import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

// VAPID public key - in production this should come from env
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function PushNotificationManager() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  const registerMutation = trpc.pushNotifications.registerToken.useMutation();
  const unregisterMutation = trpc.pushNotifications.unregisterToken.useMutation();

  useEffect(() => {
    // Check if push notifications are supported
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
      
      // Check if already subscribed
      navigator.serviceWorker.ready.then((registration) => {
        registration.pushManager.getSubscription().then((subscription) => {
          setIsSubscribed(!!subscription);
        });
      });
    }
  }, []);

  const subscribe = async () => {
    setIsLoading(true);
    try {
      // Request notification permission
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);

      if (permissionResult !== 'granted') {
        toast.error('Permissão para notificações negada');
        return;
      }

      // Register service worker if not already registered
      let registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        registration = await navigator.serviceWorker.register('/sw.js');
      }

      await navigator.serviceWorker.ready;

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });

      // Send subscription to server - store as JSON string token
      const subscriptionJSON = subscription.toJSON();
      const token = JSON.stringify(subscriptionJSON);
      await registerMutation.mutateAsync({
        token,
        platform: "web",
        deviceName: navigator.userAgent.slice(0, 50),
      });

      setIsSubscribed(true);
      toast.success('Notificações ativadas com sucesso!');
    } catch (error) {
      console.error('Error subscribing to push:', error);
      toast.error('Erro ao ativar notificações');
    } finally {
      setIsLoading(false);
    }
  };

  const unsubscribe = async () => {
    setIsLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const token = JSON.stringify(subscription.toJSON());
        await subscription.unsubscribe();
        await unregisterMutation.mutateAsync({
          token,
        });
      }

      setIsSubscribed(false);
      toast.success('Notificações desativadas');
    } catch (error) {
      console.error('Error unsubscribing from push:', error);
      toast.error('Erro ao desativar notificações');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isSupported) {
    return (
      <div className="flex items-center gap-2 text-gray-500 text-sm">
        <BellOff className="h-4 w-4" />
        <span>Notificações não suportadas neste navegador</span>
      </div>
    );
  }

  if (permission === 'denied') {
    return (
      <div className="flex items-center gap-2 text-red-500 text-sm">
        <BellOff className="h-4 w-4" />
        <span>Notificações bloqueadas. Altere nas configurações do navegador.</span>
      </div>
    );
  }

  return (
    <Button
      variant={isSubscribed ? "outline" : "default"}
      onClick={isSubscribed ? unsubscribe : subscribe}
      disabled={isLoading}
      className="gap-2"
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isSubscribed ? (
        <BellOff className="h-4 w-4" />
      ) : (
        <Bell className="h-4 w-4" />
      )}
      {isLoading ? 'Processando...' : isSubscribed ? 'Desativar Notificações' : 'Ativar Notificações'}
    </Button>
  );
}

// Simple notification toggle button for header/profile
export function NotificationToggle() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const registerMutation = trpc.pushNotifications.registerToken.useMutation();
  const unregisterMutation = trpc.pushNotifications.unregisterToken.useMutation();

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      navigator.serviceWorker.ready.then((registration) => {
        registration.pushManager.getSubscription().then((subscription) => {
          setIsSubscribed(!!subscription);
        });
      });
    }
  }, []);

  const toggle = async () => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      if (isSubscribed) {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          const token = JSON.stringify(subscription.toJSON());
          await subscription.unsubscribe();
          await unregisterMutation.mutateAsync({ token });
        }
        setIsSubscribed(false);
        toast.success('Notificações desativadas');
      } else {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          toast.error('Permissão negada');
          return;
        }

        let registration = await navigator.serviceWorker.getRegistration();
        if (!registration) {
          registration = await navigator.serviceWorker.register('/sw.js');
        }
        await navigator.serviceWorker.ready;

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
        });

        const token = JSON.stringify(subscription.toJSON());
        await registerMutation.mutateAsync({
          token,
          platform: "web",
          deviceName: navigator.userAgent.slice(0, 50),
        });

        setIsSubscribed(true);
        toast.success('Notificações ativadas!');
      }
    } catch (error) {
      console.error('Push notification error:', error);
      toast.error('Erro com notificações');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isSupported) return null;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      disabled={isLoading}
      title={isSubscribed ? 'Desativar notificações' : 'Ativar notificações'}
    >
      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : isSubscribed ? (
        <Bell className="h-5 w-5 text-green-500" />
      ) : (
        <BellOff className="h-5 w-5" />
      )}
    </Button>
  );
}
