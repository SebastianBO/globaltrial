import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import * as xml2js from 'xml2js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as unzipper from 'unzipper';
import { format } from 'date-fns';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface EUCTRTrial {
  eudract_number: string;
  sponsor_protocol_number?: string;
  sponsor_name: string;
  full_title: string;
  trial_protocol_title?: string;
  acronym?: string;
  
  // Status information
  trial_status: string;
  date_on_which_this_record_was_first_entered: string;
  
  // Medical condition
  medical_condition: string;
  disease_name?: string;
  disease_meddra_classification?: string;
  therapeutic_area?: string;
  
  // Population
  population_age: {
    adults: boolean;
    elderly: boolean;
    children: boolean;
    
    // Specific age groups for children
    newborns?: boolean; // 0-27 days
    infants_toddlers?: boolean; // 28 days-23 months
    children_2_11?: boolean; // 2-11 years
    adolescents?: boolean; // 12-17 years
  };
  gender: string;
  
  // Trial design
  trial_type: string;
  trial_phase: string;
  controlled: boolean;
  randomised: boolean;
  open_blinded: string;
  single_double_blinded?: string;
  parallel_group?: boolean;
  cross_over?: boolean;
  other_trial_design?: string;
  
  // Interventions
  trade_name?: string;
  product_name?: string;
  product_code?: string;
  pharmaceutical_form?: string;
  concentration?: string;
  active_substance?: string;
  routes_of_administration?: string[];
  
  // Objectives and endpoints
  main_objective: string;
  primary_endpoint: string;
  secondary_objectives?: string;
  secondary_endpoints?: string;
  
  // Inclusion/Exclusion criteria
  principal_inclusion_criteria: string;
  principal_exclusion_criteria: string;
  
  // Trial sites and ethics
  member_state_concerned: string[];
  eudract_number_of_the_trial_in_other_member_states?: string[];
  trial_being_conducted_globally?: boolean;
  countries_outside_eu?: string[];
  
  // Ethics committee opinion
  ethics_committee_opinion?: string;
  date_of_ethics_committee_opinion?: string;
  ethics_committee_opinion_reasons?: string;
  
  // Competent authority decision
  competent_authority_decision?: string;
  date_of_competent_authority_decision?: string;
  
  // Recruitment information
  recruitment_status_for_this_member_state?: string;
  date_of_first_enrollment?: string;
  target_number_of_subjects?: number;
  actually_enrolled_subjects?: number;
  
  // Sponsor contact information
  sponsor_contact_details?: {
    organisation: string;
    name?: string;
    address?: string;
    telephone?: string;
    email?: string;
  };
  
  // Results
  results_available?: boolean;
  completion_date?: string;
  global_end_of_trial_date?: string;
  
  // Links
  link_to_protocol?: string;
  link_to_results?: string;
}

export class EUCTRBulkScraper {
  private baseUrl = 'https://www.clinicaltrialsregister.eu';
  private bulkDownloadUrl = 'https://www.clinicaltrialsregister.eu/about.html'; // Check for bulk download link
  private downloadDir = path.join(process.cwd(), 'data', 'eu-ctr');
  private checkpointFile = path.join(this.downloadDir, 'checkpoint.json');
  private processedTrialsFile = path.join(this.downloadDir, 'processed-trials.json');

  constructor() {
    this.ensureDirectoryExists();
  }

  private async ensureDirectoryExists() {
    await fs.mkdir(this.downloadDir, { recursive: true });
  }

  /**
   * Download bulk XML data from EU CTR
   * Note: EU CTR doesn't provide a direct API, but offers bulk downloads
   */
  async downloadBulkData(): Promise<string> {
    console.log('📥 Downloading EU CTR bulk data...');
    
    // EU CTR provides weekly exports - check their website for the current link
    // For now, we'll simulate with a placeholder
    console.log('⚠️  EU CTR bulk download requires manual download');
    console.log('📥 Please download the latest export from:');
    console.log('   https://www.clinicaltrialsregister.eu/about.html');
    console.log('   Look for "Download all records" or similar link');
    console.log(`📁 Place the downloaded file in: ${this.downloadDir}`);
    
    // Check for existing files
    const files = await fs.readdir(this.downloadDir);
    const xmlFiles = files.filter(f => f.endsWith('.xml') || f.endsWith('.zip'));
    
    if (xmlFiles.length === 0) {
      throw new Error('No EU CTR data files found. Please download manually.');
    }
    
    // Use the most recent file
    const dataFile = xmlFiles.sort().pop()!;
    console.log(`✅ Found data file: ${dataFile}`);
    
    return path.join(this.downloadDir, dataFile);
  }

