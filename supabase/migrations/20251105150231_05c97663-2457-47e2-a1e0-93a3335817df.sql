-- สร้าง function ที่ bypass RLS
CREATE OR REPLACE FUNCTION get_user_group_id(user_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT group_id 
  FROM group_members 
  WHERE student_id = user_id 
  LIMIT 1;
$$;

-- ลบ policy เดิม
DROP POLICY IF EXISTS "Students can read their group membership" ON group_members;

-- สร้าง policy ใหม่ที่ใช้ function
CREATE POLICY "Students read own and group members"
ON group_members
FOR SELECT
TO authenticated
USING (
  student_id = auth.uid() OR
  group_id = get_user_group_id(auth.uid())
);