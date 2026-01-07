-- Create tea_sales table
CREATE TABLE IF NOT EXISTS tea_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  factory_name VARCHAR(255) NOT NULL,
  kg_delivered DECIMAL(10, 2) NOT NULL,
  rate_per_kg DECIMAL(10, 2) NOT NULL,
  total_income DECIMAL(12, 2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster date queries
CREATE INDEX IF NOT EXISTS idx_tea_sales_date ON tea_sales(date);

-- Enable RLS
ALTER TABLE tea_sales ENABLE ROW LEVEL SECURITY;

-- Create policy for all operations (adjust based on your auth setup)
CREATE POLICY "Allow all operations on tea_sales" ON tea_sales
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tea_sales_updated_at
  BEFORE UPDATE ON tea_sales
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data for testing
INSERT INTO tea_sales (date, factory_name, kg_delivered, rate_per_kg, total_income, notes) VALUES
  ('2025-12-05', 'Ceylon Tea Factory', 150.5, 1200, 180600, 'High quality green tea'),
  ('2025-12-05', 'Mountain View Tea Mills', 200.0, 1150, 230000, NULL),
  ('2025-12-04', 'Ceylon Tea Factory', 180.0, 1200, 216000, 'Morning batch'),
  ('2025-12-04', 'Highland Tea Co', 95.5, 1180, 112690, NULL),
  ('2025-12-03', 'Mountain View Tea Mills', 220.5, 1150, 253575, NULL),
  ('2025-12-03', 'Ceylon Tea Factory', 175.0, 1200, 210000, 'Premium leaves'),
  ('2025-12-02', 'Highland Tea Co', 160.0, 1180, 188800, NULL),
  ('2025-12-01', 'Ceylon Tea Factory', 145.0, 1200, 174000, NULL),
  ('2025-12-01', 'Mountain View Tea Mills', 190.0, 1150, 218500, NULL),
  ('2025-11-30', 'Highland Tea Co', 210.0, 1175, 246750, 'End of month delivery'),
  ('2025-11-28', 'Ceylon Tea Factory', 185.0, 1200, 222000, NULL),
  ('2025-11-25', 'Mountain View Tea Mills', 170.0, 1150, 195500, NULL),
  ('2025-11-20', 'Highland Tea Co', 155.0, 1180, 182900, NULL),
  ('2025-11-15', 'Ceylon Tea Factory', 200.0, 1190, 238000, 'Special batch'),
  ('2025-11-10', 'Mountain View Tea Mills', 165.0, 1150, 189750, NULL);
