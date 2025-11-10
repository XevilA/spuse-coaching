-- Fix search_path for all SECURITY DEFINER functions to prevent search_path injection attacks

-- Fix book_appointment_atomic function
CREATE OR REPLACE FUNCTION public.book_appointment_atomic(appointment_id uuid, student_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  UPDATE appointments
  SET student_id = book_appointment_atomic.student_id,
      status = 'booked',
      updated_at = NOW()
  WHERE id = appointment_id
    AND status = 'available'
    AND appointment_date >= CURRENT_DATE;
  
  RETURN FOUND;
END;
$function$;

-- Fix get_user_group_id function
CREATE OR REPLACE FUNCTION public.get_user_group_id(user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE 
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT group_id
  FROM public.group_members
  WHERE student_id = get_user_group_id.user_id
  LIMIT 1;
$function$;

-- Fix is_group_leader function
CREATE OR REPLACE FUNCTION public.is_group_leader(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE 
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members
    WHERE student_id = _user_id
      AND group_id = _group_id
      AND is_leader = true
  );
$function$;

-- Fix is_user_locked function
CREATE OR REPLACE FUNCTION public.is_user_locked(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE 
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT COALESCE((SELECT is_locked FROM public.profiles WHERE id = _user_id), false);
$function$;

-- Fix has_role function
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE 
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$function$;

-- Fix notify_teacher_on_coaching_submit trigger function
CREATE OR REPLACE FUNCTION public.notify_teacher_on_coaching_submit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$;

-- Fix notify_student_on_coaching_review trigger function
CREATE OR REPLACE FUNCTION public.notify_student_on_coaching_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$;

-- Fix handle_new_user trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  user_role app_role;
BEGIN
  -- Determine role based on email domain
  IF NEW.email = 'dev@dotmini.in.th' THEN
    user_role := 'super_admin';
  ELSIF NEW.email LIKE '%@spumail.net' THEN
    user_role := 'student';
  ELSIF NEW.email LIKE '%@spu.ac.th' THEN
    user_role := 'teacher';
  ELSE
    -- Reject other domains
    RAISE EXCEPTION 'Invalid email domain. Only @spumail.net, @spu.ac.th, and dev@dotmini.in.th are allowed.';
  END IF;

  -- Insert into profiles
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  );

  -- Insert role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, user_role);

  RETURN NEW;
END;
$function$;