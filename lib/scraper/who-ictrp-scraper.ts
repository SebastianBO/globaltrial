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

interface ICTRPTrial {
  primary_registry_id: string;
  last_refreshed_on: string;
  primary_sponsor: string;
  public_title: string;
  scientific_title: string;
  date_registration: string;
  date_enrolment: string;
  recruitment_status: string;
  study_type: string;
  study_design: string;
  phase: string;
  countries: string[];
  condition: string;
  intervention: string;
  age_minimum: string;
  age_maximum: string;
  gender: string;
  inclusion_criteria: string;
  exclusion_criteria: string;
  primary_outcome: string;
  key_secondary_outcomes: string;
  target_size: string;
  contact_firstname: string;
  contact_lastname: string;
  contact_address: string;
  contact_email: string;
  contact_tel: string;
  contact_affiliation: string;
  secondary_ids: string[];
  source_register: string;
  web_address: string;
}

export class WHOICTRPScraper {
  private downloadDir = path.join(process.cwd(), 'data', 'who-ictrp');
  private checkpointFile = path.join(this.downloadDir, 'checkpoint.json');
  private processedTrialsFile = path.join(this.downloadDir, 'processed-trials.json');

  constructor() {
    this.ensureDirectoryExists();
  }

  private async ensureDirectoryExists() {
    await fs.mkdir(this.downloadDir, { recursive: true });
  }

  /**
   * Download the weekly export from WHO ICTRP
   * Note: This requires manual download as WHO doesn't provide public API
   * The file should be placed in data/who-ictrp/ICTRPWeek[YYYYMMDD].zip
   */
  async downloadLatestExport(): Promise<string> {
    console.log('⚠️  WHO ICTRP requires manual download of weekly exports');
    console.log('📥 Please download the latest export from:');
    console.log('   https://www.who.int/clinical-trials-registry-platform/the-ictrp-search-portal');
    console.log(`📁 Place the ZIP file in: ${this.downloadDir}`);
    
    // Check for existing files
    const files = await fs.readdir(this.downloadDir);
    const zipFiles = files.filter(f => f.startsWith('ICTRPWeek') && f.endsWith('.zip'));
    
    if (zipFiles.length === 0) {
      throw new Error('No WHO ICTRP export files found. Please download manually.');
    }
    
    // Use the most recent file
    const latestFile = zipFiles.sort().pop()!;
    console.log(`✅ Found export file: ${latestFile}`);
    
    return path.join(this.downloadDir, latestFile);
  }

  /**
   * Extract and parse WHO ICTRP XML data
   */
  async extractAndParseExport(zipPath: string): Promise<ICTRPTrial[]> {
    const trials: ICTRPTrial[] = [];
    const extractDir = path.join(this.downloadDir, 'extracted');
    
    // Create extraction directory
    await fs.mkdir(extractDir, { recursive: true });
    
    // Extract ZIP file
    await fs.createReadStream(zipPath)
      .pipe(unzipper.Extract({ path: extractDir }))
      .promise();
    
    // Find XML files
    const files = await fs.readdir(extractDir);
    const xmlFiles = files.filter(f => f.endsWith('.xml'));
    
    console.log(`📄 Found ${xmlFiles.length} XML files to process`);
    
    // Parse each XML file
    for (const xmlFile of xmlFiles) {
      const xmlPath = path.join(extractDir, xmlFile);
      const xmlContent = await fs.readFile(xmlPath, 'utf-8');
      
      try {
        const parsed = await xml2js.parseStringPromise(xmlContent);
        const extractedTrials = this.extractTrialsFromXML(parsed);
        trials.push(...extractedTrials);
      } catch (error) {
        console.error(`❌ Error parsing ${xmlFile}:`, error);
      }
    }
    
    // Clean up extracted files
    await fs.rm(extractDir, { recursive: true, force: true });
    
    return trials;
  }

