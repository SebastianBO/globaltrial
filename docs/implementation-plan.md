# GlobalTrials Implementation Plan

## Current State Assessment

### ✅ What's Already Working Well

1. **Database Architecture**
   - Multi-source support built-in (`source` column)
   - Flexible JSONB columns for registry-specific data
   - Proper indexing for performance
   - RLS security policies in place

2. **Core Features**
   - ClinicalTrials.gov integration (6 conditions)
   - AI-powered matching with Groq
   - Patient intake via chat interface
   - Compensation calculations
   - Urgency level determination

3. **Tech Stack**
   - Next.js 14 with App Router
   - Supabase (PostgreSQL + Edge Functions)
   - TypeScript throughout
   - Tailwind CSS for UI

## Implementation Phases

### Phase 1: Enhance Current System (Week 1-2)

#### 1.1 Expand ClinicalTrials.gov Coverage
```typescript
// Update supabase/functions/scrape-trials/index.ts
const expandedConditions = [
  // Current
  'diabetes', 'cancer', 'heart disease', 'alzheimer', 'covid-19', 'hypertension',
  // Add common conditions
  'asthma', 'arthritis', 'depression', 'anxiety', 'obesity', 'copd',
  'parkinsons', 'multiple sclerosis', 'lupus', 'crohns disease',
  // Add rare diseases
  'cystic fibrosis', 'sickle cell', 'huntingtons'
];

// Add pagination support
const fetchAllTrials = async (condition: string) => {
  let allTrials = [];
  let pageToken = null;
  
  do {
    const params = new URLSearchParams({
      'query.cond': condition,
      'filter.overallStatus': 'RECRUITING',
      'pageSize': '100',
      'pageToken': pageToken || '',
      'format': 'json'
    });
    
    const response = await fetch(`${baseUrl}?${params}`);
    const data = await response.json();
    
    allTrials.push(...data.studies);
    pageToken = data.nextPageToken;
  } while (pageToken);
  
  return allTrials;
};
```

#### 1.2 Implement Terminology Mapping
```typescript
// Create new file: lib/terminology-mapper.ts
export interface MedicalTermMapping {
  id: string;
  patientTerms: string[];
  medicalTerms: string[];
  meshCodes: string[];
  icdCodes: string[];
  category: string;
}

export const terminologyMappings: MedicalTermMapping[] = [
  {
    id: 'heart-attack',
    patientTerms: ['heart attack', 'cardiac arrest', 'heart problem'],
    medicalTerms: ['myocardial infarction', 'MI', 'acute coronary syndrome', 'STEMI', 'NSTEMI'],
    meshCodes: ['D009203', 'D054058'],
    icdCodes: ['I21', 'I22'],
    category: 'cardiovascular'
  },
  {
    id: 'high-blood-pressure',
    patientTerms: ['high blood pressure', 'blood pressure', 'bp issues'],
    medicalTerms: ['hypertension', 'HTN', 'essential hypertension', 'secondary hypertension'],
    meshCodes: ['D006973'],
    icdCodes: ['I10', 'I11', 'I12', 'I13', 'I15'],
    category: 'cardiovascular'
  },
  // Add more mappings...
];

// Create Supabase table for dynamic management
```

```sql
-- Create terminology mappings table
CREATE TABLE medical_term_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mapping_id VARCHAR(100) UNIQUE NOT NULL,
  patient_terms TEXT[] NOT NULL,
  medical_terms TEXT[] NOT NULL,
  mesh_codes TEXT[],
  icd_codes TEXT[],
  category VARCHAR(50),
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for searching
CREATE INDEX idx_term_mappings_patient ON medical_term_mappings USING GIN (patient_terms);
CREATE INDEX idx_term_mappings_medical ON medical_term_mappings USING GIN (medical_terms);
```

#### 1.3 Enhance Location-Based Search
```typescript
// Add geocoding to patient registration
// lib/geocoding.ts
export async function geocodeLocation(city: string, state: string, country: string) {
  // Use a geocoding API (e.g., Mapbox, Google Maps)
  const response = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${city},${state},${country}.json?access_token=${process.env.MAPBOX_TOKEN}`);
  const data = await response.json();
  
  if (data.features?.[0]) {
    const [longitude, latitude] = data.features[0].center;
    return { latitude, longitude };
  }
  return null;
}

