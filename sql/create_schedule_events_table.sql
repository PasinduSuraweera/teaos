-- Create schedule_events table for the scheduler
CREATE TABLE IF NOT EXISTS schedule_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    event_date DATE NOT NULL,
    event_time TIME,
    event_type VARCHAR(50) DEFAULT 'task' CHECK (event_type IN ('task', 'reminder', 'meeting', 'harvest', 'maintenance')),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE schedule_events ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view schedule events" ON schedule_events
    FOR SELECT USING (true);

CREATE POLICY "Anyone can insert schedule events" ON schedule_events
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update schedule events" ON schedule_events
    FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete schedule events" ON schedule_events
    FOR DELETE USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_schedule_events_date ON schedule_events(event_date);
CREATE INDEX IF NOT EXISTS idx_schedule_events_status ON schedule_events(status);
