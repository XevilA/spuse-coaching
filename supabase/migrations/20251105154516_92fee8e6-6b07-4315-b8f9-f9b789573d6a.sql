-- 1) Add lock flag to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;

-- 2) Security definer helper to check lock status
CREATE OR REPLACE FUNCTION public.is_user_locked(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_locked FROM public.profiles WHERE id = _user_id), false);
$$;

-- 3) Update RLS policies to respect lock for teacher-managed actions

-- appointments: drop and recreate relevant policies
DROP POLICY IF EXISTS "Teachers can confirm appointments" ON public.appointments;
CREATE POLICY "Teachers can confirm appointments" ON public.appointments
FOR UPDATE
USING ((auth.uid() = teacher_id) AND (status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'booked'::text])) AND NOT public.is_user_locked(auth.uid()));

DROP POLICY IF EXISTS "Teachers can create appointments" ON public.appointments;
CREATE POLICY "Teachers can create appointments" ON public.appointments
FOR INSERT
WITH CHECK ((auth.uid() = teacher_id) AND NOT public.is_user_locked(auth.uid()));

DROP POLICY IF EXISTS "Teachers can update their appointments" ON public.appointments;
CREATE POLICY "Teachers can update their appointments" ON public.appointments
FOR UPDATE
USING ((auth.uid() = teacher_id) AND NOT public.is_user_locked(auth.uid()));

-- coaching_sessions: teacher updates should be blocked when locked
DROP POLICY IF EXISTS "Teachers can update coaching sessions" ON public.coaching_sessions;
CREATE POLICY "Teachers can update coaching sessions" ON public.coaching_sessions
FOR UPDATE
USING (((public.has_role(auth.uid(), 'teacher'::app_role) AND NOT public.is_user_locked(auth.uid()))
        OR public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'super_admin'::app_role)));

-- event_requests: teacher/admin updates, block locked teachers
DROP POLICY IF EXISTS "Teachers and admins can update event requests" ON public.event_requests;
CREATE POLICY "Teachers and admins can update event requests" ON public.event_requests
FOR UPDATE
USING (((public.has_role(auth.uid(), 'teacher'::app_role) AND NOT public.is_user_locked(auth.uid()))
        OR public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'super_admin'::app_role)));

-- room_bookings: teacher/admin updates, block locked teachers
DROP POLICY IF EXISTS "Teachers and admins can update bookings" ON public.room_bookings;
CREATE POLICY "Teachers and admins can update bookings" ON public.room_bookings
FOR UPDATE
USING (((public.has_role(auth.uid(), 'teacher'::app_role) AND NOT public.is_user_locked(auth.uid()))
        OR public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'super_admin'::app_role)));

-- profiles: prevent locked users from updating their own profile (so they can't unlock themselves)
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
FOR UPDATE
USING ((auth.uid() = id) AND NOT public.is_user_locked(auth.uid()));

-- keep existing SELECT and super_admin ALL policies as-is
