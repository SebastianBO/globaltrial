-- Add compensation and urgency_level columns to clinical_trials table
ALTER TABLE clinical_trials 
ADD COLUMN IF NOT EXISTS compensation JSONB,
ADD COLUMN IF NOT EXISTS urgency_level VARCHAR(20) DEFAULT 'standard';

-- Add check constraint for urgency_level
ALTER TABLE clinical_trials
ADD CONSTRAINT check_urgency_level 
CHECK (urgency_level IN ('critical', 'high', 'standard'));