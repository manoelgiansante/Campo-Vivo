-- Criar tabela crops (culturas)
CREATE TABLE IF NOT EXISTS "crops" (
  "id" SERIAL PRIMARY KEY,
  "fieldId" INTEGER NOT NULL REFERENCES "fields"("id") ON DELETE CASCADE,
  "userId" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "cropType" VARCHAR(100) NOT NULL,
  "variety" VARCHAR(100),
  "plantingDate" TIMESTAMP,
  "expectedHarvestDate" TIMESTAMP,
  "actualHarvestDate" TIMESTAMP,
  "status" VARCHAR(50) DEFAULT 'planned',
  "areaHectares" INTEGER,
  "expectedYield" INTEGER,
  "actualYield" INTEGER,
  "notes" TEXT,
  "season" VARCHAR(20),
  "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL,
  "updatedAt" TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS "crops_fieldId_idx" ON "crops"("fieldId");
CREATE INDEX IF NOT EXISTS "crops_userId_idx" ON "crops"("userId");
CREATE INDEX IF NOT EXISTS "crops_season_idx" ON "crops"("season");
