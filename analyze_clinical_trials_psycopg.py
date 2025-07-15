#!/usr/bin/env python3
"""
Analyze the structure and content of the clinical_trials table in Supabase using psycopg2
"""

import os
import json
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime
from typing import Dict, List, Any
from urllib.parse import urlparse

# Supabase connection details
SUPABASE_URL = "https://wwjorfctbizdhqkpduxt.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3am9yZmN0Yml6ZGhxa3BkdXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1ODMwMzksImV4cCI6MjA2ODE1OTAzOX0.PW5ZRSQsK9ij97v4xg7FLQPXEwmxtZC_Zlxdx3dJKnY"

# Extract database connection info from Supabase URL
parsed = urlparse(SUPABASE_URL)
project_ref = parsed.hostname.split('.')[0]  # wwjorfctbizdhqkpduxt

# Supabase PostgreSQL connection details
DB_HOST = f"db.{project_ref}.supabase.co"
DB_PORT = 5432
DB_NAME = "postgres"
DB_USER = "postgres"

def get_db_password():
    """Get database password from environment or prompt user"""
    password = os.environ.get('SUPABASE_DB_PASSWORD')
    if not password:
        print("Please provide the database password (found in Supabase Dashboard > Settings > Database):")
        password = input().strip()
    return password

