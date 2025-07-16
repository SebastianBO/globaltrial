import { createClient } from '@/lib/supabase/server'
import Navigation from '@/components/navigation'
import Link from 'next/link'
import { Building2, Activity, Users, TrendingUp } from 'lucide-react'

export default async function SponsorsPage() {
  const supabase = await createClient()
  
  // Get unique sponsors and their trial counts
  const { data: sponsors } = await supabase
    .from('clinical_trials')
    .select('sponsor')
    .not('sponsor', 'is', null)
  
  // Count trials by sponsor
  const sponsorCounts = sponsors?.reduce((acc: any, { sponsor }) => {
    if (sponsor) {
      acc[sponsor] = (acc[sponsor] || 0) + 1
    }
    return acc
  }, {}) || {}
  
  // Convert to array and sort by trial count
  const sponsorList = Object.entries(sponsorCounts)
    .map(([name, count]) => ({ name, count: count as number }))
    .sort((a, b) => b.count - a.count)
  
  // Get recruiting trial counts
  const { data: recruitingData } = await supabase
    .from('clinical_trials')
    .select('sponsor')
    .eq('status', 'recruiting')
    .not('sponsor', 'is', null)
  
  const recruitingCounts = recruitingData?.reduce((acc: any, { sponsor }) => {
    if (sponsor) {
      acc[sponsor] = (acc[sponsor] || 0) + 1
    }
    return acc
  }, {}) || {}
  
  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Clinical Trial Sponsors</h1>
            <p className="text-gray-600">
              Browse pharmaceutical companies and research organizations running trials
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sponsorList.map(({ name, count }) => {
              const recruiting = recruitingCounts[name] || 0
              const completionRate = count > 0 ? ((count - recruiting) / count * 100).toFixed(0) : 0
              
              return (
                <Link
                  key={name}
                  href={`/sponsors/${encodeURIComponent(name)}`}
                  className="bg-white rounded-lg shadow-sm hover:shadow-xl transition-all duration-300 p-6 block"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 line-clamp-1">{name}</h3>
                        <p className="text-sm text-gray-500">Sponsor</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Activity className="w-4 h-4" />
                        <span>Total Trials</span>
                      </div>
                      <span className="font-semibold text-gray-900">{count}</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Users className="w-4 h-4" />
                        <span>Recruiting</span>
                      </div>
                      <span className="font-semibold text-green-600">{recruiting}</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <TrendingUp className="w-4 h-4" />
                        <span>Completed</span>
                      </div>
                      <span className="font-semibold text-gray-900">{completionRate}%</span>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-blue-600 font-medium">View Dashboard →</span>
                      {recruiting > 0 && (
                        <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                          Active
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}