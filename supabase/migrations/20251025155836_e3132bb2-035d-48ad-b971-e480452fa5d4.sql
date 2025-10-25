-- Allow super_admin and admin to update student_groups
CREATE POLICY "Admins can update groups"
ON public.student_groups
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));