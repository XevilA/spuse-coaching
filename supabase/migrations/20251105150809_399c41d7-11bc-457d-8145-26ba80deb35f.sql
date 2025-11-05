-- ลบ policy ที่ทำให้เกิด recursion
DROP POLICY IF EXISTS "Students read own and group members" ON group_members;

-- สร้าง policy ที่ง่ายกว่า ไม่มี recursion
CREATE POLICY "Students can view group members"
ON group_members
FOR SELECT
TO authenticated
USING (
  -- นักศึกษาเห็นได้เฉพาะแถวที่ตัวเองเป็นสมาชิก
  student_id = auth.uid() OR
  -- หรือเห็นสมาชิกในกลุ่มเดียวกัน ถ้าตัวเองอยู่ในกลุ่มนั้น
  group_id IN (
    SELECT gm.group_id 
    FROM group_members gm 
    WHERE gm.student_id = auth.uid()
  ) OR
  -- หรือเป็น teacher/admin
  has_role(auth.uid(), 'teacher'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'super_admin'::app_role)
);