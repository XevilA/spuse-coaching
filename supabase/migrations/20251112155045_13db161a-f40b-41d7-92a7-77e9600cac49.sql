-- Fix teacher profile access - restrict to assigned students only
DROP POLICY IF EXISTS "Teachers can view student profiles" ON public.profiles;

CREATE POLICY "Teachers can view assigned student profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'teacher'::app_role) AND (
    -- Teachers can view their own profile
    auth.uid() = id
    OR
    -- Teachers can view students in their assigned groups
    EXISTS (
      SELECT 1 FROM public.teacher_assignments ta
      WHERE ta.teacher_id = auth.uid()
        AND ta.group_id = profiles.group_id
    )
    OR
    -- Teachers can view students who are members of their assigned groups
    EXISTS (
      SELECT 1 FROM public.teacher_assignments ta
      JOIN public.group_members gm ON gm.group_id = ta.group_id
      WHERE ta.teacher_id = auth.uid()
        AND gm.student_id = profiles.id
    )
  )
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'super_admin'::app_role)
);

-- Ensure student_groups table requires authentication for viewing
DROP POLICY IF EXISTS "Everyone can view groups" ON public.student_groups;
DROP POLICY IF EXISTS "Students can view all groups" ON public.student_groups;

CREATE POLICY "Authenticated users can view groups"
ON public.student_groups
FOR SELECT
TO authenticated
USING (true);

-- Add validation trigger for student_groups to prevent invalid data
CREATE OR REPLACE FUNCTION validate_student_group()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate name
  IF NEW.name IS NULL OR LENGTH(TRIM(NEW.name)) = 0 THEN
    RAISE EXCEPTION 'Group name cannot be empty';
  END IF;
  
  IF LENGTH(NEW.name) > 100 THEN
    RAISE EXCEPTION 'Group name too long (max 100 characters)';
  END IF;
  
  IF NEW.name ~ '[<>{}]' THEN
    RAISE EXCEPTION 'Group name contains invalid characters';
  END IF;
  
  -- Validate major
  IF NEW.major IS NULL OR LENGTH(TRIM(NEW.major)) = 0 THEN
    RAISE EXCEPTION 'Major cannot be empty';
  END IF;
  
  IF LENGTH(NEW.major) > 100 THEN
    RAISE EXCEPTION 'Major too long (max 100 characters)';
  END IF;
  
  -- Validate year_level
  IF NEW.year_level !~ '^[1-4]$' THEN
    RAISE EXCEPTION 'Year level must be 1-4';
  END IF;
  
  -- Validate required_sessions
  IF NEW.required_sessions < 1 OR NEW.required_sessions > 20 THEN
    RAISE EXCEPTION 'Required sessions must be between 1 and 20';
  END IF;
  
  -- Trim and clean data
  NEW.name := TRIM(NEW.name);
  NEW.major := TRIM(NEW.major);
  NEW.year_level := TRIM(NEW.year_level);
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_student_group_trigger ON public.student_groups;
CREATE TRIGGER validate_student_group_trigger
BEFORE INSERT OR UPDATE ON public.student_groups
FOR EACH ROW
EXECUTE FUNCTION validate_student_group();

-- Add validation trigger for profiles
CREATE OR REPLACE FUNCTION validate_profile_data()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate names
  IF NEW.first_name IS NOT NULL THEN
    NEW.first_name := TRIM(NEW.first_name);
    IF LENGTH(NEW.first_name) > 100 THEN
      RAISE EXCEPTION 'First name too long (max 100 characters)';
    END IF;
  END IF;
  
  IF NEW.last_name IS NOT NULL THEN
    NEW.last_name := TRIM(NEW.last_name);
    IF LENGTH(NEW.last_name) > 100 THEN
      RAISE EXCEPTION 'Last name too long (max 100 characters)';
    END IF;
  END IF;
  
  -- Validate student_id
  IF NEW.student_id IS NOT NULL THEN
    NEW.student_id := TRIM(NEW.student_id);
    IF LENGTH(NEW.student_id) < 8 OR LENGTH(NEW.student_id) > 20 THEN
      RAISE EXCEPTION 'Student ID must be 8-20 characters';
    END IF;
  END IF;
  
  -- Validate employee_id
  IF NEW.employee_id IS NOT NULL THEN
    NEW.employee_id := TRIM(NEW.employee_id);
    IF LENGTH(NEW.employee_id) < 5 OR LENGTH(NEW.employee_id) > 20 THEN
      RAISE EXCEPTION 'Employee ID must be 5-20 characters';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_profile_data_trigger ON public.profiles;
CREATE TRIGGER validate_profile_data_trigger
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION validate_profile_data();