  /**
   * Parse EU CTR XML data
   */
  async parseXMLData(filePath: string): Promise<EUCTRTrial[]> {
    const trials: EUCTRTrial[] = [];
    
    try {
      // Check if it's a ZIP file
      if (filePath.endsWith('.zip')) {
        // Extract ZIP first
        const extractDir = path.join(this.downloadDir, 'extracted');
        await fs.mkdir(extractDir, { recursive: true });
        
        await fs.createReadStream(filePath)
          .pipe(unzipper.Extract({ path: extractDir }))
          .promise();
        
        // Find XML files in extracted directory
        const extractedFiles = await fs.readdir(extractDir);
        const xmlFiles = extractedFiles.filter(f => f.endsWith('.xml'));
        
        for (const xmlFile of xmlFiles) {
          const xmlPath = path.join(extractDir, xmlFile);
          const xmlContent = await fs.readFile(xmlPath, 'utf-8');
          const parsedTrials = await this.parseXMLContent(xmlContent);
          trials.push(...parsedTrials);
        }
        
        // Clean up
        await fs.rm(extractDir, { recursive: true, force: true });
      } else {
        // Direct XML file
        const xmlContent = await fs.readFile(filePath, 'utf-8');
        const parsedTrials = await this.parseXMLContent(xmlContent);
        trials.push(...parsedTrials);
      }
      
    } catch (error) {
      console.error('Error parsing XML data:', error);
      throw error;
    }
    
    return trials;
  }

  /**
   * Parse XML content
   */
  private async parseXMLContent(xmlContent: string): Promise<EUCTRTrial[]> {
    const trials: EUCTRTrial[] = [];
    
    try {
      const parser = new xml2js.Parser({
        explicitArray: false,
        ignoreAttrs: true,
        normalize: true,
        normalizeTags: true
      });
      
      const result = await parser.parseStringPromise(xmlContent);
      
      // EU CTR XML structure varies, but typically has trials under a root element
      const trialElements = this.extractTrialElements(result);
      
      for (const element of trialElements) {
        try {
          const trial = this.extractTrialData(element);
          if (trial) {
            trials.push(trial);
          }
        } catch (error) {
          console.error('Error extracting trial data:', error);
        }
      }
      
    } catch (error) {
      console.error('Error parsing XML:', error);
    }
    
    return trials;
  }

  /**
   * Extract trial elements from parsed XML
   */
  private extractTrialElements(data: any): any[] {
    // Try different possible structures
    if (data.trials?.trial) {
      return Array.isArray(data.trials.trial) ? data.trials.trial : [data.trials.trial];
    }
    if (data.euclinicaltrials?.trial) {
      return Array.isArray(data.euclinicaltrials.trial) ? data.euclinicaltrials.trial : [data.euclinicaltrials.trial];
    }
    if (data.clinicaltrial) {
      return Array.isArray(data.clinicaltrial) ? data.clinicaltrial : [data.clinicaltrial];
    }
    
    // If structure is unknown, log it for debugging
    console.log('Unknown XML structure:', Object.keys(data));
    return [];
  }

