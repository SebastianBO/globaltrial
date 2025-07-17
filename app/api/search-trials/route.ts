import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface SearchFilters {
  status: string[];
  phase: string[];
  sponsor: string;
  location: string;
  locationRadius: number | null;
  ageMin: number | null;
  ageMax: number | null;
  gender: string;
  compensationMin: number | null;
  compensationMax: number | null;
  source: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      query = '', 
      filters = {}, 
      sortBy = 'relevance', 
      page = 1, 
      limit = 20,
      userLocation = null
    } = body;

    const supabase = await createClient();
    
    // Build the base query
    let queryBuilder = supabase
      .from('clinical_trials')
      .select('*', { count: 'exact' });

    // Apply text search if query is provided
    if (query.trim()) {
      // Create a search condition for multiple fields
      const searchTerms = query.trim().split(' ').filter(Boolean);
      const searchConditions = searchTerms.map((term: string) => {
        const escapedTerm = term.replace(/[%_]/g, '\\$&');
        return `(title.ilike.%${escapedTerm}% | description.ilike.%${escapedTerm}% | conditions.cs.{${escapedTerm}} | interventions.cs.{${escapedTerm}} | layman_description.ilike.%${escapedTerm}%)`;
      }).join(',');
      
      queryBuilder = queryBuilder.or(searchConditions);
    }

    // Apply filters
    if (filters.status && filters.status.length > 0) {
      queryBuilder = queryBuilder.in('status', filters.status);
    }

    if (filters.phase && filters.phase.length > 0) {
      queryBuilder = queryBuilder.in('phase', filters.phase);
    }

    if (filters.sponsor) {
      queryBuilder = queryBuilder.ilike('sponsor', `%${filters.sponsor}%`);
    }

    if (filters.location) {
      // Search in locations array - it contains strings like "City, State, Country"
      queryBuilder = queryBuilder.filter('locations', 'cs', `{*${filters.location}*}`);
    }

    // Note: locationRadius filtering is handled on the frontend after geocoding
    // since it requires calculating distances between coordinates

    if (filters.compensationMin !== null) {
      queryBuilder = queryBuilder.gte('compensation_amount', filters.compensationMin);
    }

    if (filters.compensationMax !== null) {
      queryBuilder = queryBuilder.lte('compensation_amount', filters.compensationMax);
    }

    if (filters.source && filters.source.length > 0) {
      queryBuilder = queryBuilder.in('source', filters.source);
    }

    // Apply age and gender filters through eligibility criteria
    if (filters.ageMin !== null || filters.ageMax !== null || filters.gender) {
      // For now, we'll filter these in the post-processing step
      // since eligibility_criteria structure varies
    }

    // Apply sorting
    switch (sortBy) {
      case 'newest':
        queryBuilder = queryBuilder.order('created_at', { ascending: false });
        break;
      case 'compensation':
        queryBuilder = queryBuilder
          .order('compensation_amount', { ascending: false, nullsFirst: false });
        break;
      case 'urgency':
        queryBuilder = queryBuilder
          .order('urgency', { ascending: false })
          .order('boost_visibility', { ascending: false });
        break;
      case 'relevance':
      default:
        // For relevance, prioritize featured trials and those with boost visibility
        queryBuilder = queryBuilder
          .order('featured', { ascending: false })
          .order('boost_visibility', { ascending: false })
          .order('created_at', { ascending: false });
        break;
    }

    // Apply pagination
    const startIndex = (page - 1) * limit;
    queryBuilder = queryBuilder.range(startIndex, startIndex + limit - 1);

    // Execute the query
    const { data: results, error, count } = await queryBuilder;

    if (error) {
      console.error('Search error:', error);
      return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }

    // Generate search suggestions based on the query
    let suggestions: string[] = [];
    if (query) {
      // Get related conditions from the database
      const { data: conditionData } = await supabase
        .from('medical_term_mappings')
        .select('patient_term, medical_term')
        .or(`patient_term.ilike.%${query}%,medical_term.ilike.%${query}%`)
        .limit(5);

      if (conditionData) {
        suggestions = conditionData.map(d => d.patient_term);
      }
    }

    // Add relevance scoring for text search
    const scoredResults = results?.map(trial => {
      let score = 0;
      if (query) {
        const lowerQuery = query.toLowerCase();
        const lowerTitle = trial.title?.toLowerCase() || '';
        const lowerDesc = trial.description?.toLowerCase() || '';
        
        // Score based on where the match occurs
        if (lowerTitle.includes(lowerQuery)) score += 10;
        if (lowerDesc.includes(lowerQuery)) score += 5;
        if (trial.conditions?.some((c: string) => c.toLowerCase().includes(lowerQuery))) score += 8;
        if (trial.interventions?.some((i: string) => i.toLowerCase().includes(lowerQuery))) score += 6;
      }
      
      return { ...trial, relevance_score: score };
    });

    // If sorting by relevance and we have a query, sort by our calculated score
    if (sortBy === 'relevance' && query) {
      scoredResults?.sort((a, b) => {
        // First by relevance score
        if (b.relevance_score !== a.relevance_score) {
          return b.relevance_score - a.relevance_score;
        }
        // Then by featured status
        if (b.featured !== a.featured) {
          return b.featured ? 1 : -1;
        }
        // Then by boost visibility
        if (b.boost_visibility !== a.boost_visibility) {
          return b.boost_visibility ? 1 : -1;
        }
        // Finally by creation date
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }

    // Track search analytics
    if (query) {
      // Don't await to avoid slowing down the response
      supabase.from('search_analytics').insert({
        query,
        filters,
        results_count: count || 0,
      }).then(({ error }) => {
        if (error) {
          console.error('Failed to track search analytics:', error);
        }
      });
    }

    return NextResponse.json({
      results: scoredResults || [],
      total: count || 0,
      suggestions,
      page,
      limit,
    });
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}