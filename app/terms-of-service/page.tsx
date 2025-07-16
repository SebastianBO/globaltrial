'use client'

import Navigation from '@/components/navigation'
import { FileText } from 'lucide-react'

export default function TermsOfServicePage() {
  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-white">
        <div className="container mx-auto px-4 py-16 max-w-4xl">
          <div className="flex items-center gap-3 mb-8">
            <FileText className="h-8 w-8 text-blue-600" />
            <h1 className="text-4xl font-bold">Terms of Service</h1>
          </div>
          
          <p className="text-gray-600 mb-8">Effective Date: January 2025</p>
          
          <div className="prose prose-lg max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
              <p className="text-gray-700 mb-4">
                By accessing or using GlobalTrial's services, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">2. Description of Services</h2>
              <p className="text-gray-700 mb-4">
                GlobalTrial provides an AI-powered platform that connects patients with clinical trials. Our services include:
              </p>
              <ul className="list-disc pl-6 text-gray-700 mb-4">
                <li>Clinical trial matching based on medical profiles</li>
                <li>Information about trial eligibility and requirements</li>
                <li>Communication tools between patients and researchers</li>
                <li>Educational resources about clinical trials</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">3. User Responsibilities</h2>
              <p className="text-gray-700 mb-4">As a user of GlobalTrial, you agree to:</p>
              <ul className="list-disc pl-6 text-gray-700 mb-4">
                <li>Provide accurate and complete information</li>
                <li>Maintain the confidentiality of your account</li>
                <li>Use the service only for lawful purposes</li>
                <li>Not misrepresent your identity or medical information</li>
                <li>Respect the privacy and rights of other users</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">4. Medical Disclaimer</h2>
              <p className="text-gray-700 mb-4">
                <strong>Important:</strong> GlobalTrial does not provide medical advice. Our platform is designed to help connect patients with clinical trials but should not replace professional medical consultation. Always consult with your healthcare provider before participating in any clinical trial.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">5. Privacy and Data Protection</h2>
              <p className="text-gray-700 mb-4">
                Your privacy is important to us. Our use of your information is governed by our Privacy Policy. By using our services, you consent to our collection and use of information as described in the Privacy Policy.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">6. Intellectual Property</h2>
              <p className="text-gray-700 mb-4">
                All content on GlobalTrial, including text, graphics, logos, and software, is the property of GlobalTrial or its licensors and is protected by intellectual property laws. You may not use, reproduce, or distribute our content without written permission.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">7. Limitation of Liability</h2>
              <p className="text-gray-700 mb-4">
                GlobalTrial shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of our services. Our total liability shall not exceed the amount paid by you for our services in the past 12 months.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">8. Termination</h2>
              <p className="text-gray-700 mb-4">
                We reserve the right to terminate or suspend your account at any time for violation of these terms or for any other reason. You may also terminate your account at any time by contacting us.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">9. Governing Law</h2>
              <p className="text-gray-700 mb-4">
                These Terms of Service are governed by the laws of Sweden. Any disputes shall be resolved in the courts of Gothenburg, Sweden.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">10. Contact Information</h2>
              <p className="text-gray-700 mb-4">
                For questions about these Terms of Service, please contact us at:
              </p>
              <div className="bg-gray-100 p-4 rounded-lg">
                <p className="text-gray-700">
                  GlobalTrial<br />
                  Gothenburg, Sweden<br />
                  Email: legal@globaltrial.com<br />
                  Phone: +46 31 123 4567
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  )
}