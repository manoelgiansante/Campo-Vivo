// Service Worker for Push Notifications
// Campo Vivo - Agricultural Management App

self.addEventListener('install', (event) => {
  console.log('Service Worker installed');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activated');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);

  let data = {
    title: 'Campo Vivo',
    body: 'Você tem uma nova notificação',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    tag: 'campovivo-notification',
    data: {}
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = {
        title: payload.title || data.title,
        body: payload.body || data.body,
        icon: payload.icon || data.icon,
        badge: payload.badge || data.badge,
        tag: payload.tag || data.tag,
        data: payload.data || {}
      };
    } catch (e) {
      console.error('Error parsing push data:', e);
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag,
    data: data.data,
    vibrate: [100, 50, 100],
    actions: [
      { action: 'open', title: 'Abrir' },
      { action: 'dismiss', title: 'Dispensar' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  // Get the URL to open based on notification data
  let url = '/';
  if (event.notification.data) {
    if (event.notification.data.url) {
      url = event.notification.data.url;
    } else if (event.notification.data.fieldId) {
      url = `/fields/${event.notification.data.fieldId}`;
    } else if (event.notification.data.taskId) {
      url = `/tasks`;
    } else if (event.notification.data.alertId) {
      url = `/alerts`;
    }
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already an open window
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Open a new window if none exists
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});

self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event);
});

// Background sync for offline support
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-data') {
    console.log('Background sync triggered');
    event.waitUntil(syncOfflineData());
  }
});

async function syncOfflineData() {
  try {
    // This will be handled by the main app
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({ type: 'SYNC_OFFLINE_DATA' });
    });
  } catch (error) {
    console.error('Error syncing offline data:', error);
  }
}

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-weather-alerts') {
    event.waitUntil(checkWeatherAlerts());
  }
});

async function checkWeatherAlerts() {
  try {
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({ type: 'CHECK_WEATHER_ALERTS' });
    });
  } catch (error) {
    console.error('Error checking weather alerts:', error);
  }
}
