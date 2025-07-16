import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Building2, BarChart3, Users, TrendingUp, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface SponsorStats {
  sponsor: string
  total_trials: number
  recruiting_trials: number
  total_matches: number
  interested_patients: number
}

export default async function SponsorsPage() {
  const supabase = await createClient()
  
  // Get unique sponsors with their stats
  const { data: sponsorStats, error } = await supabase
    .from('sponsor_dashboard_metrics')
    .select('*')
    .order('total_trials', { ascending: false })

  const sponsors = sponsorStats || []

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Pharmaceutical Sponsors</h1>
          <p className="text-gray-600">
            Explore clinical trials by pharmaceutical companies and research organizations
          </p>
        </div>

        <div className="grid gap-6">
          {sponsors.map((sponsor) => (
            <Card key={sponsor.sponsor} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-8 w-8 text-gray-400" />
                    <CardTitle className="text-xl">{sponsor.sponsor}</CardTitle>
                  </div>
                  <Link
                    href={`/sponsors/${encodeURIComponent(sponsor.sponsor)}`}
                    className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800"
                  >
                    View Dashboard
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <BarChart3 className="h-6 w-6 text-gray-500 mx-auto mb-1" />
                    <p className="text-2xl font-bold">{sponsor.total_trials}</p>
                    <p className="text-sm text-gray-600">Total Trials</p>
                  </div>
                  
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <TrendingUp className="h-6 w-6 text-green-500 mx-auto mb-1" />
                    <p className="text-2xl font-bold text-green-700">{sponsor.recruiting_trials}</p>
                    <p className="text-sm text-gray-600">Recruiting</p>
                  </div>
                  
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <Users className="h-6 w-6 text-blue-500 mx-auto mb-1" />
                    <p className="text-2xl font-bold text-blue-700">{sponsor.total_matches}</p>
                    <p className="text-sm text-gray-600">Patient Matches</p>
                  </div>
                  
                  <div className="text-center p-3 bg-purple-50 rounded-lg">
                    <Users className="h-6 w-6 text-purple-500 mx-auto mb-1" />
                    <p className="text-2xl font-bold text-purple-700">{sponsor.interested_patients}</p>
                    <p className="text-sm text-gray-600">Interested</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {sponsors.length === 0 && (
          <Card className="text-center py-12">
            <CardContent>
              <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No sponsors found in the database.</p>
              <p className="text-sm text-gray-500 mt-2">Sponsor data will appear here once trials are imported.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}