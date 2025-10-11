-- 1. ตารางแชทสำหรับนัดหมาย (Appointment Messages)
CREATE TABLE IF NOT EXISTS public.appointment_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id),
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.appointment_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view messages from their appointments"
  ON public.appointment_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.appointments
      WHERE id = appointment_id
      AND (teacher_id = auth.uid() OR student_id = auth.uid())
    )
  );

CREATE POLICY "Users can send messages to their appointments"
  ON public.appointment_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.appointments
      WHERE id = appointment_id
      AND (teacher_id = auth.uid() OR student_id = auth.uid())
    )
  );

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointment_messages;

-- 2. ตารางลา/ลากิจ (Leave Requests)
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id),
  leave_type TEXT NOT NULL CHECK (leave_type IN ('sick', 'personal', 'other')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can create their own leave requests"
  ON public.leave_requests FOR INSERT
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students can view their own leave requests"
  ON public.leave_requests FOR SELECT
  USING (student_id = auth.uid() OR has_role(auth.uid(), 'teacher'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Teachers and admins can update leave requests"
  ON public.leave_requests FOR UPDATE
  USING (has_role(auth.uid(), 'teacher'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- 3. ตารางจองห้อง Student Lounge (Room Bookings)
CREATE TABLE IF NOT EXISTS public.room_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id),
  room_name TEXT NOT NULL,
  booking_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  purpose TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_booking_time CHECK (start_time < end_time)
);

ALTER TABLE public.room_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can create room bookings"
  ON public.room_bookings FOR INSERT
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students can view their own bookings"
  ON public.room_bookings FOR SELECT
  USING (student_id = auth.uid() OR has_role(auth.uid(), 'teacher'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Teachers and admins can update bookings"
  ON public.room_bookings FOR UPDATE
  USING (has_role(auth.uid(), 'teacher'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- 4. ตารางนัดหมาย Event (Event Requests)
CREATE TABLE IF NOT EXISTS public.event_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id),
  event_name TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  location TEXT,
  description TEXT NOT NULL,
  expected_participants INTEGER,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_event_time CHECK (start_time < end_time)
);

ALTER TABLE public.event_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can create event requests"
  ON public.event_requests FOR INSERT
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students can view their own event requests"
  ON public.event_requests FOR SELECT
  USING (student_id = auth.uid() OR has_role(auth.uid(), 'teacher'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Teachers and admins can update event requests"
  ON public.event_requests FOR UPDATE
  USING (has_role(auth.uid(), 'teacher'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- 5. ตารางกำหนดอาจารย์กับ LINE Channel
CREATE TABLE IF NOT EXISTS public.line_channel_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.profiles(id),
  line_notification_id UUID NOT NULL REFERENCES public.line_notifications(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(teacher_id, line_notification_id)
);

ALTER TABLE public.line_channel_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can view their LINE assignments"
  ON public.line_channel_assignments FOR SELECT
  USING (teacher_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Admins can manage LINE assignments"
  ON public.line_channel_assignments FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role));

-- 6. Triggers สำหรับ updated_at
CREATE TRIGGER update_leave_requests_updated_at
  BEFORE UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_room_bookings_updated_at
  BEFORE UPDATE ON public.room_bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_event_requests_updated_at
  BEFORE UPDATE ON public.event_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 7. เพิ่ม status ใหม่ให้ appointments
ALTER TABLE public.appointments 
  DROP CONSTRAINT IF EXISTS appointments_status_check;

ALTER TABLE public.appointments 
  ADD CONSTRAINT appointments_status_check 
  CHECK (status IN ('available', 'pending', 'confirmed', 'booked', 'completed', 'cancelled'));

-- Update RLS policy สำหรับ appointments ให้รองรับ pending/confirmed
DROP POLICY IF EXISTS "Students can book available appointments" ON public.appointments;

CREATE POLICY "Students can request appointments"
  ON public.appointments FOR UPDATE
  USING (
    status = 'available' AND 
    has_role(auth.uid(), 'student'::app_role)
  )
  WITH CHECK (
    student_id = auth.uid() AND 
    status = 'pending' AND
    appointment_date >= CURRENT_DATE
  );

CREATE POLICY "Teachers can confirm appointments"
  ON public.appointments FOR UPDATE
  USING (
    auth.uid() = teacher_id AND
    status IN ('pending', 'confirmed', 'booked')
  );