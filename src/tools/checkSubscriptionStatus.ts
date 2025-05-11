import { z } from "zod";
import { experimental_PaidMcpAgent as PaidMcpAgent } from "@stripe/agent-toolkit/cloudflare";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function checkSubscriptionStatusTool(
	agent: PaidMcpAgent<Env, any, any>,
	env: { BASE_URL: string } // BASE_URL is needed for the billing portal return URL
) {
	const baseUrl = env.BASE_URL;

	(agent.server as McpServer).tool(
		"check_user_subscription_status",
		"This tool checks for active subscriptions and the status of the logged in user's Stripe customer ID.",
		{},
		async () => {
			let responseData: {
				userEmail?: string | null;
				stripeCustomerId?: string | null;
				subscriptions?: Array<{
					id: string;
					status: string;
					items: Array<{ productName: string; productId: string; }>;
					current_period_end?: number;
					cancel_at_period_end?: boolean;
					cancel_at?: number | null;
					ended_at?: number | null;
				}>;
				billingPortal?: { url: string | null; message: string; };
				statusMessage?: string;
				error?: string;
				isError?: boolean;
				agentInstructions?: string;
			} = {};

			try {
				let userEmail = agent.props?.userEmail;
				const customerId = await agent.getCurrentCustomerID();

				if (!userEmail && customerId) {
					try {
						const customer = await agent.stripe().customers.retrieve(customerId);
						if (customer && !customer.deleted && 'email' in customer && customer.email) {
							userEmail = customer.email;
						}
					} catch (e) {
						// console.error("Error retrieving customer details from Stripe to get email:", e);
						// Non-fatal, proceed without email if retrieval fails
					}
				}
				responseData.userEmail = userEmail || null;

				if (!customerId) {
					responseData.statusMessage = "Could not identify your Stripe customer ID. Have you previously interacted with a paid feature or logged in?";
					responseData.isError = true;
					return {
						content: [{ type: "text", text: JSON.stringify(responseData, null, 2) }],
					};
				}
				responseData.stripeCustomerId = customerId;

				const stripe = agent.stripe();
				const subscriptionsData = await stripe.subscriptions.list({
					customer: customerId,
					status: 'active',
					limit: 10,
				});

				responseData.subscriptions = [];
				if (subscriptionsData.data.length > 0) {
					responseData.statusMessage = `Found ${subscriptionsData.data.length} active subscription(s).`;
					for (const sub of subscriptionsData.data) {
						const subscriptionOutput: {
							id: string;
							status: string;
							items: Array<{ productName: string; productId: string; }>;
							current_period_end?: number;
							cancel_at_period_end?: boolean;
							cancel_at?: number | null;
							ended_at?: number | null;
						} = {
							id: sub.id,
							status: sub.status,
							items: [],
							current_period_end: sub.current_period_end,
							cancel_at_period_end: sub.cancel_at_period_end,
							cancel_at: sub.cancel_at,
							ended_at: sub.ended_at,
						};
						for (const item of sub.items.data) {
							let productName = 'Unknown Product';
							let productId = 'N/A';
							if (typeof item.price.product === 'string') {
								productId = item.price.product;
								try {
									const product = await stripe.products.retrieve(item.price.product);
									// console.log("Retrieved product details:", JSON.stringify(product, null, 2));
									if (product && product.name) {
										productName = product.name;
									}
								} catch (e: any) {
									// console.error(`Error retrieving product details for ID ${item.price.product}:`, e);
									productName = `Could not retrieve product name (ID: ${item.price.product}, Error: ${e.message})`;
								}
							}
							subscriptionOutput.items.push({ productName, productId });
						}
						responseData.subscriptions.push(subscriptionOutput);
					}
				} else {
					responseData.statusMessage = "No active subscriptions found.";
				}

				responseData.billingPortal = { url: null, message: "" };
				if (baseUrl) {
					try {
						const portalSession = await stripe.billingPortal.sessions.create({
							customer: customerId,
							return_url: `${baseUrl}/`,
						});
						if (portalSession.url) {
							responseData.billingPortal.url = portalSession.url;
							responseData.billingPortal.message = "Manage your billing and subscriptions here.";
						} else {
							responseData.billingPortal.message = "Could not retrieve billing portal URL, but session creation was reported as successful.";
						}
					} catch (portalError: any) {
						// console.error("Error creating Stripe billing portal session:", portalError.message);
						if (portalError.message && portalError.message.includes("No configuration provided")) {
							responseData.billingPortal.message = `Could not generate a link to the customer billing portal: ${portalError.message}`;
						} else {
							responseData.billingPortal.message = "Could not generate a link to the customer billing portal at this time due to an unexpected error.";
						}
					}
				} else {
					responseData.billingPortal.message = "Billing portal link could not be generated: BASE_URL is not configured.";
				}

				// Construct agent instructions
				let anySubscriptionEndingOrCancelled = false;
				if (responseData.subscriptions && responseData.subscriptions.length > 0) {
					for (const sub of responseData.subscriptions) {
						// A subscription is considered "ending or cancelled" if:
						// 1. It's explicitly set to cancel at period end.
						// 2. Or, its status is not 'active' AND it has an ended_at date (this covers already past-due/cancelled subs
						//    if they were somehow fetched, though less likely with 'status: active' filter).
						if (sub.cancel_at_period_end || (sub.status !== 'active' && sub.ended_at)) {
							anySubscriptionEndingOrCancelled = true;
							break;
						}
					}
				}

				let agentInstructionText = "AI_AGENT_ACTION: Present the user\'s subscription details (userEmail, subscriptions) in Markdown format. Do NOT display the stripeCustomerId or the productId for subscription items. " +
					"For each subscription, clearly state its status and product name. " +
					"If the subscription has an end date (from 'ended_at'), mention it. " +
					"If it\'s set to cancel (from 'cancel_at_period_end' is true and 'cancel_at' is set), state the cancellation date. " +
					"Otherwise, if it\'s active, state its renewal date (from 'current_period_end'). " +
					"All relevant dates are provided as Unix timestamps in the subscription data; please convert them to a human-readable format (e.g., YYYY-MM-DD or Month Day, Year) when presenting to the user. ";

				if (responseData.billingPortal?.url) {
					if (anySubscriptionEndingOrCancelled) {
						agentInstructionText += `Some subscriptions are ending or have been cancelled. You can manage or potentially renew them at the billing portal. Ask the user: 'Would you like to open the billing portal to manage your subscriptions?' `;
					} else {
						agentInstructionText += `A billing portal is available. Ask the user: 'Would you like to open the billing portal?' `;
					}
					agentInstructionText += `If they respond affirmatively, run the appropriate command for their OS to open the URL ${responseData.billingPortal.url} in their default browser.`;
				} else if (responseData.billingPortal?.message) {
					agentInstructionText += `Inform the user about the billing portal status: '${responseData.billingPortal.message}'.`;
				} else {
					agentInstructionText += "Inform the user that no billing portal information is available.";
				}
				responseData.agentInstructions = agentInstructionText;

				return {
					content: [{ type: "text", text: JSON.stringify(responseData, null, 2) }],
				};

			} catch (error: any) {
				// console.error("Error in checkPaymentStatusTool:", error.message);
				responseData = { // Overwrite responseData for a clean error output
					error: `An error occurred while checking payment status: ${error.message}`,
					isError: true,
					// Optional: Add a generic agent instruction for errors
					// agentInstructions: "AI_AGENT_ACTION: Inform the user that an error occurred while checking their payment status."
				};
				return {
					content: [{ type: "text", text: JSON.stringify(responseData, null, 2) }],
				};
			}
		}
	);
}