  /**
   * Extract trial data from parsed XML
   */
  private extractTrialsFromXML(data: any): ICTRPTrial[] {
    const trials: ICTRPTrial[] = [];
    
    // WHO ICTRP XML structure varies, but typically has a root element with trial records
    const trialRecords = data.trials?.trial || data.clinical_trials?.clinical_trial || [];
    
    for (const record of Array.isArray(trialRecords) ? trialRecords : [trialRecords]) {
      try {
        const trial: ICTRPTrial = {
          primary_registry_id: this.getField(record, 'main_id', 'id'),
          last_refreshed_on: this.getField(record, 'last_refreshed_on', 'date_updated'),
          primary_sponsor: this.getField(record, 'primary_sponsor', 'sponsor'),
          public_title: this.getField(record, 'public_title', 'title'),
          scientific_title: this.getField(record, 'scientific_title'),
          date_registration: this.getField(record, 'date_registration', 'registration_date'),
          date_enrolment: this.getField(record, 'date_enrolment', 'enrollment_date'),
          recruitment_status: this.getField(record, 'recruitment_status', 'status'),
          study_type: this.getField(record, 'study_type', 'type'),
          study_design: this.getField(record, 'study_design', 'design'),
          phase: this.getField(record, 'phase'),
          countries: this.extractCountries(record),
          condition: this.getField(record, 'condition', 'health_condition'),
          intervention: this.getField(record, 'intervention'),
          age_minimum: this.getField(record, 'agemin', 'age_minimum'),
          age_maximum: this.getField(record, 'agemax', 'age_maximum'),
          gender: this.getField(record, 'gender', 'sex'),
          inclusion_criteria: this.getField(record, 'inclusion_criteria'),
          exclusion_criteria: this.getField(record, 'exclusion_criteria'),
          primary_outcome: this.getField(record, 'primary_outcome'),
          key_secondary_outcomes: this.getField(record, 'key_secondary_outcomes', 'secondary_outcomes'),
          target_size: this.getField(record, 'target_size', 'enrollment'),
          contact_firstname: this.getField(record, 'contact_firstname'),
          contact_lastname: this.getField(record, 'contact_lastname'),
          contact_address: this.getField(record, 'contact_address'),
          contact_email: this.getField(record, 'contact_email'),
          contact_tel: this.getField(record, 'contact_tel', 'contact_phone'),
          contact_affiliation: this.getField(record, 'contact_affiliation'),
          secondary_ids: this.extractSecondaryIds(record),
          source_register: this.getField(record, 'source_register', 'registry'),
          web_address: this.getField(record, 'web_address', 'url')
        };
        
        trials.push(trial);
      } catch (error) {
        console.error('Error extracting trial:', error);
      }
    }
    
    return trials;
  }

  /**
   * Get field value from various possible locations in the XML
   */
  private getField(record: any, ...fieldNames: string[]): string {
    for (const fieldName of fieldNames) {
      const value = record[fieldName]?.[0] || record[fieldName];
      if (value) {
        return typeof value === 'string' ? value : value.toString();
      }
    }
    return '';
  }

  /**
   * Extract countries array from record
   */
  private extractCountries(record: any): string[] {
    const countries = record.countries || record.country || record.recruitment_countries;
    if (!countries) return [];
    
    if (Array.isArray(countries)) {
      return countries.map(c => typeof c === 'string' ? c : c.country?.[0] || c.name?.[0] || '').filter(Boolean);
    }
    
    if (typeof countries === 'string') {
      return countries.split(/[;,]/).map(c => c.trim()).filter(Boolean);
    }
    
    return [];
  }

  /**
   * Extract secondary IDs (including NCT numbers, EudraCT numbers, etc.)
   */
  private extractSecondaryIds(record: any): string[] {
    const ids: string[] = [];
    
    // Check various possible locations for secondary IDs
    const secondaryIdFields = [
      record.secondary_ids,
      record.secondary_id,
      record.other_ids,
      record.nct_id,
      record.eudract_number
    ];
    
    for (const field of secondaryIdFields) {
      if (!field) continue;
      
      if (Array.isArray(field)) {
        ids.push(...field.map(id => typeof id === 'string' ? id : id.id?.[0] || '').filter(Boolean));
      } else if (typeof field === 'string') {
        ids.push(field);
      }
    }
    
    return [...new Set(ids)]; // Remove duplicates
  }

