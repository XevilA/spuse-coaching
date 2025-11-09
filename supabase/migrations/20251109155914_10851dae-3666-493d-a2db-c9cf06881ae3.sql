-- Add required_sessions column to teacher_assignments
ALTER TABLE public.teacher_assignments 
ADD COLUMN required_sessions integer DEFAULT 10 NOT NULL;

-- Update existing assignments to use group's required_sessions
UPDATE public.teacher_assignments ta
SET required_sessions = COALESCE(
  (SELECT sg.required_sessions FROM public.student_groups sg WHERE sg.id = ta.group_id),
  10
);

COMMENT ON COLUMN public.teacher_assignments.required_sessions IS 'Number of required coaching sessions for this teacher-group assignment';