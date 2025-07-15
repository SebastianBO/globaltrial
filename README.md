# GlobalTrial - AI Clinical Trial Matching Platform

GlobalTrial is an AI-powered platform that matches patients with relevant clinical trials from ClinicalTrials.gov and EMA databases.

## Features

- AI-powered matching algorithm using OpenAI
- Patient intake form with medical history
- Real-time clinical trial database
- Match scoring and explanations
- Automated trial data scraping via Supabase Edge Functions

## Setup Instructions

### 1. Supabase Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the schema from `supabase/schema.sql`
3. Get your project URL and anon key from Settings > API

### 2. Environment Variables

Create a `.env.local` file with:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
OPENAI_API_KEY=your_openai_api_key
```

### 3. Deploy Edge Function

Deploy the trial scraping function:

```bash
supabase functions deploy scrape-trials
```

Set up a cron job in Supabase to run this function periodically.

### 4. Install Dependencies

```bash
npm install
```

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Deployment to Vercel

1. Push your code to GitHub
2. Connect your GitHub repo to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

## Architecture

- **Next.js 15** with App Router
- **Supabase** for database and auth
- **OpenAI GPT-4** for AI matching
- **Tailwind CSS** for styling
- **TypeScript** for type safety

## Database Schema

- `clinical_trials` - Stores trial information
- `patients` - Patient profiles and medical history  
- `patient_trial_matches` - AI-generated matches with scores

## API Endpoints

- `POST /api/match-trials` - Runs AI matching for a patient
