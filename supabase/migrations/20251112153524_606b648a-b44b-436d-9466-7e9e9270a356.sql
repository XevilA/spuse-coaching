-- Allow students to create new groups
CREATE POLICY "Students can create groups"
ON public.student_groups
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'student'::app_role));