import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';
import { format } from 'date-fns';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface CTISPublicContact {
  organisation: string;
  functionalName: string;
  email: string;
  telephoneNumber?: string;
}

interface CTISTherapeuticArea {
  meddraCode: string;
  meddraPreferredTerm: string;
  meddraSystemOrganClass: string;
}

interface CTISMedicinalProduct {
  productName: string;
  activeSubstance: string;
  pharmaceuticalForm?: string;
  routeOfAdministration?: string;
}

interface CTISLocation {
  memberState: string;
  region?: string;
  sites?: number;
  plannedSubjects?: number;
}

interface CTISTrial {
  ctNumber: string;
  sponsorProtocolNumber: string;
  title: string;
  laySummaryTitle?: string;
  laySummary?: string;
  trialPhase: string;
  trialStatus: string;
  decisionDate: string;
  startDateEU: string;
  endDateEU?: string;
  
  // Sponsor information
  sponsorName: string;
  sponsorType: string;
  
  // Public contact
  publicContact: CTISPublicContact;
  
  // Medical information
  therapeuticAreas: CTISTherapeuticArea[];
  medicalConditions: string[];
  medicinalProducts: CTISMedicinalProduct[];
  
  // Study design
  mainObjective: string;
  primaryEndpoint: string;
  secondaryEndpoints?: string[];
  inclusionCriteria: string;
  exclusionCriteria: string;
  
  // Population
  ageGroup: {
    adults?: boolean;
    elderly?: boolean;
    adolescents?: boolean;
    children?: boolean;
    preterm?: boolean;
    newborn?: boolean;
  };
  gender: string;
  populationSpecifics?: string;
  plannedNumberOfSubjects: number;
  actualNumberOfSubjects?: number;
  
  // Locations
  euLocations: CTISLocation[];
  thirdCountries?: string[];
  
  // Trial design
  trialDesign: {
    controlled: boolean;
    randomised: boolean;
    blindingType?: string;
    numberOfArms?: number;
  };
  
  // Additional info
  rareDisease?: boolean;
  geneticallyModifiedOrganisms?: boolean;
  firstInHuman?: boolean;
  emergencySituation?: boolean;
  
  // Results
  resultsAvailable?: boolean;
  resultsPublicationDate?: string;
  
  // Cross-references
  eudraCTNumber?: string;
  whoUniversalTrialNumber?: string;
  isrctnNumber?: string;
  nctNumber?: string;
}

export class CTISScraper {
  private baseUrl = 'https://euclinicaltrials.eu';
  private apiUrl = 'https://euclinicaltrials.eu/ctis-public-api';
  private checkpointFile = path.join(process.cwd(), 'data', 'ctis-checkpoint.json');
  private pageSize = 100;
  private rateLimit = 1000; // 1 second between requests

  constructor() {
    this.ensureDataDirectory();
  }

  private async ensureDataDirectory() {
    await fs.mkdir(path.join(process.cwd(), 'data'), { recursive: true });
  }

  /**
   * Sleep for rate limiting
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Load checkpoint data
   */
  private async loadCheckpoint(): Promise<{ lastOffset: number; processedIds: string[] }> {
    try {
      const data = await fs.readFile(this.checkpointFile, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return { lastOffset: 0, processedIds: [] };
    }
  }

  /**
   * Save checkpoint data
   */
  private async saveCheckpoint(lastOffset: number, processedIds: string[]): Promise<void> {
    await fs.writeFile(
      this.checkpointFile,
      JSON.stringify({ lastOffset, processedIds, lastUpdate: new Date().toISOString() }, null, 2)
    );
  }

  /**
   * Search CTIS trials
   */
  async searchTrials(offset: number = 0): Promise<{ trials: any[]; total: number }> {
    try {
      // CTIS API endpoint structure (this is hypothetical as CTIS API is not fully public yet)
      const response = await axios.get(`${this.apiUrl}/trials`, {
        params: {
          offset: offset,
          limit: this.pageSize,
          sort: 'decisionDate:desc'
        },
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'GlobalTrials/1.0'
        }
      });

      return {
        trials: response.data.results || [],
        total: response.data.totalCount || 0
      };
    } catch (error) {
      console.error(`Error searching CTIS at offset ${offset}:`, error);
      
      // For now, return empty results as CTIS API may not be fully available
      console.log('⚠️  CTIS API not available. Please check https://euclinicaltrials.eu for API access.');
      return { trials: [], total: 0 };
    }
  }

