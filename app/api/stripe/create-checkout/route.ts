import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { stripeService, PRICING_PLANS } from '@/lib/stripe';

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { planId } = await request.json();

    // Verify user is authenticated
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('user_type, first_name, last_name')
      .eq('id', session.user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Only pharma users can purchase subscriptions
    if (profile.user_type !== 'pharma') {
      return NextResponse.json({ error: 'Only pharma accounts can purchase subscriptions' }, { status: 403 });
    }

    // Check if plan exists
    const plan = PRICING_PLANS[planId];
    if (!plan || !plan.stripePriceId) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    // Get or create Stripe customer
    let customerId: string;
    
    const { data: pharmaProfile } = await supabase
      .from('pharma_profiles')
      .select('stripe_customer_id, company_name')
      .eq('user_id', session.user.id)
      .single();

    if (pharmaProfile?.stripe_customer_id) {
      customerId = pharmaProfile.stripe_customer_id;
    } else {
      // Create new Stripe customer
      const customer = await stripeService.createCustomer(
        session.user.email!,
        pharmaProfile?.company_name || `${profile.first_name} ${profile.last_name}`,
        {
          user_id: session.user.id,
          user_type: 'pharma'
        }
      );
      
      customerId = customer.id;
      
      // Save customer ID
      await supabase
        .from('pharma_profiles')
        .update({ stripe_customer_id: customerId })
        .eq('user_id', session.user.id);
    }

    // Create checkout session
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const successUrl = `${baseUrl}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/pricing?checkout=cancelled`;

    const checkoutSession = await stripeService.createCheckoutSession(
      customerId,
      plan.stripePriceId!,
      successUrl,
      cancelUrl,
      {
        user_id: session.user.id,
        plan_id: planId
      }
    );

    return NextResponse.json({ 
      url: checkoutSession.url,
      sessionId: checkoutSession.id 
    });

  } catch (error) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}