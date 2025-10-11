-- Create appointments table for coaching sessions
CREATE TABLE public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  appointment_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'booked', 'completed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Teachers can create and manage their appointments
CREATE POLICY "Teachers can create appointments" ON public.appointments
  FOR INSERT WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Teachers can view their appointments" ON public.appointments
  FOR SELECT USING (
    auth.uid() = teacher_id OR 
    auth.uid() = student_id OR
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'super_admin'::app_role)
  );

CREATE POLICY "Teachers can update their appointments" ON public.appointments
  FOR UPDATE USING (auth.uid() = teacher_id);

CREATE POLICY "Students can book available appointments" ON public.appointments
  FOR UPDATE USING (
    auth.uid() = student_id OR
    (status = 'available' AND has_role(auth.uid(), 'student'::app_role))
  );

-- Super admins can do everything
CREATE POLICY "Super admins can manage appointments" ON public.appointments
  FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Add group_id to profiles for student registration
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES public.student_groups(id) ON DELETE SET NULL;

-- Create LINE notification settings table
CREATE TABLE public.line_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('group', 'broadcast')),
  channel_access_token TEXT,
  group_id TEXT,
  enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for LINE notifications
ALTER TABLE public.line_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage LINE notifications" ON public.line_notifications
  FOR ALL USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'super_admin'::app_role)
  );

-- Create trigger for line_notifications updated_at
CREATE TRIGGER update_line_notifications_updated_at
  BEFORE UPDATE ON public.line_notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();