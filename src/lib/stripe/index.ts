import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_51dummy", {
    typescript: true,
});

/**
 * Creates a Stripe Checkout session for subscription
 */
export async function createCheckoutSession({
    priceId,
    customerId,
    successUrl,
    cancelUrl,
}: {
    priceId: string;
    customerId?: string;
    successUrl: string;
    cancelUrl: string;
}) {
    return stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        customer: customerId,
        success_url: successUrl,
        cancel_url: cancelUrl,
        allow_promotion_codes: true,
    });
}

/**
 * Creates a Stripe Customer Portal session
 */
export async function createPortalSession({
    customerId,
    returnUrl,
}: {
    customerId: string;
    returnUrl: string;
}) {
    return stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
    });
}

/**
 * Gets or creates a Stripe customer for a user
 */
export async function getOrCreateCustomer({
    email,
    name,
    userId,
}: {
    email: string;
    name?: string;
    userId: string;
}) {
    const existingCustomers = await stripe.customers.list({
        email,
        limit: 1,
    });

    if (existingCustomers.data.length > 0) {
        return existingCustomers.data[0];
    }

    return stripe.customers.create({
        email,
        name: name || undefined,
        metadata: { supabase_user_id: userId },
    });
}
