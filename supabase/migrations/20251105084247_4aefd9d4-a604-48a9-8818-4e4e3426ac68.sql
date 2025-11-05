-- Update coaching_sessions policy to allow both group and individual submissions
DROP POLICY IF EXISTS "Group leaders can create sessions" ON coaching_sessions;

CREATE POLICY "Students can create coaching sessions"
ON coaching_sessions
FOR INSERT
WITH CHECK (
  auth.uid() = student_id AND 
  status = 'pending'::coaching_status AND
  (
    -- Individual submission (no group_id)
    (group_id IS NULL) OR
    -- Group submission (must be group leader)
    (
      group_id IS NOT NULL AND 
      EXISTS (
        SELECT 1 FROM group_members 
        WHERE student_id = auth.uid() 
        AND is_leader = true 
        AND group_id = coaching_sessions.group_id
      )
    ) OR
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'super_admin'::app_role)
  )
);