// Update trial matching to calculate distances
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}
```

### Phase 2: Add EU Clinical Trials Register (Week 3-4)

#### 2.1 Create Bulk Download Infrastructure
```typescript
// supabase/functions/import-euctr/index.ts
import { parseStringPromise } from 'https://deno.land/x/xml2js@0.23.0/mod.ts';

export async function importEUCTRData() {
  // Download bulk XML data
  const response = await fetch('https://www.clinicaltrialsregister.eu/ctr-search/rest/download');
  const xmlData = await response.text();
  
  // Parse XML
  const parsed = await parseStringPromise(xmlData);
  
  // Transform to our schema
  const trials = parsed.trials.map(transformEUCTRTrial);
  
  // Batch insert with deduplication
  await batchUpsertTrials(trials, 'euctr');
}

function transformEUCTRTrial(euctrTrial: any) {
  return {
    trial_id: euctrTrial.EudraCTNumber,
    title: euctrTrial.title,
    description: euctrTrial.synopsis,
    conditions: mapMedDRAToConditions(euctrTrial.medicalConditions),
    source: 'euctr',
    // ... map other fields
  };
}
```

#### 2.2 MedDRA Code Mapping
```typescript
// lib/meddra-mapper.ts
interface MedDRAMapping {
  code: string;
  preferredTerm: string;
  patientFriendlyTerms: string[];
}

// Create mapping table and import MedDRA dictionary
```

### Phase 3: WHO ICTRP Integration (Week 5)

#### 3.1 Bulk Data Processing
```typescript
// supabase/functions/import-who-ictrp/index.ts
export async function importWHOData() {
  // WHO provides CSV/XML dumps
  const csvData = await fetchWHOBulkData();
  
  // Parse and deduplicate
  const trials = parseWHOTrials(csvData);
  
  // Check for duplicates across registries
  const uniqueTrials = await deduplicateTrials(trials);
  
  // Store with cross-references
  await storeWithCrossReferences(uniqueTrials);
}
```

#### 3.2 Cross-Registry Deduplication
```sql
-- Add cross-reference table
CREATE TABLE trial_cross_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_trial_id UUID REFERENCES clinical_trials(id),
  registry_source VARCHAR(50),
  registry_id VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create function to find duplicate trials
CREATE OR REPLACE FUNCTION find_duplicate_trials(
  p_title TEXT,
  p_sponsor TEXT,
  p_conditions TEXT[]
) RETURNS TABLE (trial_id UUID, similarity_score FLOAT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    id,
    similarity(title, p_title) * 0.4 +
    CASE WHEN sponsor = p_sponsor THEN 0.3 ELSE 0 END +
    (SELECT COUNT(*)::FLOAT / GREATEST(array_length(conditions, 1), array_length(p_conditions, 1))
     FROM unnest(conditions) c WHERE c = ANY(p_conditions)) * 0.3
    AS similarity_score
  FROM clinical_trials
  WHERE similarity(title, p_title) > 0.7
  ORDER BY similarity_score DESC;
END;
$$ LANGUAGE plpgsql;
```

### Phase 4: Advanced Features (Week 6-7)

#### 4.1 Real-time Updates
```typescript
// supabase/functions/sync-trials/index.ts
// Run as scheduled function every 6 hours
export async function syncTrials() {
  // Check last sync timestamp
  const lastSync = await getLastSyncTime();
  
  // Fetch updates from each registry
  const updates = await Promise.all([
    fetchClinicalTrialsUpdates(lastSync),
    fetchEUCTRUpdates(lastSync),
    fetchWHOUpdates(lastSync)
  ]);
  
  // Apply updates
  await applyTrialUpdates(updates.flat());
  
  // Update sync timestamp
  await updateSyncTime();
}
```

#### 4.2 Enhanced AI Matching
```typescript
// Improve match-trials API with multi-factor scoring
interface MatchingFactors {
  conditionMatch: number;      // 0-1
  locationDistance: number;     // 0-1 (inverse of distance)
  eligibilityMatch: number;     // 0-1
  compensationFit: number;      // 0-1
  urgencyAlignment: number;     // 0-1
  phasePreference: number;      // 0-1
}

export function calculateMatchScore(factors: MatchingFactors): number {
  const weights = {
    conditionMatch: 0.35,
    locationDistance: 0.25,
    eligibilityMatch: 0.20,
    compensationFit: 0.10,
    urgencyAlignment: 0.05,
    phasePreference: 0.05
  };
  
  return Object.entries(factors).reduce((score, [factor, value]) => {
    return score + (value * weights[factor as keyof MatchingFactors]);
  }, 0);
}
```

#### 4.3 Patient Feedback Loop
```sql
-- Add feedback table
CREATE TABLE trial_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id),
  trial_id UUID REFERENCES clinical_trials(id),
  feedback_type VARCHAR(50), -- 'data_accuracy', 'experience', 'outcome'
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comments TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Update match scoring based on feedback
CREATE OR REPLACE FUNCTION update_trial_quality_score() RETURNS TRIGGER AS $$
BEGIN
  UPDATE clinical_trials
  SET quality_score = (
    SELECT AVG(rating)::DECIMAL(3,2)
    FROM trial_feedback
    WHERE trial_id = NEW.trial_id
  )
  WHERE id = NEW.trial_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Phase 5: Monitoring & Analytics (Week 8)

