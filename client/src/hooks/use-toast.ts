import { useState, useCallback } from "react";

type ToastVariant = "default" | "destructive";

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
}

interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
}

// Simple toast implementation using alerts for now
// Can be replaced with a proper toast library later
export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((options: ToastOptions) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast: Toast = {
      id,
      title: options.title,
      description: options.description,
      variant: options.variant || "default",
    };

    // For now, use a simple alert or console log
    // In production, you'd want to show a proper toast UI
    if (options.variant === "destructive") {
      console.error(`[Toast Error] ${options.title}: ${options.description || ""}`);
    } else {
      console.log(`[Toast] ${options.title}: ${options.description || ""}`);
    }

    // Optional: show native alert for important messages
    // Uncomment if you want visible feedback:
    // alert(`${options.title}\n${options.description || ""}`);

    setToasts((prev) => [...prev, newToast]);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);

    return { id, dismiss: () => setToasts((prev) => prev.filter((t) => t.id !== id)) };
  }, []);

  const dismiss = useCallback((toastId?: string) => {
    if (toastId) {
      setToasts((prev) => prev.filter((t) => t.id !== toastId));
    } else {
      setToasts([]);
    }
  }, []);

  return {
    toast,
    toasts,
    dismiss,
  };
}
