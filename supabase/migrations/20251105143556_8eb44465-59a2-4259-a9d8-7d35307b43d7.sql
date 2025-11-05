-- ✅ 1. อนุญาตให้ Student อ่านข้อมูล user_roles (เพื่อดูรายชื่ออาจารย์)
CREATE POLICY "Students can read teacher roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (role = 'teacher'::app_role);

-- ✅ 2. Profiles มี policy อยู่แล้วที่ให้ students อ่านได้ แต่เพิ่มให้ชัดเจนยิ่งขึ้น
-- Policy "Students can view teacher profiles" มีอยู่แล้วและครอบคลุมการใช้งาน

-- ✅ 3. อนุญาตให้ admin และ teacher INSERT teacher_assignments
CREATE POLICY "Teachers and admins can insert teacher assignments"
ON public.teacher_assignments
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'super_admin'::app_role) OR 
  has_role(auth.uid(), 'teacher'::app_role)
);