  /**
   * Fetch detailed trial information
   */
  async fetchTrialDetails(ctNumber: string): Promise<CTISTrial | null> {
    try {
      const response = await axios.get(`${this.apiUrl}/trials/${ctNumber}`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'GlobalTrials/1.0'
        }
      });
      
      return this.parseTrialData(response.data);
    } catch (error) {
      console.error(`Error fetching CTIS trial ${ctNumber}:`, error);
      return null;
    }
  }

  /**
   * Parse trial data from API response
   */
  private parseTrialData(data: any): CTISTrial {
    return {
      ctNumber: data.ctNumber,
      sponsorProtocolNumber: data.sponsorProtocolNumber || '',
      title: data.title || data.fullTitle || '',
      laySummaryTitle: data.laySummaryTitle,
      laySummary: data.laySummary,
      trialPhase: data.trialPhase || data.phase || '',
      trialStatus: data.trialStatus || data.status || '',
      decisionDate: data.decisionDate || data.approvalDate || '',
      startDateEU: data.startDateEU || data.startDate || '',
      endDateEU: data.endDateEU || data.endDate,
      
      // Sponsor
      sponsorName: data.sponsor?.name || data.sponsorName || '',
      sponsorType: data.sponsor?.type || data.sponsorType || '',
      
      // Public contact
      publicContact: {
        organisation: data.publicContact?.organisation || '',
        functionalName: data.publicContact?.functionalName || data.publicContact?.name || '',
        email: data.publicContact?.email || '',
        telephoneNumber: data.publicContact?.telephoneNumber
      },
      
      // Medical information
      therapeuticAreas: this.parseTherapeuticAreas(data.therapeuticAreas),
      medicalConditions: data.medicalConditions || [],
      medicinalProducts: this.parseMedicinalProducts(data.medicinalProducts),
      
      // Study design
      mainObjective: data.mainObjective || data.primaryObjective || '',
      primaryEndpoint: data.primaryEndpoint || data.primaryOutcome || '',
      secondaryEndpoints: data.secondaryEndpoints || data.secondaryOutcomes || [],
      inclusionCriteria: data.inclusionCriteria || '',
      exclusionCriteria: data.exclusionCriteria || '',
      
      // Population
      ageGroup: {
        adults: data.ageGroup?.adults || false,
        elderly: data.ageGroup?.elderly || false,
        adolescents: data.ageGroup?.adolescents || false,
        children: data.ageGroup?.children || false,
        preterm: data.ageGroup?.preterm || false,
        newborn: data.ageGroup?.newborn || false
      },
      gender: data.gender || 'All',
      populationSpecifics: data.populationSpecifics,
      plannedNumberOfSubjects: data.plannedNumberOfSubjects || 0,
      actualNumberOfSubjects: data.actualNumberOfSubjects,
      
      // Locations
      euLocations: this.parseLocations(data.euLocations),
      thirdCountries: data.thirdCountries || [],
      
      // Trial design
      trialDesign: {
        controlled: data.trialDesign?.controlled || false,
        randomised: data.trialDesign?.randomised || false,
        blindingType: data.trialDesign?.blindingType,
        numberOfArms: data.trialDesign?.numberOfArms
      },
      
      // Additional info
      rareDisease: data.rareDisease || false,
      geneticallyModifiedOrganisms: data.geneticallyModifiedOrganisms || false,
      firstInHuman: data.firstInHuman || false,
      emergencySituation: data.emergencySituation || false,
      
      // Results
      resultsAvailable: data.resultsAvailable || false,
      resultsPublicationDate: data.resultsPublicationDate,
      
      // Cross-references
      eudraCTNumber: data.eudraCTNumber,
      whoUniversalTrialNumber: data.whoUniversalTrialNumber,
      isrctnNumber: data.isrctnNumber,
      nctNumber: data.nctNumber || data.clinicalTrialsGovNumber
    };
  }

  /**
   * Parse therapeutic areas
   */
  private parseTherapeuticAreas(areas: any[]): CTISTherapeuticArea[] {
    if (!areas || !Array.isArray(areas)) return [];
    
    return areas.map(area => ({
      meddraCode: area.meddraCode || '',
      meddraPreferredTerm: area.meddraPreferredTerm || area.preferredTerm || '',
      meddraSystemOrganClass: area.meddraSystemOrganClass || area.systemOrganClass || ''
    }));
  }

  /**
   * Parse medicinal products
   */
  private parseMedicinalProducts(products: any[]): CTISMedicinalProduct[] {
    if (!products || !Array.isArray(products)) return [];
    
    return products.map(product => ({
      productName: product.productName || product.name || '',
      activeSubstance: product.activeSubstance || '',
      pharmaceuticalForm: product.pharmaceuticalForm,
      routeOfAdministration: product.routeOfAdministration
    }));
  }

  /**
   * Parse locations
   */
  private parseLocations(locations: any[]): CTISLocation[] {
    if (!locations || !Array.isArray(locations)) return [];
    
    return locations.map(location => ({
      memberState: location.memberState || location.country || '',
      region: location.region,
      sites: location.sites || location.numberOfSites,
      plannedSubjects: location.plannedSubjects
    }));
  }

  /**
   * Transform CTIS trial to our database format
   */
  private transformTrial(trial: CTISTrial): any {
    // Map CTIS status to our status format
    const statusMap: Record<string, string> = {
      'authorised': 'RECRUITING',
      'ongoing': 'ACTIVE_NOT_RECRUITING',
      'ended': 'COMPLETED',
      'terminated early': 'TERMINATED',
      'suspended': 'SUSPENDED',
      'not authorised': 'WITHDRAWN'
    };
    
    const status = statusMap[trial.trialStatus.toLowerCase()] || 'UNKNOWN';
    
    // Determine age range
    let minimumAge = 'N/A';
    let maximumAge = 'N/A';
    
    if (trial.ageGroup.newborn) minimumAge = '0 Years';
    else if (trial.ageGroup.preterm) minimumAge = '0 Years';
    else if (trial.ageGroup.children) minimumAge = '2 Years';
    else if (trial.ageGroup.adolescents) minimumAge = '12 Years';
    else if (trial.ageGroup.adults) minimumAge = '18 Years';
    else if (trial.ageGroup.elderly) minimumAge = '65 Years';
    
    if (trial.ageGroup.elderly) maximumAge = 'N/A';
    else if (trial.ageGroup.adults) maximumAge = '64 Years';
    else if (trial.ageGroup.adolescents) maximumAge = '17 Years';
    else if (trial.ageGroup.children) maximumAge = '11 Years';
    else if (trial.ageGroup.preterm || trial.ageGroup.newborn) maximumAge = '2 Years';
    
    // Build locations
    const locations = [
      ...trial.euLocations.map(loc => ({
        facility: 'Multiple Sites',
        city: loc.region || 'Multiple Cities',
        country: loc.memberState,
        status: status
      })),
      ...(trial.thirdCountries || []).map(country => ({
        facility: 'Multiple Sites',
        city: 'Multiple Cities',
        country: country,
        status: status
      }))
    ];
    
    // Build eligibility criteria
    const eligibilityCriteria = {
      inclusion: trial.inclusionCriteria,
      exclusion: trial.exclusionCriteria,
      gender: trial.gender || 'All',
      minimumAge: minimumAge,
      maximumAge: maximumAge,
      populationSpecifics: trial.populationSpecifics
    };
    
    // Build interventions
    const interventions = trial.medicinalProducts.map(product => ({
      type: 'Drug',
      name: product.productName,
      description: `Active substance: ${product.activeSubstance}${product.pharmaceuticalForm ? `, Form: ${product.pharmaceuticalForm}` : ''}${product.routeOfAdministration ? `, Route: ${product.routeOfAdministration}` : ''}`
    }));
    
    // Build contacts
    const contacts = [];
    if (trial.publicContact.email) {
      contacts.push({
        name: trial.publicContact.functionalName || trial.publicContact.organisation,
        email: trial.publicContact.email,
        phone: trial.publicContact.telephoneNumber,
        role: 'Public Contact'
      });
    }
    
    return {
      nct_id: trial.ctNumber, // Use CT number as primary key
      external_ids: {
        ct_number: trial.ctNumber,
        eudract_number: trial.eudraCTNumber,
        nct_id: trial.nctNumber,
        isrctn_id: trial.isrctnNumber,
        who_utn: trial.whoUniversalTrialNumber,
        sponsor_protocol: trial.sponsorProtocolNumber
      },
      title: trial.laySummaryTitle || trial.title,
      brief_title: trial.laySummaryTitle || trial.title,
      official_title: trial.title,
      status: status,
      phase: trial.trialPhase,
      study_type: 'Interventional',
      conditions: [
        ...trial.medicalConditions,
        ...trial.therapeuticAreas.map(ta => ta.meddraPreferredTerm)
      ].filter(Boolean),
      interventions: interventions,
      sponsors: {
        lead: trial.sponsorName,
        collaborators: []
      },
      locations: locations,
      eligibility_criteria: eligibilityCriteria,
      primary_outcome: trial.primaryEndpoint,
      secondary_outcomes: trial.secondaryEndpoints || [],
      enrollment: trial.plannedNumberOfSubjects,
      start_date: trial.startDateEU,
      completion_date: trial.endDateEU,
      last_update_date: trial.decisionDate,
      verification_date: trial.decisionDate,
      first_posted_date: trial.decisionDate,
      results_first_posted_date: trial.resultsPublicationDate,
      contacts: contacts,
      references: [],
      brief_summary: trial.laySummary || '',
      detailed_description: `${trial.mainObjective}\n\nTrial Design: ${trial.trialDesign.controlled ? 'Controlled' : 'Uncontrolled'}, ${trial.trialDesign.randomised ? 'Randomised' : 'Non-randomised'}${trial.trialDesign.blindingType ? `, ${trial.trialDesign.blindingType}` : ''}`,
      registry_url: `${this.baseUrl}/ctis-public/view/${trial.ctNumber}`,
      source: 'CTIS',
      special_categories: {
        rare_disease: trial.rareDisease,
        first_in_human: trial.firstInHuman,
        gmo: trial.geneticallyModifiedOrganisms,
        emergency: trial.emergencySituation
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  /**
   * Main scraping function
   */
  async scrape(): Promise<void> {
    console.log('🔍 Starting CTIS scraper...');
    
    // Load checkpoint
    const checkpoint = await this.loadCheckpoint();
    let currentOffset = checkpoint.lastOffset;
    const processedIds = new Set(checkpoint.processedIds);
    
    let totalImported = 0;
    let totalErrors = 0;
    
    try {
      // Get first batch to determine total
      const { trials: firstBatch, total } = await this.searchTrials(0);
      
      if (total === 0) {
        console.log('⚠️  No trials found in CTIS. The API may not be available yet.');
        console.log('📌 CTIS is the new EU clinical trials system replacing EudraCT.');
        console.log('📌 Check https://euclinicaltrials.eu for the latest API documentation.');
        return;
      }
      
      console.log(`📊 Found ${total} trials in CTIS`);
      
      // Process all trials
      while (currentOffset < total) {
        console.log(`\n📄 Processing trials ${currentOffset + 1}-${Math.min(currentOffset + this.pageSize, total)} of ${total}`);
        
        const { trials } = await this.searchTrials(currentOffset);
        
        for (const trialSummary of trials) {
          const ctNumber = trialSummary.ctNumber;
          
          if (processedIds.has(ctNumber)) {
            continue;
          }
          
          try {
            // Fetch detailed trial information
            const trial = await this.fetchTrialDetails(ctNumber);
            
            if (!trial) {
              console.error(`❌ Failed to fetch details for ${ctNumber}`);
              totalErrors++;
              continue;
            }
            
            // Transform and save to database
            const transformedTrial = this.transformTrial(trial);
            
            const { error } = await supabase
              .from('clinical_trials')
              .upsert(transformedTrial, {
                onConflict: 'nct_id'
              });
            
            if (error) {
              console.error(`❌ Database error for ${ctNumber}:`, error);
              totalErrors++;
            } else {
              totalImported++;
              processedIds.add(ctNumber);
              console.log(`✅ Imported ${ctNumber} (${totalImported} total)`);
            }
            
            // Rate limiting
            await this.sleep(this.rateLimit);
            
          } catch (error) {
            console.error(`❌ Error processing ${ctNumber}:`, error);
            totalErrors++;
          }
        }
        
        // Update offset
        currentOffset += this.pageSize;
        
        // Save checkpoint after each batch
        await this.saveCheckpoint(currentOffset, Array.from(processedIds));
      }
      
    } catch (error) {
      console.error('❌ Scraper error:', error);
      throw error;
    }
    
    console.log('\n✅ CTIS Scraping Complete:');
    console.log(`   - Total imported: ${totalImported}`);
    console.log(`   - Total errors: ${totalErrors}`);
  }
}

// Run if called directly
if (require.main === module) {
  const scraper = new CTISScraper();
  scraper.scrape().catch(console.error);
}