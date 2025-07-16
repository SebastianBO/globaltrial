# GlobalTrials

A global clinical trials search platform that aggregates trials from multiple registries and uses AI to translate medical jargon into patient-friendly language.

## Current Status

- ✅ **47,620 clinical trials** scraped from ClinicalTrials.gov
- ✅ **AI-powered chat** for patient intake (Groq)
- ✅ **78 trials** with patient-friendly eligibility criteria
- 🚧 **EU/WHO registries** - not yet integrated
- 🚧 **Location-based search** - not yet implemented
- 🚧 **AI translation** for remaining 47k trials - pending

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **AI**: Groq (Llama 3.1)
- **Deployment**: Vercel

## Local Development

```bash
npm install
npm run dev
```

## Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=https://wwjorfctbizdhqkpduxt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3am9yZmN0Yml6ZGhxa3BkdXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1ODMwMzksImV4cCI6MjA2ODE1OTAzOX0.PW5ZRSQsK9ij97v4xg7FLQPXEwmxtZC_Zlxdx3dJKnY
GROQ_API_KEY=your_groq_key_here
```

## Features

- Browse 47,620 clinical trials
- Search by condition
- AI chat interface for finding trials
- View detailed trial information
- Patient-friendly eligibility criteria (78 trials)

## Next Steps

1. Complete AI translation for all trials
2. Add EU Clinical Trials Register
3. Integrate WHO ICTRP
4. Add location-based search
5. Build pharma dashboard