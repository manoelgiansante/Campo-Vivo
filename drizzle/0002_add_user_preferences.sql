-- Add preferences column to users table for storing user settings like map position
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB;
