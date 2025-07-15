import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://wwjorfctbizdhqkpduxt.supabase.co'
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
    
    const response = await fetch(`${supabaseUrl}/functions/v1/scrape-trials`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`Scraping failed: ${response.statusText}`)
    }

    const data = await response.json()
    
    return NextResponse.json({ 
      success: true,
      message: 'Scraping initiated',
      data 
    })
  } catch (error) {
    console.error('Scrape error:', error)
    return NextResponse.json(
      { error: 'Failed to initiate scraping' },
      { status: 500 }
    )
  }
}