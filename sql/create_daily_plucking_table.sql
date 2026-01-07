-- Create daily_plucking table for tracking daily harvest and financial data
CREATE TABLE daily_plucking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id UUID REFERENCES workers(id) ON DELETE CASCADE,
  plantation_id UUID REFERENCES plantations(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  kg_plucked DECIMAL(10,2) NOT NULL DEFAULT 0,
  rate_per_kg DECIMAL(10,2) NOT NULL DEFAULT 0,
  wage_earned DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_income DECIMAL(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_daily_plucking_worker_id ON daily_plucking(worker_id);
CREATE INDEX idx_daily_plucking_plantation_id ON daily_plucking(plantation_id);
CREATE INDEX idx_daily_plucking_date ON daily_plucking(date);

-- Add RLS policies
ALTER TABLE daily_plucking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view daily plucking records" ON daily_plucking
  FOR SELECT USING (true);

CREATE POLICY "Anyone can insert daily plucking records" ON daily_plucking
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update daily plucking records" ON daily_plucking
  FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete daily plucking records" ON daily_plucking
  FOR DELETE USING (true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_daily_plucking_updated_at
  BEFORE UPDATE ON daily_plucking
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample data for testing (using LKR rates)
INSERT INTO daily_plucking (worker_id, plantation_id, date, kg_plucked, rate_per_kg, wage_earned, total_income, notes)
SELECT 
  w.id,
  w.plantation_id,
  CURRENT_DATE - INTERVAL '1 day' * (random() * 30)::int,
  (random() * 50 + 10)::decimal(10,2),
  (random() * 10 + 20)::decimal(10,2), -- LKR 20-30 per kg
  0, -- Will be calculated
  0, -- Will be calculated
  'Sample harvest record'
FROM workers w
WHERE w.status = 'active'
LIMIT 50;

-- Update wage_earned and total_income based on kg_plucked and rate_per_kg
UPDATE daily_plucking 
SET 
  wage_earned = kg_plucked * rate_per_kg,
  total_income = kg_plucked * rate_per_kg;