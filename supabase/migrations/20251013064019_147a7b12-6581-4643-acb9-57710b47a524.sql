-- Enable realtime for tables that don't have it yet (skip if already exists)
DO $$ 
BEGIN
  -- Add profiles if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;

  -- Add teacher_assignments if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'teacher_assignments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.teacher_assignments;
  END IF;

  -- Add group_members if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'group_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;
  END IF;

  -- Add student_groups if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'student_groups'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.student_groups;
  END IF;

  -- Add line_notifications if not exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'line_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.line_notifications;
  END IF;
END $$;

-- Add group_id to coaching_sessions if not exists (for better querying)
ALTER TABLE public.coaching_sessions 
ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.student_groups(id) ON DELETE SET NULL;

-- Update existing coaching_sessions to set group_id based on student's group
UPDATE public.coaching_sessions cs
SET group_id = p.group_id
FROM public.profiles p
WHERE cs.student_id = p.id AND cs.group_id IS NULL;

-- Update RLS policy for coaching_sessions to ensure teacher can see all sessions in their groups
DROP POLICY IF EXISTS "Teachers can view sessions in their groups" ON public.coaching_sessions;
CREATE POLICY "Teachers can view sessions in their groups"
ON public.coaching_sessions
FOR SELECT
USING (
  has_role(auth.uid(), 'teacher'::app_role) 
  AND EXISTS (
    SELECT 1 FROM public.teacher_assignments ta
    WHERE ta.teacher_id = auth.uid()
    AND ta.group_id = coaching_sessions.group_id
  )
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- Ensure students can only create sessions with status 'pending'
DROP POLICY IF EXISTS "Students can create their own sessions" ON public.coaching_sessions;
CREATE POLICY "Students can create their own sessions"
ON public.coaching_sessions
FOR INSERT
WITH CHECK (
  auth.uid() = student_id 
  AND status = 'pending'::coaching_status
);

-- Update group_members RLS to allow super_admin and admin to manage
DROP POLICY IF EXISTS "Super admins can manage group members" ON public.group_members;
CREATE POLICY "Super admins can manage group members"
ON public.group_members
FOR ALL
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_coaching_sessions_group_id ON public.coaching_sessions(group_id);
CREATE INDEX IF NOT EXISTS idx_coaching_sessions_teacher_id ON public.coaching_sessions(teacher_id);
CREATE INDEX IF NOT EXISTS idx_profiles_group_id ON public.profiles(group_id);