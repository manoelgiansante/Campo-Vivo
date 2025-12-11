-- Migration: Add Agromonitoring integration
-- Add new columns to fields table for NDVI tracking

ALTER TABLE `fields` ADD COLUMN `agroPolygonId` varchar(50);
ALTER TABLE `fields` ADD COLUMN `lastNdviSync` timestamp;
ALTER TABLE `fields` ADD COLUMN `currentNdvi` int;

-- Create NDVI history table
CREATE TABLE `ndviHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fieldId` int NOT NULL,
	`userId` int NOT NULL,
	`ndviValue` int NOT NULL,
	`ndviMin` int,
	`ndviMax` int,
	`cloudCoverage` int,
	`satellite` varchar(50),
	`imageUrl` varchar(500),
	`acquisitionDate` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ndviHistory_id` PRIMARY KEY(`id`)
);

-- Add index for faster queries
CREATE INDEX `idx_ndviHistory_fieldId` ON `ndviHistory` (`fieldId`);
CREATE INDEX `idx_ndviHistory_acquisitionDate` ON `ndviHistory` (`acquisitionDate`);
