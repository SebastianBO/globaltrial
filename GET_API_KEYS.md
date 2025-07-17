# Getting API Keys for GlobalTrials

## Required Keys

### 1. Supabase Service Role Key ⚠️ REQUIRED
- Go to: https://supabase.com/dashboard/project/wwjorfctbizdhqkpduxt/settings/api
- Copy the `service_role` key (under "Project API keys")
- Add to `.env.local`: `SUPABASE_SERVICE_ROLE_KEY=your_key_here`

## Optional but Recommended

### 2. NCBI API Key (For faster MeSH lookups)
- Sign up: https://www.ncbi.nlm.nih.gov/account/
- Go to Account Settings → API Key Management
- Generate new key
- Add to `.env.local`: `NCBI_API_KEY=your_key_here`
- Benefit: 10 requests/second instead of 3

### 3. Google Maps API (For trial locations)
- Go to: https://console.cloud.google.com/
- Create new project
- Enable APIs: Maps JavaScript API, Geocoding API
- Create credentials → API key
- Add to `.env.local`: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_key_here`
- Important: Restrict key to your domains!

### 4. OpenAI API (For vector search)
- Get key: https://platform.openai.com/api-keys
- Add to `.env.local`: `OPENAI_API_KEY=your_key_here`
- Enables semantic trial matching

### 5. Resend API (For email notifications)
- Sign up: https://resend.com/
- Free: 3,000 emails/month
- Add to `.env.local`: `RESEND_API_KEY=your_key_here`

### 6. Stripe API (For payments)
- Sign up: https://stripe.com/
- Test keys: https://dashboard.stripe.com/test/apikeys
- Add to `.env.local`:
  ```
  STRIPE_SECRET_KEY=sk_test_...
  STRIPE_WEBHOOK_SECRET=whsec_...
  STRIPE_BASIC_PRICE_ID=price_...
  STRIPE_PROFESSIONAL_PRICE_ID=price_...
  STRIPE_ENTERPRISE_PRICE_ID=price_...
  ```

## International Registry Data

### WHO ICTRP (Manual download)
1. Go to: https://www.who.int/clinical-trials-registry-platform/the-ictrp-search-portal
2. Click "Download" → "ICTRP Search Portal datasets"
3. Download the weekly export (ICTRPWeek[date].zip)
4. Place in: `/data/who-ictrp/`
5. Run: `node lib/scraper/who-ictrp-scraper.ts`

### EU Clinical Trials Register
1. Visit: https://www.clinicaltrialsregister.eu/
2. Look for bulk download option
3. Download XML files
4. Run: `node lib/scraper/eu-ctr-bulk-scraper.ts`

### Other Registries
- ISRCTN (UK): Automatic scraping, no key needed
- CTIS (New EU): Automatic scraping, no key needed
- Run: `node run-international-scrapers.js`

## Vercel Environment Variables

Add all keys to Vercel:
```bash
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add NCBI_API_KEY production
vercel env add OPENAI_API_KEY production
# etc...
```

## Testing Your Setup

1. Check API connections:
   ```bash
   node check-status.js
   ```

2. Test trial import:
   ```bash
   node lib/scraper/clinical-trials-scraper.ts --limit 10
   ```

3. Test international import:
   ```bash
   node run-international-scrapers.js
   ```

## Priority Order

1. **First**: Get Supabase service role key (required)
2. **Second**: NCBI key (improves MeSH performance)
3. **Third**: Google Maps (enables location features)
4. **Later**: OpenAI, Resend, Stripe (for advanced features)

## Cost Estimates

- **Supabase**: Free tier sufficient for start
- **NCBI**: Free
- **Google Maps**: $200 free credit, then ~$5/1000 geocoding requests
- **OpenAI**: ~$0.10/1000 embeddings
- **Resend**: Free for 3,000 emails/month
- **Stripe**: 2.9% + $0.30 per transaction

## Security Notes

⚠️ **NEVER commit API keys to Git!**
- Use `.env.local` (already in .gitignore)
- Add to Vercel environment variables for production
- Rotate keys regularly
- Use API key restrictions where possible