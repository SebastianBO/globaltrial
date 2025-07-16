'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Navigation from '@/components/navigation'
import { 
  ChevronDown,
  HelpCircle,
  DollarSign,
  Clock,
  Shield,
  UserCheck,
  FileText,
  AlertCircle
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface FAQItem {
  question: string
  answer: string
  category: string
  icon: React.ReactNode
}

export default function FAQsPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  const faqs: FAQItem[] = [
    {
      question: "What is a clinical trial?",
      answer: "A clinical trial is a research study that tests new medical treatments, drugs, or devices in people. These studies help researchers determine if new treatments are safe and effective before they become widely available.",
      category: "general",
      icon: <HelpCircle className="h-5 w-5" />
    },
    {
      question: "Do I get paid for participating in clinical trials?",
      answer: "Many clinical trials offer compensation for your time and travel expenses. The amount varies depending on the trial's requirements, duration, and number of visits. Compensation details are always disclosed upfront.",
      category: "compensation",
      icon: <DollarSign className="h-5 w-5" />
    },
    {
      question: "How long do clinical trials last?",
      answer: "Clinical trial duration varies widely - from a few weeks to several years. The length depends on what's being studied and the trial phase. You'll know the expected duration before you commit to participating.",
      category: "timeline",
      icon: <Clock className="h-5 w-5" />
    },
    {
      question: "Are clinical trials safe?",
      answer: "Clinical trials follow strict safety protocols and are monitored by ethics committees and regulatory agencies. While there may be risks, these are carefully explained to you before participation, and your safety is the top priority.",
      category: "safety",
      icon: <Shield className="h-5 w-5" />
    },
    {
      question: "Can I leave a clinical trial if I change my mind?",
      answer: "Yes, absolutely. Participation in clinical trials is voluntary, and you have the right to withdraw at any time, for any reason, without affecting your future medical care.",
      category: "general",
      icon: <UserCheck className="h-5 w-5" />
    },
    {
      question: "How does GlobalTrial match me with trials?",
      answer: "Our AI analyzes your medical history, current conditions, medications, and preferences against thousands of trial eligibility criteria to find the best matches for you. The process is quick and accurate.",
      category: "platform",
      icon: <HelpCircle className="h-5 w-5" />
    },
    {
      question: "What information do I need to provide?",
      answer: "You'll need to share your medical conditions, current medications, age, location, and any relevant medical history. The more accurate information you provide, the better matches we can find.",
      category: "platform",
      icon: <FileText className="h-5 w-5" />
    },
    {
      question: "Is my information kept private?",
      answer: "Yes, we take your privacy seriously. All information is encrypted and stored securely. We're HIPAA compliant and only share your information with trials you explicitly express interest in.",
      category: "safety",
      icon: <Shield className="h-5 w-5" />
    },
    {
      question: "What are the different phases of clinical trials?",
      answer: "Clinical trials have 4 phases: Phase 1 tests safety in small groups, Phase 2 evaluates effectiveness, Phase 3 compares to standard treatments in larger groups, and Phase 4 monitors long-term effects after approval.",
      category: "general",
      icon: <AlertCircle className="h-5 w-5" />
    },
    {
      question: "Will I receive medical care during the trial?",
      answer: "Yes, you'll receive regular medical monitoring and care related to the trial at no cost. This often includes tests, procedures, and check-ups that would normally be expensive.",
      category: "compensation",
      icon: <DollarSign className="h-5 w-5" />
    }
  ]

  const categories = [
    { id: 'all', label: 'All Questions', count: faqs.length },
    { id: 'general', label: 'General', count: faqs.filter(f => f.category === 'general').length },
    { id: 'compensation', label: 'Compensation', count: faqs.filter(f => f.category === 'compensation').length },
    { id: 'timeline', label: 'Timeline', count: faqs.filter(f => f.category === 'timeline').length },
    { id: 'safety', label: 'Safety', count: faqs.filter(f => f.category === 'safety').length },
    { id: 'platform', label: 'Platform', count: faqs.filter(f => f.category === 'platform').length }
  ]

  const filteredFAQs = selectedCategory === 'all' 
    ? faqs 
    : faqs.filter(faq => faq.category === selectedCategory)

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
              <h1 className="text-4xl md:text-6xl font-bold mb-6">
                Frequently Asked Questions
              </h1>
              <p className="text-xl text-gray-600">
                Find answers to common questions about clinical trials and our platform
              </p>
            </motion.div>
          </div>
        </section>

        {/* Category Filter */}
        <section className="pb-8">
          <div className="container mx-auto px-4">
            <div className="flex flex-wrap justify-center gap-3">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    selectedCategory === category.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {category.label} ({category.count})
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* FAQs */}
        <section className="pb-16">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto space-y-4">
              {filteredFAQs.map((faq, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card className="overflow-hidden">
                    <button
                      onClick={() => setOpenIndex(openIndex === index ? null : index)}
                      className="w-full p-6 text-left hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                            {faq.icon}
                          </div>
                          <h3 className="font-semibold text-lg">{faq.question}</h3>
                        </div>
                        <ChevronDown 
                          className={`h-5 w-5 text-gray-400 transition-transform ${
                            openIndex === index ? 'rotate-180' : ''
                          }`}
                        />
                      </div>
                    </button>
                    <AnimatePresence>
                      {openIndex === index && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <CardContent className="pt-0 pb-6">
                            <p className="text-gray-600 leading-relaxed pl-16">
                              {faq.answer}
                            </p>
                          </CardContent>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Contact CTA */}
        <section className="py-16 bg-gradient-to-r from-blue-600 to-green-500">
          <div className="container mx-auto px-4 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-3xl font-bold text-white mb-4">
                Still have questions?
              </h2>
              <p className="text-xl text-blue-100 mb-8">
                Our support team is here to help you 24/7
              </p>
              <a 
                href="mailto:support@globaltrial.com"
                className="inline-flex items-center px-6 py-3 bg-white text-blue-600 rounded-lg font-medium hover:bg-gray-100 transition-colors"
              >
                Contact Support
              </a>
            </motion.div>
          </div>
        </section>
      </div>
    </>
  )
}