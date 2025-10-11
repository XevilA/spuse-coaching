-- Update handle_new_user function to support dev@dotmini.in.th as super admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
$$;

-- Update RLS policies to include super_admin
CREATE POLICY "Super admins can do everything on profiles"
ON public.profiles
FOR ALL
USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can do everything on user_roles"
ON public.user_roles
FOR ALL
USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can do everything on coaching_sessions"
ON public.coaching_sessions
FOR ALL
USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can do everything on student_groups"
ON public.student_groups
FOR ALL
USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can do everything on group_members"
ON public.group_members
FOR ALL
USING (has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can do everything on teacher_assignments"
ON public.teacher_assignments
FOR ALL
USING (has_role(auth.uid(), 'super_admin'));