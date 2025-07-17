import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});

export interface PricingPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  interval: 'month' | 'year';
  features: string[];
  limits: {
    searches: number;
    contacts: number;
    apiCalls?: number;
    exports?: number;
  };
  popular?: boolean;
  stripePriceId?: string;
}

export const PRICING_PLANS: Record<string, PricingPlan> = {
  free: {
    id: 'free',
    name: 'Free',
    description: 'Perfect for getting started',
    price: 0,
    interval: 'month',
    features: [
      'Basic patient search',
      'Limited contact requests',
      'Standard support',
      'Basic analytics'
    ],
    limits: {
      searches: 100,
      contacts: 10
    }
  },
  basic: {
    id: 'basic',
    name: 'Basic',
    description: 'For growing recruitment needs',
    price: 99,
    interval: 'month',
    features: [
      'Advanced patient search',
      'Enhanced analytics',
      'Email support',
      'Data export',
      'Custom filters'
    ],
    limits: {
      searches: 1000,
      contacts: 100,
      exports: 50
    },
    stripePriceId: process.env.STRIPE_BASIC_PRICE_ID
  },
  professional: {
    id: 'professional',
    name: 'Professional',
    description: 'For serious clinical research teams',
    price: 299,
    interval: 'month',
    features: [
      'API access',
      'Priority support',
      'Custom reports',
      'Advanced integrations',
      'Bulk operations',
      'Dedicated account manager'
    ],
    limits: {
      searches: 5000,
      contacts: 500,
      apiCalls: 10000,
      exports: 200
    },
    popular: true,
    stripePriceId: process.env.STRIPE_PROFESSIONAL_PRICE_ID
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For large organizations',
    price: 999,
    interval: 'month',
    features: [
      'Unlimited access',
      'White-label options',
      'Custom integrations',
      'SLA guarantee',
      'On-premise deployment',
      '24/7 dedicated support'
    ],
    limits: {
      searches: -1, // Unlimited
      contacts: -1, // Unlimited
      apiCalls: -1, // Unlimited
      exports: -1 // Unlimited
    },
    stripePriceId: process.env.STRIPE_ENTERPRISE_PRICE_ID
  }
};

export class StripeService {
  /**
   * Create a Stripe customer
   */
  async createCustomer(email: string, name: string, metadata?: Record<string, string>): Promise<Stripe.Customer> {
    return await stripe.customers.create({
      email,
      name,
      metadata: metadata || {}
    });
  }

  /**
   * Create a subscription
   */
  async createSubscription(
    customerId: string,
    priceId: string,
    metadata?: Record<string, string>
  ): Promise<Stripe.Subscription> {
    return await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
      metadata: metadata || {}
    });
  }

  /**
   * Create a checkout session
   */
  async createCheckoutSession(
    customerId: string,
    priceId: string,
    successUrl: string,
    cancelUrl: string,
    metadata?: Record<string, string>
  ): Promise<Stripe.Checkout.Session> {
    return await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: metadata || {},
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      tax_id_collection: {
        enabled: true,
      },
    });
  }

  /**
   * Create a billing portal session
   */
  async createBillingPortalSession(
    customerId: string,
    returnUrl: string
  ): Promise<Stripe.BillingPortal.Session> {
    return await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return await stripe.subscriptions.cancel(subscriptionId);
  }

  /**
   * Update subscription
   */
  async updateSubscription(
    subscriptionId: string,
    newPriceId: string
  ): Promise<Stripe.Subscription> {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    return await stripe.subscriptions.update(subscriptionId, {
      items: [
        {
          id: subscription.items.data[0].id,
          price: newPriceId,
        },
      ],
      payment_behavior: 'pending_if_incomplete',
    });
  }

  /**
   * Get customer subscriptions
   */
  async getCustomerSubscriptions(customerId: string): Promise<Stripe.Subscription[]> {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      expand: ['data.default_payment_method'],
    });
    
    return subscriptions.data;
  }

  /**
   * Get subscription usage
   */
  async getSubscriptionUsage(subscriptionId: string): Promise<any> {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['items.data.price.product'],
    });

    // For usage-based billing, you would retrieve usage records here
    // This is a simplified version for demonstration
    return {
      subscription,
      usage: {
        searches: 0,
        contacts: 0,
        apiCalls: 0
      }
    };
  }

  /**
   * Create usage record (for usage-based billing)
   */
  async createUsageRecord(
    subscriptionItemId: string,
    quantity: number,
    timestamp?: number
  ): Promise<Stripe.UsageRecord> {
    return await stripe.subscriptionItems.createUsageRecord(subscriptionItemId, {
      quantity,
      timestamp: timestamp || Math.floor(Date.now() / 1000),
      action: 'increment',
    });
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): Stripe.Event {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
    return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  }

  /**
   * Get invoice by ID
   */
  async getInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    return await stripe.invoices.retrieve(invoiceId);
  }

  /**
   * Create payment intent
   */
  async createPaymentIntent(
    amount: number,
    currency: string = 'usd',
    customerId?: string,
    metadata?: Record<string, string>
  ): Promise<Stripe.PaymentIntent> {
    return await stripe.paymentIntents.create({
      amount,
      currency,
      customer: customerId,
      metadata: metadata || {},
      automatic_payment_methods: {
        enabled: true,
      },
    });
  }
}

export const stripeService = new StripeService();