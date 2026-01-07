import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    const { data: plantations, error } = await supabase
      .from('plantations')
      .select('*')
      .eq('status', 'active')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(plantations)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch plantations' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    const { data: plantation, error } = await supabase
      .from('plantations')
      .insert([body])
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(plantation, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create plantation' },
      { status: 500 }
    )
  }
}