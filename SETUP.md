# GlobalTrial Setup Guide

## Prerequisites
- Supabase account
- OpenAI API key
- Vercel account

## Step 1: Create Supabase Project

1. Go to [app.supabase.com](https://app.supabase.com)
2. Create a new project named "globaltrial"
3. Save the following credentials:
   - Project URL
   - Anon Key
   - Service Role Key (Settings > API)

## Step 2: Set Up Database

1. Go to SQL Editor in Supabase Dashboard
2. Run the SQL from `supabase/schema.sql`
3. The tables will be created automatically

## Step 3: Configure Environment Variables

Create a `.env.local` file in the project root:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key

# Supabase Service Role (for Edge Functions)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Step 4: Deploy Edge Functions

```bash
# Login to Supabase CLI
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Deploy the scraping function
supabase functions deploy scrape-trials
```

## Step 5: Set Up Cron Job

In Supabase Dashboard:
1. Go to Edge Functions
2. Select the `scrape-trials` function
3. Add a cron trigger (e.g., daily at midnight)

## Step 6: Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Add environment variables in Vercel Dashboard
```

## Step 7: Test the Application

1. Visit your deployed URL
2. Go to "Find a Trial"
3. Fill in patient information
4. View matched trials

## API Keys Needed

### OpenAI
Get from: https://platform.openai.com/api-keys

### Supabase
Get from: Your Supabase project dashboard > Settings > API

### Optional: Vercel
For deployment, connect your GitHub repository to Vercel