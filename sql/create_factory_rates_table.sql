-- Create factory_rates table
CREATE TABLE IF NOT EXISTS factory_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_name VARCHAR(255) NOT NULL UNIQUE,
  current_rate DECIMAL(10, 2) NOT NULL,
  previous_rate DECIMAL(10, 2),
  effective_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create rate_history table to track all rate changes
CREATE TABLE IF NOT EXISTS rate_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id UUID NOT NULL REFERENCES factory_rates(id) ON DELETE CASCADE,
  rate DECIMAL(10, 2) NOT NULL,
  effective_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_factory_rates_name ON factory_rates(factory_name);
CREATE INDEX IF NOT EXISTS idx_rate_history_factory ON rate_history(factory_id);
CREATE INDEX IF NOT EXISTS idx_rate_history_date ON rate_history(effective_date);

-- Enable RLS
ALTER TABLE factory_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_history ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow all operations on factory_rates" ON factory_rates
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on rate_history" ON rate_history
  FOR ALL USING (true) WITH CHECK (true);

-- Create updated_at trigger for factory_rates
CREATE TRIGGER update_factory_rates_updated_at
  BEFORE UPDATE ON factory_rates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data
INSERT INTO factory_rates (id, factory_name, current_rate, previous_rate, effective_date, notes) VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Ceylon Tea Factory', 1200, 1180, '2025-12-01', 'Premium rates for quality leaves'),
  ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'Mountain View Tea Mills', 1150, 1140, '2025-11-28', NULL),
  ('c3d4e5f6-a7b8-9012-cdef-123456789012', 'Highland Tea Co', 1180, 1175, '2025-11-25', 'Good relationship, consistent buyer');

-- Insert rate history
INSERT INTO rate_history (factory_id, rate, effective_date) VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 1200, '2025-12-01'),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 1180, '2025-11-15'),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 1150, '2025-11-01'),
  ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 1150, '2025-11-28'),
  ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 1140, '2025-11-10'),
  ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 1120, '2025-10-20'),
  ('c3d4e5f6-a7b8-9012-cdef-123456789012', 1180, '2025-11-25'),
  ('c3d4e5f6-a7b8-9012-cdef-123456789012', 1175, '2025-11-05');
