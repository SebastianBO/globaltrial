'use client'

import { motion } from 'framer-motion'
import Navigation from '@/components/navigation'
import { 
  MessageSquare,
  Phone,
  Mail,
  Clock,
  FileText,
  Video,
  BookOpen,
  Users
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

export default function SupportPage() {
  const supportChannels = [
    {
      icon: <MessageSquare className="h-6 w-6" />,
      title: "Live Chat",
      description: "Get instant help from our support team",
      availability: "24/7",
      action: "Start Chat"
    },
    {
      icon: <Phone className="h-6 w-6" />,
      title: "Phone Support",
      description: "Speak directly with our experts",
      availability: "Mon-Fri 9AM-6PM CET",
      action: "Call Now"
    },
    {
      icon: <Mail className="h-6 w-6" />,
      title: "Email Support",
      description: "Detailed assistance via email",
      availability: "Response within 24h",
      action: "Send Email"
    },
    {
      icon: <Video className="h-6 w-6" />,
      title: "Video Support",
      description: "Screen sharing and video assistance",
      availability: "By appointment",
      action: "Schedule Call"
    }
  ]

  const resources = [
    {
      icon: <BookOpen className="h-8 w-8" />,
      title: "Knowledge Base",
      description: "Comprehensive guides and tutorials",
      link: "#"
    },
    {
      icon: <FileText className="h-8 w-8" />,
      title: "Documentation",
      description: "Technical documentation and API guides",
      link: "#"
    },
    {
      icon: <Users className="h-8 w-8" />,
      title: "Community Forum",
      description: "Connect with other researchers",
      link: "#"
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
              <h1 className="text-4xl md:text-6xl font-bold mb-6">
                We're Here to Help
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                Get the support you need to make the most of GlobalTrial's platform.
                Our dedicated team is ready to assist you.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Support Channels */}
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12">
              Choose Your Support Channel
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {supportChannels.map((channel, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="h-full hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center mb-4">
                        {channel.icon}
                      </div>
                      <CardTitle className="text-xl">{channel.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-600 mb-2">{channel.description}</p>
                      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                        <Clock className="h-4 w-4" />
                        <span>{channel.availability}</span>
                      </div>
                      <Button className="w-full">{channel.action}</Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Quick Contact Form */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="max-w-2xl mx-auto"
            >
              <h2 className="text-3xl font-bold text-center mb-8">
                Send Us a Message
              </h2>
              <Card>
                <CardContent className="p-8">
                  <form className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Name</label>
                        <Input placeholder="Your name" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Email</label>
                        <Input type="email" placeholder="your@email.com" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Subject</label>
                      <Input placeholder="How can we help?" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Message</label>
                      <textarea 
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={5}
                        placeholder="Tell us more about your issue..."
                      />
                    </div>
                    <Button className="w-full bg-blue-600 hover:bg-blue-700">
                      Send Message
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </section>

        {/* Resources Section */}
        <section className="py-16 bg-gray-50">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12">
              Self-Service Resources
            </h2>
            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              {resources.map((resource, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
                    <CardContent className="p-8 text-center">
                      <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
                        {resource.icon}
                      </div>
                      <h3 className="text-xl font-semibold mb-2">{resource.title}</h3>
                      <p className="text-gray-600">{resource.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Contact Info */}
        <section className="py-16 bg-gradient-to-r from-blue-600 to-green-500">
          <div className="container mx-auto px-4 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-3xl font-bold text-white mb-8">
                Direct Contact Information
              </h2>
              <div className="grid md:grid-cols-3 gap-8 max-w-3xl mx-auto text-white">
                <div>
                  <Mail className="h-8 w-8 mx-auto mb-3" />
                  <p className="font-medium">Email</p>
                  <p className="text-blue-100">support@globaltrial.com</p>
                </div>
                <div>
                  <Phone className="h-8 w-8 mx-auto mb-3" />
                  <p className="font-medium">Phone</p>
                  <p className="text-blue-100">+46 31 123 4567</p>
                </div>
                <div>
                  <Clock className="h-8 w-8 mx-auto mb-3" />
                  <p className="font-medium">Office Hours</p>
                  <p className="text-blue-100">Mon-Fri 9AM-6PM CET</p>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      </div>
    </>
  )
}