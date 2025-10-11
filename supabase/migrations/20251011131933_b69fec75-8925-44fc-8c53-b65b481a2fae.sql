-- Ensure coaching-forms bucket exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('coaching-forms', 'coaching-forms', false, 52428800, ARRAY['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Students can upload their own coaching forms" ON storage.objects;
DROP POLICY IF EXISTS "Students can view their own coaching forms" ON storage.objects;
DROP POLICY IF EXISTS "Teachers can view all coaching forms" ON storage.objects;
DROP POLICY IF EXISTS "Admins can manage all coaching forms" ON storage.objects;

-- Students can upload their own files
CREATE POLICY "Students can upload their own coaching forms"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'coaching-forms' 
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND has_role(auth.uid(), 'student'::app_role)
);

-- Students can update their own files
CREATE POLICY "Students can update their own coaching forms"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'coaching-forms' 
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND has_role(auth.uid(), 'student'::app_role)
);

-- Students can view their own files
CREATE POLICY "Students can view their own coaching forms"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'coaching-forms' 
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND has_role(auth.uid(), 'student'::app_role)
);

-- Teachers can view all coaching forms
CREATE POLICY "Teachers can view all coaching forms"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'coaching-forms' 
  AND (has_role(auth.uid(), 'teacher'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
);

-- Admins can manage all coaching forms
CREATE POLICY "Admins can manage all coaching forms"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'coaching-forms' 
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'super_admin'::app_role))
);