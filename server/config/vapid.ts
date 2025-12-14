/**
 * VAPID Keys para Push Notifications
 * 
 * INSTRUÇÕES:
 * 1. Gere suas próprias keys usando: npx web-push generate-vapid-keys
 * 2. Adicione ao .env:
 *    VAPID_PUBLIC_KEY=sua_chave_publica
 *    VAPID_PRIVATE_KEY=sua_chave_privada
 *    VAPID_EMAIL=seu_email@exemplo.com
 * 
 * As keys abaixo são apenas para desenvolvimento.
 * NÃO USE EM PRODUÇÃO!
 */

// Keys de desenvolvimento (geradas para teste)
export const VAPID_CONFIG = {
  // Chave pública (pode ser exposta no frontend)
  publicKey: process.env.VAPID_PUBLIC_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U',
  
  // Chave privada (NUNCA expor no frontend)
  privateKey: process.env.VAPID_PRIVATE_KEY || 'UUxI4O8-FbRouAevSmBQ6_O0P-GvAFvWXFSQBQ7MVPU',
  
  // Email para contato (obrigatório pelo protocolo VAPID)
  email: process.env.VAPID_EMAIL || 'mailto:suporte@campovivo.app',
};

/**
 * Configuração do Web Push
 */
export const PUSH_CONFIG = {
  // Tempo de vida da notificação (em segundos)
  ttl: 60 * 60 * 24, // 24 horas
  
  // Urgência da notificação
  urgency: 'normal' as const,
  
  // Tópico (para agrupar notificações)
  topic: 'campovivo-alerts',
};

/**
 * Tipos de notificação suportados
 */
export const NOTIFICATION_TYPES = {
  NDVI_ALERT: 'ndvi_alert',
  PEST_WARNING: 'pest_warning',
  WEATHER_ALERT: 'weather_alert',
  TASK_REMINDER: 'task_reminder',
  SYSTEM_UPDATE: 'system_update',
} as const;

/**
 * Templates de notificação
 */
export const NOTIFICATION_TEMPLATES = {
  [NOTIFICATION_TYPES.NDVI_ALERT]: {
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    vibrate: [200, 100, 200],
    requireInteraction: true,
    actions: [
      { action: 'view', title: 'Ver no mapa' },
      { action: 'dismiss', title: 'Ignorar' },
    ],
  },
  [NOTIFICATION_TYPES.PEST_WARNING]: {
    icon: '/icons/pest-alert.png',
    badge: '/icons/badge-72.png',
    vibrate: [200, 100, 200, 100, 200],
    requireInteraction: true,
    actions: [
      { action: 'view', title: 'Ver detalhes' },
      { action: 'schedule', title: 'Agendar inspeção' },
    ],
  },
  [NOTIFICATION_TYPES.WEATHER_ALERT]: {
    icon: '/icons/weather-alert.png',
    badge: '/icons/badge-72.png',
    vibrate: [300, 100, 300],
    requireInteraction: false,
  },
  [NOTIFICATION_TYPES.TASK_REMINDER]: {
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    vibrate: [100],
    requireInteraction: false,
  },
  [NOTIFICATION_TYPES.SYSTEM_UPDATE]: {
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    silent: true,
  },
};

export default VAPID_CONFIG;
