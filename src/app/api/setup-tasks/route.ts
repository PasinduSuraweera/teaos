import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

export async function POST() {
  try {
    const supabase = createAdminClient()
    
    // Try to query the estate_tasks table to see if it exists
    const { data: existingTasks, error: checkError } = await supabase
      .from('estate_tasks')
      .select('id')
      .limit(1)
    
    // If table doesn't exist, we need to create it manually
    if (checkError && checkError.message?.includes('relation "estate_tasks" does not exist')) {
      return NextResponse.json({ 
        error: 'Table does not exist. Please create the estate_tasks table in your Supabase dashboard.',
        sql: `CREATE TABLE estate_tasks (
  id SERIAL PRIMARY KEY,
  header VARCHAR(255) NOT NULL,
  type VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL,
  target VARCHAR(100) NOT NULL,
  "limit" VARCHAR(100) NOT NULL,
  reviewer VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`,
        instructions: [
          "1. Go to your Supabase dashboard",
          "2. Navigate to SQL Editor", 
          "3. Run the SQL command above",
          "4. Try this setup again"
        ]
      }, { status: 400 })
    }

    if (checkError && !checkError.message?.includes('does not exist')) {
      console.error('Database error:', checkError)
      return NextResponse.json({ 
        error: 'Database connection failed: ' + checkError.message 
      }, { status: 500 })
    }

    // If table exists but is empty, insert sample data
    if (!existingTasks || existingTasks.length === 0) {
      const sampleTasks = [
        {
          header: "Morning Inspection",
          type: "Daily Task", 
          status: "Done",
          target: "08:00",
          limit: "09:00",
          reviewer: "Estate Manager"
        },
        {
          header: "Worker Assignment",
          type: "Daily Task",
          status: "Done", 
          target: "08:30",
          limit: "09:00",
          reviewer: "Field Supervisor"
        },
        {
          header: "Tea Plucking Records",
          type: "Data Entry",
          status: "In Process",
          target: "18:00",
          limit: "20:00", 
          reviewer: "Estate Manager"
        },
        {
          header: "Quality Check",
          type: "Quality Control",
          status: "Done",
          target: "16:00",
          limit: "17:00",
          reviewer: "Quality Inspector"
        },
        {
          header: "Factory Delivery",
          type: "Logistics",
          status: "Scheduled",
          target: "19:00",
          limit: "20:00",
          reviewer: "Transport Manager"
        },
        {
          header: "Equipment Maintenance",
          type: "Maintenance",
          status: "Pending", 
          target: "14:00",
          limit: "16:00",
          reviewer: "Maintenance Team"
        },
        {
          header: "Weather Monitoring",
          type: "Daily Task",
          status: "Done",
          target: "07:00",
          limit: "07:30",
          reviewer: "Field Supervisor"
        },
        {
          header: "Salary Calculations",
          type: "Finance",
          status: "Scheduled",
          target: "Monthly",
          limit: "End of Month",
          reviewer: "Accountant"
        },
        {
          header: "Fertilizer Application",
          type: "Plantation Care",
          status: "Pending",
          target: "Weekly",
          limit: "Friday",
          reviewer: "Plantation Manager"
        },
        {
          header: "Financial Reports",
          type: "Reporting",
          status: "Scheduled",
          target: "Monthly",
          limit: "5th of Month",
          reviewer: "Estate Manager"
        }
      ]

      const { error: insertError } = await supabase
        .from('estate_tasks')
        .insert(sampleTasks)

      if (insertError) {
        console.error('Error inserting sample data:', insertError)
        return NextResponse.json({ 
          error: 'Failed to insert sample data: ' + insertError.message 
        }, { status: 500 })
      }

      return NextResponse.json({ 
        success: true, 
        message: 'Sample data inserted successfully!' 
      })
    }

    // Table exists and has data
    return NextResponse.json({ 
      success: true, 
      message: 'Table already exists with data' 
    })

  } catch (error) {
    console.error('Setup error:', error)
    return NextResponse.json({ 
      error: 'Setup failed: ' + (error instanceof Error ? error.message : 'Unknown error')
    }, { status: 500 })
  }
}