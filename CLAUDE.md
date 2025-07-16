# GlobalTrials - Claude Context

## Project Overview
GlobalTrials is building the world's first truly global, patient-centric clinical trials marketplace. We're creating a two-sided platform that connects desperate patients (seeking treatment or compensation) with pharmaceutical companies that need qualified trial participants.

### The Core Problem We're Solving
- **For Pharma**: Clinical trials fail because they can't find eligible patients (80% miss enrollment deadlines, average cost $6,533 per patient recruited)
- **For Patients**: Sick people can't find trials (scattered across registries in medical jargon) and people needing money don't know trials pay $1,000-5,000+

### Our Solution: A Global Trials Aggregator + AI Translator
1. **Aggregate ALL trials globally** (500,000+ from all major registries)
2. **AI translates medical jargon** to patient language ("heart attack" → finds "myocardial infarction" trials)
3. **Smart matching** based on condition, location, compensation needs
4. **Simple signup** for patients, pre-qualified leads for pharma

## Tech Stack
- **Frontend**: Next.js 14 with App Router, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **AI**: Groq API (Llama 3.1) for conversational intake and trial matching
- **Deployment**: Vercel (planned)

## Target Registries to Aggregate
1. **ClinicalTrials.gov** (400,000+ trials, US/Global)
   - API: JSON/XML via https://clinicaltrials.gov/api/v2/
   - Has NCT numbers, MeSH terms, contact info
2. **EU Clinical Trials Register** (30,000+ trials)
   - No API - bulk XML downloads
   - EudraCT numbers, being replaced by CTIS
3. **WHO ICTRP** (Global aggregator)
   - Links multiple registries, helps deduplicate
4. **ISRCTN** (UK-focused)
   - Limited API, bulk data available
5. **CTIS** (New EU system)
   - Replacing EUCTR, includes lay summaries

## Key Features Implemented
1. **Clinical Trials Database**: Currently 78 trials from ClinicalTrials.gov (need to scale to 500,000+)
2. **AI Eligibility Translation**: All 78 trials now have patient-friendly eligibility criteria using Groq
3. **Smart Matching**: AI analyzes patient conditions against trial eligibility
4. **MeSH Integration**: Built to map patient language → medical terms
5. **Multi-source Support**: Database schema ready for multiple registries

## Recent Progress (Jan 2025)

### 1. Production Infrastructure Built
- Created distributed job queue system for massive scraping
- Built checkpoint/resume capability for 400k+ trials
- Implemented deduplication system using NCT/EudraCT cross-references
- Set up monitoring and alerting infrastructure

### 2. AI Eligibility Translation Complete
- Successfully parsed all 78 trials with Groq AI
- Converts complex medical criteria to patient-friendly language
- Example: "Histologically confirmed adenocarcinoma" → "You must have been diagnosed by a doctor with a certain type of cancer"
- Rate-limited implementation to handle API constraints

### 3. MeSH Integration Ready
- Built full MeSH term translator (`lib/mesh-translator.ts`)
- Maps patient language ("heart attack") → medical terms ("myocardial infarction")
- 30,000+ medical terms with patient-friendly explanations
- Caches translations for performance

### 4. Multi-Registry Architecture
- Database schema supports multiple registry sources
- Built adapters for different data formats (JSON, XML)
- Deduplication logic using cross-registry IDs

## Database Schema

### Current Tables:
1. **clinical_trials**: Main trials data (with eligibility_simple for AI-translated criteria)
2. **patients**: User profiles and medical history
3. **patient_trial_matches**: Junction table with AI match scores
4. **medical_term_mappings**: Patient-to-medical term translations
5. **mesh_cache**: Cached MeSH API responses
6. **scraping_jobs**: Job queue for distributed scraping
7. **job_queue**: General job processing queue
8. **trial_duplicates**: Cross-registry duplicate detection

## Environment Variables
```
GROQ_API_KEY=(set in Vercel environment)
NEXT_PUBLIC_SUPABASE_URL=https://wwjorfctbizdhqkpduxt.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=(set in Vercel environment)
NCBI_API_KEY=(optional for higher rate limits)
```

## The Business Model

### Revenue Streams
1. **Per-Patient Recruitment Fees**
   - Pharma pays $500-2,000 per enrolled patient
   - We pre-screen and qualify leads
   
2. **Premium Pharma Subscriptions**
   - Advanced analytics dashboard
   - Priority access to new patient signups
   - Direct messaging to interested patients
   - $10k-50k/month per pharma company

3. **Anonymized Data Insights**
   - "1,000 Alzheimer's patients in Boston seeking trials"
   - Helps pharma plan trial locations
   - $100k+ annual subscriptions

### Patient Value Props
- **For desperate patients**: Find ANY trial for their condition globally
- **For cash-motivated**: See compensation upfront ($1,000-5,000+)
- **Always free** for patients
- **Simple process**: No medical jargon, instant matching

## Critical Next Steps
1. **Scale to 500,000+ trials**
   - Implement ClinicalTrials.gov full scraper
   - Add EU CTR bulk XML ingestion
   - Integrate WHO ICTRP for global coverage
   - Build ISRCTN and CTIS adapters

2. **Deduplication Engine**
   - Cross-reference NCT, EudraCT, ISRCTN numbers
   - Fuzzy match on trial titles and sponsors
   - Use WHO ICTRP linkages

3. **Patient Experience**
   - "Do I qualify?" conversational AI
   - Location-based search ("trials within 50km")
   - Compensation calculator
   - Multi-language support

4. **Pharma Dashboard**
   - Real-time recruitment pipeline
   - Geographic heat maps of interested patients
   - Conversion analytics
   - Direct patient engagement tools

## Important URLs
- Supabase Dashboard: https://supabase.com/dashboard/project/wwjorfctbizdhqkpduxt
- ClinicalTrials.gov API: https://clinicaltrials.gov/api/v2/studies
- NCBI MeSH Browser: https://www.ncbi.nlm.nih.gov/mesh/

## Development Commands
```bash
npm run dev              # Start Next.js dev server
node check-status.js     # Check system status
node monitor-scraper.js  # Monitor trial scraping
node enrich-trials-batch.js  # Add patient descriptions
node setup-database.js   # Run database setup
```

## Notes
- MCP tools require Claude restart after `.mcp.json` changes
- Supabase functions have 10min timeout limit
- NCBI API: 3 requests/second without key, 10/second with key
- Trial matching uses Groq's llama-3.1-8b-instant model