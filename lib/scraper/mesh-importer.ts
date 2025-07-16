import { createClient } from '@supabase/supabase-js';
import { XMLParser } from 'fast-xml-parser';
import * as fs from 'fs';
import * as https from 'https';
import * as zlib from 'zlib';
import { pipeline } from 'stream/promises';

const MESH_XML_URL = 'https://nlmpubs.nlm.nih.gov/projects/mesh/MESH_FILES/xmlmesh/desc2025.gz';
const BATCH_SIZE = 1000;

interface MeshTerm {
  id: string;
  ui: string;
  name: string;
  scope_note?: string;
  tree_numbers: string[];
  synonyms: string[];
  parent_ids: string[];
  semantic_types: string[];
  is_major_topic: boolean;
  created_at: Date;
}

export class MeshImporter {
  private supabase: any;
  private parser: XMLParser;
  private processedCount: number = 0;
  private totalCount: number = 0;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text'
    });
  }

  async importFullMeshDatabase(): Promise<void> {
    console.log('Starting MeSH database import...');
    
    try {
      // Download and parse MeSH XML
      const xmlData = await this.downloadMeshXML();
      
      // Parse XML
      console.log('Parsing MeSH XML...');
      const parsed = this.parser.parse(xmlData);
      const descriptors = this.ensureArray(parsed.DescriptorRecordSet.DescriptorRecord);
      
      this.totalCount = descriptors.length;
      console.log(`Found ${this.totalCount} MeSH descriptors`);
      
      // Create MeSH tables if not exists
      await this.createMeshTables();
      
      // Process in batches
      for (let i = 0; i < descriptors.length; i += BATCH_SIZE) {
        const batch = descriptors.slice(i, i + BATCH_SIZE);
        await this.processBatch(batch);
        
        this.processedCount += batch.length;
        console.log(`Processed ${this.processedCount}/${this.totalCount} descriptors`);
      }
      
      // Build hierarchy relationships
      await this.buildHierarchy();
      
      // Create indexes
      await this.createIndexes();
      
      console.log('MeSH import completed successfully!');
      
    } catch (error) {
      console.error('MeSH import failed:', error);
      throw error;
    }
  }

  private async downloadMeshXML(): Promise<string> {
    console.log('Downloading MeSH XML file...');
    
    return new Promise((resolve, reject) => {
      const tempFile = '/tmp/mesh.xml.gz';
      const file = fs.createWriteStream(tempFile);
      
      https.get(MESH_XML_URL, (response) => {
        response.pipe(file);
        
        file.on('finish', async () => {
          file.close();
          
          // Decompress
          const compressed = fs.readFileSync(tempFile);
          const decompressed = zlib.gunzipSync(compressed);
          const xml = decompressed.toString('utf-8');
          
          // Clean up
          fs.unlinkSync(tempFile);
          
          resolve(xml);
        });
      }).on('error', (err) => {
        fs.unlinkSync(tempFile);
        reject(err);
      });
    });
  }

  private async createMeshTables(): Promise<void> {
    const createTableSQL = `
      -- Main MeSH descriptors table
      CREATE TABLE IF NOT EXISTS mesh_descriptors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ui VARCHAR(20) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        scope_note TEXT,
        tree_numbers TEXT[],
        semantic_types TEXT[],
        is_major_topic BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- MeSH synonyms table
      CREATE TABLE IF NOT EXISTS mesh_synonyms (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        descriptor_id UUID REFERENCES mesh_descriptors(id) ON DELETE CASCADE,
        synonym VARCHAR(255) NOT NULL,
        language VARCHAR(10) DEFAULT 'en',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- MeSH hierarchy table
      CREATE TABLE IF NOT EXISTS mesh_hierarchy (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        child_id UUID REFERENCES mesh_descriptors(id) ON DELETE CASCADE,
        parent_id UUID REFERENCES mesh_descriptors(id) ON DELETE CASCADE,
        tree_number VARCHAR(50) NOT NULL,
        depth INTEGER NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(child_id, parent_id)
      );

      -- MeSH to lay term mappings
      CREATE TABLE IF NOT EXISTS mesh_lay_mappings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        mesh_id UUID REFERENCES mesh_descriptors(id) ON DELETE CASCADE,
        lay_term VARCHAR(255) NOT NULL,
        explanation TEXT,
        confidence_score NUMERIC(3,2),
        source VARCHAR(50) DEFAULT 'manual',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_mesh_name ON mesh_descriptors(name);
      CREATE INDEX IF NOT EXISTS idx_mesh_ui ON mesh_descriptors(ui);
      CREATE INDEX IF NOT EXISTS idx_mesh_tree ON mesh_descriptors USING GIN(tree_numbers);
      CREATE INDEX IF NOT EXISTS idx_mesh_synonyms ON mesh_synonyms(synonym);
      CREATE INDEX IF NOT EXISTS idx_mesh_hierarchy_child ON mesh_hierarchy(child_id);
      CREATE INDEX IF NOT EXISTS idx_mesh_hierarchy_parent ON mesh_hierarchy(parent_id);
    `;

    const { error } = await this.supabase.rpc('execute_sql', {
      query: createTableSQL
    });

    if (error) throw error;
  }

  private async processBatch(descriptors: any[]): Promise<void> {
    const meshTerms: any[] = [];
    const synonyms: any[] = [];
    
    for (const descriptor of descriptors) {
      const term = this.transformDescriptor(descriptor);
      meshTerms.push({
        ui: term.ui,
        name: term.name,
        scope_note: term.scope_note,
        tree_numbers: term.tree_numbers,
        semantic_types: term.semantic_types,
        is_major_topic: term.is_major_topic
      });
      
      // Process synonyms
      for (const synonym of term.synonyms) {
        synonyms.push({
          descriptor_ui: term.ui,
          synonym: synonym
        });
      }
    }
    
    // Insert mesh terms
    const { error: meshError } = await this.supabase
      .from('mesh_descriptors')
      .upsert(meshTerms, { onConflict: 'ui' });
      
    if (meshError) throw meshError;
    
    // Get inserted IDs for synonyms
    if (synonyms.length > 0) {
      const { data: insertedTerms } = await this.supabase
        .from('mesh_descriptors')
        .select('id, ui')
        .in('ui', meshTerms.map(t => t.ui));
        
      const uiToId = new Map(insertedTerms.map((t: any) => [t.ui, t.id]));
      
      const synonymsWithIds = synonyms.map(s => ({
        descriptor_id: uiToId.get(s.descriptor_ui),
        synonym: s.synonym
      })).filter(s => s.descriptor_id);
      
      if (synonymsWithIds.length > 0) {
        const { error: synError } = await this.supabase
          .from('mesh_synonyms')
          .upsert(synonymsWithIds);
          
        if (synError) throw synError;
      }
    }
  }

  private transformDescriptor(descriptor: any): MeshTerm {
    const ui = descriptor.DescriptorUI?.['#text'] || descriptor.DescriptorUI;
    const name = descriptor.DescriptorName?.String?.['#text'] || descriptor.DescriptorName?.String || '';
    
    // Extract tree numbers
    const treeNumbers: string[] = [];
    const treeNumberList = this.ensureArray(descriptor.TreeNumberList?.TreeNumber);
    for (const tn of treeNumberList) {
      if (tn?.['#text']) {
        treeNumbers.push(tn['#text']);
      } else if (typeof tn === 'string') {
        treeNumbers.push(tn);
      }
    }
    
    // Extract concepts and synonyms
    const synonyms: string[] = [];
    const concepts = this.ensureArray(descriptor.ConceptList?.Concept);
    
    for (const concept of concepts) {
      const terms = this.ensureArray(concept.TermList?.Term);
      for (const term of terms) {
        const termString = term.String?.['#text'] || term.String;
        if (termString && termString !== name) {
          synonyms.push(termString);
        }
      }
    }
    
    // Extract semantic types
    const semanticTypes: string[] = [];
    const semTypes = this.ensureArray(descriptor.SemanticTypeList?.SemanticType);
    for (const st of semTypes) {
      const semName = st.SemanticTypeName?.['#text'] || st.SemanticTypeName;
      if (semName) {
        semanticTypes.push(semName);
      }
    }
    
    // Scope note
    const scopeNote = descriptor.ConceptList?.Concept?.[0]?.ScopeNote?.['#text'] || 
                     descriptor.ConceptList?.Concept?.[0]?.ScopeNote || '';
    
    return {
      id: '',
      ui,
      name,
      scope_note: scopeNote,
      tree_numbers: treeNumbers,
      synonyms: [...new Set(synonyms)], // Remove duplicates
      parent_ids: [],
      semantic_types: semanticTypes,
      is_major_topic: treeNumbers.some(tn => tn.length <= 4), // Top-level terms
      created_at: new Date()
    };
  }

  private async buildHierarchy(): Promise<void> {
    console.log('Building MeSH hierarchy...');
    
    const { data: descriptors } = await this.supabase
      .from('mesh_descriptors')
      .select('id, ui, tree_numbers');
      
    const hierarchyEntries: any[] = [];
    const uiToId = new Map(descriptors.map((d: any) => [d.ui, d.id]));
    
    for (const descriptor of descriptors) {
      for (const treeNumber of descriptor.tree_numbers || []) {
        // Find parent tree number
        const parentTreeNumber = this.getParentTreeNumber(treeNumber);
        
        if (parentTreeNumber) {
          // Find parent descriptor
          const parentDescriptor = descriptors.find((d: any) => 
            d.tree_numbers?.includes(parentTreeNumber)
          );
          
          if (parentDescriptor) {
            hierarchyEntries.push({
              child_id: descriptor.id,
              parent_id: parentDescriptor.id,
              tree_number: treeNumber,
              depth: treeNumber.split('.').length
            });
          }
        }
      }
    }
    
    // Insert hierarchy in batches
    for (let i = 0; i < hierarchyEntries.length; i += BATCH_SIZE) {
      const batch = hierarchyEntries.slice(i, i + BATCH_SIZE);
      const { error } = await this.supabase
        .from('mesh_hierarchy')
        .upsert(batch, { onConflict: 'child_id,parent_id' });
        
      if (error) throw error;
    }
  }

  private getParentTreeNumber(treeNumber: string): string | null {
    const parts = treeNumber.split('.');
    if (parts.length <= 1) return null;
    
    parts.pop();
    return parts.join('.');
  }

  private async createIndexes(): Promise<void> {
    console.log('Creating additional indexes...');
    
    const indexSQL = `
      -- Full text search indexes
      CREATE INDEX IF NOT EXISTS idx_mesh_name_fts ON mesh_descriptors 
      USING GIN(to_tsvector('english', name));
      
      CREATE INDEX IF NOT EXISTS idx_mesh_scope_fts ON mesh_descriptors 
      USING GIN(to_tsvector('english', scope_note));
      
      CREATE INDEX IF NOT EXISTS idx_mesh_synonyms_fts ON mesh_synonyms 
      USING GIN(to_tsvector('english', synonym));
      
      -- Trigram indexes for fuzzy matching
      CREATE EXTENSION IF NOT EXISTS pg_trgm;
      
      CREATE INDEX IF NOT EXISTS idx_mesh_name_trgm ON mesh_descriptors 
      USING GIN(name gin_trgm_ops);
      
      CREATE INDEX IF NOT EXISTS idx_mesh_synonyms_trgm ON mesh_synonyms 
      USING GIN(synonym gin_trgm_ops);
      
      -- Materialized view for common lookups
      CREATE MATERIALIZED VIEW IF NOT EXISTS mv_mesh_with_synonyms AS
      SELECT 
        d.id,
        d.ui,
        d.name,
        d.scope_note,
        d.tree_numbers,
        d.semantic_types,
        ARRAY_AGG(DISTINCT s.synonym) FILTER (WHERE s.synonym IS NOT NULL) as synonyms,
        COUNT(DISTINCT h.parent_id) as parent_count,
        COUNT(DISTINCT h2.child_id) as child_count
      FROM mesh_descriptors d
      LEFT JOIN mesh_synonyms s ON s.descriptor_id = d.id
      LEFT JOIN mesh_hierarchy h ON h.child_id = d.id
      LEFT JOIN mesh_hierarchy h2 ON h2.parent_id = d.id
      GROUP BY d.id, d.ui, d.name, d.scope_note, d.tree_numbers, d.semantic_types;
      
      CREATE UNIQUE INDEX ON mv_mesh_with_synonyms(id);
      CREATE INDEX ON mv_mesh_with_synonyms(ui);
      CREATE INDEX ON mv_mesh_with_synonyms USING GIN(synonyms);
    `;

    const { error } = await this.supabase.rpc('execute_sql', {
      query: indexSQL
    });

    if (error) throw error;
  }

  private ensureArray(value: any): any[] {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  }

  async generateLayMappings(): Promise<void> {
    console.log('Generating lay term mappings for common medical terms...');
    
    // Common medical to lay term mappings
    const mappings = [
      { mesh_name: 'Myocardial Infarction', lay_term: 'Heart Attack', explanation: 'When blood flow to part of the heart is blocked' },
      { mesh_name: 'Cerebrovascular Accident', lay_term: 'Stroke', explanation: 'When blood flow to part of the brain is blocked' },
      { mesh_name: 'Hypertension', lay_term: 'High Blood Pressure', explanation: 'When blood pressure is consistently too high' },
      { mesh_name: 'Diabetes Mellitus', lay_term: 'Diabetes', explanation: 'When your body cannot properly process sugar' },
      { mesh_name: 'Neoplasms', lay_term: 'Cancer/Tumor', explanation: 'Abnormal growth of cells' },
      { mesh_name: 'Pneumonia', lay_term: 'Lung Infection', explanation: 'Infection that inflames air sacs in lungs' },
      { mesh_name: 'Asthma', lay_term: 'Breathing Disorder', explanation: 'Condition causing airways to narrow and swell' },
      { mesh_name: 'Chronic Obstructive Pulmonary Disease', lay_term: 'COPD/Emphysema', explanation: 'Long-term breathing problems' },
      { mesh_name: 'Alzheimer Disease', lay_term: "Alzheimer's", explanation: 'Progressive memory loss and confusion' },
      { mesh_name: 'Depression', lay_term: 'Clinical Depression', explanation: 'Persistent feelings of sadness and loss of interest' }
    ];
    
    for (const mapping of mappings) {
      // Find MeSH descriptor
      const { data: mesh } = await this.supabase
        .from('mesh_descriptors')
        .select('id')
        .ilike('name', mapping.mesh_name)
        .single();
        
      if (mesh) {
        await this.supabase
          .from('mesh_lay_mappings')
          .upsert({
            mesh_id: mesh.id,
            lay_term: mapping.lay_term,
            explanation: mapping.explanation,
            confidence_score: 1.0,
            source: 'system'
          });
      }
    }
  }
}