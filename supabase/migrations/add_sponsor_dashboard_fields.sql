-- Add sponsor dashboard enhancement fields to clinical_trials table
ALTER TABLE clinical_trials
ADD COLUMN IF NOT EXISTS compensation JSONB DEFAULT '{"amount": 0, "currency": "USD", "per_visit": 0, "visits_estimated": 0}',
ADD COLUMN IF NOT EXISTS urgency VARCHAR(20) DEFAULT 'normal' CHECK (urgency IN ('low', 'normal', 'high', 'critical')),
ADD COLUMN IF NOT EXISTS boost_visibility BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS enrollment_target INTEGER,
ADD COLUMN IF NOT EXISTS current_enrollment INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS boost_compensation_amount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS boost_expires_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS sponsor_notes TEXT;

-- Create sponsor_analytics table for tracking views and engagement
CREATE TABLE IF NOT EXISTS sponsor_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trial_id UUID REFERENCES clinical_trials(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL, -- 'view', 'interest', 'apply', 'contact'
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_clinical_trials_sponsor ON clinical_trials(sponsor);
CREATE INDEX IF NOT EXISTS idx_clinical_trials_boost_visibility ON clinical_trials(boost_visibility) WHERE boost_visibility = TRUE;
CREATE INDEX IF NOT EXISTS idx_clinical_trials_urgency ON clinical_trials(urgency);
CREATE INDEX IF NOT EXISTS idx_sponsor_analytics_trial_id ON sponsor_analytics(trial_id);
CREATE INDEX IF NOT EXISTS idx_sponsor_analytics_event_type ON sponsor_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_sponsor_analytics_created_at ON sponsor_analytics(created_at);

-- Add RLS policies for sponsor_analytics
ALTER TABLE sponsor_analytics ENABLE ROW LEVEL SECURITY;

-- Policy for reading analytics (sponsors can see their own trial analytics)
CREATE POLICY "Sponsors can view their trial analytics" ON sponsor_analytics
  FOR SELECT
  USING (
    trial_id IN (
      SELECT id FROM clinical_trials 
      WHERE sponsor = current_setting('app.current_sponsor', TRUE)
    )
  );

-- Policy for inserting analytics (system can insert)
CREATE POLICY "System can insert analytics" ON sponsor_analytics
  FOR INSERT
  WITH CHECK (TRUE);

-- Create a view for sponsor dashboard metrics
CREATE OR REPLACE VIEW sponsor_dashboard_metrics AS
SELECT 
  ct.sponsor,
  COUNT(DISTINCT ct.id) as total_trials,
  COUNT(DISTINCT ct.id) FILTER (WHERE ct.status = 'recruiting') as recruiting_trials,
  COUNT(DISTINCT ct.id) FILTER (WHERE ct.status = 'completed') as completed_trials,
  COUNT(DISTINCT ptm.id) as total_matches,
  COUNT(DISTINCT ptm.id) FILTER (WHERE ptm.patient_interest = TRUE) as interested_patients,
  COUNT(DISTINCT ptm.id) FILTER (WHERE ptm.status = 'applied') as applied_patients,
  AVG(ptm.match_score) as avg_match_score,
  COUNT(DISTINCT ct.id) FILTER (WHERE ct.urgency = 'high' OR ct.urgency = 'critical') as urgent_trials,
  COUNT(DISTINCT ct.id) FILTER (WHERE ct.boost_visibility = TRUE) as boosted_trials
FROM clinical_trials ct
LEFT JOIN patient_trial_matches ptm ON ct.id = ptm.trial_id
GROUP BY ct.sponsor;

-- Add some sample data for testing
UPDATE clinical_trials 
SET 
  compensation = jsonb_build_object(
    'amount', (RANDOM() * 5000 + 500)::INT,
    'currency', 'USD',
    'per_visit', (RANDOM() * 300 + 50)::INT,
    'visits_estimated', (RANDOM() * 20 + 5)::INT,
    'description', 'Participants will receive compensation for time and travel',
    'additional_benefits', ARRAY['free_parking', 'meal_vouchers', 'health_screening']
  ),
  urgency = CASE 
    WHEN RANDOM() < 0.2 THEN 'high'
    WHEN RANDOM() < 0.1 THEN 'critical'
    ELSE 'normal'
  END,
  enrollment_target = (RANDOM() * 500 + 50)::INT,
  current_enrollment = (RANDOM() * 100)::INT
WHERE compensation IS NULL OR compensation = '{}';