# GlobalTrials Setup Guide

## Environment Variables

You need to add the following environment variables to your `.env.local` file:

```bash
# Required
GROQ_API_KEY=your_groq_api_key_here
NEXT_PUBLIC_SUPABASE_URL=https://wwjorfctbizdhqkpduxt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# Optional (add these as you get the API keys)
STRIPE_SECRET_KEY=your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret_here
STRIPE_BASIC_PRICE_ID=your_stripe_basic_price_id_here
STRIPE_PROFESSIONAL_PRICE_ID=your_stripe_professional_price_id_here
STRIPE_ENTERPRISE_PRICE_ID=your_stripe_enterprise_price_id_here
RESEND_API_KEY=your_resend_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
NCBI_API_KEY=your_ncbi_api_key_here
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Vercel Deployment

1. Push to GitHub (already done)
2. Connect your GitHub repo to Vercel
3. Add environment variables in Vercel dashboard:
   - Go to Project Settings > Environment Variables
   - Add each variable from the list above
   - **IMPORTANT**: Add SUPABASE_SERVICE_ROLE_KEY for API routes to work
4. Deploy!

## Local Development

```bash
npm install
npm run dev
```

The app will be available at http://localhost:3000