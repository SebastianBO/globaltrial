import { createClient } from '@/lib/supabase/server'
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react'

export default async function PatientMatchesPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params
  const supabase = await createClient()
  
  // Fetch patient matches with trial details
  const { data: matches, error } = await supabase
    .from('patient_trial_matches')
    .select(`
      *,
      clinical_trials (*)
    `)
    .eq('patient_id', id)
    .order('match_score', { ascending: false })

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4">
          <p className="text-red-600">Error loading matches. Please try again.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Your Clinical Trial Matches</h1>
        
        {matches && matches.length > 0 ? (
          <div className="space-y-6">
            {matches.map((match) => {
              const trial = match.clinical_trials
              const matchReasons = match.match_reasons as any
              
              return (
                <div key={match.id} className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h2 className="text-xl font-semibold text-gray-900 mb-2">
                        {trial?.title}
                      </h2>
                      <p className="text-sm text-gray-600">
                        Trial ID: {trial?.trial_id}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-blue-600">
                        {(match.match_score * 100).toFixed(0)}%
                      </div>
                      <div className="text-sm text-gray-600">Match Score</div>
                    </div>
                  </div>

                  <p className="text-gray-700 mb-4">
                    {trial?.description}
                  </p>

                  <div className="mb-4">
                    <h3 className="font-medium text-gray-900 mb-2">Why You Match</h3>
                    <ul className="space-y-2">
                      {matchReasons?.reasons?.map((reason: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-gray-700">{reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Conditions</h4>
                      <div className="flex flex-wrap gap-2">
                        {trial?.conditions?.map((condition, idx) => (
                          <span key={idx} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                            {condition}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    {trial?.sponsor && (
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Sponsor</h4>
                        <p className="text-sm text-gray-700">{trial.sponsor}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-4">
                    <button className="bg-blue-600 text-white px-6 py-2 rounded-md font-medium hover:bg-blue-700 transition-colors">
                      Express Interest
                    </button>
                    <button className="border border-gray-300 text-gray-700 px-6 py-2 rounded-md font-medium hover:bg-gray-50 transition-colors">
                      View Details
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No Matches Found</h2>
            <p className="text-gray-600">
              We couldn't find any clinical trials matching your profile at this time. 
              Please check back later as new trials are added regularly.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}