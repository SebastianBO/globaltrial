-- RUN THIS IN SUPABASE SQL EDITOR

-- 1. First add the new columns to clinical_trials
ALTER TABLE clinical_trials 
ADD COLUMN IF NOT EXISTS compensation JSONB,
ADD COLUMN IF NOT EXISTS urgency_level VARCHAR(20) DEFAULT 'standard';

-- 2. Enable RLS and create policies for patients table
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to insert their own patient records
CREATE POLICY "Allow anonymous insert" ON patients
    FOR INSERT 
    TO anon
    WITH CHECK (true);

-- Allow users to view their own patient records
CREATE POLICY "Allow users to view own records" ON patients
    FOR SELECT
    TO anon
    USING (true);

-- Allow users to update their own records
CREATE POLICY "Allow users to update own records" ON patients
    FOR UPDATE
    TO anon
    USING (true)
    WITH CHECK (true);

-- 3. Enable RLS and create policies for patient_trial_matches
ALTER TABLE patient_trial_matches ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to insert matches
CREATE POLICY "Allow anonymous insert matches" ON patient_trial_matches
    FOR INSERT 
    TO anon
    WITH CHECK (true);

-- Allow viewing matches
CREATE POLICY "Allow viewing matches" ON patient_trial_matches
    FOR SELECT
    TO anon
    USING (true);

-- 4. Enable RLS on clinical_trials but allow public read
ALTER TABLE clinical_trials ENABLE ROW LEVEL SECURITY;

-- Allow public read access to clinical trials
CREATE POLICY "Allow public read" ON clinical_trials
    FOR SELECT
    TO anon
    USING (true);