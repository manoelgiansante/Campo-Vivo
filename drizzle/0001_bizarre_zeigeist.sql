CREATE TABLE `cropRotationPlans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fieldId` int NOT NULL,
	`userId` int NOT NULL,
	`season` varchar(20) NOT NULL,
	`plannedCrop` varchar(100) NOT NULL,
	`previousCrop` varchar(100),
	`isConfirmed` boolean DEFAULT false,
	`notes` text,
	`suggestedBy` enum('user','system') DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cropRotationPlans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `crops` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fieldId` int NOT NULL,
	`userId` int NOT NULL,
	`cropType` varchar(100) NOT NULL,
	`variety` varchar(100),
	`plantingDate` timestamp,
	`expectedHarvestDate` timestamp,
	`actualHarvestDate` timestamp,
	`status` enum('planned','planted','growing','harvested','failed') DEFAULT 'planned',
	`areaHectares` int,
	`expectedYield` int,
	`actualYield` int,
	`notes` text,
	`season` varchar(20),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `crops_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fieldNotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fieldId` int NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255),
	`content` text NOT NULL,
	`noteType` enum('observation','problem','task','harvest','application') DEFAULT 'observation',
	`latitude` varchar(20),
	`longitude` varchar(20),
	`photos` json,
	`severity` enum('low','medium','high','critical'),
	`isResolved` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fieldNotes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fields` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`areaHectares` int,
	`latitude` varchar(20),
	`longitude` varchar(20),
	`boundaries` json,
	`address` text,
	`city` varchar(100),
	`state` varchar(100),
	`country` varchar(100) DEFAULT 'Brasil',
	`soilType` varchar(100),
	`irrigationType` enum('none','drip','sprinkler','pivot','flood') DEFAULT 'none',
	`isActive` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `fields_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ndviData` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fieldId` int NOT NULL,
	`captureDate` timestamp NOT NULL,
	`ndviAverage` int,
	`ndviMin` int,
	`ndviMax` int,
	`healthStatus` enum('excellent','good','moderate','poor','critical'),
	`cloudCoverage` int,
	`imageUrl` text,
	`thumbnailUrl` text,
	`problemAreas` json,
	`source` varchar(50) DEFAULT 'sentinel-2',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ndviData_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`message` text,
	`notificationType` enum('weather','task','ndvi','system','crop') DEFAULT 'system',
	`relatedFieldId` int,
	`isRead` boolean DEFAULT false,
	`actionUrl` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `offlineSyncQueue` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`entityType` varchar(50) NOT NULL,
	`entityId` int,
	`action` enum('create','update','delete') NOT NULL,
	`payload` json,
	`syncStatus` enum('pending','synced','failed') DEFAULT 'pending',
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`syncedAt` timestamp,
	CONSTRAINT `offlineSyncQueue_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fieldId` int,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`taskType` enum('planting','irrigation','fertilization','spraying','harvest','maintenance','inspection','other') DEFAULT 'other',
	`priority` enum('low','medium','high','urgent') DEFAULT 'medium',
	`status` enum('pending','in_progress','completed','cancelled') DEFAULT 'pending',
	`dueDate` timestamp,
	`completedAt` timestamp,
	`assignedTo` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `weatherAlerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fieldId` int NOT NULL,
	`userId` int NOT NULL,
	`alertType` enum('rain','frost','heat','wind','drought','spray_window') NOT NULL,
	`title` varchar(255) NOT NULL,
	`message` text,
	`severity` enum('info','warning','critical') DEFAULT 'info',
	`isRead` boolean DEFAULT false,
	`isDismissed` boolean DEFAULT false,
	`validFrom` timestamp,
	`validUntil` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `weatherAlerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `weatherData` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fieldId` int NOT NULL,
	`date` timestamp NOT NULL,
	`temperatureMin` int,
	`temperatureMax` int,
	`temperatureAvg` int,
	`humidity` int,
	`precipitation` int,
	`windSpeed` int,
	`windDirection` varchar(10),
	`uvIndex` int,
	`condition` varchar(50),
	`iconCode` varchar(10),
	`isForecast` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `weatherData_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `userType` enum('farmer','agronomist','consultant') DEFAULT 'farmer' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(20);--> statement-breakpoint
ALTER TABLE `users` ADD `company` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `avatarUrl` text;