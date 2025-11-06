-- Fix RLS policies for profiles to allow super_admin to view all teachers
DROP POLICY IF EXISTS "Super admins can manage profiles" ON public.profiles;
CREATE POLICY "Super admins can manage profiles" 
ON public.profiles 
FOR ALL 
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- Create notification_preferences table for automation settings
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  notification_type text NOT NULL, -- 'email', 'line', 'both'
  event_type text NOT NULL, -- 'coaching_submitted', 'coaching_reviewed', 'appointment_booked', etc.
  enabled boolean DEFAULT true,
  line_channel_id uuid REFERENCES public.line_notifications(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, event_type)
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own notification preferences" 
ON public.notification_preferences 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Super admins can manage all notification preferences" 
ON public.notification_preferences 
FOR ALL 
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Create automation_logs table
CREATE TABLE IF NOT EXISTS public.automation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  triggered_by uuid REFERENCES auth.users(id),
  notification_type text, -- 'email', 'line'
  recipient_id uuid REFERENCES auth.users(id),
  status text DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  error_message text,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can view their own automation logs" 
ON public.automation_logs 
FOR SELECT 
USING (auth.uid() = recipient_id OR auth.uid() = triggered_by);

CREATE POLICY "Super admins can view all automation logs" 
ON public.automation_logs 
FOR SELECT 
USING (has_role(auth.uid(), 'super_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Create trigger function to notify teachers when coaching is submitted
CREATE OR REPLACE FUNCTION public.notify_teacher_on_coaching_submit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assigned_teacher_id uuid;
  group_name text;
  student_name text;
  teacher_prefs record;
BEGIN
  -- Get the assigned teacher for this group
  IF NEW.group_id IS NOT NULL THEN
    SELECT ta.teacher_id, sg.name
    INTO assigned_teacher_id, group_name
    FROM teacher_assignments ta
    JOIN student_groups sg ON sg.id = ta.group_id
    WHERE ta.group_id = NEW.group_id
    LIMIT 1;
  END IF;

  -- Get student name
  SELECT first_name || ' ' || last_name
  INTO student_name
  FROM profiles
  WHERE id = NEW.student_id;

  -- If we have a teacher assigned, check their notification preferences
  IF assigned_teacher_id IS NOT NULL THEN
    -- Get teacher's notification preferences
    FOR teacher_prefs IN 
      SELECT notification_type, line_channel_id
      FROM notification_preferences
      WHERE user_id = assigned_teacher_id 
        AND event_type = 'coaching_submitted'
        AND enabled = true
    LOOP
      -- Log the automation event
      INSERT INTO automation_logs (
        event_type,
        triggered_by,
        recipient_id,
        notification_type,
        status,
        metadata
      ) VALUES (
        'coaching_submitted',
        NEW.student_id,
        assigned_teacher_id,
        teacher_prefs.notification_type,
        'pending',
        jsonb_build_object(
          'coaching_session_id', NEW.id,
          'group_id', NEW.group_id,
          'group_name', group_name,
          'student_name', student_name,
          'session_number', NEW.session_number
        )
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for coaching submissions
DROP TRIGGER IF EXISTS trigger_notify_teacher_on_coaching_submit ON public.coaching_sessions;
CREATE TRIGGER trigger_notify_teacher_on_coaching_submit
  AFTER INSERT ON public.coaching_sessions
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION public.notify_teacher_on_coaching_submit();

-- Create trigger function to notify students when coaching is reviewed
CREATE OR REPLACE FUNCTION public.notify_student_on_coaching_review()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  student_prefs record;
  group_name text;
BEGIN
  -- Only trigger when status changes to 'reviewed'
  IF OLD.status != 'reviewed' AND NEW.status = 'reviewed' THEN
    -- Get group name if exists
    IF NEW.group_id IS NOT NULL THEN
      SELECT name INTO group_name
      FROM student_groups
      WHERE id = NEW.group_id;
    END IF;

    -- Get student's notification preferences
    FOR student_prefs IN 
      SELECT notification_type, line_channel_id
      FROM notification_preferences
      WHERE user_id = NEW.student_id 
        AND event_type = 'coaching_reviewed'
        AND enabled = true
    LOOP
      -- Log the automation event
      INSERT INTO automation_logs (
        event_type,
        triggered_by,
        recipient_id,
        notification_type,
        status,
        metadata
      ) VALUES (
        'coaching_reviewed',
        NEW.teacher_id,
        NEW.student_id,
        student_prefs.notification_type,
        'pending',
        jsonb_build_object(
          'coaching_session_id', NEW.id,
          'group_id', NEW.group_id,
          'group_name', group_name,
          'session_number', NEW.session_number,
          'score', NEW.score
        )
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for coaching reviews
DROP TRIGGER IF EXISTS trigger_notify_student_on_coaching_review ON public.coaching_sessions;
CREATE TRIGGER trigger_notify_student_on_coaching_review
  AFTER UPDATE ON public.coaching_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_student_on_coaching_review();

-- Add updated_at trigger for notification_preferences
CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();