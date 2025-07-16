'use client'

import Navigation from '@/components/navigation'
import { Cookie } from 'lucide-react'

export default function CookiePolicyPage() {
  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-white">
        <div className="container mx-auto px-4 py-16 max-w-4xl">
          <div className="flex items-center gap-3 mb-8">
            <Cookie className="h-8 w-8 text-blue-600" />
            <h1 className="text-4xl font-bold">Cookie Policy</h1>
          </div>
          
          <p className="text-gray-600 mb-8">Last updated: January 2025</p>
          
          <div className="prose prose-lg max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">1. What Are Cookies?</h2>
              <p className="text-gray-700 mb-4">
                Cookies are small text files that are placed on your device when you visit our website. They help us provide you with a better experience by remembering your preferences and understanding how you use our platform.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">2. How We Use Cookies</h2>
              <p className="text-gray-700 mb-4">GlobalTrial uses cookies for the following purposes:</p>
              <ul className="list-disc pl-6 text-gray-700 mb-4">
                <li><strong>Essential Cookies:</strong> Required for the website to function properly</li>
                <li><strong>Performance Cookies:</strong> Help us understand how visitors use our website</li>
                <li><strong>Functionality Cookies:</strong> Remember your preferences and settings</li>
                <li><strong>Analytics Cookies:</strong> Provide anonymous statistics about website usage</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">3. Types of Cookies We Use</h2>
              
              <div className="bg-gray-50 p-6 rounded-lg mb-4">
                <h3 className="text-lg font-semibold mb-2">Session Cookies</h3>
                <p className="text-gray-700">
                  Temporary cookies that are deleted when you close your browser. Used for maintaining your session while navigating our platform.
                </p>
              </div>

              <div className="bg-gray-50 p-6 rounded-lg mb-4">
                <h3 className="text-lg font-semibold mb-2">Persistent Cookies</h3>
                <p className="text-gray-700">
                  Remain on your device for a set period. Used to remember your preferences for future visits.
                </p>
              </div>

              <div className="bg-gray-50 p-6 rounded-lg mb-4">
                <h3 className="text-lg font-semibold mb-2">Third-Party Cookies</h3>
                <p className="text-gray-700">
                  Set by third-party services we use, such as analytics providers. We only work with trusted partners who comply with data protection regulations.
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">4. Managing Cookies</h2>
              <p className="text-gray-700 mb-4">
                You can control and manage cookies in various ways:
              </p>
              <ul className="list-disc pl-6 text-gray-700 mb-4">
                <li>Most browsers allow you to view, delete, and block cookies</li>
                <li>You can set your browser to notify you when cookies are sent</li>
                <li>You can choose to disable all cookies (though this may affect website functionality)</li>
              </ul>
              <p className="text-gray-700 mb-4">
                For more information on managing cookies, visit your browser's help section or <a href="https://www.allaboutcookies.org" className="text-blue-600 hover:underline">www.allaboutcookies.org</a>.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">5. Cookies We Use</h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-4 py-2 text-left">Cookie Name</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">Purpose</th>
                      <th className="border border-gray-300 px-4 py-2 text-left">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-gray-300 px-4 py-2">session_id</td>
                      <td className="border border-gray-300 px-4 py-2">Maintains user session</td>
                      <td className="border border-gray-300 px-4 py-2">Session</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-4 py-2">user_preferences</td>
                      <td className="border border-gray-300 px-4 py-2">Stores user settings</td>
                      <td className="border border-gray-300 px-4 py-2">1 year</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-300 px-4 py-2">analytics_token</td>
                      <td className="border border-gray-300 px-4 py-2">Anonymous usage analytics</td>
                      <td className="border border-gray-300 px-4 py-2">30 days</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">6. Updates to This Policy</h2>
              <p className="text-gray-700 mb-4">
                We may update this Cookie Policy from time to time. Any changes will be posted on this page with an updated revision date.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">7. Contact Us</h2>
              <p className="text-gray-700 mb-4">
                If you have questions about our use of cookies, please contact us at:
              </p>
              <div className="bg-gray-100 p-4 rounded-lg">
                <p className="text-gray-700">
                  GlobalTrial<br />
                  Gothenburg, Sweden<br />
                  Email: privacy@globaltrial.com<br />
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