  /**
   * Transform WHO ICTRP trial to our database format
   */
  private transformTrial(trial: ICTRPTrial): any {
    // Extract NCT ID from secondary IDs if available
    const nctId = trial.secondary_ids.find(id => id.startsWith('NCT')) || null;
    
    // Map recruitment status to our status format
    const statusMap: Record<string, string> = {
      'recruiting': 'RECRUITING',
      'not recruiting': 'NOT_YET_RECRUITING',
      'active': 'ACTIVE_NOT_RECRUITING',
      'completed': 'COMPLETED',
      'suspended': 'SUSPENDED',
      'terminated': 'TERMINATED',
      'withdrawn': 'WITHDRAWN',
      'unknown': 'UNKNOWN'
    };
    
    const status = statusMap[trial.recruitment_status.toLowerCase()] || 'UNKNOWN';
    
    // Build location data
    const locations = trial.countries.map(country => ({
      facility: trial.contact_affiliation || 'Unknown Facility',
      city: 'Unknown',
      country: country,
      status: status
    }));
    
    // Build eligibility criteria
    const eligibilityCriteria = {
      inclusion: trial.inclusion_criteria,
      exclusion: trial.exclusion_criteria,
      gender: trial.gender || 'All',
      minimumAge: trial.age_minimum || 'N/A',
      maximumAge: trial.age_maximum || 'N/A'
    };
    
    // Build contact info
    const contacts = [];
    if (trial.contact_email || trial.contact_tel) {
      contacts.push({
        name: `${trial.contact_firstname} ${trial.contact_lastname}`.trim() || 'Contact',
        email: trial.contact_email,
        phone: trial.contact_tel,
        role: 'Contact'
      });
    }
    
    return {
      // Use ICTRP ID with registry prefix
      nct_id: trial.primary_registry_id,
      external_ids: {
        ictrp_id: trial.primary_registry_id,
        nct_id: nctId,
        secondary_ids: trial.secondary_ids,
        registry: trial.source_register
      },
      title: trial.public_title || trial.scientific_title,
      brief_title: trial.public_title,
      official_title: trial.scientific_title,
      status: status,
      phase: trial.phase || 'N/A',
      study_type: trial.study_type,
      conditions: trial.condition.split(/[;,]/).map(c => c.trim()).filter(Boolean),
      interventions: trial.intervention.split(/[;,]/).map(i => ({
        type: 'Unknown',
        name: i.trim()
      })).filter(i => i.name),
      sponsors: {
        lead: trial.primary_sponsor,
        collaborators: []
      },
      locations: locations,
      eligibility_criteria: eligibilityCriteria,
      primary_outcome: trial.primary_outcome,
      secondary_outcomes: trial.key_secondary_outcomes.split(/[;,]/).map(o => o.trim()).filter(Boolean),
      enrollment: parseInt(trial.target_size) || null,
      start_date: trial.date_enrolment,
      completion_date: null,
      last_update_date: trial.last_refreshed_on,
      verification_date: trial.last_refreshed_on,
      first_posted_date: trial.date_registration,
      results_first_posted_date: null,
      contacts: contacts,
      references: [],
      registry_url: trial.web_address,
      source: 'WHO_ICTRP',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  /**
   * Import trials to database
   */
  async importTrials(trials: ICTRPTrial[]): Promise<void> {
    console.log(`📥 Importing ${trials.length} trials from WHO ICTRP`);
    
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
      if (processedIds.has(trial.primary_registry_id)) {
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
          console.error(`❌ Error importing ${trial.primary_registry_id}:`, error);
          errors++;
        } else {
          imported++;
          processedIds.add(trial.primary_registry_id);
          
          // Save checkpoint every 100 trials
          if (imported % 100 === 0) {
            await this.saveCheckpoint(processedIds);
            console.log(`✅ Imported ${imported} trials...`);
          }
        }
      } catch (error) {
        console.error(`❌ Error transforming ${trial.primary_registry_id}:`, error);
        errors++;
      }
    }
    
    // Save final checkpoint
    await this.saveCheckpoint(processedIds);
    
    console.log(`\n✅ WHO ICTRP Import Complete:`);
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
      // Get the export file
      const zipPath = await this.downloadLatestExport();
      
      // Extract and parse trials
      console.log('📤 Extracting and parsing WHO ICTRP data...');
      const trials = await this.extractAndParseExport(zipPath);
      
      console.log(`✅ Extracted ${trials.length} trials from WHO ICTRP`);
      
      // Import to database
      await this.importTrials(trials);
      
    } catch (error) {
      console.error('❌ WHO ICTRP import failed:', error);
      throw error;
    }
  }
}

// Run if called directly
if (require.main === module) {
  const scraper = new WHOICTRPScraper();
  scraper.import().catch(console.error);
}