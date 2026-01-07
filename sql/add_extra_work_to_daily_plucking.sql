-- Add extra work payment field to daily_plucking table
ALTER TABLE daily_plucking
ADD COLUMN extra_work_payment DECIMAL(10,2) DEFAULT 0;

-- Update existing records to have 0 as default
UPDATE daily_plucking SET extra_work_payment = 0 WHERE extra_work_payment IS NULL;

-- Add comment
COMMENT ON COLUMN daily_plucking.extra_work_payment IS 'Additional payment for extra work done by the worker';
