import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Calendar, Building2, Users, MapPin, Info, Phone, Mail, Globe } from 'lucide-react'

export default async function TrialDetailPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params
  const supabase = await createClient()
  
  const { data: trial, error } = await supabase
    .from('clinical_trials')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !trial) {
    notFound()
  }

  const eligibility = trial.eligibility_criteria as { gender?: string; minAge?: string; maxAge?: string; criteria?: string }
  const locations = trial.locations as { facility?: string; city?: string; state?: string; country?: string; status?: string }[]
  const contactInfo = trial.contact_info as { centralContact?: { name?: string; phone?: string; email?: string } }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <Link 
          href="/trials" 
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Trials
        </Link>

        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="mb-6">
            <div className="flex justify-between items-start mb-4">
              <h1 className="text-2xl font-bold text-gray-900 flex-1">
                {trial.title}
              </h1>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ml-4 ${
                trial.status === 'recruiting' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {trial.status}
              </span>
            </div>
            
            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
              <div>
                <span className="font-medium">Trial ID:</span>
                <span className="ml-2 font-mono">{trial.trial_id}</span>
              </div>
              {trial.source && (
                <div>
                  <span className="font-medium">Source:</span>
                  <span className="ml-2">{trial.source}</span>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Description</h2>
            <p className="text-gray-700 whitespace-pre-line">{trial.description}</p>
          </section>

          {/* Conditions & Interventions */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Conditions</h2>
              <div className="flex flex-wrap gap-2">
                {trial.conditions?.map((condition: string, idx: number) => (
                  <span key={idx} className="bg-blue-100 text-blue-800 px-3 py-1 rounded text-sm">
                    {condition}
                  </span>
                ))}
              </div>
            </section>
            
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Interventions</h2>
              <div className="flex flex-wrap gap-2">
                {trial.interventions?.length > 0 ? (
                  trial.interventions.map((intervention: string, idx: number) => (
                    <span key={idx} className="bg-purple-100 text-purple-800 px-3 py-1 rounded text-sm">
                      {intervention}
                    </span>
                  ))
                ) : (
                  <span className="text-gray-500">Not specified</span>
                )}
              </div>
            </section>
          </div>

          {/* Eligibility */}
          {eligibility && (
            <section className="mb-8 bg-blue-50 p-6 rounded-lg">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Info className="w-5 h-5" />
                Eligibility Criteria
              </h2>
              
              <div className="grid md:grid-cols-3 gap-4 mb-4">
                <div>
                  <span className="text-gray-600 font-medium">Gender:</span>
                  <p className="text-gray-900">{eligibility.gender || 'All'}</p>
                </div>
                <div>
                  <span className="text-gray-600 font-medium">Minimum Age:</span>
                  <p className="text-gray-900">{eligibility.minAge || 'No limit'}</p>
                </div>
                <div>
                  <span className="text-gray-600 font-medium">Maximum Age:</span>
                  <p className="text-gray-900">{eligibility.maxAge || 'No limit'}</p>
                </div>
              </div>
              
              {eligibility.criteria && (
                <div>
                  <span className="text-gray-600 font-medium">Detailed Criteria:</span>
                  <p className="text-gray-700 mt-2 whitespace-pre-line text-sm">
                    {eligibility.criteria}
                  </p>
                </div>
              )}
            </section>
          )}

          {/* Study Details */}
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Study Details</h2>
            <div className="grid md:grid-cols-2 gap-4">
              {trial.sponsor && (
                <div className="flex items-start gap-2">
                  <Building2 className="w-5 h-5 text-gray-500 mt-0.5" />
                  <div>
                    <span className="text-gray-600 font-medium">Sponsor:</span>
                    <p className="text-gray-900">{trial.sponsor}</p>
                  </div>
                </div>
              )}
              
              {trial.phase && trial.phase !== 'NA' && (
                <div className="flex items-start gap-2">
                  <Users className="w-5 h-5 text-gray-500 mt-0.5" />
                  <div>
                    <span className="text-gray-600 font-medium">Phase:</span>
                    <p className="text-gray-900">{trial.phase}</p>
                  </div>
                </div>
              )}
              
              {trial.start_date && (
                <div className="flex items-start gap-2">
                  <Calendar className="w-5 h-5 text-gray-500 mt-0.5" />
                  <div>
                    <span className="text-gray-600 font-medium">Start Date:</span>
                    <p className="text-gray-900">{new Date(trial.start_date).toLocaleDateString()}</p>
                  </div>
                </div>
              )}
              
              {trial.completion_date && (
                <div className="flex items-start gap-2">
                  <Calendar className="w-5 h-5 text-gray-500 mt-0.5" />
                  <div>
                    <span className="text-gray-600 font-medium">Expected Completion:</span>
                    <p className="text-gray-900">{new Date(trial.completion_date).toLocaleDateString()}</p>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Locations */}
          {locations && locations.length > 0 && (
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Study Locations ({locations.length})
              </h2>
              <div className="grid gap-3">
                {locations.map((location, idx) => (
                  <div key={idx} className="bg-gray-50 p-4 rounded-lg">
                    <p className="font-medium text-gray-900">{location.facility}</p>
                    <p className="text-gray-600">
                      {location.city}{location.state && `, ${location.state}`}, {location.country}
                    </p>
                    {location.status && (
                      <p className="text-sm text-gray-500 mt-1">Status: {location.status}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Contact Information */}
          {contactInfo && (
            <section className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Phone className="w-5 h-5" />
                Contact Information
              </h2>
              {contactInfo.centralContact && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="font-medium text-gray-900">
                    {contactInfo.centralContact.name || 'Central Contact'}
                  </p>
                  {contactInfo.centralContact.phone && (
                    <p className="text-gray-600 flex items-center gap-2 mt-1">
                      <Phone className="w-4 h-4" />
                      {contactInfo.centralContact.phone}
                    </p>
                  )}
                  {contactInfo.centralContact.email && (
                    <p className="text-gray-600 flex items-center gap-2 mt-1">
                      <Mail className="w-4 h-4" />
                      {contactInfo.centralContact.email}
                    </p>
                  )}
                </div>
              )}
            </section>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-4 pt-6 border-t">
            <Link 
              href="/patient"
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Check If You Match
            </Link>
            <a 
              href={`https://clinicaltrials.gov/study/${trial.trial_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="border border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <Globe className="w-4 h-4" />
              View on ClinicalTrials.gov
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}