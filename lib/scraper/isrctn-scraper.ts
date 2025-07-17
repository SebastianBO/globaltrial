import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs/promises';
import * as path from 'path';
import { format } from 'date-fns';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ISRCTNTrial {
  isrctn_id: string;
  doi: string;
  title: string;
  acronym?: string;
  condition_category: string;
  date_applied: string;
  date_assigned: string;
  last_edited: string;
  prospective_retrospective: string;
  overall_trial_status: string;
  recruitment_status: string;
  plain_english_summary: string;
  trial_website?: string;
  
  // Contact information
  contact_name: string;
  contact_email: string;
  contact_address?: string;
  contact_phone?: string;
  contact_orcid?: string;
  
  // Sponsor information
  sponsor_name: string;
  sponsor_type: string;
  sponsor_website?: string;
  
  // Study details
  primary_study_design: string;
  secondary_study_design?: string;
  trial_setting: string;
  trial_type: string;
  condition: string;
  intervention: string;
  intervention_type: string;
  primary_outcome_measures: string;
  secondary_outcome_measures?: string;
  
  // Participant information
  participant_inclusion_criteria: string;
  participant_exclusion_criteria?: string;
  participant_type: string;
  age_group: string;
  gender: string;
  target_enrollment: string;
  
  // Location information
  countries_of_recruitment: string[];
  trial_participating_centre?: string;
  
  // Other identifiers
  eudract_number?: string;
  clinicaltrials_gov_number?: string;
  protocol_serial_number?: string;
  additional_reference_numbers?: string[];
}

