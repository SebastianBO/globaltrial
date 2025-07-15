# Supabase Setup Instructions

Your Supabase project is ready at: https://supabase.com/dashboard/project/wwjorfctbizdhqkpduxt

## Step 1: Create Database Tables

1. Go to the [SQL Editor](https://supabase.com/dashboard/project/wwjorfctbizdhqkpduxt/sql/new)
2. Copy and paste the entire content from `supabase/schema.sql`
3. Click "Run" to create all tables

## Step 2: Get Your API Keys

1. Go to [Settings > API](https://supabase.com/dashboard/project/wwjorfctbizdhqkpduxt/settings/api)
2. Copy these values:
   - Project URL: `https://wwjorfctbizdhqkpduxt.supabase.co`
   - Anon Key: (under "Project API keys")
   - Service Role Key: (under "Project API keys" - keep this secret!)

## Step 3: Update Environment Variables

Create a `.env.local` file in the project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://wwjorfctbizdhqkpduxt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
OPENAI_API_KEY=your_openai_api_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

## Step 4: Deploy Edge Function

The Edge Function will automatically scrape clinical trials data.