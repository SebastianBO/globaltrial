export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      clinical_trials: {
        Row: {
          id: string
          trial_id: string
          title: string
          description: string | null
          conditions: string[]
          interventions: string[]
          sponsor: string | null
          status: 'recruiting' | 'active' | 'completed' | 'suspended' | 'terminated' | 'withdrawn'
          phase: string | null
          start_date: string | null
          completion_date: string | null
          eligibility_criteria: Json | null
          locations: Json[] | null
          contact_info: Json | null
          source: string | null
          last_updated: string
          created_at: string
        }
        Insert: {
          id?: string
          trial_id: string
          title: string
          description?: string | null
          conditions: string[]
          interventions: string[]
          sponsor?: string | null
          status?: 'recruiting' | 'active' | 'completed' | 'suspended' | 'terminated' | 'withdrawn'
          phase?: string | null
          start_date?: string | null
          completion_date?: string | null
          eligibility_criteria?: Json | null
          locations?: Json[] | null
          contact_info?: Json | null
          source?: string | null
          last_updated?: string
          created_at?: string
        }
        Update: {
          id?: string
          trial_id?: string
          title?: string
          description?: string | null
          conditions?: string[]
          interventions?: string[]
          sponsor?: string | null
          status?: 'recruiting' | 'active' | 'completed' | 'suspended' | 'terminated' | 'withdrawn'
          phase?: string | null
          start_date?: string | null
          completion_date?: string | null
          eligibility_criteria?: Json | null
          locations?: Json[] | null
          contact_info?: Json | null
          source?: string | null
          last_updated?: string
          created_at?: string
        }
      }
      patients: {
        Row: {
          id: string
          email: string
          conditions: string[]
          age: number | null
          gender: string | null
          location: Json | null
          medical_history: string | null
          current_medications: string[]
          preferences: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          conditions: string[]
          age?: number | null
          gender?: string | null
          location?: Json | null
          medical_history?: string | null
          current_medications?: string[]
          preferences?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          conditions?: string[]
          age?: number | null
          gender?: string | null
          location?: Json | null
          medical_history?: string | null
          current_medications?: string[]
          preferences?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      patient_trial_matches: {
        Row: {
          id: string
          patient_id: string
          trial_id: string
          match_score: number
          match_reasons: Json | null
          status: 'pending' | 'matched' | 'applied' | 'accepted' | 'rejected'
          patient_interest: boolean | null
          applied_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          trial_id: string
          match_score: number
          match_reasons?: Json | null
          status?: 'pending' | 'matched' | 'applied' | 'accepted' | 'rejected'
          patient_interest?: boolean | null
          applied_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          patient_id?: string
          trial_id?: string
          match_score?: number
          match_reasons?: Json | null
          status?: 'pending' | 'matched' | 'applied' | 'accepted' | 'rejected'
          patient_interest?: boolean | null
          applied_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}