def analyze_clinical_trials():
    """Analyze the clinical_trials table structure and content"""
    
    # Get database password
    db_password = get_db_password()
    
    # Create connection
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            database=DB_NAME,
            user=DB_USER,
            password=db_password,
            cursor_factory=RealDictCursor
        )
        cursor = conn.cursor()
        
        print("Successfully connected to database!\n")
        print("=== CLINICAL TRIALS TABLE ANALYSIS ===\n")
        
        # 1. Get total count of records
        cursor.execute("SELECT COUNT(*) as count FROM clinical_trials")
        total_records = cursor.fetchone()['count']
        print(f"Total records in clinical_trials table: {total_records}\n")
        
        # 2. Get column information
        cursor.execute("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'clinical_trials'
            ORDER BY ordinal_position
        """)
        columns = cursor.fetchall()
        
        print("=== TABLE SCHEMA ===")
        for col in columns:
            nullable = "NULL" if col['is_nullable'] == 'YES' else "NOT NULL"
            default = f" DEFAULT {col['column_default']}" if col['column_default'] else ""
            print(f"  {col['column_name']}: {col['data_type']} {nullable}{default}")
        
        # 3. Get sample records
        print("\n\nFetching sample records...")
        cursor.execute("SELECT * FROM clinical_trials LIMIT 5")
        sample_records = cursor.fetchall()
        
        if sample_records:
            print(f"Successfully fetched {len(sample_records)} sample records\n")
            
            # Analyze column population
            print("=== COLUMN POPULATION ANALYSIS ===")
            column_stats = analyze_column_population(sample_records)
            for col, stats in column_stats.items():
                print(f"\n{col}:")
                print(f"  - Populated: {stats['populated']}/{stats['total']} ({stats['percentage']:.1f}%)")
                print(f"  - Data type: {stats['type']}")
                if stats['sample_values']:
                    print(f"  - Sample values: {stats['sample_values'][:3]}")
            
            # Analyze JSONB fields in detail
            print("\n\n=== JSONB FIELD STRUCTURE ANALYSIS ===")
            
            # Analyze eligibility_criteria
            print("\n1. ELIGIBILITY_CRITERIA Structure:")
            analyze_jsonb_field(sample_records, 'eligibility_criteria')
            
            # Analyze locations
            print("\n2. LOCATIONS Structure:")
            analyze_jsonb_field(sample_records, 'locations')
            
            # Analyze contact_info
            print("\n3. CONTACT_INFO Structure:")
            analyze_jsonb_field(sample_records, 'contact_info')
            
            # Display full sample records
            print("\n\n=== SAMPLE RECORDS (First 2) ===")
            for i, record in enumerate(sample_records[:2]):
                print(f"\n--- Record {i+1} ---")
                print(f"ID: {record.get('id', 'N/A')}")
                print(f"Trial ID: {record.get('trial_id', 'N/A')}")
                print(f"Title: {record.get('title', 'N/A')[:100]}...")
                print(f"Status: {record.get('status', 'N/A')}")
                print(f"Phase: {record.get('phase', 'N/A')}")
                print(f"Sponsor: {record.get('sponsor', 'N/A')}")
                print(f"Conditions: {record.get('conditions', [])}")
                print(f"Interventions: {record.get('interventions', [])}")
                
                # Pretty print JSONB fields
                if record.get('eligibility_criteria'):
                    print("\nEligibility Criteria:")
                    print(json.dumps(record['eligibility_criteria'], indent=2))
                
                if record.get('locations'):
                    print(f"\nLocations ({len(record.get('locations', []))} total):")
                    for loc in record.get('locations', [])[:2]:  # Show first 2 locations
                        print(json.dumps(loc, indent=2))
                
                if record.get('contact_info'):
                    print("\nContact Info:")
                    print(json.dumps(record['contact_info'], indent=2))
        
        # 4. Analyze data patterns and issues
        print("\n\n=== DATA PATTERNS AND ISSUES ===")
        
        # Check for missing critical fields
        print("\nChecking for records with missing critical fields...")
        
        # Records without title
        cursor.execute("SELECT COUNT(*) as count FROM clinical_trials WHERE title IS NULL")
        no_title = cursor.fetchone()['count']
        print(f"Records without title: {no_title}")
        
        # Records without conditions
        cursor.execute("SELECT COUNT(*) as count FROM clinical_trials WHERE conditions = '{}' OR conditions IS NULL")
        empty_conditions = cursor.fetchone()['count']
        print(f"Records with empty or null conditions: {empty_conditions}")
        
        # Status distribution
        print("\nStatus distribution:")
        cursor.execute("""
            SELECT status, COUNT(*) as count 
            FROM clinical_trials 
            GROUP BY status 
            ORDER BY count DESC
        """)
        status_dist = cursor.fetchall()
        for row in status_dist:
            percentage = (row['count'] / total_records) * 100
            print(f"  - {row['status']}: {row['count']} ({percentage:.1f}%)")
        
        # Phase distribution
        print("\nPhase distribution:")
        cursor.execute("""
            SELECT phase, COUNT(*) as count 
            FROM clinical_trials 
            WHERE phase IS NOT NULL
            GROUP BY phase 
            ORDER BY count DESC
            LIMIT 10
        """)
        phase_dist = cursor.fetchall()
        for row in phase_dist:
            print(f"  - {row['phase']}: {row['count']}")
        
        # Date range analysis
        print("\nDate range analysis:")
        cursor.execute("""
            SELECT 
                MIN(start_date) as earliest_start,
                MAX(start_date) as latest_start,
                MIN(completion_date) as earliest_completion,
                MAX(completion_date) as latest_completion
            FROM clinical_trials
        """)
        date_ranges = cursor.fetchone()
        print(f"  - Earliest start date: {date_ranges['earliest_start']}")
        print(f"  - Latest start date: {date_ranges['latest_start']}")
        print(f"  - Earliest completion date: {date_ranges['earliest_completion']}")
        print(f"  - Latest completion date: {date_ranges['latest_completion']}")
        
        # Check JSONB field population
        print("\n\nJSONB field population:")
        cursor.execute("""
            SELECT 
                COUNT(*) FILTER (WHERE eligibility_criteria IS NOT NULL) as has_eligibility,
                COUNT(*) FILTER (WHERE locations IS NOT NULL AND locations != '[]'::jsonb) as has_locations,
                COUNT(*) FILTER (WHERE contact_info IS NOT NULL) as has_contact,
                COUNT(*) as total
            FROM clinical_trials
        """)
        jsonb_stats = cursor.fetchone()
        print(f"  - eligibility_criteria: {jsonb_stats['has_eligibility']}/{jsonb_stats['total']} ({jsonb_stats['has_eligibility']/jsonb_stats['total']*100:.1f}%)")
        print(f"  - locations: {jsonb_stats['has_locations']}/{jsonb_stats['total']} ({jsonb_stats['has_locations']/jsonb_stats['total']*100:.1f}%)")
        print(f"  - contact_info: {jsonb_stats['has_contact']}/{jsonb_stats['total']} ({jsonb_stats['has_contact']/jsonb_stats['total']*100:.1f}%)")
        
        # Most common conditions
        print("\n\nMost common conditions (top 10):")
        cursor.execute("""
            SELECT condition, COUNT(*) as count
            FROM clinical_trials, unnest(conditions) as condition
            GROUP BY condition
            ORDER BY count DESC
            LIMIT 10
        """)
        conditions = cursor.fetchall()
        for row in conditions:
            print(f"  - {row['condition']}: {row['count']}")
        
        # Location distribution
        print("\n\nLocation countries (top 10):")
        cursor.execute("""
            SELECT 
                location->>'country' as country, 
                COUNT(*) as count
            FROM clinical_trials, 
                 jsonb_array_elements(locations) as location
            WHERE locations IS NOT NULL AND locations != '[]'::jsonb
            GROUP BY country
            ORDER BY count DESC
            LIMIT 10
        """)
        countries = cursor.fetchall()
        for row in countries:
            print(f"  - {row['country']}: {row['count']}")
        
        cursor.close()
        conn.close()
        
    except psycopg2.Error as e:
        print(f"Database error: {e}")
        if 'conn' in locals():
            conn.close()


def analyze_column_population(records: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    """Analyze which columns are populated and their data types"""
    if not records:
        return {}
    
    # Get all unique columns
    all_columns = set()
    for record in records:
        all_columns.update(record.keys())
    
    column_stats = {}
    
    for col in sorted(all_columns):
        populated = 0
        sample_values = []
        data_types = set()
        
        for record in records:
            value = record.get(col)
            if value is not None and value != '' and value != []:
                populated += 1
                if len(sample_values) < 3:
                    if isinstance(value, (dict, list)):
                        sample_values.append(f"{type(value).__name__} with {len(value)} items")
                    else:
                        sample_values.append(str(value)[:50] + '...' if len(str(value)) > 50 else str(value))
                data_types.add(type(value).__name__)
        
        column_stats[col] = {
            'populated': populated,
            'total': len(records),
            'percentage': (populated / len(records)) * 100,
            'type': ', '.join(data_types) if data_types else 'unknown',
            'sample_values': sample_values
        }
    
    return column_stats


def analyze_jsonb_field(records: List[Dict[str, Any]], field_name: str):
    """Analyze the structure of a JSONB field"""
    field_values = [r.get(field_name) for r in records if r.get(field_name)]
    
    if not field_values:
        print(f"  No populated {field_name} fields found in sample")
        return
    
    print(f"  Found {len(field_values)} populated {field_name} fields")
    
    # For list fields (like locations)
    if isinstance(field_values[0], list):
        print(f"  Type: Array of objects")
        print(f"  Array lengths: {[len(v) for v in field_values[:5]]}")
        
        # Get sample structure from first non-empty array
        for values in field_values:
            if values and len(values) > 0:
                print(f"  Sample item structure:")
                sample_item = values[0]
                for key, val in sample_item.items():
                    val_type = type(val).__name__
                    print(f"    - {key}: {val_type}")
                break
    
    # For object fields
    elif isinstance(field_values[0], dict):
        print(f"  Type: Object")
        
        # Collect all keys across samples
        all_keys = set()
        for value in field_values:
            if isinstance(value, dict):
                all_keys.update(value.keys())
        
        print(f"  Keys found: {sorted(all_keys)}")
        
        # Show sample structure
        print(f"  Sample structure:")
        sample = field_values[0]
        for key, val in sample.items():
            val_type = type(val).__name__
            if isinstance(val, (str, int, float, bool)):
                print(f"    - {key}: {val_type} = {str(val)[:50]}")
            else:
                print(f"    - {key}: {val_type}")


if __name__ == "__main__":
    try:
        analyze_clinical_trials()
    except Exception as e:
        print(f"Error analyzing clinical trials: {e}")
        import traceback
        traceback.print_exc()