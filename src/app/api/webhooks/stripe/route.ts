import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    const body = await req.text();
    const headersList = await headers();
    const signature = headersList.get("Stripe-Signature")!;

    let event;

    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET!
        );
    } catch (err) {
        console.error("Webhook signature verification failed:", err);
        return NextResponse.json(
            { error: "Webhook signature verification failed" },
            { status: 400 }
        );
    }

    const supabase = await createClient();

    switch (event.type) {
        case "checkout.session.completed": {
            const session = event.data.object;
            const userId = session.metadata?.supabase_user_id;

            if (userId) {
                await supabase
                    .from("subscriptions")
                    .upsert({
                        user_id: userId,
                        stripe_customer_id: session.customer as string,
                        stripe_subscription_id: session.subscription as string,
                        status: "active",
                        plan: session.metadata?.plan || "pro",
                    });
            }
            break;
        }

        case "customer.subscription.updated": {
            const subscription = event.data.object;
            const periodEnd = (subscription as unknown as Record<string, unknown>).current_period_end;
            await supabase
                .from("subscriptions")
                .update({
                    status: subscription.status,
                    ...(typeof periodEnd === "number"
                        ? { current_period_end: new Date(periodEnd * 1000).toISOString() }
                        : {}),
                })
                .eq("stripe_subscription_id", subscription.id);
            break;
        }

        case "customer.subscription.deleted": {
            const subscription = event.data.object;
            await supabase
                .from("subscriptions")
                .update({ status: "canceled" })
                .eq("stripe_subscription_id", subscription.id);
            break;
        }

        default:
            console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
}
