import { getLoginUrl, isOAuthConfigured } from "@/const";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo, useRef } from "react";

// Generate or retrieve device ID for guest identification
function getDeviceId(): string {
  const storageKey = "campovivo_device_id";
  let deviceId = localStorage.getItem(storageKey);
  
  if (!deviceId) {
    // Generate a unique device ID
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    localStorage.setItem(storageKey, deviceId);
  }
  
  return deviceId;
}

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
  autoCreateGuest?: boolean;
};

export function useAuth(options?: UseAuthOptions) {
  const loginUrl = isOAuthConfigured() ? getLoginUrl() : null;
  const { 
    redirectOnUnauthenticated = false, 
    redirectPath = loginUrl,
    autoCreateGuest = false 
  } = options ?? {};
  const utils = trpc.useUtils();
  const guestCreationAttempted = useRef(false);

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const createGuestMutation = trpc.auth.getOrCreateGuest.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        utils.auth.me.invalidate();
      }
    },
    onError: (error) => {
      console.warn("[Auth] Failed to create guest:", error);
    },
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
      // Reset guest creation flag so a new guest can be created
      guestCreationAttempted.current = false;
    },
  });

  // Auto-create guest user if no user exists and autoCreateGuest is enabled
  useEffect(() => {
    if (!autoCreateGuest) return;
    if (meQuery.isLoading) return;
    if (meQuery.data) return; // User already exists
    if (guestCreationAttempted.current) return;
    if (createGuestMutation.isPending) return;

    guestCreationAttempted.current = true;
    const deviceId = getDeviceId();
    createGuestMutation.mutate({ deviceId });
  }, [autoCreateGuest, meQuery.isLoading, meQuery.data, createGuestMutation]);

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        return;
      }
      throw error;
    } finally {
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, utils]);

  const state = useMemo(() => {
    localStorage.setItem(
      "manus-runtime-user-info",
      JSON.stringify(meQuery.data)
    );
    return {
      user: meQuery.data ?? null,
      loading: meQuery.isLoading || logoutMutation.isPending || createGuestMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? createGuestMutation.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
      isGuest: meQuery.data?.isGuest ?? false,
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    logoutMutation.error,
    logoutMutation.isPending,
    createGuestMutation.error,
    createGuestMutation.isPending,
  ]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (!redirectPath) return; // Don't redirect if OAuth not configured
    if (meQuery.isLoading || logoutMutation.isPending) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    if (window.location.pathname === redirectPath) return;

    window.location.href = redirectPath
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    logoutMutation.isPending,
    meQuery.isLoading,
    state.user,
  ]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
