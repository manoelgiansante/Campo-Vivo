import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";

interface PushNotificationState {
  isSupported: boolean;
  isSubscribed: boolean;
  permission: NotificationPermission | null;
  isLoading: boolean;
  error: string | null;
}

export function usePushNotifications() {
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    isSubscribed: false,
    permission: null,
    isLoading: false,
    error: null,
  });

  const subscribeMutation = trpc.notifications.subscribe.useMutation();
  const unsubscribeMutation = trpc.notifications.unsubscribe.useMutation();
  const { data: vapidData } = trpc.notifications.getPublicKey.useQuery();

  useEffect(() => {
    // Check if push notifications are supported
    const isSupported = "serviceWorker" in navigator && "PushManager" in window;
    setState((prev) => ({
      ...prev,
      isSupported,
      permission: isSupported ? Notification.permission : null,
    }));

    if (isSupported) {
      checkSubscription();
    }
  }, []);

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setState((prev) => ({ ...prev, isSubscribed: !!subscription }));
    } catch (error) {
      console.error("Erro ao verificar subscription:", error);
    }
  };

  const urlBase64ToUint8Array = (base64String: string): ArrayBuffer => {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray.buffer;
  };

  const subscribe = useCallback(async () => {
    if (!state.isSupported || !vapidData?.publicKey) {
      setState((prev) => ({ ...prev, error: "Notificações não suportadas" }));
      return false;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // Request permission
      const permission = await Notification.requestPermission();
      setState((prev) => ({ ...prev, permission }));

      if (permission !== "granted") {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: "Permissão negada",
        }));
        return false;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidData.publicKey),
      });

      // Send subscription to server
      const subscriptionJson = subscription.toJSON();
      await subscribeMutation.mutateAsync({
        endpoint: subscriptionJson.endpoint!,
        p256dh: subscriptionJson.keys!.p256dh,
        auth: subscriptionJson.keys!.auth,
      });

      setState((prev) => ({
        ...prev,
        isSubscribed: true,
        isLoading: false,
      }));

      return true;
    } catch (error: any) {
      console.error("Erro ao ativar notificações:", error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error.message || "Erro ao ativar notificações",
      }));
      return false;
    }
  }, [state.isSupported, vapidData?.publicKey, subscribeMutation]);

  const unsubscribe = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
        await unsubscribeMutation.mutateAsync({
          endpoint: subscription.endpoint,
        });
      }

      setState((prev) => ({
        ...prev,
        isSubscribed: false,
        isLoading: false,
      }));

      return true;
    } catch (error: any) {
      console.error("Erro ao desativar notificações:", error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error.message || "Erro ao desativar notificações",
      }));
      return false;
    }
  }, [unsubscribeMutation]);

  return {
    ...state,
    subscribe,
    unsubscribe,
  };
}
