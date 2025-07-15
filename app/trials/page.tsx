import { createClient } from '@/lib/supabase/server'
import { MapPin, Calendar, Building2, Users } from 'lucide-react'

export default async function TrialsPage() {
  const supabase = await createClient()
  
  const { data: trials, error } = await supabase
    .from('clinical_trials')
    .select('*')
    .eq('status', 'recruiting')
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Active Clinical Trials</h1>
        
        <div className="grid gap-6">
          {trials?.map((trial) => (
            <div key={trial.id} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">
                    {trial.title}
                  </h2>
                  <p className="text-sm text-gray-600 mb-1">
                    Trial ID: {trial.trial_id}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
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
                    {trial.conditions?.map((condition, idx) => (
                      <span key={idx} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                        {condition}
                      </span>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">Interventions</h3>
                  <div className="flex flex-wrap gap-2">
                    {trial.interventions?.slice(0, 3).map((intervention, idx) => (
                      <span key={idx} className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-sm">
                        {intervention}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                {trial.sponsor && (
                  <div className="flex items-center gap-1">
                    <Building2 className="w-4 h-4" />
                    <span>{trial.sponsor}</span>
                  </div>
                )}
                
                {trial.phase && (
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
              </div>
            </div>
          ))}
        </div>

        {!trials || trials.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600">No trials available. Check back later!</p>
          </div>
        )}
      </div>
    </div>
  )
}