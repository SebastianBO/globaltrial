import Link from 'next/link'
import { Search, Activity, Database, MessageCircle, DollarSign, Heart } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'

export default async function HomePage() {
  const supabase = await createClient()
  
  // Get statistics
  const { count: totalTrials } = await supabase
    .from('clinical_trials')
    .select('*', { count: 'exact', head: true })
    
  const { data: conditions } = await supabase
    .from('clinical_trials')
    .select('conditions')
    .limit(100)
    
  // Count unique conditions
  const uniqueConditions = new Set()
  conditions?.forEach(row => {
    row.conditions?.forEach((condition: string) => uniqueConditions.add(condition))
  })
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            GlobalTrial
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            AI-powered clinical trial matching platform connecting patients with the right trials worldwide
          </p>
          
          {/* Motivational Banner */}
          <div className="mt-8 flex flex-col md:flex-row gap-4 justify-center items-center text-lg">
            <div className="flex items-center gap-2 text-green-600">
              <DollarSign className="w-6 h-6" />
              <span className="font-medium">Earn compensation for participation</span>
            </div>
            <div className="hidden md:block text-gray-400">•</div>
            <div className="flex items-center gap-2 text-red-600">
              <Heart className="w-6 h-6" />
              <span className="font-medium">Access cutting-edge treatments</span>
            </div>
          </div>
        </div>

        {/* Statistics Banner */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-12 max-w-3xl mx-auto">
          <div className="grid md:grid-cols-3 gap-6 text-center">
            <div>
              <p className="text-3xl font-bold text-blue-600">{totalTrials || 0}</p>
              <p className="text-gray-600">Active Trials</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-blue-600">{uniqueConditions.size}</p>
              <p className="text-gray-600">Conditions Covered</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-blue-600">100%</p>
              <p className="text-gray-600">Free to Use</p>
            </div>
          </div>
        </div>

        {/* New Chat CTA */}
        <div className="text-center mb-12">
          <Link
            href="/chat"
            className="inline-flex items-center gap-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-10 py-5 rounded-full font-bold text-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-xl transform hover:scale-105"
          >
            <MessageCircle className="w-6 h-6" />
            Start Chat with AI Assistant
          </Link>
          <p className="text-gray-600 mt-3">Have a conversation to find your perfect trial match</p>
        </div>

        <div className="flex flex-col md:flex-row gap-8 justify-center items-center mb-16">
          <Link
            href="/patient"
            className="bg-white text-blue-600 px-8 py-4 rounded-lg font-semibold hover:bg-gray-50 transition-colors shadow-lg border-2 border-blue-600"
          >
            Use Traditional Form
          </Link>
          <Link
            href="/trials"
            className="bg-white text-blue-600 px-8 py-4 rounded-lg font-semibold hover:bg-gray-50 transition-colors shadow-lg border-2 border-blue-600"
          >
            Browse All {totalTrials} Trials
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="bg-white p-8 rounded-lg shadow-md hover:shadow-xl transition-shadow">
            <Search className="w-12 h-12 text-blue-600 mb-4" />
            <h3 className="text-xl font-semibold mb-2">AI Matching</h3>
            <p className="text-gray-600">
              Our AI analyzes your medical history to find the most suitable clinical trials
            </p>
          </div>
          
          <div className="bg-white p-8 rounded-lg shadow-md hover:shadow-xl transition-shadow">
            <Database className="w-12 h-12 text-blue-600 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Global Database</h3>
            <p className="text-gray-600">
              Access trials from ClinicalTrials.gov and EMA databases
            </p>
          </div>
          
          <div className="bg-white p-8 rounded-lg shadow-md hover:shadow-xl transition-shadow">
            <Activity className="w-12 h-12 text-blue-600 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Real-time Updates</h3>
            <p className="text-gray-600">
              Stay informed about trial status and new matching opportunities
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}