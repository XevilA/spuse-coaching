-- เพิ่ม RLS policy ให้ students สามารถลบ coaching sessions ของตัวเองที่ pending ได้
CREATE POLICY "Students can delete their own pending sessions"
ON public.coaching_sessions
FOR DELETE
TO authenticated
USING (
  auth.uid() = student_id 
  AND status = 'pending'::coaching_status
);