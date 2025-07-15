import { createClient } from '@/lib/supabase/server'
import { Calendar, Building2, Users, MapPin, Info, Phone } from 'lucide-react'
import Link from 'next/link'

export default async function TrialsPage() {
  const supabase = await createClient()
  
  const { data: trials, count } = await supabase
    .from('clinical_trials')
    .select('*', { count: 'exact' })
    .eq('status', 'recruiting')
    .order('created_at', { ascending: false })
    .limit(20)

  return (
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
            const eligibility = trial.eligibility_criteria as any
            const locations = trial.locations as any[]
            const contactInfo = trial.contact_info as any
            
            return (
              <div key={trial.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
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

                {/* Locations Section */}
                {locations && locations.length > 0 && (
                  <div className="mb-4">
                    <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Locations ({locations.length})
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {locations.slice(0, 3).map((location: any, idx: number) => (
                        <span key={idx} className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-sm">
                          {location.city}, {location.state || location.country}
                        </span>
                      ))}
                      {locations.length > 3 && (
                        <span className="text-gray-500 text-sm">+{locations.length - 3} more locations</span>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-4 text-sm text-gray-600 pt-3 border-t">
                  {trial.sponsor && (
                    <div className="flex items-center gap-1">
                      <Building2 className="w-4 h-4" />
                      <span>{trial.sponsor}</span>
                    </div>
                  )}
                  
                  {trial.phase && trial.phase !== 'NA' && (
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      <span>{trial.phase}</span>
                    </div>
                  )}
                  
                  {trial.start_date && (
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>Started: {new Date(trial.start_date).toLocaleDateString()}</span>
                    </div>
                  )}

                  {contactInfo?.centralContact && (
                    <div className="flex items-center gap-1">
                      <Phone className="w-4 h-4" />
                      <span>Contact Available</span>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex gap-3">
                  <Link 
                    href={`/trials/${trial.id}`}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                  >
                    View Details
                  </Link>
                  <a 
                    href={`https://clinicaltrials.gov/study/${trial.trial_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50 transition-colors"
                  >
                    View on ClinicalTrials.gov
                  </a>
                </div>
              </div>
            )
          })}
        </div>

        {(!trials || trials.length === 0) && (
          <div className="text-center py-12 bg-white rounded-lg shadow-md">
            <p className="text-gray-600">No trials available. Check back later!</p>
          </div>
        )}

        {trials && trials.length > 0 && (
          <div className="mt-8 text-center">
            <p className="text-gray-600 mb-4">
              Showing {trials.length} of {count} trials
            </p>
            <Link 
              href="/patient"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Find Trials That Match You
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}