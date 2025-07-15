'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function PatientIntake() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    age: '',
    gender: '',
    conditions: '',
    medications: '',
    medicalHistory: '',
    country: '',
    state: '',
    city: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const supabase = createClient()
      
      // Create patient record
      const { data: patient, error: patientError } = await supabase
        .from('patients')
        .insert({
          email: formData.email,
          age: parseInt(formData.age),
          gender: formData.gender,
          conditions: formData.conditions.split(',').map(c => c.trim()).filter(Boolean),
          current_medications: formData.medications.split(',').map(m => m.trim()).filter(Boolean),
          medical_history: formData.medicalHistory,
          location: {
            country: formData.country,
            state: formData.state,
            city: formData.city
          }
        })
        .select()
        .single()

      if (patientError) throw patientError

      // Call AI matching API
      const response = await fetch('/api/match-trials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: patient.id,
          conditions: patient.conditions,
          medicalHistory: formData.medicalHistory,
          location: patient.location
        })
      })

      if (!response.ok) throw new Error('Failed to match trials')

      router.push(`/patient/${patient.id}/matches`)
    } catch (error) {
      console.error('Error:', error)
      alert('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white py-12">
      <div className="container mx-auto px-4 max-w-2xl">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Patient Information</h1>
        <p className="text-lg text-gray-600 mb-8">Fill out the form below to find clinical trials that match your medical profile</p>
        
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-lg border-2 border-gray-200 p-8 space-y-6">
          <div>
            <label className="block text-base font-semibold text-gray-900 mb-2">
              Email
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full px-4 py-3 border-2 border-gray-400 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-600 bg-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-base font-semibold text-gray-900 mb-2">
                Age
              </label>
              <input
                type="number"
                required
                value={formData.age}
                onChange={(e) => setFormData({...formData, age: e.target.value})}
                className="w-full px-4 py-3 border-2 border-gray-400 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-600 bg-white"
              />
            </div>
            
            <div>
              <label className="block text-base font-semibold text-gray-900 mb-2">
                Gender
              </label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({...formData, gender: e.target.value})}
                className="w-full px-4 py-3 border-2 border-gray-400 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-600 bg-white"
              >
                <option value="" className="text-gray-500">Select Gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-base font-semibold text-gray-900 mb-2">
              Medical Conditions (comma separated)
            </label>
            <input
              type="text"
              required
              placeholder="e.g., Type 2 Diabetes, Hypertension"
              value={formData.conditions}
              onChange={(e) => setFormData({...formData, conditions: e.target.value})}
              className="w-full px-4 py-3 border-2 border-gray-400 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-600 bg-white"
            />
          </div>

          <div>
            <label className="block text-base font-semibold text-gray-900 mb-2">
              Current Medications (comma separated)
            </label>
            <input
              type="text"
              placeholder="e.g., Metformin, Lisinopril"
              value={formData.medications}
              onChange={(e) => setFormData({...formData, medications: e.target.value})}
              className="w-full px-4 py-3 border-2 border-gray-400 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-600 bg-white"
            />
          </div>

          <div>
            <label className="block text-base font-semibold text-gray-900 mb-2">
              Medical History & Additional Information
            </label>
            <textarea
              rows={4}
              value={formData.medicalHistory}
              onChange={(e) => setFormData({...formData, medicalHistory: e.target.value})}
              className="w-full px-4 py-3 border-2 border-gray-400 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-600 bg-white"
              placeholder="Please describe your medical history, any relevant surgeries, allergies, or other information that might be relevant for clinical trials"
              className="w-full px-4 py-3 border-2 border-gray-400 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-600 bg-white resize-none"
            />
          </div>

          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-4 pb-2 border-b-2 border-gray-200">Location</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-base font-semibold text-gray-900 mb-2">
                  Country
                </label>
                <input
                  type="text"
                  required
                  value={formData.country}
                  onChange={(e) => setFormData({...formData, country: e.target.value})}
                  className="w-full px-4 py-3 border-2 border-gray-400 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-600 bg-white"
                />
              </div>
              
              <div>
                <label className="block text-base font-semibold text-gray-900 mb-2">
                  State/Province
                </label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => setFormData({...formData, state: e.target.value})}
                  className="w-full px-4 py-3 border-2 border-gray-400 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-600 bg-white"
                />
              </div>
              
              <div>
                <label className="block text-base font-semibold text-gray-900 mb-2">
                  City
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({...formData, city: e.target.value})}
                  className="w-full px-4 py-3 border-2 border-gray-400 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder-gray-600 bg-white"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-4 px-6 rounded-lg text-lg font-bold hover:bg-blue-700 transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Finding Matches...' : 'Find Clinical Trials'}
          </button>
        </form>
      </div>
    </div>
  )
}