#### 5.1 Usage Analytics
```typescript
// Track search patterns for terminology improvement
interface SearchAnalytics {
  searchTerm: string;
  matchedTrials: number;
  patientId?: string;
  timestamp: Date;
}

// API endpoint to log searches
export async function logSearch(analytics: SearchAnalytics) {
  await supabase.from('search_analytics').insert(analytics);
  
  // Update terminology mappings if no matches
  if (analytics.matchedTrials === 0) {
    await flagUnmatchedTerm(analytics.searchTerm);
  }
}
```

#### 5.2 Registry Health Monitoring
```sql
-- Monitor data freshness
CREATE VIEW registry_health AS
SELECT 
  source,
  COUNT(*) as total_trials,
  COUNT(*) FILTER (WHERE last_updated > NOW() - INTERVAL '7 days') as recently_updated,
  AVG(EXTRACT(epoch FROM NOW() - last_updated) / 86400)::INT as avg_days_since_update
FROM clinical_trials
GROUP BY source;

-- Alert on stale data
CREATE OR REPLACE FUNCTION check_data_freshness() RETURNS void AS $$
DECLARE
  stale_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO stale_count
  FROM clinical_trials
  WHERE last_updated < NOW() - INTERVAL '30 days';
  
  IF stale_count > 100 THEN
    -- Send alert (implement notification system)
    PERFORM notify_admin('High number of stale trials: ' || stale_count);
  END IF;
END;
$$ LANGUAGE plpgsql;
```

## Quick Wins to Implement Now

1. **Expand Conditions List** (1 hour)
   - Update `supabase/functions/scrape-trials/index.ts:79`
   - Add 10-15 more common conditions

2. **Basic Terminology Mapping** (2 hours)
   - Create mapping table in Supabase
   - Add initial mappings for top conditions
   - Update chat API to use mappings

3. **Improve Location Matching** (2 hours)
   - Add distance calculation to matching algorithm
   - Display distance in trial results

4. **Add Data Source Badge** (30 minutes)
   - Show registry source on trial cards
   - Add registry logos/icons

5. **Search Analytics** (1 hour)
   - Log all searches
   - Create weekly report of unmatched terms

## Technical Debt to Address

1. Add comprehensive error handling for API failures
2. Implement retry logic for external API calls
3. Add request caching to reduce API load
4. Create admin dashboard for monitoring
5. Add comprehensive logging for debugging

## Success Metrics

- Number of supported registries (target: 5)
- Trial coverage by geography (target: 50+ countries)
- Match accuracy score (target: >85%)
- Average time to match (target: <2 seconds)
- Patient satisfaction rating (target: 4.5/5)