-- =====================================================
-- CAMPO VIVO - SCHEMA COMPLETO PARA SUPABASE/POSTGRESQL
-- Execute este script no SQL Editor do Supabase
-- =====================================================

-- Tabelas que você JÁ deve ter:
-- users, fields, notifications, ndvi_history

-- =====================================================
-- VERIFICAR TABELAS EXISTENTES
-- =====================================================

-- Execute esta query primeiro para ver o que já existe:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- =====================================================
-- TABELAS ADICIONAIS (OPCIONAL - para funcionalidades futuras)
-- =====================================================

-- CROPS (Cultivos)
CREATE TABLE IF NOT EXISTS crops (
  id SERIAL PRIMARY KEY,
  "fieldId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL,
  "cropType" VARCHAR(100) NOT NULL,
  variety VARCHAR(100),
  "plantingDate" TIMESTAMP,
  "expectedHarvestDate" TIMESTAMP,
  "actualHarvestDate" TIMESTAMP,
  status VARCHAR(20) DEFAULT 'planned',
  "areaHectares" INTEGER,
  "expectedYield" INTEGER,
  "actualYield" INTEGER,
  notes TEXT,
  season VARCHAR(20),
  "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL,
  "updatedAt" TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_crops_field ON crops("fieldId");
CREATE INDEX IF NOT EXISTS idx_crops_user ON crops("userId");

-- FIELD NOTES (Notas de Campo)
CREATE TABLE IF NOT EXISTS "fieldNotes" (
  id SERIAL PRIMARY KEY,
  "fieldId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL,
  title VARCHAR(255),
  content TEXT NOT NULL,
  "noteType" VARCHAR(30) DEFAULT 'observation',
  latitude VARCHAR(20),
  longitude VARCHAR(20),
  photos JSON,
  severity VARCHAR(20),
  "isResolved" BOOLEAN DEFAULT FALSE,
  "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL,
  "updatedAt" TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fieldnotes_field ON "fieldNotes"("fieldId");
CREATE INDEX IF NOT EXISTS idx_fieldnotes_user ON "fieldNotes"("userId");

-- WEATHER ALERTS (Alertas Climáticos)
CREATE TABLE IF NOT EXISTS "weatherAlerts" (
  id SERIAL PRIMARY KEY,
  "fieldId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL,
  "alertType" VARCHAR(30) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  severity VARCHAR(20) DEFAULT 'info',
  "isRead" BOOLEAN DEFAULT FALSE,
  "isDismissed" BOOLEAN DEFAULT FALSE,
  "validFrom" TIMESTAMP,
  "validUntil" TIMESTAMP,
  "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_weatheralerts_field ON "weatherAlerts"("fieldId");
CREATE INDEX IF NOT EXISTS idx_weatheralerts_user ON "weatherAlerts"("userId");

-- TASKS (Tarefas)
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  "fieldId" INTEGER,
  "userId" INTEGER NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  "taskType" VARCHAR(30) DEFAULT 'other',
  priority VARCHAR(20) DEFAULT 'medium',
  status VARCHAR(20) DEFAULT 'pending',
  "dueDate" TIMESTAMP,
  "completedAt" TIMESTAMP,
  "assignedTo" INTEGER,
  "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL,
  "updatedAt" TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_field ON tasks("fieldId");
CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks("userId");

-- PUSH SUBSCRIPTIONS (para notificações push)
CREATE TABLE IF NOT EXISTS "pushSubscriptions" (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pushsubs_user ON "pushSubscriptions"("userId");

-- =====================================================
-- VERIFICAÇÃO FINAL
-- =====================================================

-- Execute esta query para confirmar todas as tabelas:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;

-- Tabelas esperadas:
-- 1. users ✓
-- 2. fields ✓
-- 3. notifications ✓
-- 4. ndvi_history ✓
-- 5. crops (opcional)
-- 6. fieldNotes (opcional)
-- 7. weatherAlerts (opcional)
-- 8. tasks (opcional)
-- 9. pushSubscriptions (opcional)
