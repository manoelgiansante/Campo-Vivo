/**
 * Push Notification Service
 * Serviço para enviar notificações push aos usuários
 */

// Import dinâmico para web-push (dependência opcional)
let webPush: any = null;

async function getWebPush(): Promise<any> {
  if (!webPush) {
    try {
      // @ts-ignore - web-push é uma dependência opcional
      const module = await import('web-push').catch(() => null);
      if (module) {
        webPush = module.default || module;
      }
    } catch {
      console.warn('web-push não instalado. Push notifications desabilitadas.');
      return null;
    }
  }
  return webPush;
}

import { VAPID_CONFIG, PUSH_CONFIG, NOTIFICATION_TEMPLATES, NOTIFICATION_TYPES } from '../config/vapid';
import * as db from '../db';

// Configurar web-push quando disponível
async function setupWebPush() {
  const wp = await getWebPush();
  if (wp) {
    wp.setVapidDetails(
      VAPID_CONFIG.email,
      VAPID_CONFIG.publicKey,
      VAPID_CONFIG.privateKey
    );
  }
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string;
  data?: Record<string, any>;
  actions?: Array<{ action: string; title: string; url?: string }>;
  vibrate?: number[];
  requireInteraction?: boolean;
  silent?: boolean;
}

export interface SendResult {
  success: boolean;
  sent: number;
  failed: number;
  errors?: string[];
}

/**
 * Envia notificação push para um usuário específico
 */
export async function sendPushToUser(
  userId: number,
  payload: PushPayload
): Promise<SendResult> {
  const subscriptions = await db.getPushSubscriptionsByUserId(userId);
  
  if (!subscriptions || subscriptions.length === 0) {
    return { success: false, sent: 0, failed: 0, errors: ['Nenhuma subscription encontrada'] };
  }
  
  return sendPushToSubscriptions(subscriptions, payload);
}

/**
 * Envia notificação para múltiplas subscriptions
 */
export async function sendPushToSubscriptions(
  subscriptions: Array<{ endpoint: string; p256dh: string; auth: string }>,
  payload: PushPayload
): Promise<SendResult> {
  const wp = await getWebPush();
  
  if (!wp) {
    return { 
      success: false, 
      sent: 0, 
      failed: subscriptions.length, 
      errors: ['web-push não instalado'] 
    };
  }
  
  await setupWebPush();
  
  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      wp.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        JSON.stringify(payload),
        {
          TTL: PUSH_CONFIG.ttl,
          urgency: PUSH_CONFIG.urgency,
          topic: payload.tag || PUSH_CONFIG.topic,
        }
      )
    )
  );
  
  const sent = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;
  const errors = results
    .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    .map((r) => r.reason?.message || 'Erro desconhecido');
  
  return {
    success: sent > 0,
    sent,
    failed,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Envia alerta de NDVI baixo
 */
export async function sendNdviAlert(
  userId: number,
  fieldName: string,
  ndviValue: number,
  fieldId: number
): Promise<SendResult> {
  const template = NOTIFICATION_TEMPLATES[NOTIFICATION_TYPES.NDVI_ALERT];
  
  const payload: PushPayload = {
    title: '⚠️ Alerta de NDVI',
    body: `O campo "${fieldName}" apresenta NDVI baixo (${ndviValue.toFixed(2)}). Verifique possível estresse.`,
    ...template,
    data: {
      type: NOTIFICATION_TYPES.NDVI_ALERT,
      fieldId,
      ndviValue,
      url: `/fields/${fieldId}`,
    },
  };
  
  return sendPushToUser(userId, payload);
}

/**
 * Envia alerta de risco de praga
 */
export async function sendPestAlert(
  userId: number,
  fieldName: string,
  pestName: string,
  riskLevel: string,
  fieldId: number
): Promise<SendResult> {
  const template = NOTIFICATION_TEMPLATES[NOTIFICATION_TYPES.PEST_WARNING];
  
  const emoji = riskLevel === 'critical' ? '🚨' : riskLevel === 'high' ? '⚠️' : '🐛';
  
  const payload: PushPayload = {
    title: `${emoji} Risco de ${pestName}`,
    body: `Campo "${fieldName}" tem risco ${riskLevel} de ${pestName}. Recomendamos monitoramento.`,
    ...template,
    data: {
      type: NOTIFICATION_TYPES.PEST_WARNING,
      fieldId,
      pestName,
      riskLevel,
      url: `/fields/${fieldId}/pests`,
    },
  };
  
  return sendPushToUser(userId, payload);
}

/**
 * Envia alerta de clima
 */
export async function sendWeatherAlert(
  userId: number,
  fieldName: string,
  alertType: 'frost' | 'heat' | 'storm' | 'drought',
  details: string,
  fieldId: number
): Promise<SendResult> {
  const template = NOTIFICATION_TEMPLATES[NOTIFICATION_TYPES.WEATHER_ALERT];
  
  const titles: Record<string, string> = {
    frost: '❄️ Alerta de Geada',
    heat: '🌡️ Alerta de Calor',
    storm: '⛈️ Alerta de Tempestade',
    drought: '☀️ Alerta de Seca',
  };
  
  const payload: PushPayload = {
    title: titles[alertType] || '🌤️ Alerta Climático',
    body: `${fieldName}: ${details}`,
    ...template,
    data: {
      type: NOTIFICATION_TYPES.WEATHER_ALERT,
      fieldId,
      alertType,
      url: `/fields/${fieldId}/weather`,
    },
  };
  
  return sendPushToUser(userId, payload);
}

/**
 * Envia lembrete de tarefa
 */
export async function sendTaskReminder(
  userId: number,
  taskTitle: string,
  fieldName: string,
  taskId: number
): Promise<SendResult> {
  const template = NOTIFICATION_TEMPLATES[NOTIFICATION_TYPES.TASK_REMINDER];
  
  const payload: PushPayload = {
    title: '📋 Lembrete de Tarefa',
    body: `${taskTitle} - ${fieldName}`,
    ...template,
    data: {
      type: NOTIFICATION_TYPES.TASK_REMINDER,
      taskId,
      url: `/tasks/${taskId}`,
    },
  };
  
  return sendPushToUser(userId, payload);
}

/**
 * Envia notificação de atualização do sistema
 */
export async function sendSystemUpdate(
  userId: number,
  title: string,
  message: string
): Promise<SendResult> {
  const template = NOTIFICATION_TEMPLATES[NOTIFICATION_TYPES.SYSTEM_UPDATE];
  
  const payload: PushPayload = {
    title,
    body: message,
    ...template,
    data: {
      type: NOTIFICATION_TYPES.SYSTEM_UPDATE,
      url: '/',
    },
  };
  
  return sendPushToUser(userId, payload);
}

/**
 * Broadcast para todos os usuários (admin only)
 */
export async function broadcastNotification(
  payload: PushPayload
): Promise<SendResult> {
  const allSubscriptions = await db.getAllPushSubscriptions();
  return sendPushToSubscriptions(allSubscriptions, payload);
}

export default {
  sendPushToUser,
  sendNdviAlert,
  sendPestAlert,
  sendWeatherAlert,
  sendTaskReminder,
  sendSystemUpdate,
  broadcastNotification,
};
