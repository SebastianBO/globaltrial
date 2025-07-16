'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

// Simple debounce implementation
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

interface SearchFilters {
  status: string[];
  phase: string[];
  sponsor: string;
  location: string;
  ageMin: number | null;
  ageMax: number | null;
  gender: string;
  compensationMin: number | null;
  compensationMax: number | null;
  source: string[];
}

interface SearchResult {
  id: string;
  trial_id: string;
  title: string;
  description: string;
  conditions: string[];
  interventions: string[];
  sponsor: string;
  status: string;
  phase: string;
  locations: any[];
  compensation_amount: number | null;
  compensation_currency: string;
  source: string;
  urgency: string;
  featured: boolean;
  relevance_score?: number;
}

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    status: [],
    phase: [],
    sponsor: '',
    location: '',
    ageMin: null,
    ageMax: null,
    gender: '',
    compensationMin: null,
    compensationMax: null,
    source: [],
  });
  const [sortBy, setSortBy] = useState('relevance');
  const [page, setPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [savedSearchName, setSavedSearchName] = useState('');

  const resultsPerPage = 20;

  // Debounced search function
  const debouncedSearch = useMemo(
    () =>
      debounce(async (searchQuery: string) => {
        if (!searchQuery.trim() && Object.values(filters).every(v => !v || (Array.isArray(v) && v.length === 0))) {
          setResults([]);
          setTotalResults(0);
          return;
        }

        setLoading(true);
        try {
          const response = await fetch('/api/search-trials', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: searchQuery,
              filters,
              sortBy,
              page,
              limit: resultsPerPage,
            }),
          });

          if (!response.ok) throw new Error('Search failed');

          const data = await response.json();
          setResults(data.results);
          setTotalResults(data.total);
          setSuggestions(data.suggestions || []);

          // Update URL
          const params = new URLSearchParams();
          if (searchQuery) params.set('q', searchQuery);
          if (page > 1) params.set('page', page.toString());
          router.push(`/search?${params.toString()}`, { scroll: false });
        } catch (error) {
          console.error('Search error:', error);
        } finally {
          setLoading(false);
        }
      }, 300),
    [filters, sortBy, page, router]
  );

  // Trigger search on query or filter changes
  useEffect(() => {
    debouncedSearch(query);
  }, [query, filters, sortBy, page, debouncedSearch]);

  // Load sponsors for filter dropdown
  const [sponsors, setSponsors] = useState<string[]>([]);
  useEffect(() => {
    const fetchSponsors = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('clinical_trials')
        .select('sponsor')
        .not('sponsor', 'is', null)
        .limit(100);
      
      if (data) {
        const uniqueSponsors = [...new Set(data.map(d => d.sponsor))].sort();
        setSponsors(uniqueSponsors);
      }
    };
    fetchSponsors();
  }, []);

  const handleSaveSearch = async () => {
    if (!savedSearchName.trim()) return;

    const supabase = createClient();
    const { error } = await supabase.from('saved_searches').insert({
      name: savedSearchName,
      query,
      filters,
      created_at: new Date().toISOString(),
    });

    if (!error) {
      alert('Search saved successfully!');
      setSavedSearchName('');
    }
  };

  const handleExportCSV = () => {
    const csv = [
      ['Title', 'Sponsor', 'Status', 'Phase', 'Conditions', 'Compensation', 'Source'],
      ...results.map(r => [
        r.title,
        r.sponsor,
        r.status,
        r.phase,
        r.conditions.join('; '),
        r.compensation_amount ? `${r.compensation_currency} ${r.compensation_amount}` : 'N/A',
        r.source,
      ]),
    ]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clinical-trials-search-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const totalPages = Math.ceil(totalResults / resultsPerPage);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Search Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search clinical trials by condition, treatment, or keyword..."
                className="w-full px-4 py-3 pr-12 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <svg
                className="absolute right-4 top-3.5 w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-3 border rounded-lg hover:bg-gray-50 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              Filters
              {Object.values(filters).some(v => v && (Array.isArray(v) ? v.length > 0 : true)) && (
                <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
                  Active
                </span>
              )}
            </button>
          </div>

          {/* Search Suggestions */}
          {suggestions.length > 0 && (
            <div className="mt-2 flex gap-2 flex-wrap">
              <span className="text-sm text-gray-600">Try:</span>
              {suggestions.map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => setQuery(suggestion)}
                  className="text-sm text-blue-600 hover:underline"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Filters Sidebar */}
          {showFilters && (
            <div className="w-80 bg-white p-6 rounded-lg shadow-sm h-fit">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold">Filters</h3>
                <button
                  onClick={() => setFilters({
                    status: [],
                    phase: [],
                    sponsor: '',
                    location: '',
                    ageMin: null,
                    ageMax: null,
                    gender: '',
                    compensationMin: null,
                    compensationMax: null,
                    source: [],
                  })}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Clear all
                </button>
              </div>

              {/* Status Filter */}
              <div className="mb-6">
                <h4 className="font-medium mb-2">Trial Status</h4>
                {['Recruiting', 'Active, not recruiting', 'Completed', 'Enrolling by invitation'].map(status => (
                  <label key={status} className="flex items-center gap-2 mb-1">
                    <input
                      type="checkbox"
                      checked={filters.status.includes(status)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFilters({ ...filters, status: [...filters.status, status] });
                        } else {
                          setFilters({ ...filters, status: filters.status.filter(s => s !== status) });
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm">{status}</span>
                  </label>
                ))}
              </div>

              {/* Phase Filter */}
              <div className="mb-6">
                <h4 className="font-medium mb-2">Phase</h4>
                {['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4', 'Early Phase 1'].map(phase => (
                  <label key={phase} className="flex items-center gap-2 mb-1">
                    <input
                      type="checkbox"
                      checked={filters.phase.includes(phase)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFilters({ ...filters, phase: [...filters.phase, phase] });
                        } else {
                          setFilters({ ...filters, phase: filters.phase.filter(p => p !== phase) });
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm">{phase}</span>
                  </label>
                ))}
              </div>

              {/* Sponsor Filter */}
              <div className="mb-6">
                <h4 className="font-medium mb-2">Sponsor</h4>
                <select
                  value={filters.sponsor}
                  onChange={(e) => setFilters({ ...filters, sponsor: e.target.value })}
                  className="w-full border rounded px-2 py-1 text-sm"
                >
                  <option value="">All sponsors</option>
                  {sponsors.map(sponsor => (
                    <option key={sponsor} value={sponsor}>{sponsor}</option>
                  ))}
                </select>
              </div>

              {/* Location Filter */}
              <div className="mb-6">
                <h4 className="font-medium mb-2">Location</h4>
                <input
                  type="text"
                  value={filters.location}
                  onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                  placeholder="Country, state, or city"
                  className="w-full border rounded px-2 py-1 text-sm"
                />
              </div>

              {/* Age Filter */}
              <div className="mb-6">
                <h4 className="font-medium mb-2">Age Range</h4>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={filters.ageMin || ''}
                    onChange={(e) => setFilters({ ...filters, ageMin: e.target.value ? parseInt(e.target.value) : null })}
                    placeholder="Min"
                    className="w-1/2 border rounded px-2 py-1 text-sm"
                  />
                  <input
                    type="number"
                    value={filters.ageMax || ''}
                    onChange={(e) => setFilters({ ...filters, ageMax: e.target.value ? parseInt(e.target.value) : null })}
                    placeholder="Max"
                    className="w-1/2 border rounded px-2 py-1 text-sm"
                  />
                </div>
              </div>

              {/* Gender Filter */}
              <div className="mb-6">
                <h4 className="font-medium mb-2">Gender</h4>
                <select
                  value={filters.gender}
                  onChange={(e) => setFilters({ ...filters, gender: e.target.value })}
                  className="w-full border rounded px-2 py-1 text-sm"
                >
                  <option value="">All</option>
                  <option value="All">All Genders</option>
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                </select>
              </div>

              {/* Compensation Filter */}
              <div className="mb-6">
                <h4 className="font-medium mb-2">Compensation Range ($)</h4>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={filters.compensationMin || ''}
                    onChange={(e) => setFilters({ ...filters, compensationMin: e.target.value ? parseInt(e.target.value) : null })}
                    placeholder="Min"
                    className="w-1/2 border rounded px-2 py-1 text-sm"
                  />
                  <input
                    type="number"
                    value={filters.compensationMax || ''}
                    onChange={(e) => setFilters({ ...filters, compensationMax: e.target.value ? parseInt(e.target.value) : null })}
                    placeholder="Max"
                    className="w-1/2 border rounded px-2 py-1 text-sm"
                  />
                </div>
              </div>

              {/* Source Filter */}
              <div className="mb-6">
                <h4 className="font-medium mb-2">Trial Source</h4>
                {['ClinicalTrials.gov', 'EU-CTR', 'WHO ICTRP', 'ISRCTN'].map(source => (
                  <label key={source} className="flex items-center gap-2 mb-1">
                    <input
                      type="checkbox"
                      checked={filters.source.includes(source)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFilters({ ...filters, source: [...filters.source, source] });
                        } else {
                          setFilters({ ...filters, source: filters.source.filter(s => s !== source) });
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm">{source}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Results */}
          <div className="flex-1">
            {/* Results Header */}
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-semibold">
                  {loading ? 'Searching...' : `${totalResults} trials found`}
                </h2>
                {query && (
                  <p className="text-gray-600">
                    Results for "{query}"
                  </p>
                )}
              </div>
              <div className="flex items-center gap-4">
                {/* Sort Dropdown */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="border rounded px-3 py-2 text-sm"
                >
                  <option value="relevance">Most Relevant</option>
                  <option value="newest">Newest First</option>
                  <option value="compensation">Highest Compensation</option>
                  <option value="urgency">Most Urgent</option>
                </select>

                {/* Save Search */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={savedSearchName}
                    onChange={(e) => setSavedSearchName(e.target.value)}
                    placeholder="Save search as..."
                    className="border rounded px-2 py-1 text-sm"
                  />
                  <button
                    onClick={handleSaveSearch}
                    disabled={!savedSearchName.trim()}
                    className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>

                {/* Export Button */}
                <button
                  onClick={handleExportCSV}
                  disabled={results.length === 0}
                  className="text-sm border px-3 py-1 rounded hover:bg-gray-50 disabled:opacity-50"
                >
                  Export CSV
                </button>
              </div>
            </div>

            {/* Results List */}
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600">No trials found. Try adjusting your search or filters.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {results.map((trial) => (
                  <Link
                    key={trial.id}
                    href={`/trials/${trial.id}`}
                    className="block bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-blue-600 hover:text-blue-800">
                          {trial.title}
                        </h3>
                        {trial.featured && (
                          <span className="inline-block bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full mt-1">
                            Featured
                          </span>
                        )}
                      </div>
                      {trial.urgency === 'high' && (
                        <span className="bg-red-100 text-red-800 text-sm px-3 py-1 rounded-full">
                          Urgent
                        </span>
                      )}
                    </div>

                    <p className="text-gray-600 mb-3 line-clamp-2">
                      {trial.description}
                    </p>

                    <div className="flex flex-wrap gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Sponsor:</span>{' '}
                        <span className="font-medium">{trial.sponsor}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Status:</span>{' '}
                        <span className={`font-medium ${
                          trial.status === 'Recruiting' ? 'text-green-600' : ''
                        }`}>
                          {trial.status}
                        </span>
                      </div>
                      {trial.phase && (
                        <div>
                          <span className="text-gray-500">Phase:</span>{' '}
                          <span className="font-medium">{trial.phase}</span>
                        </div>
                      )}
                      {trial.compensation_amount && (
                        <div>
                          <span className="text-gray-500">Compensation:</span>{' '}
                          <span className="font-medium text-green-600">
                            {trial.compensation_currency} {trial.compensation_amount.toLocaleString()}
                          </span>
                        </div>
                      )}
                      <div>
                        <span className="text-gray-500">Source:</span>{' '}
                        <span className="font-medium">{trial.source}</span>
                      </div>
                    </div>

                    {trial.conditions && trial.conditions.length > 0 && (
                      <div className="mt-3">
                        <div className="flex flex-wrap gap-2">
                          {trial.conditions.slice(0, 3).map((condition, i) => (
                            <span
                              key={i}
                              className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded"
                            >
                              {condition}
                            </span>
                          ))}
                          {trial.conditions.length > 3 && (
                            <span className="text-xs text-gray-500">
                              +{trial.conditions.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-8">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <div className="flex gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`px-3 py-1 rounded ${
                          page === pageNum
                            ? 'bg-blue-600 text-white'
                            : 'border hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}