-- Create worker_bonuses table for tracking monthly bonuses
CREATE TABLE IF NOT EXISTS worker_bonuses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id UUID REFERENCES workers(id) ON DELETE CASCADE,
  month DATE NOT NULL, -- First day of the month (e.g., 2024-12-01)
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(worker_id, month)
);

-- Create indexes for better performance
CREATE INDEX idx_worker_bonuses_worker_id ON worker_bonuses(worker_id);
CREATE INDEX idx_worker_bonuses_month ON worker_bonuses(month);

-- Add RLS policies
ALTER TABLE worker_bonuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view worker bonuses" ON worker_bonuses
  FOR SELECT USING (true);

CREATE POLICY "Anyone can insert worker bonuses" ON worker_bonuses
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update worker bonuses" ON worker_bonuses
  FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete worker bonuses" ON worker_bonuses
  FOR DELETE USING (true);

-- Create updated_at trigger
CREATE TRIGGER update_worker_bonuses_updated_at
  BEFORE UPDATE ON worker_bonuses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
