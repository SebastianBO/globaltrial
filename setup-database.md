# Database Setup Instructions

The Edge Function is deployed and working! Now we need to create the database tables.

## Quick Setup:

1. **Open SQL Editor**: https://supabase.com/dashboard/project/wwjorfctbizdhqkpduxt/sql/new

2. **Copy and paste this entire SQL script**:

```sql
-- Create enum for trial status
CREATE TYPE trial_status AS ENUM ('recruiting', 'active', 'completed', 'suspended', 'terminated', 'withdrawn');

-- Create enum for patient match status
CREATE TYPE match_status AS ENUM ('pending', 'matched', 'applied', 'accepted', 'rejected');

-- Clinical trials table
CREATE TABLE clinical_trials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trial_id VARCHAR(50) UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    conditions TEXT[],
    interventions TEXT[],
    sponsor VARCHAR(255),
    status trial_status DEFAULT 'recruiting',
    phase VARCHAR(50),
    start_date DATE,
    completion_date DATE,
    eligibility_criteria JSONB,
    locations JSONB[],
    contact_info JSONB,
    source VARCHAR(50),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Patients table
CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    conditions TEXT[],
    age INTEGER,
    gender VARCHAR(20),
    location JSONB,
    medical_history TEXT,
    current_medications TEXT[],
    preferences JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Patient-Trial matches table
CREATE TABLE patient_trial_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    trial_id UUID REFERENCES clinical_trials(id) ON DELETE CASCADE,
    match_score DECIMAL(3,2),
    match_reasons JSONB,
    status match_status DEFAULT 'pending',
    patient_interest BOOLEAN DEFAULT NULL,
    applied_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(patient_id, trial_id)
);

-- Create indexes
CREATE INDEX idx_clinical_trials_conditions ON clinical_trials USING GIN (conditions);
CREATE INDEX idx_clinical_trials_status ON clinical_trials(status);
CREATE INDEX idx_patients_conditions ON patients USING GIN (conditions);
CREATE INDEX idx_matches_patient ON patient_trial_matches(patient_id);
CREATE INDEX idx_matches_trial ON patient_trial_matches(trial_id);
CREATE INDEX idx_matches_status ON patient_trial_matches(status);

-- Enable Row Level Security
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_trial_matches ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own data" ON patients
    FOR ALL USING (auth.uid()::text = id::text);

CREATE POLICY "Users can view their own matches" ON patient_trial_matches
    FOR ALL USING (
        patient_id IN (
            SELECT id FROM patients WHERE auth.uid()::text = id::text
        )
    );
```

3. **Click "Run"** to create all tables

4. **Verify tables were created**: 
   - Go to Table Editor: https://supabase.com/dashboard/project/wwjorfctbizdhqkpduxt/editor
   - You should see: clinical_trials, patients, patient_trial_matches

## After Creating Tables:

Run the scraping function again to populate the database with clinical trials:
```bash
node test-scraping.js
```

## Environment Variables for Vercel:

Add these to your Vercel project:
- NEXT_PUBLIC_SUPABASE_URL = https://wwjorfctbizdhqkpduxt.supabase.co
- NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3am9yZmN0Yml6ZGhxa3BkdXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1ODMwMzksImV4cCI6MjA2ODE1OTAzOX0.PW5ZRSQsK9ij97v4xg7FLQPXEwmxtZC_Zlxdx3dJKnY
- OPENAI_API_KEY = (your OpenAI key)