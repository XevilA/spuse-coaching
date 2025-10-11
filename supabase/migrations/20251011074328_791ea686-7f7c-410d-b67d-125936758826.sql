-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('student', 'teacher', 'admin');

-- Create enum for coaching session status
CREATE TYPE public.coaching_status AS ENUM ('pending', 'approved', 'rejected');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  student_id TEXT,
  employee_id TEXT,
  year_level TEXT,
  major TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user_roles table (security best practice - never store roles in profiles)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- Create student_groups table
CREATE TABLE public.student_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  year_level TEXT NOT NULL,
  major TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create group_members table
CREATE TABLE public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.student_groups(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, student_id)
);

-- Create teacher_assignments table
CREATE TABLE public.teacher_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.student_groups(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(teacher_id, group_id)
);

-- Create coaching_settings table
CREATE TABLE public.coaching_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings
INSERT INTO public.coaching_settings (key, value, description) VALUES
('min_sessions', '10', 'Minimum number of coaching sessions required'),
('academic_year', '2567', 'Current academic year (Buddhist calendar)');

-- Create coaching_sessions table
CREATE TABLE public.coaching_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_number INT NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  status coaching_status DEFAULT 'pending',
  ocr_data JSONB,
  analysis_data JSONB,
  notes TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, session_number)
);

-- Create storage bucket for coaching forms
INSERT INTO storage.buckets (id, name, public) 
VALUES ('coaching-forms', 'coaching-forms', false);

-- Storage policies for coaching forms
CREATE POLICY "Students can upload their own coaching forms"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'coaching-forms' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Students can view their own coaching forms"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'coaching-forms' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Teachers can view all coaching forms"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'coaching-forms' AND
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('teacher', 'admin')
  )
);

CREATE POLICY "Admins can delete coaching forms"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'coaching-forms' AND
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_sessions ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Teachers can view student profiles"
ON public.profiles FOR SELECT
USING (
  public.has_role(auth.uid(), 'teacher') OR
  public.has_role(auth.uid(), 'admin')
);

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
ON public.user_roles FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for student_groups
CREATE POLICY "Everyone can view groups"
ON public.student_groups FOR SELECT
USING (true);

CREATE POLICY "Admins can manage groups"
ON public.student_groups FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for group_members
CREATE POLICY "Students can view their group membership"
ON public.group_members FOR SELECT
USING (
  auth.uid() = student_id OR
  public.has_role(auth.uid(), 'teacher') OR
  public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can manage group members"
ON public.group_members FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for teacher_assignments
CREATE POLICY "Teachers can view their assignments"
ON public.teacher_assignments FOR SELECT
USING (
  auth.uid() = teacher_id OR
  public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can manage teacher assignments"
ON public.teacher_assignments FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for coaching_settings
CREATE POLICY "Everyone can view settings"
ON public.coaching_settings FOR SELECT
USING (true);

CREATE POLICY "Admins can manage settings"
ON public.coaching_settings FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for coaching_sessions
CREATE POLICY "Students can view their own sessions"
ON public.coaching_sessions FOR SELECT
USING (auth.uid() = student_id);

CREATE POLICY "Students can create their own sessions"
ON public.coaching_sessions FOR INSERT
WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can update their own pending sessions"
ON public.coaching_sessions FOR UPDATE
USING (auth.uid() = student_id AND status = 'pending');

CREATE POLICY "Teachers can view sessions in their groups"
ON public.coaching_sessions FOR SELECT
USING (
  public.has_role(auth.uid(), 'teacher') OR
  public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Teachers can update session status"
ON public.coaching_sessions FOR UPDATE
USING (
  public.has_role(auth.uid(), 'teacher') OR
  public.has_role(auth.uid(), 'admin')
);

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role app_role;
BEGIN
  -- Determine role based on email domain
  IF NEW.email LIKE '%@spumail.net' THEN
    user_role := 'student';
  ELSIF NEW.email LIKE '%@spu.ac.th' THEN
    user_role := 'teacher';
  ELSE
    user_role := 'student'; -- default
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

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE PLPGSQL
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_coaching_sessions_updated_at
BEFORE UPDATE ON public.coaching_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_coaching_settings_updated_at
BEFORE UPDATE ON public.coaching_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();