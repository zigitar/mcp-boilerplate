import { z } from "zod";
import { experimental_PaidMcpAgent as PaidMcpAgent } from "@stripe/agent-toolkit/cloudflare";
import { REUSABLE_PAYMENT_REASON } from "../helpers/constants";

export function subscriptionTool(
	agent: PaidMcpAgent<Env, any, any>, 
	env?: { STRIPE_PRICE_ID: string; BASE_URL: string }
) {

	const priceId = env?.STRIPE_PRICE_ID || null;
	const baseUrl = env?.BASE_URL || null;

	if (!priceId || !baseUrl) {
		throw new Error("No env provided");
	}
	
	agent.paidTool(
		"subscription_add",
		{ a: z.number(), b: z.number() },
		async ({ a, b }: { a: number; b: number }) => ({
			content: [{ type: "text", text: String(a + b) }],
		}),
		{
			priceId,
			successUrl: `${baseUrl}/payment/success`,
			paymentReason: REUSABLE_PAYMENT_REASON,
		}
	);
}