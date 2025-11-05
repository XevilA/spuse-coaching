-- Add score column to coaching_sessions
ALTER TABLE coaching_sessions ADD COLUMN IF NOT EXISTS score integer;
ALTER TABLE coaching_sessions ADD COLUMN IF NOT EXISTS max_score integer DEFAULT 100;

-- Add is_leader column to group_members
ALTER TABLE group_members ADD COLUMN IF NOT EXISTS is_leader boolean DEFAULT false;

-- Update RLS policy for teachers to view all coaching sessions (not just from their assigned groups)
DROP POLICY IF EXISTS "Teachers can view sessions in their groups" ON coaching_sessions;

CREATE POLICY "Teachers can view all coaching sessions"
ON coaching_sessions
FOR SELECT
USING (
  has_role(auth.uid(), 'teacher'::app_role) OR 
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- Allow group leaders to view their group members
CREATE POLICY "Group leaders can view their group members"
ON group_members
FOR SELECT
USING (
  auth.uid() = student_id OR
  (is_leader = true AND group_id IN (
    SELECT group_id FROM group_members WHERE student_id = auth.uid() AND is_leader = true
  )) OR
  has_role(auth.uid(), 'teacher'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- Allow group leaders to add members to their group
CREATE POLICY "Group leaders can add members"
ON group_members
FOR INSERT
WITH CHECK (
  group_id IN (
    SELECT group_id FROM group_members WHERE student_id = auth.uid() AND is_leader = true
  ) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- Allow group leaders to remove members from their group
CREATE POLICY "Group leaders can remove members"
ON group_members
FOR DELETE
USING (
  group_id IN (
    SELECT group_id FROM group_members WHERE student_id = auth.uid() AND is_leader = true
  ) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role)
);

-- Update coaching_sessions policy to only allow group leaders to create sessions
DROP POLICY IF EXISTS "Students can create their own sessions" ON coaching_sessions;

CREATE POLICY "Group leaders can create sessions"
ON coaching_sessions
FOR INSERT
WITH CHECK (
  auth.uid() = student_id AND 
  status = 'pending'::coaching_status AND
  (
    -- Check if user is a group leader
    EXISTS (
      SELECT 1 FROM group_members 
      WHERE student_id = auth.uid() AND is_leader = true AND group_id = coaching_sessions.group_id
    ) OR
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'super_admin'::app_role)
  )
);

-- Allow students to view if they are group leaders
CREATE POLICY "Students can check if they are leaders"
ON group_members
FOR SELECT
USING (
  auth.uid() = student_id OR
  has_role(auth.uid(), 'teacher'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role)
);