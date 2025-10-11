-- Add columns to line_notifications for multiple channels support
ALTER TABLE public.line_notifications
ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT 'Default Channel',
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS channel_secret text;

-- Make notification_type nullable since we'll use multiple channels
ALTER TABLE public.line_notifications
ALTER COLUMN notification_type DROP NOT NULL;

-- Add unique constraint on name
ALTER TABLE public.line_notifications
ADD CONSTRAINT line_notifications_name_key UNIQUE (name);