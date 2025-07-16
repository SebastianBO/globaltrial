-- Add full-text search indexes for better performance
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create text search configuration for medical terms
CREATE TEXT SEARCH CONFIGURATION medical_english ( COPY = english );

-- Add GIN indexes for full-text search
CREATE INDEX IF NOT EXISTS idx_clinical_trials_title_trgm 
ON clinical_trials USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_clinical_trials_description_trgm 
ON clinical_trials USING gin (description gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_clinical_trials_layman_description_trgm 
ON clinical_trials USING gin (layman_description gin_trgm_ops);

-- Add composite index for common filter combinations
CREATE INDEX IF NOT EXISTS idx_clinical_trials_status_phase_source 
ON clinical_trials (status, phase, source);

-- Add index for compensation queries
CREATE INDEX IF NOT EXISTS idx_clinical_trials_compensation 
ON clinical_trials (compensation_amount, compensation_currency) 
WHERE compensation_amount IS NOT NULL;

-- Add index for location searches (if using JSONB for locations_geocoded)
CREATE INDEX IF NOT EXISTS idx_clinical_trials_locations_geocoded 
ON clinical_trials USING gin (locations_geocoded);

-- Create saved searches table
CREATE TABLE IF NOT EXISTS saved_searches (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  query TEXT,
  filters JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_used TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  use_count INTEGER DEFAULT 0
);

-- Create search analytics table
CREATE TABLE IF NOT EXISTS search_analytics (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  query TEXT,
  filters JSONB,
  results_count INTEGER,
  user_id UUID,
  session_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for analytics
CREATE INDEX IF NOT EXISTS idx_search_analytics_query 
ON search_analytics (query);

CREATE INDEX IF NOT EXISTS idx_search_analytics_created_at 
ON search_analytics (created_at);

-- Create a materialized view for popular searches
CREATE MATERIALIZED VIEW IF NOT EXISTS popular_searches AS
SELECT 
  query,
  COUNT(*) as search_count,
  AVG(results_count) as avg_results,
  MAX(created_at) as last_searched
FROM search_analytics
WHERE query IS NOT NULL 
  AND query != ''
  AND created_at > CURRENT_TIMESTAMP - INTERVAL '30 days'
GROUP BY query
HAVING COUNT(*) > 2
ORDER BY search_count DESC
LIMIT 100;

-- Create index on the materialized view
CREATE INDEX IF NOT EXISTS idx_popular_searches_query 
ON popular_searches (query);

-- Function to refresh popular searches (call this periodically)
CREATE OR REPLACE FUNCTION refresh_popular_searches()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY popular_searches;
END;
$$ LANGUAGE plpgsql;

-- Add function for relevance scoring
CREATE OR REPLACE FUNCTION calculate_trial_relevance(
  trial_record clinical_trials,
  search_query TEXT
) RETURNS FLOAT AS $$
DECLARE
  relevance_score FLOAT := 0;
  query_lower TEXT := LOWER(search_query);
BEGIN
  -- Title match (highest weight)
  IF LOWER(trial_record.title) LIKE '%' || query_lower || '%' THEN
    relevance_score := relevance_score + 10;
  END IF;
  
  -- Description match
  IF LOWER(trial_record.description) LIKE '%' || query_lower || '%' THEN
    relevance_score := relevance_score + 5;
  END IF;
  
  -- Layman description match
  IF LOWER(trial_record.layman_description) LIKE '%' || query_lower || '%' THEN
    relevance_score := relevance_score + 7;
  END IF;
  
  -- Conditions match
  IF EXISTS (
    SELECT 1 FROM unnest(trial_record.conditions) AS condition
    WHERE LOWER(condition) LIKE '%' || query_lower || '%'
  ) THEN
    relevance_score := relevance_score + 8;
  END IF;
  
  -- Interventions match
  IF EXISTS (
    SELECT 1 FROM unnest(trial_record.interventions) AS intervention
    WHERE LOWER(intervention) LIKE '%' || query_lower || '%'
  ) THEN
    relevance_score := relevance_score + 6;
  END IF;
  
  -- Boost for featured trials
  IF trial_record.featured THEN
    relevance_score := relevance_score * 1.5;
  END IF;
  
  -- Boost for trials with boost visibility
  IF trial_record.boost_visibility THEN
    relevance_score := relevance_score * 1.3;
  END IF;
  
  -- Boost for currently recruiting trials
  IF trial_record.status = 'Recruiting' THEN
    relevance_score := relevance_score * 1.2;
  END IF;
  
  RETURN relevance_score;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create RLS policies for new tables
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_analytics ENABLE ROW LEVEL SECURITY;

-- Policy for saved searches (users can only see their own)
CREATE POLICY "Users can view own saved searches" ON saved_searches
  FOR SELECT USING (auth.uid() = patient_id);

CREATE POLICY "Users can create own saved searches" ON saved_searches
  FOR INSERT WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Users can update own saved searches" ON saved_searches
  FOR UPDATE USING (auth.uid() = patient_id);

CREATE POLICY "Users can delete own saved searches" ON saved_searches
  FOR DELETE USING (auth.uid() = patient_id);

-- Policy for search analytics (insert only, no read for privacy)
CREATE POLICY "Anyone can insert search analytics" ON search_analytics
  FOR INSERT WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON popular_searches TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON saved_searches TO authenticated;
GRANT INSERT ON search_analytics TO anon, authenticated;