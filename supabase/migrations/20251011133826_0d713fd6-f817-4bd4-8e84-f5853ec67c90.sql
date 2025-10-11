-- Enable realtime for coaching_sessions table
ALTER PUBLICATION supabase_realtime ADD TABLE public.coaching_sessions;

-- Enable realtime for group_members table
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;

-- Enable realtime for teacher_assignments table
ALTER PUBLICATION supabase_realtime ADD TABLE public.teacher_assignments;

-- Enable realtime for profiles table (for student/teacher updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;