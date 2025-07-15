-- Create enum for trial status
CREATE TYPE trial_status AS ENUM ('recruiting', 'active', 'completed', 'suspended', 'terminated', 'withdrawn');

-- Create enum for patient match status
CREATE TYPE match_status AS ENUM ('pending', 'matched', 'applied', 'accepted', 'rejected');

-- Clinical trials table
CREATE TABLE clinical_trials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trial_id VARCHAR(50) UNIQUE NOT NULL, -- NCT number or EMA identifier
    title TEXT NOT NULL,
    description TEXT,
    conditions TEXT[], -- Array of conditions being studied
    interventions TEXT[], -- Array of interventions/treatments
    sponsor VARCHAR(255),
    status trial_status DEFAULT 'recruiting',
    phase VARCHAR(50), -- Phase 1, 2, 3, 4
    start_date DATE,
    completion_date DATE,
    eligibility_criteria JSONB, -- Structured eligibility data
    locations JSONB[], -- Array of location objects
    contact_info JSONB,
    source VARCHAR(50), -- 'clinicaltrials.gov' or 'ema'
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Patients table
CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    conditions TEXT[], -- Patient's medical conditions
    age INTEGER,
    gender VARCHAR(20),
    location JSONB, -- {country, state, city}
    medical_history TEXT,
    current_medications TEXT[],
    preferences JSONB, -- Trial preferences
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Patient-Trial matches table
CREATE TABLE patient_trial_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    trial_id UUID REFERENCES clinical_trials(id) ON DELETE CASCADE,
    match_score DECIMAL(3,2), -- 0.00 to 1.00
    match_reasons JSONB, -- Detailed matching criteria
    status match_status DEFAULT 'pending',
    patient_interest BOOLEAN DEFAULT NULL,
    applied_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(patient_id, trial_id)
);

-- Create indexes for better query performance
CREATE INDEX idx_clinical_trials_conditions ON clinical_trials USING GIN (conditions);
CREATE INDEX idx_clinical_trials_status ON clinical_trials(status);
CREATE INDEX idx_patients_conditions ON patients USING GIN (conditions);
CREATE INDEX idx_matches_patient ON patient_trial_matches(patient_id);
CREATE INDEX idx_matches_trial ON patient_trial_matches(trial_id);
CREATE INDEX idx_matches_status ON patient_trial_matches(status);

-- Enable Row Level Security
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_trial_matches ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (adjust based on your auth strategy)
CREATE POLICY "Users can view their own data" ON patients
    FOR ALL USING (auth.uid()::text = id::text);

CREATE POLICY "Users can view their own matches" ON patient_trial_matches
    FOR ALL USING (
        patient_id IN (
            SELECT id FROM patients WHERE auth.uid()::text = id::text
        )
    );