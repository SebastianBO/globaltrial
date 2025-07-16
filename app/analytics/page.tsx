'use client'

import { motion } from 'framer-motion'
import Navigation from '@/components/navigation'
import { 
  BarChart3,
  TrendingUp,
  Users,
  Clock,
  Target,
  PieChart,
  Activity,
  Download
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function AnalyticsPage() {
  const metrics = [
    {
      icon: <Users className="h-6 w-6" />,
      title: "Patient Reach",
      value: "2.5M+",
      change: "+23%",
      description: "Active patients in our database"
    },
    {
      icon: <Target className="h-6 w-6" />,
      title: "Match Rate",
      value: "87%",
      change: "+12%",
      description: "Average patient-trial match accuracy"
    },
    {
      icon: <Clock className="h-6 w-6" />,
      title: "Time to Recruit",
      value: "45 days",
      change: "-31%",
      description: "Average recruitment timeline"
    },
    {
      icon: <TrendingUp className="h-6 w-6" />,
      title: "Enrollment Rate",
      value: "68%",
      change: "+18%",
      description: "Qualified patients who enroll"
    }
  ]

  const features = [
    {
      title: "Real-time Dashboard",
      description: "Monitor recruitment progress with live updates and interactive visualizations",
      items: [
        "Application pipeline tracking",
        "Geographic heat maps",
        "Demographic breakdowns",
        "Conversion funnel analysis"
      ]
    },
    {
      title: "Predictive Analytics",
      description: "AI-powered forecasting to optimize your recruitment strategy",
      items: [
        "Enrollment projections",
        "Site performance predictions",
        "Risk identification",
        "Budget optimization"
      ]
    },
    {
      title: "Custom Reports",
      description: "Generate detailed reports tailored to your specific needs",
      items: [
        "Automated report scheduling",
        "Custom KPI tracking",
        "Export to multiple formats",
        "Stakeholder dashboards"
      ]
    }
  ]

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
        {/* Hero Section */}
        <section className="py-12 md:py-24">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center max-w-4xl mx-auto"
            >
              <div className="mb-6 flex justify-center">
                <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
                  <BarChart3 className="h-8 w-8 text-white" />
                </div>
              </div>
              <h1 className="text-4xl md:text-6xl font-bold mb-6">
                Advanced Analytics Platform
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                Gain deep insights into your clinical trial recruitment with our 
                comprehensive analytics suite powered by AI and machine learning.
              </p>
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
                View Demo Dashboard
              </Button>
            </motion.div>
          </div>
        </section>

        {/* Metrics Section */}
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12">
              Platform Performance Metrics
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {metrics.map((metric, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                          {metric.icon}
                        </div>
                        <span className={`text-sm font-medium ${
                          metric.change.startsWith('+') ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {metric.change}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-3xl font-bold mb-1">{metric.value}</p>
                      <p className="text-sm font-medium text-gray-900 mb-1">{metric.title}</p>
                      <p className="text-xs text-gray-600">{metric.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="grid lg:grid-cols-3 gap-8">
              {features.map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.2 }}
                >
                  <Card className="h-full bg-white hover:shadow-xl transition-shadow">
                    <CardHeader>
                      <CardTitle className="text-2xl">{feature.title}</CardTitle>
                      <p className="text-gray-600 mt-2">{feature.description}</p>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-3">
                        {feature.items.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-3">
                            <Activity className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                            <span className="text-gray-700">{item}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Dashboard Preview */}
        <section className="py-16 bg-gray-50">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-12"
            >
              <h2 className="text-3xl font-bold mb-4">
                Intuitive Analytics Dashboard
              </h2>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                Get a complete view of your recruitment performance with our 
                user-friendly dashboard designed for clinical trial teams.
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="max-w-6xl mx-auto"
            >
              <div className="bg-white rounded-lg shadow-xl p-8">
                <div className="grid md:grid-cols-3 gap-6 mb-6">
                  <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-6 text-white">
                    <PieChart className="h-8 w-8 mb-3" />
                    <p className="text-3xl font-bold">78%</p>
                    <p className="text-blue-100">Screening Success Rate</p>
                  </div>
                  <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-6 text-white">
                    <Users className="h-8 w-8 mb-3" />
                    <p className="text-3xl font-bold">1,234</p>
                    <p className="text-green-100">Active Participants</p>
                  </div>
                  <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-6 text-white">
                    <TrendingUp className="h-8 w-8 mb-3" />
                    <p className="text-3xl font-bold">92%</p>
                    <p className="text-purple-100">Retention Rate</p>
                  </div>
                </div>
                <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                  <p className="text-gray-500">Interactive Chart Preview</p>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 bg-gradient-to-r from-blue-600 to-purple-600">
          <div className="container mx-auto px-4 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-3xl font-bold text-white mb-4">
                Transform Your Trial Data into Insights
              </h2>
              <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
                Start making data-driven decisions to optimize your recruitment 
                and improve trial outcomes.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  size="lg" 
                  className="bg-white text-blue-600 hover:bg-gray-100"
                >
                  Get Started
                </Button>
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="border-white text-white hover:bg-white hover:text-blue-600"
                >
                  <Download className="mr-2 h-5 w-5" />
                  Download Sample Report
                </Button>
              </div>
            </motion.div>
          </div>
        </section>
      </div>
    </>
  )
}