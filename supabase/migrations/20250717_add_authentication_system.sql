-- Authentication and user management system for GlobalTrials
-- Supports both patient and pharma company accounts

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User types enum
CREATE TYPE user_type AS ENUM ('patient', 'pharma', 'admin');

-- Account verification status
CREATE TYPE verification_status AS ENUM ('pending', 'verified', 'rejected');

-- Pharma company size categories
CREATE TYPE company_size AS ENUM ('startup', 'small', 'medium', 'large', 'enterprise');

-- User profiles table (extends auth.users)
CREATE TABLE user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  user_type user_type NOT NULL DEFAULT 'patient',
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  verification_status verification_status DEFAULT 'pending',
  verified_at TIMESTAMP WITH TIME ZONE,
  
  -- Profile completion tracking
  profile_completed BOOLEAN DEFAULT FALSE,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  
  -- Privacy settings
  data_sharing_consent BOOLEAN DEFAULT FALSE,
  marketing_consent BOOLEAN DEFAULT FALSE,
  newsletter_subscription BOOLEAN DEFAULT TRUE,
  
  -- Account metadata
  signup_source TEXT, -- 'web', 'mobile', 'referral', etc.
  referral_code TEXT,
  timezone TEXT DEFAULT 'UTC'
);

-- Patient-specific profiles
CREATE TABLE patient_profiles (
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE PRIMARY KEY,
  date_of_birth DATE,
  gender TEXT,
  
  -- Medical information
  medical_conditions TEXT[] DEFAULT '{}',
  current_medications TEXT[] DEFAULT '{}',
  allergies TEXT[] DEFAULT '{}',
  previous_treatments TEXT[] DEFAULT '{}',
  
  -- Contact preferences
  preferred_contact_method TEXT DEFAULT 'email', -- 'email', 'phone', 'sms'
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  emergency_contact_relationship TEXT,
  
  -- Trial preferences
  max_travel_distance_km INTEGER DEFAULT 50,
  available_days TEXT[] DEFAULT '{}', -- ['monday', 'tuesday', etc.]
  compensation_interest BOOLEAN DEFAULT FALSE,
  remote_trial_interest BOOLEAN DEFAULT TRUE,
  
  -- Location information
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state_province TEXT,
  postal_code TEXT,
  country TEXT,
  coordinates POINT, -- For geographic searches
  
  -- Health insurance
  has_insurance BOOLEAN,
  insurance_provider TEXT,
  insurance_type TEXT, -- 'private', 'public', 'medicare', 'medicaid', etc.
  
  -- Privacy and consent
  medical_data_sharing BOOLEAN DEFAULT FALSE,
  contact_for_studies BOOLEAN DEFAULT TRUE,
  share_anonymous_data BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Pharma company profiles
CREATE TABLE pharma_profiles (
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE PRIMARY KEY,
  company_name TEXT NOT NULL,
  company_size company_size,
  industry_sector TEXT, -- 'biotech', 'pharma', 'cro', 'academic', etc.
  
  -- Company details
  website_url TEXT,
  linkedin_url TEXT,
  company_description TEXT,
  founded_year INTEGER,
  headquarters_country TEXT,
  headquarters_city TEXT,
  
  -- Contact information
  primary_contact_title TEXT,
  department TEXT, -- 'clinical research', 'business development', etc.
  
  -- Business information
  annual_revenue_range TEXT, -- '$1M-10M', '$10M-100M', etc.
  employee_count_range TEXT, -- '1-10', '11-50', etc.
  therapeutic_areas TEXT[] DEFAULT '{}',
  development_stages TEXT[] DEFAULT '{}', -- 'preclinical', 'phase1', etc.
  
  -- Verification documents
  business_license_verified BOOLEAN DEFAULT FALSE,
  regulatory_credentials TEXT[] DEFAULT '{}',
  
  -- Account status
  subscription_tier TEXT DEFAULT 'free', -- 'free', 'basic', 'professional', 'enterprise'
  billing_email TEXT,
  payment_method_id TEXT, -- Stripe payment method ID
  
  -- Usage limits (based on subscription)
  monthly_search_limit INTEGER DEFAULT 100,
  monthly_contact_limit INTEGER DEFAULT 10,
  api_access BOOLEAN DEFAULT FALSE,
  export_access BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User sessions tracking
CREATE TABLE user_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE
);

-- Password reset tokens
CREATE TABLE password_reset_tokens (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Email verification tokens
CREATE TABLE email_verification_tokens (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User activity logs
CREATE TABLE user_activity_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL, -- 'login', 'search', 'profile_update', etc.
  activity_details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Account verification requests (for pharma companies)
CREATE TABLE verification_requests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL, -- 'company_verification', 'credential_verification'
  documents JSONB, -- Document URLs and metadata
  status verification_status DEFAULT 'pending',
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES user_profiles(id),
  review_notes TEXT,
  rejection_reason TEXT
);

-- Subscription plans and features
CREATE TABLE subscription_plans (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  plan_name TEXT NOT NULL UNIQUE,
  plan_type TEXT NOT NULL, -- 'patient', 'pharma'
  monthly_price_cents INTEGER NOT NULL DEFAULT 0,
  annual_price_cents INTEGER NOT NULL DEFAULT 0,
  features JSONB NOT NULL DEFAULT '{}',
  limits JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User subscriptions
CREATE TABLE user_subscriptions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES subscription_plans(id),
  stripe_subscription_id TEXT,
  status TEXT DEFAULT 'active', -- 'active', 'canceled', 'past_due', 'unpaid'
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  trial_start TIMESTAMP WITH TIME ZONE,
  trial_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_user_profiles_email ON user_profiles(email);
CREATE INDEX idx_user_profiles_type ON user_profiles(user_type);
CREATE INDEX idx_user_profiles_verification ON user_profiles(verification_status);
CREATE INDEX idx_patient_profiles_conditions ON patient_profiles USING GIN(medical_conditions);
CREATE INDEX idx_patient_profiles_location ON patient_profiles USING GIST(coordinates);
CREATE INDEX idx_pharma_profiles_therapeutic_areas ON pharma_profiles USING GIN(therapeutic_areas);
CREATE INDEX idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_user_activity_logs_user_date ON user_activity_logs(user_id, created_at DESC);

-- Row Level Security (RLS) policies

-- User profiles: users can only access their own profile
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Patient profiles: only patients can access their own data
ALTER TABLE patient_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients can view own profile" ON patient_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Patients can update own profile" ON patient_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Patients can insert own profile" ON patient_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Pharma profiles: only pharma users can access their own data
ALTER TABLE pharma_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pharma users can view own profile" ON pharma_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Pharma users can update own profile" ON pharma_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Pharma users can insert own profile" ON pharma_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User sessions: users can only access their own sessions
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own sessions" ON user_sessions
  FOR SELECT USING (auth.uid() = user_id);

-- User activity logs: users can only view their own activity
ALTER TABLE user_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own activity" ON user_activity_logs
  FOR SELECT USING (auth.uid() = user_id);

-- Functions and triggers

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_patient_profiles_updated_at
  BEFORE UPDATE ON patient_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pharma_profiles_updated_at
  BEFORE UPDATE ON pharma_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_subscriptions_updated_at
  BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to create user profile after signup
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, email, user_type)
  VALUES (NEW.id, NEW.email, 'patient'); -- Default to patient
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to create profile after user signup
CREATE TRIGGER create_user_profile_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_profile();

-- Function to log user activity
CREATE OR REPLACE FUNCTION log_user_activity(
  p_user_id UUID,
  p_activity_type TEXT,
  p_activity_details JSONB DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  activity_id UUID;
BEGIN
  INSERT INTO user_activity_logs (
    user_id, 
    activity_type, 
    activity_details, 
    ip_address, 
    user_agent
  )
  VALUES (
    p_user_id, 
    p_activity_type, 
    p_activity_details, 
    p_ip_address, 
    p_user_agent
  )
  RETURNING id INTO activity_id;
  
  RETURN activity_id;
END;
$$ language 'plpgsql';

-- Function to check user permissions
CREATE OR REPLACE FUNCTION check_user_permission(
  p_user_id UUID,
  p_permission TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  user_type_val user_type;
  subscription_features JSONB;
BEGIN
  -- Get user type
  SELECT up.user_type INTO user_type_val
  FROM user_profiles up
  WHERE up.id = p_user_id;
  
  -- Get subscription features if pharma user
  IF user_type_val = 'pharma' THEN
    SELECT sp.features INTO subscription_features
    FROM user_subscriptions us
    JOIN subscription_plans sp ON us.plan_id = sp.id
    WHERE us.user_id = p_user_id 
      AND us.status = 'active'
      AND us.current_period_end > CURRENT_TIMESTAMP;
    
    -- Check if permission exists in subscription features
    RETURN (subscription_features ? p_permission) AND (subscription_features->p_permission)::boolean;
  END IF;
  
  -- Patient users have basic permissions by default
  RETURN user_type_val = 'patient';
END;
$$ language 'plpgsql';

-- Insert default subscription plans
INSERT INTO subscription_plans (plan_name, plan_type, monthly_price_cents, annual_price_cents, features, limits) VALUES
-- Patient plans (free)
('Patient Free', 'patient', 0, 0, 
 '{"trial_search": true, "basic_matching": true, "profile_management": true}',
 '{"monthly_searches": 50, "saved_trials": 10}'),

-- Pharma plans
('Pharma Free', 'pharma', 0, 0,
 '{"basic_search": true, "limited_contacts": true}',
 '{"monthly_searches": 100, "monthly_contacts": 10}'),

('Pharma Basic', 'pharma', 9900, 99600, -- $99/month, $996/year
 '{"advanced_search": true, "patient_matching": true, "analytics": true, "export_data": true}',
 '{"monthly_searches": 1000, "monthly_contacts": 100}'),

('Pharma Professional', 'pharma', 29900, 299600, -- $299/month, $2996/year
 '{"api_access": true, "priority_support": true, "custom_reports": true, "bulk_export": true}',
 '{"monthly_searches": 5000, "monthly_contacts": 500}'),

('Pharma Enterprise', 'pharma', 99900, 999600, -- $999/month, $9996/year
 '{"unlimited_access": true, "dedicated_support": true, "white_label": true, "custom_integration": true}',
 '{"monthly_searches": -1, "monthly_contacts": -1}'); -- -1 means unlimited

-- Grant permissions
GRANT SELECT ON user_profiles TO anon, authenticated;
GRANT INSERT, UPDATE ON user_profiles TO authenticated;
GRANT SELECT ON patient_profiles TO authenticated;
GRANT INSERT, UPDATE ON patient_profiles TO authenticated;
GRANT SELECT ON pharma_profiles TO authenticated;
GRANT INSERT, UPDATE ON pharma_profiles TO authenticated;
GRANT SELECT ON subscription_plans TO anon, authenticated;
GRANT SELECT ON user_subscriptions TO authenticated;
GRANT INSERT, UPDATE ON user_subscriptions TO authenticated;
GRANT INSERT ON user_activity_logs TO authenticated;
GRANT SELECT ON user_activity_logs TO authenticated;