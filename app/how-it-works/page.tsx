'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import Navigation from '@/components/navigation'
import { 
  Search, 
  UserCheck, 
  FileText, 
  CheckCircle,
  ArrowRight,
  Activity,
  ChevronRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function HowItWorksPage() {
  const steps = [
    {
      number: "1",
      title: "Create Your Profile",
      description: "Share your medical history and preferences through our AI-powered chat or traditional form.",
      icon: <UserCheck className="h-6 w-6" />,
      color: "bg-blue-100 text-blue-600"
    },
    {
      number: "2",
      title: "AI Matching Process",
      description: "Our advanced AI analyzes your profile against thousands of clinical trials to find the best matches.",
      icon: <Search className="h-6 w-6" />,
      color: "bg-purple-100 text-purple-600"
    },
    {
      number: "3",
      title: "Review Matches",
      description: "Browse through personalized trial recommendations with clear eligibility criteria and compensation details.",
      icon: <FileText className="h-6 w-6" />,
      color: "bg-green-100 text-green-600"
    },
    {
      number: "4",
      title: "Apply & Connect",
      description: "Apply to trials directly and connect with research coordinators who will guide you through the process.",
      icon: <CheckCircle className="h-6 w-6" />,
      color: "bg-orange-100 text-orange-600"
    }
  ]

  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6 },
    },
  }

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  }

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
        {/* Hero Section */}
        <section className="py-12 md:py-24">
          <div className="container mx-auto px-4">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={fadeIn}
              className="text-center max-w-4xl mx-auto"
            >
              <h1 className="text-4xl md:text-6xl font-bold mb-6">
                How GlobalTrial Works
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                Finding the right clinical trial has never been easier. Our AI-powered platform
                connects you with trials that match your specific medical profile in just 4 simple steps.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Steps Section */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerContainer}
              className="max-w-5xl mx-auto"
            >
              {steps.map((step, index) => (
                <motion.div
                  key={index}
                  variants={fadeIn}
                  className="mb-8"
                >
                  <Card className="overflow-hidden hover:shadow-lg transition-shadow">
                    <CardContent className="p-0">
                      <div className="flex flex-col md:flex-row items-center">
                        <div className="md:w-1/4 p-8 flex items-center justify-center">
                          <div className={`w-20 h-20 rounded-full ${step.color} flex items-center justify-center relative`}>
                            <span className="text-3xl font-bold">{step.number}</span>
                            <div className="absolute -bottom-2 -right-2 bg-white rounded-full p-2 shadow-lg">
                              {step.icon}
                            </div>
                          </div>
                        </div>
                        <div className="md:w-3/4 p-8">
                          <h3 className="text-2xl font-semibold mb-3">{step.title}</h3>
                          <p className="text-gray-600 text-lg">{step.description}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  {index < steps.length - 1 && (
                    <div className="flex justify-center my-4">
                      <ChevronRight className="h-8 w-8 text-gray-400" />
                    </div>
                  )}
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 bg-gradient-to-r from-blue-600 to-green-500">
          <div className="container mx-auto px-4 text-center">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeIn}
            >
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Ready to Get Started?
              </h2>
              <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
                Join thousands of patients who have found their perfect clinical trial match.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  size="lg" 
                  className="bg-white text-blue-600 hover:bg-gray-100"
                  asChild
                >
                  <Link href="/chat">
                    Start with AI Assistant
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="border-white text-white hover:bg-white hover:text-blue-600"
                  asChild
                >
                  <Link href="/patient">
                    Use Traditional Form
                  </Link>
                </Button>
              </div>
            </motion.div>
          </div>
        </section>
      </div>
    </>
  )
}