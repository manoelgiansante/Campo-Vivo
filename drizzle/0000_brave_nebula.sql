CREATE TYPE "public"."alert_severity" AS ENUM('info', 'warning', 'critical');--> statement-breakpoint
CREATE TYPE "public"."alert_type" AS ENUM('rain', 'frost', 'heat', 'wind', 'drought', 'spray_window');--> statement-breakpoint
CREATE TYPE "public"."crop_status" AS ENUM('planned', 'planted', 'growing', 'harvested', 'failed');--> statement-breakpoint
CREATE TYPE "public"."health_status" AS ENUM('excellent', 'good', 'moderate', 'poor', 'critical');--> statement-breakpoint
CREATE TYPE "public"."irrigation_type" AS ENUM('none', 'drip', 'sprinkler', 'pivot', 'flood');--> statement-breakpoint
CREATE TYPE "public"."note_type" AS ENUM('observation', 'problem', 'task', 'harvest', 'application');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('weather', 'task', 'ndvi', 'system', 'crop');--> statement-breakpoint
CREATE TYPE "public"."permission" AS ENUM('view', 'edit', 'admin');--> statement-breakpoint
CREATE TYPE "public"."platform" AS ENUM('ios', 'android', 'web');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."suggested_by" AS ENUM('user', 'system');--> statement-breakpoint
CREATE TYPE "public"."sync_action" AS ENUM('create', 'update', 'delete');--> statement-breakpoint
CREATE TYPE "public"."sync_status" AS ENUM('pending', 'synced', 'failed');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('pending', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."task_type" AS ENUM('planting', 'irrigation', 'fertilization', 'spraying', 'harvest', 'maintenance', 'inspection', 'other');--> statement-breakpoint
CREATE TYPE "public"."user_type" AS ENUM('farmer', 'agronomist', 'consultant');--> statement-breakpoint
CREATE TABLE "crop_rotation_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"field_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"season" varchar(20) NOT NULL,
	"planned_crop" varchar(100) NOT NULL,
	"previous_crop" varchar(100),
	"is_confirmed" boolean DEFAULT false,
	"notes" text,
	"suggested_by" "suggested_by" DEFAULT 'user',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crops" (
	"id" serial PRIMARY KEY NOT NULL,
	"field_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"crop_type" varchar(100) NOT NULL,
	"variety" varchar(100),
	"planting_date" timestamp,
	"expected_harvest_date" timestamp,
	"actual_harvest_date" timestamp,
	"status" "crop_status" DEFAULT 'planned',
	"area_hectares" integer,
	"expected_yield" integer,
	"actual_yield" integer,
	"notes" text,
	"season" varchar(20),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "farms" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"address" text,
	"city" varchar(100),
	"state" varchar(100),
	"country" varchar(100) DEFAULT 'Brasil',
	"total_area_hectares" integer,
	"color" varchar(7) DEFAULT '#22C55E',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "field_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"field_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"title" varchar(255),
	"content" text NOT NULL,
	"note_type" "note_type" DEFAULT 'observation',
	"latitude" varchar(20),
	"longitude" varchar(20),
	"photos" json,
	"severity" "severity",
	"is_resolved" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "field_shares" (
	"id" serial PRIMARY KEY NOT NULL,
	"field_id" integer NOT NULL,
	"owner_user_id" integer NOT NULL,
	"shared_with_user_id" integer,
	"shared_with_email" varchar(320),
	"permission" "permission" DEFAULT 'view',
	"share_token" varchar(64),
	"is_public" boolean DEFAULT false,
	"expires_at" timestamp,
	"accepted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fields" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"farm_id" integer,
	"name" varchar(255) NOT NULL,
	"description" text,
	"area_hectares" integer,
	"latitude" varchar(20),
	"longitude" varchar(20),
	"boundaries" json,
	"address" text,
	"city" varchar(100),
	"state" varchar(100),
	"country" varchar(100) DEFAULT 'Brasil',
	"soil_type" varchar(100),
	"irrigation_type" "irrigation_type" DEFAULT 'none',
	"is_active" boolean DEFAULT true,
	"agro_polygon_id" varchar(50),
	"last_ndvi_sync" timestamp,
	"current_ndvi" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ndvi_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"field_id" integer NOT NULL,
	"capture_date" timestamp NOT NULL,
	"ndvi_average" integer,
	"ndvi_min" integer,
	"ndvi_max" integer,
	"health_status" "health_status",
	"cloud_coverage" integer,
	"image_url" text,
	"thumbnail_url" text,
	"problem_areas" json,
	"source" varchar(50) DEFAULT 'sentinel-2',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ndvi_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"field_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"ndvi_value" integer NOT NULL,
	"ndvi_min" integer,
	"ndvi_max" integer,
	"cloud_coverage" integer,
	"satellite" varchar(50),
	"image_url" varchar(500),
	"acquisition_date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text,
	"notification_type" "notification_type" DEFAULT 'system',
	"related_field_id" integer,
	"is_read" boolean DEFAULT false,
	"action_url" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offline_sync_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" integer,
	"action" "sync_action" NOT NULL,
	"payload" json,
	"sync_status" "sync_status" DEFAULT 'pending',
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"synced_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "push_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token" varchar(500) NOT NULL,
	"platform" "platform" NOT NULL,
	"device_name" varchar(100),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"field_id" integer,
	"user_id" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"task_type" "task_type" DEFAULT 'other',
	"priority" "priority" DEFAULT 'medium',
	"status" "task_status" DEFAULT 'pending',
	"due_date" timestamp,
	"completed_at" timestamp,
	"assigned_to" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"open_id" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"login_method" varchar(64),
	"role" "role" DEFAULT 'user' NOT NULL,
	"user_type" "user_type" DEFAULT 'farmer' NOT NULL,
	"phone" varchar(20),
	"company" varchar(255),
	"avatar_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_signed_in" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_open_id_unique" UNIQUE("open_id")
);
--> statement-breakpoint
CREATE TABLE "weather_alerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"field_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"alert_type" "alert_type" NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text,
	"severity" "alert_severity" DEFAULT 'info',
	"is_read" boolean DEFAULT false,
	"is_dismissed" boolean DEFAULT false,
	"valid_from" timestamp,
	"valid_until" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weather_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"field_id" integer NOT NULL,
	"date" timestamp NOT NULL,
	"temperature_min" integer,
	"temperature_max" integer,
	"temperature_avg" integer,
	"humidity" integer,
	"precipitation" integer,
	"wind_speed" integer,
	"wind_direction" varchar(10),
	"uv_index" integer,
	"condition" varchar(50),
	"icon_code" varchar(10),
	"is_forecast" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
