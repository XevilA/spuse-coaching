-- Update RLS policies to allow students to access teacher and group data

-- Allow students to view teacher profiles
DROP POLICY IF EXISTS "Students can view teacher profiles" ON profiles;
CREATE POLICY "Students can view teacher profiles"
ON profiles FOR SELECT
USING (
  auth.uid() = id OR
  has_role(auth.uid(), 'student') OR
  has_role(auth.uid(), 'teacher') OR
  has_role(auth.uid(), 'admin') OR
  has_role(auth.uid(), 'super_admin')
);

-- Allow students to view teacher assignments
DROP POLICY IF EXISTS "Students can view teacher assignments" ON teacher_assignments;
CREATE POLICY "Students can view teacher assignments"
ON teacher_assignments FOR SELECT
USING (
  has_role(auth.uid(), 'student') OR
  auth.uid() = teacher_id OR
  has_role(auth.uid(), 'admin') OR
  has_role(auth.uid(), 'super_admin')
);

-- Allow students to view all student groups
DROP POLICY IF EXISTS "Students can view all groups" ON student_groups;
CREATE POLICY "Students can view all groups"
ON student_groups FOR SELECT
USING (true);