  /**
   * Extract trial data from XML element
   */
  private extractTrialData(element: any): EUCTRTrial | null {
    try {
      // Helper function to get nested value
      const getValue = (obj: any, ...paths: string[]): string => {
        for (const path of paths) {
          const value = path.split('.').reduce((o, p) => o?.[p], obj);
          if (value) return String(value);
        }
        return '';
      };
      
      // Helper to check boolean fields
      const getBoolean = (value: any): boolean => {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
          return value.toLowerCase() === 'yes' || value.toLowerCase() === 'true';
        }
        return false;
      };
      
      // Extract EudraCT number (required)
      const eudractNumber = getValue(element, 'eudractnumber', 'identification.eudractnumber', 'a1_member_state_concerned.eudractnumber');
      if (!eudractNumber) return null;
      
      const trial: EUCTRTrial = {
        eudract_number: eudractNumber,
        sponsor_protocol_number: getValue(element, 'sponsorprotocolnumber', 'identification.sponsorprotocolnumber'),
        sponsor_name: getValue(element, 'sponsorname', 'sponsor.sponsorname', 'b_sponsor_information.name_of_sponsor'),
        full_title: getValue(element, 'fulltitle', 'scientifictitle', 'e_general_information_on_the_trial.full_title_of_the_trial'),
        trial_protocol_title: getValue(element, 'trialprotocoltitle'),
        acronym: getValue(element, 'acronym', 'trial_acronym'),
        
        // Status
        trial_status: getValue(element, 'trialstatus', 'overall_status', 'p_end_of_trial.trial_status'),
        date_on_which_this_record_was_first_entered: getValue(element, 'daterecordentered', 'first_entered'),
        
        // Medical condition
        medical_condition: getValue(element, 'medicalcondition', 'condition', 'e_general_information_on_the_trial.medical_condition_being_investigated'),
        disease_name: getValue(element, 'diseasename'),
        disease_meddra_classification: getValue(element, 'meddraclassification'),
        therapeutic_area: getValue(element, 'therapeuticarea'),
        
        // Population
        population_age: {
          adults: getBoolean(getValue(element, 'adults', 'f_population_of_trial_subjects.adults')),
          elderly: getBoolean(getValue(element, 'elderly', 'f_population_of_trial_subjects.elderly')),
          children: getBoolean(getValue(element, 'children', 'f_population_of_trial_subjects.children')),
          newborns: getBoolean(getValue(element, 'newborns')),
          infants_toddlers: getBoolean(getValue(element, 'infants')),
          children_2_11: getBoolean(getValue(element, 'children_2_11')),
          adolescents: getBoolean(getValue(element, 'adolescents'))
        },
        gender: getValue(element, 'gender', 'f_population_of_trial_subjects.gender') || 'Both',
        
        // Trial design
        trial_type: getValue(element, 'trialtype', 'trial_type'),
        trial_phase: getValue(element, 'trialphase', 'phase', 'e_general_information_on_the_trial.trial_phase'),
        controlled: getBoolean(getValue(element, 'controlled')),
        randomised: getBoolean(getValue(element, 'randomised')),
        open_blinded: getValue(element, 'openblinded', 'blinding'),
        single_double_blinded: getValue(element, 'singledoubleblinded'),
        parallel_group: getBoolean(getValue(element, 'parallelgroup')),
        cross_over: getBoolean(getValue(element, 'crossover')),
        other_trial_design: getValue(element, 'othertrialdesign'),
        
        // Interventions
        trade_name: getValue(element, 'tradename', 'd_imp_identification.trade_name'),
        product_name: getValue(element, 'productname'),
        product_code: getValue(element, 'productcode'),
        pharmaceutical_form: getValue(element, 'pharmaceuticalform'),
        concentration: getValue(element, 'concentration'),
        active_substance: getValue(element, 'activesubstance', 'inn'),
        routes_of_administration: this.extractArray(element, 'routesofadministration'),
        
        // Objectives
        main_objective: getValue(element, 'mainobjective', 'e_general_information_on_the_trial.main_objective'),
        primary_endpoint: getValue(element, 'primaryendpoint', 'e_general_information_on_the_trial.primary_endpoint'),
        secondary_objectives: getValue(element, 'secondaryobjectives'),
        secondary_endpoints: getValue(element, 'secondaryendpoints'),
        
        // Criteria
        principal_inclusion_criteria: getValue(element, 'incluscioncriteria', 'f_population_of_trial_subjects.principal_inclusion_criteria'),
        principal_exclusion_criteria: getValue(element, 'exclusioncriteria', 'f_population_of_trial_subjects.principal_exclusion_criteria'),
        
        // Sites
        member_state_concerned: this.extractArray(element, 'memberstateconcerned', 'a1_member_state_concerned.member_state_concerned'),
        eudract_number_of_the_trial_in_other_member_states: this.extractArray(element, 'othermemberstates'),
        trial_being_conducted_globally: getBoolean(getValue(element, 'globaltrail')),
        countries_outside_eu: this.extractArray(element, 'countriesoutsideeu'),
        
        // Ethics
        ethics_committee_opinion: getValue(element, 'ethicscommitteeopinion'),
        date_of_ethics_committee_opinion: getValue(element, 'dateethicsopinion'),
        ethics_committee_opinion_reasons: getValue(element, 'ethicsopinionreasons'),
        
        // Authority
        competent_authority_decision: getValue(element, 'competentauthoritydecision'),
        date_of_competent_authority_decision: getValue(element, 'datecompetentdecision'),
        
        // Recruitment
        recruitment_status_for_this_member_state: getValue(element, 'recruitmentstatus'),
        date_of_first_enrollment: getValue(element, 'datefirstenrollment'),
        target_number_of_subjects: parseInt(getValue(element, 'targetnumbersubjects')) || undefined,
        actually_enrolled_subjects: parseInt(getValue(element, 'actuallyenrolled')) || undefined,
        
        // Sponsor contact
        sponsor_contact_details: this.extractSponsorContact(element),
        
        // Results
        results_available: getBoolean(getValue(element, 'resultsavailable')),
        completion_date: getValue(element, 'completiondate'),
        global_end_of_trial_date: getValue(element, 'globalenddate'),
        
        // Links
        link_to_protocol: getValue(element, 'protocollink'),
        link_to_results: getValue(element, 'resultslink')
      };
      
      return trial;
      
    } catch (error) {
      console.error('Error extracting trial data:', error);
      return null;
    }
  }

  /**
   * Extract array values from various formats
   */
  private extractArray(element: any, ...paths: string[]): string[] {
    for (const path of paths) {
      const value = path.split('.').reduce((o, p) => o?.[p], element);
      if (value) {
        if (Array.isArray(value)) {
          return value.map(v => String(v));
        }
        if (typeof value === 'string') {
          return value.split(/[;,]/).map(s => s.trim()).filter(Boolean);
        }
      }
    }
    return [];
  }

  /**
   * Extract sponsor contact details
   */
  private extractSponsorContact(element: any): EUCTRTrial['sponsor_contact_details'] | undefined {
    const contact = element.sponsorcontact || element.b_sponsor_information?.contact;
    if (!contact) return undefined;
    
    return {
      organisation: contact.organisation || contact.name || '',
      name: contact.contactname,
      address: contact.address,
      telephone: contact.telephone || contact.phone,
      email: contact.email
    };
  }

  /**
   * Transform EU CTR trial to our database format
   */
  private transformTrial(trial: EUCTRTrial): any {
    // Map status
    const statusMap: Record<string, string> = {
      'ongoing': 'RECRUITING',
      'completed': 'COMPLETED',
      'terminated': 'TERMINATED',
      'suspended': 'SUSPENDED',
      'not yet recruiting': 'NOT_YET_RECRUITING',
      'restarted': 'RECRUITING'
    };
    
    const status = statusMap[trial.trial_status?.toLowerCase()] || 'UNKNOWN';
    
    // Determine age range
    let minimumAge = 'N/A';
    let maximumAge = 'N/A';
    
    if (trial.population_age.newborns) minimumAge = '0 Days';
    else if (trial.population_age.infants_toddlers) minimumAge = '28 Days';
    else if (trial.population_age.children_2_11) minimumAge = '2 Years';
    else if (trial.population_age.adolescents) minimumAge = '12 Years';
    else if (trial.population_age.adults) minimumAge = '18 Years';
    else if (trial.population_age.elderly) minimumAge = '65 Years';
    
    if (trial.population_age.elderly) maximumAge = 'N/A';
    else if (trial.population_age.adults && !trial.population_age.elderly) maximumAge = '64 Years';
    else if (trial.population_age.adolescents) maximumAge = '17 Years';
    else if (trial.population_age.children_2_11) maximumAge = '11 Years';
    else if (trial.population_age.infants_toddlers) maximumAge = '23 Months';
    else if (trial.population_age.newborns) maximumAge = '27 Days';
    
    // Build locations
    const locations = trial.member_state_concerned.map(country => ({
      facility: 'Multiple Sites',
      city: 'Multiple Cities',
      country: this.mapCountryCode(country),
      status: status
    }));
    
    // Add non-EU countries
    if (trial.countries_outside_eu) {
      locations.push(...trial.countries_outside_eu.map(country => ({
        facility: 'Multiple Sites',
        city: 'Multiple Cities',
        country: country,
        status: status
      })));
    }
    
    // Build eligibility criteria
    const eligibilityCriteria = {
      inclusion: trial.principal_inclusion_criteria,
      exclusion: trial.principal_exclusion_criteria,
      gender: trial.gender || 'All',
      minimumAge: minimumAge,
      maximumAge: maximumAge
    };
    
    // Build interventions
    const interventions = [];
    if (trial.product_name || trial.trade_name) {
      interventions.push({
        type: 'Drug',
        name: trial.trade_name || trial.product_name || 'Investigational Product',
        description: [
          trial.active_substance && `Active substance: ${trial.active_substance}`,
          trial.pharmaceutical_form && `Form: ${trial.pharmaceutical_form}`,
          trial.concentration && `Concentration: ${trial.concentration}`,
          trial.routes_of_administration?.length && `Route: ${trial.routes_of_administration.join(', ')}`
        ].filter(Boolean).join(', ')
      });
    }
    
    // Build contacts
    const contacts = [];
    if (trial.sponsor_contact_details?.email) {
      contacts.push({
        name: trial.sponsor_contact_details.name || trial.sponsor_contact_details.organisation,
        email: trial.sponsor_contact_details.email,
        phone: trial.sponsor_contact_details.telephone,
        role: 'Sponsor Contact'
      });
    }
    
    return {
      nct_id: trial.eudract_number, // Use EudraCT number as primary key
      external_ids: {
        eudract_number: trial.eudract_number,
        sponsor_protocol: trial.sponsor_protocol_number,
        other_member_states: trial.eudract_number_of_the_trial_in_other_member_states
      },
      title: trial.full_title || trial.trial_protocol_title,
      brief_title: trial.acronym || trial.full_title,
      official_title: trial.full_title,
      status: status,
      phase: trial.trial_phase || 'N/A',
      study_type: trial.trial_type || 'Interventional',
      conditions: [
        trial.medical_condition,
        trial.disease_name,
        trial.therapeutic_area
      ].filter(Boolean),
      interventions: interventions,
      sponsors: {
        lead: trial.sponsor_name,
        collaborators: []
      },
      locations: locations,
      eligibility_criteria: eligibilityCriteria,
      primary_outcome: trial.primary_endpoint,
      secondary_outcomes: trial.secondary_endpoints ? [trial.secondary_endpoints] : [],
      enrollment: trial.target_number_of_subjects || null,
      start_date: trial.date_of_first_enrollment,
      completion_date: trial.completion_date,
      last_update_date: trial.date_on_which_this_record_was_first_entered,
      verification_date: trial.date_on_which_this_record_was_first_entered,
      first_posted_date: trial.date_on_which_this_record_was_first_entered,
      results_first_posted_date: trial.results_available ? trial.completion_date : null,
      contacts: contacts,
      references: [],
      brief_summary: trial.main_objective,
      detailed_description: [
        trial.secondary_objectives && `Secondary Objectives: ${trial.secondary_objectives}`,
        `Trial Design: ${trial.controlled ? 'Controlled' : 'Uncontrolled'}, ${trial.randomised ? 'Randomised' : 'Non-randomised'}, ${trial.open_blinded}`,
        trial.parallel_group && 'Parallel Group',
        trial.cross_over && 'Cross-over',
        trial.other_trial_design
      ].filter(Boolean).join('\n'),
      registry_url: `${this.baseUrl}/ctr-search/trial/${trial.eudract_number}/`,
      source: 'EU_CTR',
      ethics_info: {
        committee_opinion: trial.ethics_committee_opinion,
        opinion_date: trial.date_of_ethics_committee_opinion,
        authority_decision: trial.competent_authority_decision,
        decision_date: trial.date_of_competent_authority_decision
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  /**
   * Map country codes to full names
   */
  private mapCountryCode(code: string): string {
    const countryMap: Record<string, string> = {
      'AT': 'Austria',
      'BE': 'Belgium',
      'BG': 'Bulgaria',
      'HR': 'Croatia',
      'CY': 'Cyprus',
      'CZ': 'Czech Republic',
      'DK': 'Denmark',
      'EE': 'Estonia',
      'FI': 'Finland',
      'FR': 'France',
      'DE': 'Germany',
      'GR': 'Greece',
      'HU': 'Hungary',
      'IE': 'Ireland',
      'IT': 'Italy',
      'LV': 'Latvia',
      'LT': 'Lithuania',
      'LU': 'Luxembourg',
      'MT': 'Malta',
      'NL': 'Netherlands',
      'PL': 'Poland',
      'PT': 'Portugal',
      'RO': 'Romania',
      'SK': 'Slovakia',
      'SI': 'Slovenia',
      'ES': 'Spain',
      'SE': 'Sweden',
      'GB': 'United Kingdom',
      'UK': 'United Kingdom',
      'IS': 'Iceland',
      'NO': 'Norway',
      'LI': 'Liechtenstein'
    };
    
    return countryMap[code.toUpperCase()] || code;
  }

  /**
   * Import trials to database
   */
  async importTrials(trials: EUCTRTrial[]): Promise<void> {
    console.log(`📥 Importing ${trials.length} trials from EU CTR`);
    
    // Load checkpoint
    let processedIds = new Set<string>();
    try {
      const checkpoint = await fs.readFile(this.checkpointFile, 'utf-8');
      processedIds = new Set(JSON.parse(checkpoint).processedIds || []);
    } catch (error) {
      // No checkpoint file, start fresh
    }
    
    let imported = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const trial of trials) {
      if (processedIds.has(trial.eudract_number)) {
        skipped++;
        continue;
      }
      
      try {
        const transformedTrial = this.transformTrial(trial);
        
        // Insert or update trial
        const { error } = await supabase
          .from('clinical_trials')
          .upsert(transformedTrial, {
            onConflict: 'nct_id'
          });
        
        if (error) {
          console.error(`❌ Error importing ${trial.eudract_number}:`, error);
          errors++;
        } else {
          imported++;
          processedIds.add(trial.eudract_number);
          
          // Save checkpoint every 100 trials
          if (imported % 100 === 0) {
            await this.saveCheckpoint(processedIds);
            console.log(`✅ Imported ${imported} trials...`);
          }
        }
      } catch (error) {
        console.error(`❌ Error transforming ${trial.eudract_number}:`, error);
        errors++;
      }
    }
    
    // Save final checkpoint
    await this.saveCheckpoint(processedIds);
    
    console.log(`\n✅ EU CTR Import Complete:`);
    console.log(`   - Imported: ${imported}`);
    console.log(`   - Skipped: ${skipped}`);
    console.log(`   - Errors: ${errors}`);
  }

  /**
   * Save checkpoint
   */
  private async saveCheckpoint(processedIds: Set<string>): Promise<void> {
    const checkpoint = {
      lastUpdate: new Date().toISOString(),
      processedIds: Array.from(processedIds)
    };
    
    await fs.writeFile(this.checkpointFile, JSON.stringify(checkpoint, null, 2));
  }

  /**
   * Main import function
   */
  async import(): Promise<void> {
    try {
      // Get the data file
      const dataFile = await this.downloadBulkData();
      
      // Parse trials from XML
      console.log('📤 Parsing EU CTR data...');
      const trials = await this.parseXMLData(dataFile);
      
      console.log(`✅ Parsed ${trials.length} trials from EU CTR`);
      
      // Import to database
      await this.importTrials(trials);
      
    } catch (error) {
      console.error('❌ EU CTR import failed:', error);
      throw error;
    }
  }
}

// Run if called directly
if (require.main === module) {
  const scraper = new EUCTRBulkScraper();
  scraper.import().catch(console.error);
}