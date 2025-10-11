-- Fix invalid appointment data first
UPDATE appointments 
SET end_time = start_time + interval '1 hour'
WHERE start_time >= end_time;

-- Fix 1: Storage Exposure - Restrict teacher access to assigned students only
DROP POLICY IF EXISTS "Teachers can view coaching forms" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can view student coaching forms" ON storage.objects;
DROP POLICY IF EXISTS "Students can upload coaching forms" ON storage.objects;
DROP POLICY IF EXISTS "Students can update their coaching forms" ON storage.objects;
DROP POLICY IF EXISTS "Students can view their coaching forms" ON storage.objects;

-- Simplified student policies (folder path already restricts to user)
CREATE POLICY "Students upload own coaching forms" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'coaching-forms' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Students update own coaching forms" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'coaching-forms' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Students view own coaching forms" ON storage.objects
FOR SELECT USING (
  bucket_id = 'coaching-forms' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Restricted teacher access to only assigned students
CREATE POLICY "Teachers view assigned students' forms" ON storage.objects
FOR SELECT USING (
  bucket_id = 'coaching-forms' AND (
    (storage.foldername(name))[1] = auth.uid()::text OR
    (has_role(auth.uid(), 'teacher'::app_role) AND EXISTS (
      SELECT 1 FROM teacher_assignments ta
      JOIN group_members gm ON ta.group_id = gm.group_id
      WHERE ta.teacher_id = auth.uid() AND gm.student_id::text = (storage.foldername(name))[1]
    )) OR
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'super_admin'::app_role)
  )
);

-- Fix 2: Appointment Race Conditions - Add constraints and atomic booking function
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_time_range'
  ) THEN
    ALTER TABLE appointments ADD CONSTRAINT valid_time_range 
      CHECK (start_time < end_time);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS unique_teacher_time ON appointments 
  (teacher_id, appointment_date, start_time) 
  WHERE status != 'cancelled';

-- Drop old permissive policy
DROP POLICY IF EXISTS "Students can book available appointments" ON appointments;

-- New policy with proper WITH CHECK clause
CREATE POLICY "Students can book available appointments" ON appointments
FOR UPDATE 
USING (
  status = 'available' AND has_role(auth.uid(), 'student'::app_role)
)
WITH CHECK (
  student_id = auth.uid() AND
  status IN ('booked', 'cancelled') AND
  appointment_date >= CURRENT_DATE
);

-- Create atomic booking function to prevent race conditions
CREATE OR REPLACE FUNCTION public.book_appointment_atomic(
  appointment_id UUID,
  student_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE appointments
  SET student_id = book_appointment_atomic.student_id,
      status = 'booked',
      updated_at = NOW()
  WHERE id = appointment_id
    AND status = 'available'
    AND appointment_date >= CURRENT_DATE;
  
  RETURN FOUND;
END;
$$;