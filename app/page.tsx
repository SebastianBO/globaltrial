import Link from 'next/link'
import { Search, Activity, Database } from 'lucide-react'

export default function HomePage() {
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
        </div>

        <div className="flex flex-col md:flex-row gap-8 justify-center items-center mb-16">
          <Link
            href="/patient"
            className="bg-blue-600 text-white px-8 py-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-lg"
          >
            Find a Trial
          </Link>
          <Link
            href="/trials"
            className="bg-white text-blue-600 px-8 py-4 rounded-lg font-semibold hover:bg-gray-50 transition-colors shadow-lg border-2 border-blue-600"
          >
            Browse Trials
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="bg-white p-8 rounded-lg shadow-md">
            <Search className="w-12 h-12 text-blue-600 mb-4" />
            <h3 className="text-xl font-semibold mb-2">AI Matching</h3>
            <p className="text-gray-600">
              Our AI analyzes your medical history to find the most suitable clinical trials
            </p>
          </div>
          
          <div className="bg-white p-8 rounded-lg shadow-md">
            <Database className="w-12 h-12 text-blue-600 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Global Database</h3>
            <p className="text-gray-600">
              Access trials from ClinicalTrials.gov and EMA databases
            </p>
          </div>
          
          <div className="bg-white p-8 rounded-lg shadow-md">
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
