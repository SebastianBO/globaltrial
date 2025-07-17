-- Add location services support to GlobalTrials

-- Create location coordinates cache table
CREATE TABLE IF NOT EXISTS location_coordinates_cache (
  location_key TEXT PRIMARY KEY,
  lat DECIMAL(10, 8) NOT NULL,
  lng DECIMAL(11, 8) NOT NULL,
  full_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_location_cache_created ON location_coordinates_cache(created_at);

-- Add location fields to clinical_trials table if not exists
ALTER TABLE clinical_trials
ADD COLUMN IF NOT EXISTS location_coordinates JSONB;

-- Add index for location queries
CREATE INDEX IF NOT EXISTS idx_clinical_trials_location_coords 
ON clinical_trials USING GIN (location_coordinates);

-- Function to calculate distance between two points (Haversine formula)
CREATE OR REPLACE FUNCTION calculate_distance(
  lat1 DOUBLE PRECISION,
  lon1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION,
  lon2 DOUBLE PRECISION
) RETURNS DOUBLE PRECISION AS $$
DECLARE
  R CONSTANT DOUBLE PRECISION := 6371; -- Earth's radius in kilometers
  dLat DOUBLE PRECISION;
  dLon DOUBLE PRECISION;
  a DOUBLE PRECISION;
  c DOUBLE PRECISION;
BEGIN
  dLat := radians(lat2 - lat1);
  dLon := radians(lon2 - lon1);
  a := sin(dLat / 2) * sin(dLat / 2) +
       cos(radians(lat1)) * cos(radians(lat2)) *
       sin(dLon / 2) * sin(dLon / 2);
  c := 2 * atan2(sqrt(a), sqrt(1 - a));
  RETURN R * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to search trials by location radius
CREATE OR REPLACE FUNCTION search_trials_by_location(
  user_lat DOUBLE PRECISION,
  user_lon DOUBLE PRECISION,
  radius_km DOUBLE PRECISION,
  limit_count INTEGER DEFAULT 100
) RETURNS TABLE (
  trial_id UUID,
  nct_id TEXT,
  title TEXT,
  status TEXT,
  location JSONB,
  distance_km DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ct.id as trial_id,
    ct.nct_id,
    ct.title,
    ct.status,
    loc.value as location,
    calculate_distance(
      user_lat, 
      user_lon, 
      (loc.value->>'lat')::DOUBLE PRECISION, 
      (loc.value->>'lng')::DOUBLE PRECISION
    ) as distance_km
  FROM 
    clinical_trials ct,
    LATERAL jsonb_array_elements(ct.locations) AS loc
  WHERE 
    loc.value->>'lat' IS NOT NULL 
    AND loc.value->>'lng' IS NOT NULL
    AND calculate_distance(
      user_lat, 
      user_lon, 
      (loc.value->>'lat')::DOUBLE PRECISION, 
      (loc.value->>'lng')::DOUBLE PRECISION
    ) <= radius_km
  ORDER BY 
    distance_km ASC
  LIMIT 
    limit_count;
END;
$$ LANGUAGE plpgsql;

-- Create view for trials with location counts
CREATE OR REPLACE VIEW trials_with_location_stats AS
SELECT 
  ct.id,
  ct.nct_id,
  ct.title,
  ct.status,
  ct.phase,
  ct.enrollment,
  ct.conditions,
  ct.sponsors,
  jsonb_array_length(ct.locations) as location_count,
  array_agg(DISTINCT loc.value->>'country') as countries,
  COUNT(CASE WHEN loc.value->>'lat' IS NOT NULL THEN 1 END) as geocoded_locations
FROM 
  clinical_trials ct
  LEFT JOIN LATERAL jsonb_array_elements(ct.locations) AS loc ON true
GROUP BY 
  ct.id, ct.nct_id, ct.title, ct.status, ct.phase, ct.enrollment, ct.conditions, ct.sponsors;

-- Add user location preferences
CREATE TABLE IF NOT EXISTS user_location_preferences (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_location JSONB, -- {lat, lng, address, city, country}
  search_radius_km INTEGER DEFAULT 50,
  allow_remote_trials BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id)
);

-- RLS for user location preferences
ALTER TABLE user_location_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own location preferences" ON user_location_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own location preferences" ON user_location_preferences
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own location preferences" ON user_location_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Function to get popular trial locations
CREATE OR REPLACE FUNCTION get_popular_trial_locations(
  limit_count INTEGER DEFAULT 20
) RETURNS TABLE (
  country TEXT,
  city TEXT,
  trial_count BIGINT,
  recruiting_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    loc.value->>'country' as country,
    loc.value->>'city' as city,
    COUNT(DISTINCT ct.id) as trial_count,
    COUNT(DISTINCT CASE WHEN ct.status = 'RECRUITING' THEN ct.id END) as recruiting_count
  FROM 
    clinical_trials ct,
    LATERAL jsonb_array_elements(ct.locations) AS loc
  WHERE 
    loc.value->>'city' IS NOT NULL
  GROUP BY 
    loc.value->>'country', 
    loc.value->>'city'
  ORDER BY 
    trial_count DESC
  LIMIT 
    limit_count;
END;
$$ LANGUAGE plpgsql;

-- Create location search analytics
CREATE TABLE IF NOT EXISTS location_search_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  search_location JSONB, -- {lat, lng, address}
  search_radius_km INTEGER,
  results_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for analytics
CREATE INDEX IF NOT EXISTS idx_location_search_analytics_created 
ON location_search_analytics(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_location_search_analytics_user 
ON location_search_analytics(user_id);

-- Grant permissions
GRANT SELECT ON location_coordinates_cache TO anon, authenticated;
GRANT INSERT, UPDATE ON location_coordinates_cache TO authenticated;
GRANT SELECT ON user_location_preferences TO authenticated;
GRANT INSERT, UPDATE ON user_location_preferences TO authenticated;
GRANT SELECT ON location_search_analytics TO authenticated;
GRANT INSERT ON location_search_analytics TO authenticated;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_location_preferences_updated_at
  BEFORE UPDATE ON user_location_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();