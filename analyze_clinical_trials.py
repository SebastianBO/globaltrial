#!/usr/bin/env python3
"""
Analyze the structure and content of the clinical_trials table in Supabase
"""

import os
import json
import supabase
from datetime import datetime
import pandas as pd
from typing import Dict, List, Any

# Supabase connection details
SUPABASE_URL = "https://wwjorfctbizdhqkpduxt.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind3am9yZmN0Yml6ZGhxa3BkdXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1ODMwMzksImV4cCI6MjA2ODE1OTAzOX0.PW5ZRSQsK9ij97v4xg7FLQPXEwmxtZC_Zlxdx3dJKnY"

def analyze_clinical_trials():
    """Analyze the clinical_trials table structure and content"""
    
    # Create Supabase client
    supabase_client = supabase.create_client(SUPABASE_URL, SUPABASE_KEY)
    
    print("=== CLINICAL TRIALS TABLE ANALYSIS ===\n")
    
    # 1. Get total count of records
    count_response = supabase_client.table('clinical_trials').select('*', count='exact').execute()
    total_records = count_response.count if hasattr(count_response, 'count') else 0
    print(f"Total records in clinical_trials table: {total_records}\n")
    
    # 2. Get sample records to analyze structure
    print("Fetching sample records...")
    sample_response = supabase_client.table('clinical_trials').select('*').limit(5).execute()
    
    if sample_response.data:
        print(f"Successfully fetched {len(sample_response.data)} sample records\n")
        
        # Analyze column population
        print("=== COLUMN POPULATION ANALYSIS ===")
        column_stats = analyze_column_population(sample_response.data)
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
        analyze_jsonb_field(sample_response.data, 'eligibility_criteria')
        
        # Analyze locations
        print("\n2. LOCATIONS Structure:")
        analyze_jsonb_field(sample_response.data, 'locations')
        
        # Analyze contact_info
        print("\n3. CONTACT_INFO Structure:")
        analyze_jsonb_field(sample_response.data, 'contact_info')
        
        # Display full sample records
        print("\n\n=== SAMPLE RECORDS (First 2) ===")
        for i, record in enumerate(sample_response.data[:2]):
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
    
    # 3. Analyze data patterns and issues
    print("\n\n=== DATA PATTERNS AND ISSUES ===")
    
    # Check for missing critical fields
    print("\nChecking for records with missing critical fields...")
    
    # Records without title
    no_title = supabase_client.table('clinical_trials').select('id').is_('title', 'null').limit(5).execute()
    print(f"Records without title: {len(no_title.data) if no_title.data else 0}")
    
    # Records without conditions
    empty_conditions = supabase_client.table('clinical_trials').select('id').eq('conditions', []).limit(5).execute()
    print(f"Records with empty conditions array: {len(empty_conditions.data) if empty_conditions.data else 0}")
    
    # Status distribution
    print("\nStatus distribution:")
    status_query = supabase_client.table('clinical_trials').select('status').execute()
    if status_query.data:
        status_counts = {}
        for record in status_query.data:
            status = record.get('status', 'unknown')
            status_counts[status] = status_counts.get(status, 0) + 1
        
        for status, count in sorted(status_counts.items(), key=lambda x: x[1], reverse=True):
            print(f"  - {status}: {count} ({count/len(status_query.data)*100:.1f}%)")
    
    # Phase distribution
    print("\nPhase distribution:")
    phase_query = supabase_client.table('clinical_trials').select('phase').execute()
    if phase_query.data:
        phase_counts = {}
        for record in phase_query.data:
            phase = record.get('phase', 'Not specified')
            phase_counts[phase] = phase_counts.get(phase, 0) + 1
        
        for phase, count in sorted(phase_counts.items(), key=lambda x: x[1], reverse=True)[:10]:
            print(f"  - {phase}: {count}")
    
    # Date range analysis
    print("\nDate range analysis:")
    date_query = supabase_client.table('clinical_trials').select('start_date, completion_date').execute()
    if date_query.data:
        start_dates = [r['start_date'] for r in date_query.data if r.get('start_date')]
        completion_dates = [r['completion_date'] for r in date_query.data if r.get('completion_date')]
        
        if start_dates:
            print(f"  - Earliest start date: {min(start_dates)}")
            print(f"  - Latest start date: {max(start_dates)}")
        
        if completion_dates:
            print(f"  - Earliest completion date: {min(completion_dates)}")
            print(f"  - Latest completion date: {max(completion_dates)}")


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