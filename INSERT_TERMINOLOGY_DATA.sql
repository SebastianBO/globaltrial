-- INSERT TERMINOLOGY MAPPINGS DATA
-- Run this if the table exists but is empty

INSERT INTO medical_term_mappings (patient_terms, medical_terms, category, mesh_codes, icd_codes) VALUES
  -- Cardiovascular
  (ARRAY['heart attack', 'cardiac arrest', 'heart problem'], 
   ARRAY['myocardial infarction', 'MI', 'acute coronary syndrome', 'STEMI', 'NSTEMI'],
   'cardiovascular', ARRAY['D009203'], ARRAY['I21', 'I22']),
  
  (ARRAY['high blood pressure', 'blood pressure', 'bp issues', 'hypertension'], 
   ARRAY['hypertension', 'HTN', 'essential hypertension', 'elevated blood pressure'],
   'cardiovascular', ARRAY['D006973'], ARRAY['I10', 'I11']),
  
  (ARRAY['stroke', 'brain attack', 'mini stroke'],
   ARRAY['cerebrovascular accident', 'CVA', 'TIA', 'transient ischemic attack'],
   'cardiovascular', ARRAY['D020521'], ARRAY['I63', 'I64']),
  
  -- Mental Health
  (ARRAY['depression', 'feeling depressed', 'sad', 'low mood'],
   ARRAY['major depressive disorder', 'MDD', 'clinical depression', 'unipolar depression'],
   'mental_health', ARRAY['D003866'], ARRAY['F32', 'F33']),
  
  (ARRAY['anxiety', 'panic attacks', 'worried', 'anxious'],
   ARRAY['generalized anxiety disorder', 'GAD', 'panic disorder', 'anxiety disorder'],
   'mental_health', ARRAY['D001008'], ARRAY['F41']),
  
  -- Respiratory
  (ARRAY['asthma', 'breathing problems', 'wheezing'],
   ARRAY['bronchial asthma', 'reactive airway disease', 'asthmatic bronchitis'],
   'respiratory', ARRAY['D001249'], ARRAY['J45']),
  
  (ARRAY['copd', 'emphysema', 'chronic bronchitis', 'smokers lung'],
   ARRAY['chronic obstructive pulmonary disease', 'COPD', 'chronic airway obstruction'],
   'respiratory', ARRAY['D029424'], ARRAY['J44']),
  
  -- Metabolic
  (ARRAY['diabetes', 'sugar', 'blood sugar', 'diabetic'],
   ARRAY['diabetes mellitus', 'DM', 'type 2 diabetes', 'T2DM', 'NIDDM'],
   'metabolic', ARRAY['D003920'], ARRAY['E11']),
  
  (ARRAY['overweight', 'obesity', 'weight issues', 'obese'],
   ARRAY['obesity', 'morbid obesity', 'overweight and obesity', 'adiposity'],
   'metabolic', ARRAY['D009765'], ARRAY['E66']),
  
  -- Neurological
  (ARRAY['alzheimers', 'memory loss', 'dementia', 'forgetfulness'],
   ARRAY['alzheimer disease', 'AD', 'dementia of alzheimer type', 'senile dementia'],
   'neurological', ARRAY['D000544'], ARRAY['G30']),
  
  (ARRAY['parkinsons', 'shaking', 'tremor'],
   ARRAY['parkinson disease', 'PD', 'paralysis agitans', 'parkinsonism'],
   'neurological', ARRAY['D010300'], ARRAY['G20']),
  
  (ARRAY['ms', 'multiple sclerosis'],
   ARRAY['multiple sclerosis', 'MS', 'disseminated sclerosis'],
   'neurological', ARRAY['D009103'], ARRAY['G35']),
  
  -- Autoimmune
  (ARRAY['lupus', 'sle'],
   ARRAY['systemic lupus erythematosus', 'SLE', 'lupus erythematosus'],
   'autoimmune', ARRAY['D008180'], ARRAY['M32']),
  
  (ARRAY['rheumatoid arthritis', 'ra', 'joint pain'],
   ARRAY['rheumatoid arthritis', 'RA', 'inflammatory arthritis'],
   'autoimmune', ARRAY['D001172'], ARRAY['M05', 'M06']),
  
  -- Cancer
  (ARRAY['cancer', 'tumor', 'malignancy'],
   ARRAY['neoplasm', 'malignant neoplasm', 'carcinoma', 'malignancy'],
   'oncology', ARRAY['D009369'], ARRAY['C00-C96']),
  
  (ARRAY['breast cancer'],
   ARRAY['breast neoplasm', 'mammary carcinoma', 'breast carcinoma'],
   'oncology', ARRAY['D001943'], ARRAY['C50']),
  
  -- Infectious
  (ARRAY['covid', 'covid-19', 'coronavirus', 'long covid'],
   ARRAY['COVID-19', 'SARS-CoV-2 infection', 'coronavirus disease 2019'],
   'infectious', ARRAY['D000086382'], ARRAY['U07.1'])
ON CONFLICT DO NOTHING;

-- Check if data was inserted
SELECT COUNT(*) as total_mappings FROM medical_term_mappings;