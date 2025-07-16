// Setup database with terminology mappings and MeSH cache
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://wwjorfctbizdhqkpduxt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3am9yZmN0Yml6ZGhxa3BkdXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1ODMwMzksImV4cCI6MjA2ODE1OTAzOX0.PW5ZRSQsK9ij97v4xg7FLQPXEwmxtZC_Zlxdx3dJKnY';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function setupDatabase() {
  console.log('🔧 Setting up GlobalTrials database...\n');

  // 1. Insert terminology mappings
  console.log('📝 Inserting terminology mappings...');
  
  const terminologyData = [
    // Cardiovascular
    {
      patient_terms: ['heart attack', 'cardiac arrest', 'heart problem'],
      medical_terms: ['myocardial infarction', 'MI', 'acute coronary syndrome', 'STEMI', 'NSTEMI'],
      category: 'cardiovascular',
      mesh_codes: ['D009203'],
      icd_codes: ['I21', 'I22']
    },
    {
      patient_terms: ['high blood pressure', 'blood pressure', 'bp issues', 'hypertension'],
      medical_terms: ['hypertension', 'HTN', 'essential hypertension', 'elevated blood pressure'],
      category: 'cardiovascular',
      mesh_codes: ['D006973'],
      icd_codes: ['I10', 'I11']
    },
    {
      patient_terms: ['stroke', 'brain attack', 'mini stroke'],
      medical_terms: ['cerebrovascular accident', 'CVA', 'TIA', 'transient ischemic attack'],
      category: 'cardiovascular',
      mesh_codes: ['D020521'],
      icd_codes: ['I63', 'I64']
    },
    // Mental Health
    {
      patient_terms: ['depression', 'feeling depressed', 'sad', 'low mood'],
      medical_terms: ['major depressive disorder', 'MDD', 'clinical depression', 'unipolar depression'],
      category: 'mental_health',
      mesh_codes: ['D003866'],
      icd_codes: ['F32', 'F33']
    },
    {
      patient_terms: ['anxiety', 'panic attacks', 'worried', 'anxious'],
      medical_terms: ['generalized anxiety disorder', 'GAD', 'panic disorder', 'anxiety disorder'],
      category: 'mental_health',
      mesh_codes: ['D001008'],
      icd_codes: ['F41']
    },
    // Respiratory
    {
      patient_terms: ['asthma', 'breathing problems', 'wheezing'],
      medical_terms: ['bronchial asthma', 'reactive airway disease', 'asthmatic bronchitis'],
      category: 'respiratory',
      mesh_codes: ['D001249'],
      icd_codes: ['J45']
    },
    {
      patient_terms: ['copd', 'emphysema', 'chronic bronchitis', 'smokers lung'],
      medical_terms: ['chronic obstructive pulmonary disease', 'COPD', 'chronic airway obstruction'],
      category: 'respiratory',
      mesh_codes: ['D029424'],
      icd_codes: ['J44']
    },
    // Metabolic
    {
      patient_terms: ['diabetes', 'sugar', 'blood sugar', 'diabetic'],
      medical_terms: ['diabetes mellitus', 'DM', 'type 2 diabetes', 'T2DM', 'NIDDM'],
      category: 'metabolic',
      mesh_codes: ['D003920'],
      icd_codes: ['E11']
    },
    {
      patient_terms: ['overweight', 'obesity', 'weight issues', 'obese'],
      medical_terms: ['obesity', 'morbid obesity', 'overweight and obesity', 'adiposity'],
      category: 'metabolic',
      mesh_codes: ['D009765'],
      icd_codes: ['E66']
    },
    // Neurological
    {
      patient_terms: ['alzheimers', 'memory loss', 'dementia', 'forgetfulness'],
      medical_terms: ['alzheimer disease', 'AD', 'dementia of alzheimer type', 'senile dementia'],
      category: 'neurological',
      mesh_codes: ['D000544'],
      icd_codes: ['G30']
    },
    {
      patient_terms: ['parkinsons', 'shaking', 'tremor'],
      medical_terms: ['parkinson disease', 'PD', 'paralysis agitans', 'parkinsonism'],
      category: 'neurological',
      mesh_codes: ['D010300'],
      icd_codes: ['G20']
    },
    {
      patient_terms: ['ms', 'multiple sclerosis'],
      medical_terms: ['multiple sclerosis', 'MS', 'disseminated sclerosis'],
      category: 'neurological',
      mesh_codes: ['D009103'],
      icd_codes: ['G35']
    },
    // Autoimmune
    {
      patient_terms: ['lupus', 'sle'],
      medical_terms: ['systemic lupus erythematosus', 'SLE', 'lupus erythematosus'],
      category: 'autoimmune',
      mesh_codes: ['D008180'],
      icd_codes: ['M32']
    },
    {
      patient_terms: ['rheumatoid arthritis', 'ra', 'joint pain'],
      medical_terms: ['rheumatoid arthritis', 'RA', 'inflammatory arthritis'],
      category: 'autoimmune',
      mesh_codes: ['D001172'],
      icd_codes: ['M05', 'M06']
    },
    // Cancer
    {
      patient_terms: ['cancer', 'tumor', 'malignancy'],
      medical_terms: ['neoplasm', 'malignant neoplasm', 'carcinoma', 'malignancy'],
      category: 'oncology',
      mesh_codes: ['D009369'],
      icd_codes: ['C00-C96']
    },
    {
      patient_terms: ['breast cancer'],
      medical_terms: ['breast neoplasm', 'mammary carcinoma', 'breast carcinoma'],
      category: 'oncology',
      mesh_codes: ['D001943'],
      icd_codes: ['C50']
    },
    // Infectious
    {
      patient_terms: ['covid', 'covid-19', 'coronavirus', 'long covid'],
      medical_terms: ['COVID-19', 'SARS-CoV-2 infection', 'coronavirus disease 2019'],
      category: 'infectious',
      mesh_codes: ['D000086382'],
      icd_codes: ['U07.1']
    }
  ];

  const { data, error } = await supabase
    .from('medical_term_mappings')
    .upsert(terminologyData, { 
      onConflict: 'id',
      ignoreDuplicates: true 
    });

  if (error) {
    console.error('❌ Error inserting terminology mappings:', error);
  } else {
    console.log(`✅ Inserted ${terminologyData.length} terminology mappings`);
  }

  // 2. Check current status
  const { count: mappingCount } = await supabase
    .from('medical_term_mappings')
    .select('*', { count: 'exact', head: true });

  console.log(`\n📊 Total terminology mappings in database: ${mappingCount}`);

  // 3. Trigger the enhanced scraper
  console.log('\n🔄 Triggering enhanced scraper...');
  
  try {
    const response = await fetch('https://wwjorfctbizdhqkpduxt.supabase.co/functions/v1/scrape-trials', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`
      }
    });
    
    console.log('✅ Scraper triggered! It will run in the background.');
    console.log('   Monitor progress with: node monitor-scraper.js');
  } catch (error) {
    console.log('⚠️  Could not trigger scraper automatically.');
    console.log('   Please trigger it manually from Supabase dashboard.');
  }

  console.log('\n✨ Setup complete!');
  console.log('\nNext steps:');
  console.log('1. Run "node monitor-scraper.js" to watch trials being added');
  console.log('2. Run "node enrich-trials-batch.js" to add patient-friendly descriptions');
  console.log('3. Test the app with "npm run dev"');
}

setupDatabase().catch(console.error);