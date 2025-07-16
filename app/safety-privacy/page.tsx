'use client'

import { motion } from 'framer-motion'
import Navigation from '@/components/navigation'
import { 
  Shield, 
  Lock, 
  Eye, 
  FileCheck,
  UserCheck,
  AlertCircle,
  CheckCircle
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function SafetyPrivacyPage() {
  const fadeIn = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6 },
    },
  }

  const protections = [
    {
      icon: <Lock className="h-6 w-6" />,
      title: "Data Encryption",
      description: "All your personal and medical information is encrypted using industry-standard AES-256 encryption."
    },
    {
      icon: <Eye className="h-6 w-6" />,
      title: "HIPAA Compliant",
      description: "We adhere to strict HIPAA guidelines to protect your health information privacy."
    },
    {
      icon: <UserCheck className="h-6 w-6" />,
      title: "Consent Control",
      description: "You have full control over who can access your information and can revoke consent at any time."
    },
    {
      icon: <FileCheck className="h-6 w-6" />,
      title: "Transparent Practices",
      description: "We clearly explain how your data is used and never sell your information to third parties."
    }
  ]

  const rights = [
    "You have the right to access all your personal data at any time",
    "You can request deletion of your account and all associated data",
    "You control which trials can see your profile information",
    "You can opt-out of communications at any time",
    "Your data is never shared without your explicit consent",
    "You have the right to data portability"
  ]

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
              <div className="mb-6 flex justify-center">
                <div className="h-20 w-20 rounded-full bg-blue-100 flex items-center justify-center">
                  <Shield className="h-10 w-10 text-blue-600" />
                </div>
              </div>
              <h1 className="text-4xl md:text-6xl font-bold mb-6">
                Your Safety & Privacy Matter
              </h1>
              <p className="text-xl text-gray-600">
                We're committed to protecting your personal information and ensuring 
                your safety throughout your clinical trial journey.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Protection Features */}
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeIn}
              className="text-center mb-12"
            >
              <h2 className="text-3xl font-bold mb-4">How We Protect You</h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                We implement multiple layers of security to ensure your data remains safe and private.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {protections.map((item, index) => (
                <motion.div
                  key={index}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  variants={fadeIn}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="h-full hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                          {item.icon}
                        </div>
                        <CardTitle className="text-xl">{item.title}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-600">{item.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Your Rights Section */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeIn}
              className="max-w-4xl mx-auto"
            >
              <h2 className="text-3xl font-bold mb-8 text-center">Your Rights</h2>
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-8">
                  <ul className="space-y-4">
                    {rights.map((right, index) => (
                      <motion.li
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: index * 0.1 }}
                        className="flex items-start gap-3"
                      >
                        <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700">{right}</span>
                      </motion.li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </section>

        {/* Important Notice */}
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeIn}
              className="max-w-4xl mx-auto"
            >
              <Card className="bg-amber-50 border-amber-200">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-6 w-6 text-amber-600" />
                    <CardTitle>Important Safety Information</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 text-gray-700">
                    <li>• Always verify trial legitimacy through official registries</li>
                    <li>• Never pay to participate in a clinical trial</li>
                    <li>• Consult with your healthcare provider before joining any trial</li>
                    <li>• Report any suspicious activity to our support team immediately</li>
                    <li>• Keep copies of all consent forms and trial documentation</li>
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </section>
      </div>
    </>
  )
}