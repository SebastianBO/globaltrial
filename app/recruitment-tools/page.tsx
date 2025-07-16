'use client'

import { motion } from 'framer-motion'
import Navigation from '@/components/navigation'
import { 
  Target,
  BarChart3,
  Mail,
  Calendar,
  Filter,
  MessageSquare,
  Zap,
  Download
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function RecruitmentToolsPage() {
  const tools = [
    {
      icon: <Target className="h-8 w-8" />,
      title: "Smart Targeting",
      description: "AI-powered patient matching based on complex eligibility criteria",
      features: [
        "Match patients by medical history",
        "Geographic targeting",
        "Demographic filtering",
        "Condition-specific searches"
      ]
    },
    {
      icon: <BarChart3 className="h-8 w-8" />,
      title: "Analytics Dashboard",
      description: "Real-time insights into your recruitment performance",
      features: [
        "Application tracking",
        "Conversion rates",
        "Patient demographics",
        "Recruitment forecasting"
      ]
    },
    {
      icon: <Mail className="h-8 w-8" />,
      title: "Communication Suite",
      description: "Streamlined patient communication and engagement",
      features: [
        "Automated email campaigns",
        "SMS notifications",
        "In-app messaging",
        "Appointment reminders"
      ]
    },
    {
      icon: <Calendar className="h-8 w-8" />,
      title: "Scheduling System",
      description: "Efficient appointment and visit management",
      features: [
        "Online appointment booking",
        "Calendar integration",
        "Automated reminders",
        "Visit tracking"
      ]
    },
    {
      icon: <Filter className="h-8 w-8" />,
      title: "Pre-screening Tools",
      description: "Automate initial patient qualification",
      features: [
        "Custom screening forms",
        "Eligibility scoring",
        "Document collection",
        "Consent management"
      ]
    },
    {
      icon: <Download className="h-8 w-8" />,
      title: "Export & Integration",
      description: "Seamless data export and system integration",
      features: [
        "CSV/Excel exports",
        "API integration",
        "EDC system sync",
        "Custom reports"
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
                <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center">
                  <Zap className="h-8 w-8 text-blue-600" />
                </div>
              </div>
              <h1 className="text-4xl md:text-6xl font-bold mb-6">
                Powerful Recruitment Tools
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                Everything you need to accelerate patient recruitment and streamline 
                your clinical trial operations in one integrated platform.
              </p>
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
                Request Demo
              </Button>
            </motion.div>
          </div>
        </section>

        {/* Tools Grid */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {tools.map((tool, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="h-full hover:shadow-xl transition-shadow">
                    <CardHeader>
                      <div className="h-16 w-16 rounded-lg bg-gradient-to-br from-blue-100 to-green-100 flex items-center justify-center mb-4">
                        {tool.icon}
                      </div>
                      <CardTitle className="text-2xl">{tool.title}</CardTitle>
                      <p className="text-gray-600 mt-2">{tool.description}</p>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {tool.features.map((feature, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-blue-600 mt-2 flex-shrink-0" />
                            <span className="text-gray-600">{feature}</span>
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

        {/* Integration Section */}
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center max-w-4xl mx-auto"
            >
              <h2 className="text-3xl font-bold mb-6">
                Seamless Integration with Your Workflow
              </h2>
              <p className="text-xl text-gray-600 mb-8">
                Our tools integrate with popular clinical trial management systems and EDCs,
                making it easy to incorporate GlobalTrial into your existing processes.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-12">
                {['REDCap', 'Medidata', 'Oracle', 'Veeva'].map((system, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                    className="h-20 bg-gray-100 rounded-lg flex items-center justify-center"
                  >
                    <span className="text-gray-600 font-medium">{system}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 bg-gradient-to-r from-blue-600 to-green-500">
          <div className="container mx-auto px-4 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-3xl font-bold text-white mb-4">
                See Our Tools in Action
              </h2>
              <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
                Schedule a personalized demo to see how our recruitment tools can 
                transform your clinical trial operations.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  size="lg" 
                  className="bg-white text-blue-600 hover:bg-gray-100"
                >
                  <MessageSquare className="mr-2 h-5 w-5" />
                  Schedule Demo
                </Button>
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="border-white text-white hover:bg-white hover:text-blue-600"
                >
                  Download Brochure
                </Button>
              </div>
            </motion.div>
          </div>
        </section>
      </div>
    </>
  )
}