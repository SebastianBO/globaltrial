# Clinical Trials Data Integration Documentation

## Overview
GlobalTrials integrates multiple clinical trial registries to provide comprehensive trial matching for patients worldwide. This document outlines the data sources, integration approaches, and patient-centric features.

## Data Sources

### 1. ClinicalTrials.gov (Primary Source - Global Coverage)
**Current Implementation**: ✅ Integrated in `supabase/functions/scrape-trials/index.ts:78-170`

**API Details**:
- Base URL: `https://clinicaltrials.gov/api/v2/studies`
- Format: JSON/XML
- Rate Limits: 10 requests/second
- Documentation: https://clinicaltrials.gov/api/

**Key Data Points**:
- NCT ID (unique identifier)
- Trial status (recruiting, completed, etc.)
- Conditions (searchable via MeSH terms)
- Interventions (drugs, procedures, devices)
- Eligibility criteria (age, gender, inclusion/exclusion)
- Locations (facility, city, state, country)
- Contact information (often redacted, use central contact)
- Phase (Phase 1-4)
- Sponsor information

**Integration Notes**:
- Currently fetching trials for: diabetes, cancer, heart disease, alzheimer, covid-19, hypertension
- Filtering by recruiting status only
- Storing in `clinical_trials` table with compensation and urgency calculations

### 2. EU Clinical Trials Register (EU + UK Coverage)
**Status**: ⏳ Not yet integrated

**Access Method**:
- No API available
- Bulk XML downloads via EUCTR website
- Web scraping may be required for real-time data

**Key Data Points**:
- EudraCT Number (unique identifier)
- Trial status
- Medical conditions (MedDRA-coded)
- Therapeutic areas
- Inclusion/exclusion criteria (structured text)
- Trial locations by country
- Sponsor contact information

**Integration Approach**:
1. Set up scheduled bulk download process
2. Parse XML files and transform to common schema
3. Map MedDRA codes to patient-friendly terms
4. Store in database with source='euctr'

### 3. WHO ICTRP (Global Registry Network)
**Status**: ⏳ Not yet integrated

**Access Method**:
- No direct API
- Bulk data downloads in XML/CSV format
- Aggregates data from multiple registries

**Key Data Points**:
- Primary registry ID (links to source)
- Recruitment status
- Conditions and interventions
- Contact information (if provided by source)
- Links to original registry entries

**Integration Approach**:
1. Schedule weekly bulk downloads
2. Parse and deduplicate trials (many overlap with ClinicalTrials.gov)
3. Store unique trials with source='who_ictrp'
4. Maintain registry cross-references

### 4. ISRCTN Registry (UK-Focused)
**Status**: ⏳ Not yet integrated

**Access Method**:
- Limited API functionality
- Bulk data downloads available
- Web scraping for real-time updates

**Key Data Points**:
- ISRCTN ID
- Study status
- Conditions (lay terms + MeSH)
- Participant inclusion/exclusion criteria
- UK-specific location details
- Ethics approval information

**Integration Approach**:
1. Implement bulk download parser
2. Focus on UK-specific trials not in other registries
3. Enhanced location matching for UK postcodes

### 5. CTIS (EU Clinical Trials Information System)
**Status**: ⏳ Monitoring for API availability

**Notes**:
- Replacing EUCTR under EU Regulation 536/2014
- API under development
- Will include mandatory lay summaries
- Enhanced transparency requirements

## Patient-Centric Design Features

### Terminology Mapping System
**Problem**: Patients search for "heart attack" not "myocardial infarction"

**Current Implementation**: Basic condition matching in `app/api/match-trials/route.ts:28`

**Proposed Enhancement**:
```typescript
interface TerminologyMap {
  patientTerm: string;
  medicalTerms: string[];
  meshCodes: string[];
  icdCodes: string[];
}

const terminologyMappings: TerminologyMap[] = [
  {
    patientTerm: "heart attack",
    medicalTerms: ["myocardial infarction", "MI", "acute coronary syndrome"],
    meshCodes: ["D009203"],
    icdCodes: ["I21", "I22"]
  },
  {
    patientTerm: "high blood pressure",
    medicalTerms: ["hypertension", "HTN", "elevated blood pressure"],
    meshCodes: ["D006973"],
    icdCodes: ["I10", "I11", "I12", "I13"]
  }
];
```

### AI-Enhanced Matching
**Current Implementation**: ✅ Using Groq AI in `app/api/match-trials/route.ts:44-58`

**Enhancements Needed**:
1. Consider travel distance calculations
2. Improve eligibility criteria parsing
3. Add multi-language support for international trials
4. Include patient preferences (compensation, time commitment)

### Data Standardization Schema

```typescript
interface StandardizedTrial {
  // Identifiers
  globalTrialId: string; // Our internal ID
  registryId: string; // Original registry ID
  registrySource: 'clinicaltrials.gov' | 'euctr' | 'who_ictrp' | 'isrctn' | 'ctis';
  
  // Basic Information
  title: string;
  briefTitle: string;
  description: string;
  conditions: string[];
  interventions: string[];
  
  // Status
  status: 'recruiting' | 'active' | 'completed' | 'withdrawn' | 'suspended';
  lastUpdated: Date;
  
  // Eligibility
  eligibility: {
    criteria: string;
    minAge?: number;
    maxAge?: number;
    gender: 'all' | 'male' | 'female';
    healthyVolunteers: boolean;
  };
  
  // Locations
  locations: Array<{
    facility: string;
    city: string;
    state?: string;
    country: string;
    postalCode?: string;
    geoCoordinates?: {
      latitude: number;
      longitude: number;
    };
    contactName?: string;
    contactEmail?: string;
    contactPhone?: string;
  }>;
  
  // Additional Info
  phase?: string;
  sponsorName: string;
  compensation?: CompensationInfo;
  urgencyLevel?: 'critical' | 'high' | 'standard';
  
  // Metadata
  importedAt: Date;
  lastVerified: Date;
}
```

## Implementation Priorities

1. **Phase 1**: Enhance ClinicalTrials.gov integration
   - Add more conditions
   - Implement location-based filtering
   - Improve eligibility parsing

2. **Phase 2**: Add EU Clinical Trials Register
   - Set up bulk download infrastructure
   - Create XML parser
   - Map MedDRA codes

3. **Phase 3**: Integrate WHO ICTRP
   - Handle deduplication
   - Maintain registry links
   - Add global coverage metrics

4. **Phase 4**: UK-specific enhancements
   - Add ISRCTN registry
   - Implement UK postcode matching
   - Add NHS trial finder integration

5. **Phase 5**: Future-proofing
   - Monitor CTIS API development
   - Implement real-time updates
   - Add patient feedback loop

## Technical Considerations

### Performance
- Implement caching for frequently accessed trials
- Use database indexes on location and condition fields
- Consider CDN for static trial data

### Data Quality
- Regular validation of imported data
- Automated checks for trial status updates
- Patient feedback mechanism for data accuracy

### Compliance
- GDPR compliance for EU data
- HIPAA considerations for US data
- Patient consent for data usage

### Monitoring
- Track API usage and rate limits
- Monitor data freshness
- Alert on import failures