import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { stripeService } from '@/lib/stripe';
import Stripe from 'stripe';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  try {
    const event = stripeService.verifyWebhookSignature(body, signature);

    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;
      
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook error' }, { status: 400 });
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  console.log('Checkout completed:', session.id);
  
  if (session.metadata?.user_id && session.subscription) {
    // Update user's subscription status
    await supabase
      .from('user_subscriptions')
      .upsert({
        user_id: session.metadata.user_id,
        stripe_subscription_id: session.subscription as string,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    // Update pharma profile subscription tier
    if (session.metadata.plan_id) {
      await supabase
        .from('pharma_profiles')
        .update({
          subscription_tier: session.metadata.plan_id,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', session.metadata.user_id);
    }

    // Log activity
    await supabase.rpc('log_user_activity', {
      p_user_id: session.metadata.user_id,
      p_activity_type: 'subscription_created',
      p_activity_details: {
        plan_id: session.metadata.plan_id,
        session_id: session.id
      }
    });
  }
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  console.log('Subscription created:', subscription.id);
  
  const customerId = subscription.customer as string;
  
  // Find user by customer ID
  const { data: pharmaProfile } = await supabase
    .from('pharma_profiles')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (pharmaProfile) {
    await supabase
      .from('user_subscriptions')
      .upsert({
        user_id: pharmaProfile.user_id,
        stripe_subscription_id: subscription.id,
        status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log('Subscription updated:', subscription.id);
  
  await supabase
    .from('user_subscriptions')
    .update({
      status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('stripe_subscription_id', subscription.id);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log('Subscription deleted:', subscription.id);
  
  // Find user and reset to free tier
  const { data: userSubscription } = await supabase
    .from('user_subscriptions')
    .select('user_id')
    .eq('stripe_subscription_id', subscription.id)
    .single();

  if (userSubscription) {
    // Update subscription status
    await supabase
      .from('user_subscriptions')
      .update({
        status: 'canceled',
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', subscription.id);

    // Reset pharma profile to free tier
    await supabase
      .from('pharma_profiles')
      .update({
        subscription_tier: 'free',
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userSubscription.user_id);

    // Log activity
    await supabase.rpc('log_user_activity', {
      p_user_id: userSubscription.user_id,
      p_activity_type: 'subscription_cancelled',
      p_activity_details: {
        subscription_id: subscription.id
      }
    });
  }
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log('Payment succeeded:', invoice.id);
  
  if (invoice.subscription) {
    // Log successful payment
    const { data: userSubscription } = await supabase
      .from('user_subscriptions')
      .select('user_id')
      .eq('stripe_subscription_id', invoice.subscription as string)
      .single();

    if (userSubscription) {
      await supabase.rpc('log_user_activity', {
        p_user_id: userSubscription.user_id,
        p_activity_type: 'payment_succeeded',
        p_activity_details: {
          invoice_id: invoice.id,
          amount: invoice.amount_paid,
          currency: invoice.currency
        }
      });
    }
  }
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  console.log('Payment failed:', invoice.id);
  
  if (invoice.subscription) {
    // Log failed payment and potentially notify user
    const { data: userSubscription } = await supabase
      .from('user_subscriptions')
      .select('user_id')
      .eq('stripe_subscription_id', invoice.subscription as string)
      .single();

    if (userSubscription) {
      await supabase.rpc('log_user_activity', {
        p_user_id: userSubscription.user_id,
        p_activity_type: 'payment_failed',
        p_activity_details: {
          invoice_id: invoice.id,
          amount: invoice.amount_due,
          currency: invoice.currency
        }
      });

      // Update subscription status if payment failed
      await supabase
        .from('user_subscriptions')
        .update({
          status: 'past_due',
          updated_at: new Date().toISOString()
        })
        .eq('stripe_subscription_id', invoice.subscription as string);
    }
  }
}