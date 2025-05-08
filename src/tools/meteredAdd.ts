import { z } from "zod";
import { experimental_PaidMcpAgent as PaidMcpAgent } from "@stripe/agent-toolkit/cloudflare";
import { METERED_TOOL_PAYMENT_REASON } from "../helpers/constants";

export function meteredAddTool(
	agent: PaidMcpAgent<Env, any, any>, 
	env?: { STRIPE_METERED_PRICE_ID: string; BASE_URL: string }
) {

	const priceId = env?.STRIPE_METERED_PRICE_ID || null;
	const baseUrl = env?.BASE_URL || null;

	if (!priceId || !baseUrl) {
		throw new Error("No env provided");
	}
	
	agent.paidTool(
		"metered_add",
		{ a: z.number(), b: z.number() },
		async ({ a, b }: { a: number; b: number }) => ({
			content: [{ type: "text", text: String(a + b) }],
		}),
		{
			priceId,
			successUrl: `${baseUrl}/payment/success`,
			paymentReason: 
				"METER INFO: Your first 3 additions are free, then we charge 10 cents per addition. " 
				+ METERED_TOOL_PAYMENT_REASON,
			meterEvent: "metered_add_usage",
		}
	);
}