import { createClient } from '@/lib/supabase/server'
import { Calendar, Building2, MapPin, Info, DollarSign, AlertCircle, Clock } from 'lucide-react'
import Link from 'next/link'
import Navigation from '@/components/navigation'

export default async function TrialsPage() {
  const supabase = await createClient()
  
  const { data: trials, count } = await supabase
    .from('clinical_trials')
    .select('*', { count: 'exact' })
    .eq('status', 'recruiting')
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Active Clinical Trials</h1>
          <p className="text-gray-600">
            Found {count || 0} recruiting clinical trials. Showing the most recent 20.
          </p>
        </div>
        
        <div className="grid gap-6">
          {trials?.map((trial) => {
            const eligibility = trial.eligibility_criteria as { gender?: string; minAge?: string; maxAge?: string; criteria?: string }
            const locations = trial.locations as { facility?: string; city?: string; state?: string; country?: string; status?: string }[]
            const compensation = trial.compensation as { amount?: number; per_visit?: number; currency?: string; description?: string; additional_benefits?: string[]; visits_estimated?: number }
            
            return (
              <div 
                key={trial.id} 
                className="bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden group"
              >
                
                <div className="p-6">
                  {/* Compensation Highlight */}
                  {compensation && (compensation.amount > 0 || compensation.per_visit > 0 || (compensation.additional_benefits && compensation.additional_benefits.length > 0)) && (
                    <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 mb-4 transform transition-transform group-hover:scale-105">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <DollarSign className="w-6 h-6 text-green-600" />
                            <span className="text-2xl font-bold text-green-700">
                              ${compensation.amount?.toLocaleString() || '0'} {compensation.currency || 'USD'}
                            </span>
                          </div>
                          {(compensation.per_visit && compensation.per_visit > 0) && (
                            <p className="text-green-600 font-medium">
                              ${compensation.per_visit} per visit • ~{compensation.visits_estimated || 10} visits
                            </p>
                          )}
                          <p className="text-sm text-gray-600 mt-1">{compensation.description}</p>
                        </div>
                      </div>
                      {compensation.additional_benefits && compensation.additional_benefits.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-green-200">
                          <p className="text-sm font-medium text-gray-700 mb-1">Additional Benefits:</p>
                          <div className="flex flex-wrap gap-2">
                            {compensation.additional_benefits.map((benefit, idx) => (
                              <span key={idx} className="bg-white px-2 py-1 rounded text-xs text-gray-700 border border-green-200">
                                {benefit.replace(/_/g, ' ').charAt(0).toUpperCase() + benefit.slice(1).replace(/_/g, ' ')}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h2 className="text-xl font-semibold text-gray-900 mb-2 line-clamp-2">
                        {trial.title}
                      </h2>
                      <p className="text-sm text-gray-600 mb-1">
                        Trial ID: <span className="font-mono">{trial.trial_id}</span>
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ml-4 ${
                      trial.status === 'recruiting' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {trial.status}
                    </span>
                  </div>

                  <p className="text-gray-700 mb-4 line-clamp-3">
                    {trial.description}
                  </p>

                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <h3 className="font-medium text-gray-900 mb-2">Conditions</h3>
                      <div className="flex flex-wrap gap-2">
                        {trial.conditions?.map((condition: string, idx: number) => (
                          <span key={idx} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                            {condition}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="font-medium text-gray-900 mb-2">Interventions</h3>
                      <div className="flex flex-wrap gap-2">
                        {trial.interventions?.length > 0 ? (
                          trial.interventions.slice(0, 3).map((intervention: string, idx: number) => (
                            <span key={idx} className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-sm">
                              {intervention}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-500 text-sm">Not specified</span>
                        )}
                        {trial.interventions?.length > 3 && (
                          <span className="text-gray-500 text-sm">+{trial.interventions.length - 3} more</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Eligibility Section */}
                  {eligibility && (
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                      <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                        <Info className="w-4 h-4" />
                        Eligibility
                      </h3>
                      <div className="grid md:grid-cols-3 gap-3 text-sm">
                        <div>
                          <span className="text-gray-600">Gender:</span>
                          <span className="ml-2 font-medium">{eligibility.gender || 'All'}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Min Age:</span>
                          <span className="ml-2 font-medium">{eligibility.minAge || 'No limit'}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Max Age:</span>
                          <span className="ml-2 font-medium">{eligibility.maxAge || 'No limit'}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Location Section */}
                  {locations && locations.length > 0 && (
                    <div className="mb-4">
                      <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        Locations ({locations.length})
                      </h3>
                      <div className="space-y-1">
                        {locations.slice(0, 2).map((location, idx) => (
                          <div key={idx} className="text-sm text-gray-600">
                            {location.facility && <span className="font-medium">{location.facility}</span>}
                            {location.city && location.state && (
                              <span> - {location.city}, {location.state}</span>
                            )}
                            {location.country && <span>, {location.country}</span>}
                          </div>
                        ))}
                        {locations.length > 2 && (
                          <span className="text-sm text-gray-500">+{locations.length - 2} more locations</span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 text-sm text-gray-600 mb-4">
                    <div className="flex items-center gap-1">
                      <Building2 className="w-4 h-4" />
                      {trial.sponsor ? (
                        <Link 
                          href={`/sponsors/${encodeURIComponent(trial.sponsor)}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {trial.sponsor}
                        </Link>
                      ) : (
                        <span>Sponsor not specified</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>Phase {trial.phase || 'N/A'}</span>
                    </div>
                  </div>

                  <Link
                    href={`/trials/${trial.id}`}
                    className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-all hover:shadow-lg transform hover:-translate-y-1"
                  >
                    View Details & Apply
                    <Clock className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
    </>
  )
}