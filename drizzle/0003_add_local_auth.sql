-- Add local authentication fields to users table
ALTER TABLE users 
ADD COLUMN passwordHash VARCHAR(255) NULL,
ADD COLUMN plan ENUM('free', 'pro', 'enterprise') DEFAULT 'free' NOT NULL,
ADD COLUMN maxFields INT DEFAULT 5 NOT NULL,
ADD COLUMN planExpiresAt TIMESTAMP NULL,
ADD COLUMN isGuest BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN deviceId VARCHAR(64) NULL;

-- Make email unique (if not already)
-- ALTER TABLE users ADD UNIQUE INDEX idx_users_email (email);

-- Add index for device lookup (for guest users)
CREATE INDEX idx_users_device ON users(deviceId);
