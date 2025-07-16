# Deployment Instructions for Vercel

## Prerequisites

1. A Vercel account
2. The environment variables below

## Environment Variables

Add these to your Vercel project settings:

```
NEXT_PUBLIC_SUPABASE_URL=(your supabase url)
NEXT_PUBLIC_SUPABASE_ANON_KEY=(your supabase anon key)
GROQ_API_KEY=(your groq api key)
```

Note: Get these values from:
- Supabase: Project Settings > API
- Groq: https://console.groq.com/keys

## Deploy Steps

1. Push to GitHub
2. Connect repo to Vercel
3. Add environment variables
4. Deploy

## What Users Will See

- Homepage with 47,620 searchable trials
- AI chat interface (bottom right)
- Individual trial pages with details
- 78 trials have patient-friendly eligibility

## Known Limitations

- Only ClinicalTrials.gov data (US focused)
- Most trials don't have patient-friendly text yet
- No location-based search
- No EU/WHO registry data