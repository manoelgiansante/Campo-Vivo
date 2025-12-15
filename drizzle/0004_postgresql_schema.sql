-- PostgreSQL Schema Migration
-- Creates all necessary tables for the application
-- Uses VARCHAR instead of ENUM types for better compatibility

-- Drop existing objects if they exist (for clean migration)
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS ndvi_history CASCADE;
DROP TABLE IF EXISTS fields CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Create users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  "openId" VARCHAR(64) NOT NULL UNIQUE,
  name TEXT,
  email VARCHAR(320) UNIQUE,
  "passwordHash" VARCHAR(255),
  "loginMethod" VARCHAR(64),
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  "userType" VARCHAR(30) NOT NULL DEFAULT 'farmer',
  phone VARCHAR(20),
  company VARCHAR(255),
  "avatarUrl" TEXT,
  plan VARCHAR(20) DEFAULT 'free',
  "maxFields" INTEGER DEFAULT 5,
  "isGuest" BOOLEAN DEFAULT FALSE,
  "deviceId" VARCHAR(64),
  "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL,
  "updatedAt" TIMESTAMP DEFAULT NOW() NOT NULL,
  "lastSignedIn" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create index for device lookup (for guest users)
CREATE INDEX idx_users_device ON users("deviceId");

-- Create fields table
CREATE TABLE fields (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  "areaHectares" INTEGER,
  latitude VARCHAR(20),
  longitude VARCHAR(20),
  boundaries JSON,
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100) DEFAULT 'Brasil',
  "soilType" VARCHAR(100),
  "irrigationType" VARCHAR(50),
  "isActive" BOOLEAN DEFAULT TRUE,
  "agroPolygonId" VARCHAR(64),
  "currentNdvi" INTEGER,
  "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL,
  "updatedAt" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create index for user fields lookup
CREATE INDEX idx_fields_user ON fields("userId");

-- Create notifications table
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type VARCHAR(50) NOT NULL,
  data JSON,
  "isRead" BOOLEAN DEFAULT FALSE,
  "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create index for user notifications lookup
CREATE INDEX idx_notifications_user ON notifications("userId");

-- Create ndvi_history table
CREATE TABLE ndvi_history (
  id SERIAL PRIMARY KEY,
  "fieldId" INTEGER NOT NULL,
  value INTEGER,
  date TIMESTAMP NOT NULL,
  "imageUrl" TEXT,
  "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create index for field ndvi history lookup
CREATE INDEX idx_ndvi_history_field ON ndvi_history("fieldId");
