/**
 * Serviço de agendamento de sincronização NDVI
 * 
 * Sincroniza automaticamente os dados NDVI de todos os campos
 * em intervalos regulares usando a API Agromonitoring
 */

import * as agromonitoring from "./agromonitoring";
import * as db from "../db";

// Intervalo de sincronização: 6 horas (em milissegundos)
const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;

// Delay entre campos para não exceder rate limit (60 req/min)
const FIELD_DELAY_MS = 1100;

// Armazena o ID do intervalo para poder parar
let schedulerInterval: NodeJS.Timeout | null = null;

// Status do scheduler
let lastSyncTime: Date | null = null;
let lastSyncStats: { success: number; failed: number; total: number } | null = null;
let isRunning = false;

/**
 * Executa a sincronização de NDVI para todos os campos de todos os usuários
 */
async function runNdviSync(): Promise<void> {
  if (isRunning) {
    console.log("[NDVI Scheduler] Sincronização já em andamento, pulando...");
    return;
  }

  if (!agromonitoring.isAgromonitoringConfigured()) {
    console.log("[NDVI Scheduler] API Agromonitoring não configurada, pulando...");
    return;
  }

  console.log("[NDVI Scheduler] Iniciando sincronização automática de NDVI...");
  isRunning = true;

  try {
    // Busca todos os campos que têm boundaries definidos
    const allFields = await db.getAllFieldsWithBoundaries();
    
    if (allFields.length === 0) {
      console.log("[NDVI Scheduler] Nenhum campo com boundaries encontrado");
      lastSyncStats = { success: 0, failed: 0, total: 0 };
      lastSyncTime = new Date();
      return;
    }

    console.log(`[NDVI Scheduler] Sincronizando ${allFields.length} campos...`);

    let success = 0;
    let failed = 0;

    for (const field of allFields) {
      try {
        await agromonitoring.syncFieldNdvi(field);
        success++;
        console.log(`[NDVI Scheduler] Campo ${field.id} (${field.name}) sincronizado`);
      } catch (error) {
        failed++;
        console.error(`[NDVI Scheduler] Erro no campo ${field.id}:`, error);
      }

      // Delay para respeitar rate limit
      await new Promise(resolve => setTimeout(resolve, FIELD_DELAY_MS));
    }

    lastSyncStats = { success, failed, total: allFields.length };
    lastSyncTime = new Date();

    console.log(
      `[NDVI Scheduler] Sincronização concluída: ${success} sucesso, ${failed} falhas de ${allFields.length} campos`
    );
  } catch (error) {
    console.error("[NDVI Scheduler] Erro geral na sincronização:", error);
  } finally {
    isRunning = false;
  }
}

/**
 * Inicia o scheduler de NDVI
 */
export function startNdviScheduler(): void {
  if (schedulerInterval) {
    console.log("[NDVI Scheduler] Scheduler já está rodando");
    return;
  }

  if (!agromonitoring.isAgromonitoringConfigured()) {
    console.log("[NDVI Scheduler] API Agromonitoring não configurada, scheduler não iniciado");
    return;
  }

  console.log(`[NDVI Scheduler] Iniciando scheduler (intervalo: ${SYNC_INTERVAL_MS / 1000 / 60 / 60}h)`);

  // Executa primeira sincronização após 5 minutos (para dar tempo do servidor estabilizar)
  setTimeout(() => {
    runNdviSync();
  }, 5 * 60 * 1000);

  // Agenda sincronizações periódicas
  schedulerInterval = setInterval(() => {
    runNdviSync();
  }, SYNC_INTERVAL_MS);

  console.log("[NDVI Scheduler] Scheduler iniciado com sucesso");
}

/**
 * Para o scheduler de NDVI
 */
export function stopNdviScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[NDVI Scheduler] Scheduler parado");
  }
}

/**
 * Retorna o status atual do scheduler
 */
export function getSchedulerStatus(): {
  running: boolean;
  lastSync: Date | null;
  lastStats: { success: number; failed: number; total: number } | null;
  nextSync: Date | null;
  isConfigured: boolean;
} {
  return {
    running: !!schedulerInterval,
    lastSync: lastSyncTime,
    lastStats: lastSyncStats,
    nextSync: lastSyncTime && schedulerInterval
      ? new Date(lastSyncTime.getTime() + SYNC_INTERVAL_MS)
      : null,
    isConfigured: agromonitoring.isAgromonitoringConfigured(),
  };
}

/**
 * Força uma sincronização imediata (manual)
 */
export async function forceSyncNow(): Promise<{ success: number; failed: number; total: number }> {
  await runNdviSync();
  return lastSyncStats || { success: 0, failed: 0, total: 0 };
}