export class ISRCTNScraper {
  private baseUrl = 'https://www.isrctn.com';
  private apiUrl = 'https://www.isrctn.com/api/query';
  private checkpointFile = path.join(process.cwd(), 'data', 'isrctn-checkpoint.json');
  private pageSize = 100; // Max allowed by ISRCTN
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
  private async loadCheckpoint(): Promise<{ lastPage: number; processedIds: string[] }> {
    try {
      const data = await fs.readFile(this.checkpointFile, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return { lastPage: 0, processedIds: [] };
    }
  }

  /**
   * Save checkpoint data
   */
  private async saveCheckpoint(lastPage: number, processedIds: string[]): Promise<void> {
    await fs.writeFile(
      this.checkpointFile,
      JSON.stringify({ lastPage, processedIds, lastUpdate: new Date().toISOString() }, null, 2)
    );
  }

  /**
   * Search ISRCTN registry
   */
  async searchTrials(page: number = 1): Promise<{ trials: any[]; totalPages: number }> {
    try {
      // ISRCTN uses a specific search format
      const params = new URLSearchParams({
        'q': '', // Empty query to get all trials
        'filters': 'phase:Not Applicable,phase:Phase I,phase:Phase II,phase:Phase III,phase:Phase IV',
        'page': page.toString(),
        'pageSize': this.pageSize.toString(),
        'sort': 'lastModified',
        'sortDirection': 'desc'
      });

      const response = await axios.get(`${this.apiUrl}?${params}`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'GlobalTrials/1.0'
        }
      });

      return {
        trials: response.data.items || [],
        totalPages: Math.ceil((response.data.totalCount || 0) / this.pageSize)
      };
    } catch (error) {
      console.error(`Error searching ISRCTN page ${page}:`, error);
      
      // Fallback to web scraping if API fails
      return this.scrapeSearchResults(page);
    }
  }

  /**
   * Fallback web scraping for search results
   */
  private async scrapeSearchResults(page: number): Promise<{ trials: any[]; totalPages: number }> {
    const url = `${this.baseUrl}/search?page=${page}`;
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);
    
    const trials: any[] = [];
    
    // Extract trial IDs from search results
    $('.ResultsList_item').each((_, element) => {
      const id = $(element).find('.ResultsList_item_id').text().trim();
      if (id) {
        trials.push({ isrctn_id: id });
      }
    });
    
    // Extract total pages
    const totalResults = parseInt($('.SearchResults_summary').text().match(/of (\d+)/)?.[1] || '0');
    const totalPages = Math.ceil(totalResults / 10); // Default page size for web interface
    
    return { trials, totalPages };
  }

  /**
   * Fetch detailed trial information
   */
  async fetchTrialDetails(isrctnId: string): Promise<ISRCTNTrial | null> {
    try {
      // Try API first
      const apiUrl = `${this.baseUrl}/api/trials/${isrctnId}`;
      const response = await axios.get(apiUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'GlobalTrials/1.0'
        }
      });
      
      return this.parseAPIResponse(response.data);
    } catch (error) {
      console.log(`API failed for ${isrctnId}, falling back to web scraping`);
      
      // Fallback to web scraping
      return this.scrapeTrialDetails(isrctnId);
    }
  }

  /**
   * Parse API response
   */
  private parseAPIResponse(data: any): ISRCTNTrial {
    return {
      isrctn_id: data.isrctn_id || data.id,
      doi: data.doi || '',
      title: data.title || data.scientificTitle || '',
      acronym: data.acronym,
      condition_category: data.conditionCategory || '',
      date_applied: data.dateApplied || '',
      date_assigned: data.dateAssigned || '',
      last_edited: data.lastEdited || data.lastModified || '',
      prospective_retrospective: data.prospectiveRetrospective || '',
      overall_trial_status: data.overallStatus || data.status || '',
      recruitment_status: data.recruitmentStatus || '',
      plain_english_summary: data.plainEnglishSummary || data.publicSummary || '',
      trial_website: data.trialWebsite,
      
      // Contact
      contact_name: data.publicContact?.name || '',
      contact_email: data.publicContact?.email || '',
      contact_address: data.publicContact?.address,
      contact_phone: data.publicContact?.phone,
      contact_orcid: data.publicContact?.orcid,
      
      // Sponsor
      sponsor_name: data.sponsor?.name || data.primarySponsor || '',
      sponsor_type: data.sponsor?.type || '',
      sponsor_website: data.sponsor?.website,
      
      // Study details
      primary_study_design: data.primaryStudyDesign || data.studyDesign || '',
      secondary_study_design: data.secondaryStudyDesign,
      trial_setting: data.trialSetting || '',
      trial_type: data.trialType || data.studyType || '',
      condition: data.condition || data.healthCondition || '',
      intervention: data.intervention || '',
      intervention_type: data.interventionType || '',
      primary_outcome_measures: data.primaryOutcome || data.primaryOutcomeMeasures || '',
      secondary_outcome_measures: data.secondaryOutcome || data.secondaryOutcomeMeasures,
      
      // Participants
      participant_inclusion_criteria: data.inclusionCriteria || data.eligibilityCriteria?.inclusion || '',
      participant_exclusion_criteria: data.exclusionCriteria || data.eligibilityCriteria?.exclusion,
      participant_type: data.participantType || '',
      age_group: data.ageGroup || data.ageRange || '',
      gender: data.gender || 'All',
      target_enrollment: data.targetEnrollment || data.targetSampleSize || '',
      
      // Locations
      countries_of_recruitment: this.parseCountries(data.countriesOfRecruitment || data.countries),
      trial_participating_centre: data.participatingCentre,
      
      // Other IDs
      eudract_number: data.eudractNumber,
      clinicaltrials_gov_number: data.clinicaltrialsGovNumber || data.nctId,
      protocol_serial_number: data.protocolSerialNumber,
      additional_reference_numbers: data.additionalReferenceNumbers || []
    };
  }

  /**
   * Scrape trial details from web page
   */
  private async scrapeTrialDetails(isrctnId: string): Promise<ISRCTNTrial | null> {
    try {
      const url = `${this.baseUrl}/${isrctnId}`;
      const response = await axios.get(url);
      const $ = cheerio.load(response.data);
      
      // Extract data from the structured page
      const getField = (label: string): string => {
        const field = $(`dt:contains("${label}")`).next('dd').text().trim();
        return field || '';
      };
      
      const getSection = (sectionTitle: string): string => {
        const section = $(`.Info_section h3:contains("${sectionTitle}")`).parent();
        return section.find('dd').text().trim() || '';
      };
      
      return {
        isrctn_id: isrctnId,
        doi: getField('DOI'),
        title: $('h1.Info_title').text().trim(),
        acronym: getField('Acronym'),
        condition_category: getField('Condition category'),
        date_applied: getField('Date applied'),
        date_assigned: getField('Date assigned'),
        last_edited: getField('Last edited'),
        prospective_retrospective: getField('Prospectively registered'),
        overall_trial_status: getField('Overall trial status'),
        recruitment_status: getField('Recruitment status'),
        plain_english_summary: getSection('Plain English Summary'),
        trial_website: getField('Trial website'),
        
        // Contact
        contact_name: getField('Public contact name'),
        contact_email: getField('Public contact email'),
        contact_address: getField('Public contact address'),
        contact_phone: getField('Public contact phone'),
        contact_orcid: getField('ORCID ID'),
        
        // Sponsor
        sponsor_name: getField('Primary sponsor name'),
        sponsor_type: getField('Primary sponsor type'),
        sponsor_website: getField('Sponsor website'),
        
        // Study details
        primary_study_design: getField('Primary study design'),
        secondary_study_design: getField('Secondary study design'),
        trial_setting: getField('Trial setting'),
        trial_type: getField('Trial type'),
        condition: getField('Condition'),
        intervention: getSection('Intervention'),
        intervention_type: getField('Intervention type'),
        primary_outcome_measures: getSection('Primary outcome measures'),
        secondary_outcome_measures: getSection('Secondary outcome measures'),
        
        // Participants
        participant_inclusion_criteria: getSection('Participant inclusion criteria'),
        participant_exclusion_criteria: getSection('Participant exclusion criteria'),
        participant_type: getField('Participant type'),
        age_group: getField('Age group'),
        gender: getField('Gender'),
        target_enrollment: getField('Target number of participants'),
        
        // Locations
        countries_of_recruitment: this.parseCountries(getField('Countries of recruitment')),
        trial_participating_centre: getField('Trial participating centre'),
        
        // Other IDs
        eudract_number: getField('EudraCT number'),
        clinicaltrials_gov_number: getField('ClinicalTrials.gov number'),
        protocol_serial_number: getField('Protocol/serial number'),
        additional_reference_numbers: []
      };
    } catch (error) {
      console.error(`Error scraping ${isrctnId}:`, error);
      return null;
    }
  }

  /**
   * Parse countries string to array
   */
  private parseCountries(countriesStr: string | string[]): string[] {
    if (Array.isArray(countriesStr)) {
      return countriesStr;
    }
    
    if (!countriesStr) {
      return [];
    }
    
    return countriesStr.split(/[,;]/).map(c => c.trim()).filter(Boolean);
  }

  /**
   * Transform ISRCTN trial to our database format
   */
  private transformTrial(trial: ISRCTNTrial): any {
    // Map recruitment status
    const statusMap: Record<string, string> = {
      'recruiting': 'RECRUITING',
      'not recruiting': 'NOT_YET_RECRUITING',
      'no longer recruiting': 'ACTIVE_NOT_RECRUITING',
      'stopped': 'TERMINATED',
      'completed': 'COMPLETED',
      'suspended': 'SUSPENDED'
    };
    
    const status = statusMap[trial.recruitment_status.toLowerCase()] || 'UNKNOWN';
    
    // Parse age range
    const ageMatch = trial.age_group.match(/(\d+)\s*(?:years?)?\s*(?:to|-)\s*(\d+)\s*(?:years?)?/i);
    const minimumAge = ageMatch ? `${ageMatch[1]} Years` : 'N/A';
    const maximumAge = ageMatch ? `${ageMatch[2]} Years` : 'N/A';
    
    // Build locations
    const locations = trial.countries_of_recruitment.map(country => ({
      facility: trial.trial_participating_centre || 'Unknown Facility',
      city: 'Unknown',
      country: country,
      status: status
    }));
    
    // Build eligibility criteria
    const eligibilityCriteria = {
      inclusion: trial.participant_inclusion_criteria,
      exclusion: trial.participant_exclusion_criteria || '',
      gender: trial.gender || 'All',
      minimumAge: minimumAge,
      maximumAge: maximumAge,
      healthyVolunteers: trial.participant_type.toLowerCase().includes('healthy') ? 'Yes' : 'No'
    };
    
    // Build contacts
    const contacts = [];
    if (trial.contact_email) {
      contacts.push({
        name: trial.contact_name || 'Public Contact',
        email: trial.contact_email,
        phone: trial.contact_phone,
        role: 'Public Contact'
      });
    }
    
    return {
      nct_id: trial.isrctn_id, // Use ISRCTN ID as primary key
      external_ids: {
        isrctn_id: trial.isrctn_id,
        nct_id: trial.clinicaltrials_gov_number,
        eudract_number: trial.eudract_number,
        protocol_number: trial.protocol_serial_number,
        doi: trial.doi
      },
      title: trial.title,
      brief_title: trial.title,
      official_title: trial.title,
      acronym: trial.acronym,
      status: status,
      phase: this.extractPhase(trial.primary_study_design),
      study_type: trial.trial_type,
      conditions: [trial.condition].filter(Boolean),
      interventions: [{
        type: trial.intervention_type,
        name: trial.intervention
      }].filter(i => i.name),
      sponsors: {
        lead: trial.sponsor_name,
        collaborators: []
      },
      locations: locations,
      eligibility_criteria: eligibilityCriteria,
      primary_outcome: trial.primary_outcome_measures,
      secondary_outcomes: trial.secondary_outcome_measures ? [trial.secondary_outcome_measures] : [],
      enrollment: parseInt(trial.target_enrollment) || null,
      start_date: trial.date_assigned,
      completion_date: null,
      last_update_date: trial.last_edited,
      verification_date: trial.last_edited,
      first_posted_date: trial.date_assigned,
      results_first_posted_date: null,
      contacts: contacts,
      references: [],
      brief_summary: trial.plain_english_summary,
      detailed_description: '',
      registry_url: `${this.baseUrl}/${trial.isrctn_id}`,
      source: 'ISRCTN',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  /**
   * Extract phase from study design
   */
  private extractPhase(studyDesign: string): string {
    const design = studyDesign.toLowerCase();
    
    if (design.includes('phase 4') || design.includes('phase iv')) return 'Phase 4';
    if (design.includes('phase 3') || design.includes('phase iii')) return 'Phase 3';
    if (design.includes('phase 2') || design.includes('phase ii')) return 'Phase 2';
    if (design.includes('phase 1') || design.includes('phase i')) return 'Phase 1';
    if (design.includes('phase 0')) return 'Early Phase 1';
    
    return 'N/A';
  }

  /**
   * Main scraping function
   */
  async scrape(): Promise<void> {
    console.log('🔍 Starting ISRCTN scraper...');
    
    // Load checkpoint
    const checkpoint = await this.loadCheckpoint();
    let currentPage = checkpoint.lastPage + 1;
    const processedIds = new Set(checkpoint.processedIds);
    
    let totalImported = 0;
    let totalErrors = 0;
    
    try {
      // Get first page to determine total pages
      const { trials: firstPageTrials, totalPages } = await this.searchTrials(1);
      console.log(`📊 Found ${totalPages} pages of trials to process`);
      
      // Process all pages
      for (let page = currentPage; page <= totalPages; page++) {
        console.log(`\n📄 Processing page ${page}/${totalPages}`);
        
        const { trials } = await this.searchTrials(page);
        
        for (const trialSummary of trials) {
          const isrctnId = trialSummary.isrctn_id;
          
          if (processedIds.has(isrctnId)) {
            continue;
          }
          
          try {
            // Fetch detailed trial information
            const trial = await this.fetchTrialDetails(isrctnId);
            
            if (!trial) {
              console.error(`❌ Failed to fetch details for ${isrctnId}`);
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
              console.error(`❌ Database error for ${isrctnId}:`, error);
              totalErrors++;
            } else {
              totalImported++;
              processedIds.add(isrctnId);
              console.log(`✅ Imported ${isrctnId} (${totalImported} total)`);
            }
            
            // Rate limiting
            await this.sleep(this.rateLimit);
            
          } catch (error) {
            console.error(`❌ Error processing ${isrctnId}:`, error);
            totalErrors++;
          }
        }
        
        // Save checkpoint after each page
        await this.saveCheckpoint(page, Array.from(processedIds));
      }
      
    } catch (error) {
      console.error('❌ Scraper error:', error);
      throw error;
    }
    
    console.log('\n✅ ISRCTN Scraping Complete:');
    console.log(`   - Total imported: ${totalImported}`);
    console.log(`   - Total errors: ${totalErrors}`);
  }
}

// Run if called directly
if (require.main === module) {
  const scraper = new ISRCTNScraper();
  scraper.scrape().catch(console.error);
}