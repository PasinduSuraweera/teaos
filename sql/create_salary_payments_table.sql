-- Create salary_payments table to track payment status
CREATE TABLE IF NOT EXISTS salary_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
    month DATE NOT NULL,
    paid_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(worker_id, month)
);

-- Enable RLS
ALTER TABLE salary_payments ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view salary payments" ON salary_payments
    FOR SELECT USING (true);

CREATE POLICY "Anyone can insert salary payments" ON salary_payments
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update salary payments" ON salary_payments
    FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete salary payments" ON salary_payments
    FOR DELETE USING (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_salary_payments_worker_month ON salary_payments(worker_id, month);
CREATE INDEX IF NOT EXISTS idx_salary_payments_month ON salary_payments(month);
