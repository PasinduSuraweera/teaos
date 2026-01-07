import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = searchParams.get('limit') || '10'
    
    const { data: harvests, error } = await supabase
      .from('harvest_records')
      .select(`
        *,
        plantation:plantations(name),
        worker:workers(first_name, last_name)
      `)
      .order('harvest_date', { ascending: false })
      .limit(parseInt(limit))

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(harvests)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch harvest records' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    const { data: harvest, error } = await supabase
      .from('harvest_records')
      .insert([body])
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(harvest, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create harvest record' },
      { status: 500 }
    )
  }
}