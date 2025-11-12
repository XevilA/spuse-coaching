-- Update default required_sessions to 3 in teacher_assignments table
ALTER TABLE teacher_assignments 
ALTER COLUMN required_sessions SET DEFAULT 3;

-- Update existing assignments that still have the old default of 10 to the new default of 3
UPDATE teacher_assignments 
SET required_sessions = 3 
WHERE required_sessions = 10;