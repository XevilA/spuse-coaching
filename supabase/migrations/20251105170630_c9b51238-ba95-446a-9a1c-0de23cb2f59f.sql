-- Fix RLS policy for line_notifications to allow INSERT
DROP POLICY IF EXISTS "Admins can manage LINE notifications" ON public.line_notifications;

CREATE POLICY "Admins can manage LINE notifications"
ON public.line_notifications
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);