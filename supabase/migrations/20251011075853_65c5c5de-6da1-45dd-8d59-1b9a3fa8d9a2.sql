-- Add required_sessions column to profiles for teachers
ALTER TABLE public.profiles ADD COLUMN required_sessions integer DEFAULT 5;

-- Add super_admin role to app_role enum
ALTER TYPE public.app_role ADD VALUE 'super_admin';