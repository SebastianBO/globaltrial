-- Create MeSH cache table to store translated terms
CREATE TABLE IF NOT EXISTS mesh_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  condition_name VARCHAR(255) UNIQUE NOT NULL, -- Original condition name from trial
  mesh_id VARCHAR(20),
  preferred_term VARCHAR(255),
  scope_note TEXT, -- MeSH definition/description
  layman_terms TEXT[], -- Patient-friendly synonyms
  tree_numbers TEXT[], -- MeSH hierarchy codes
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add layman description to clinical trials
ALTER TABLE clinical_trials 
ADD COLUMN IF NOT EXISTS layman_description TEXT,
ADD COLUMN IF NOT EXISTS mesh_terms JSONB;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_mesh_cache_condition ON mesh_cache(condition_name);
CREATE INDEX IF NOT EXISTS idx_mesh_cache_mesh_id ON mesh_cache(mesh_id);

-- Enable RLS
ALTER TABLE mesh_cache ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read" ON mesh_cache
  FOR SELECT TO anon USING (true);

-- Function to get layman explanation for a condition
CREATE OR REPLACE FUNCTION get_layman_explanation(condition_text TEXT)
RETURNS TABLE (
  layman_description TEXT,
  simple_terms TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(mc.scope_note, 'A medical condition being studied in this trial') as layman_description,
    COALESCE(mc.layman_terms, ARRAY[condition_text]) as simple_terms
  FROM mesh_cache mc
  WHERE mc.condition_name = condition_text
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;