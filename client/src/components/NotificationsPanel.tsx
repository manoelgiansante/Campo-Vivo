import { useState } from "react";
import { Bell, BellOff, Check, Loader2, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

interface Notification {
  id: number;
  title: string;
  body: string;
  type: string;
  read: boolean | null;
  createdAt: Date;
}

export function NotificationsPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const { 
    isSupported, 
    isSubscribed, 
    isLoading, 
    permission, 
    subscribe, 
    unsubscribe 
  } = usePushNotifications();

  const { data: notificationsList, refetch } = trpc.notifications.list.useQuery(
    { limit: 20 },
    { enabled: isOpen }
  );
  const { data: unreadCount } = trpc.notifications.unreadCount.useQuery();
  
  const markAsReadMutation = trpc.notifications.markAsRead.useMutation({
    onSuccess: () => refetch(),
  });
  const markAllAsReadMutation = trpc.notifications.markAllAsRead.useMutation({
    onSuccess: () => refetch(),
  });

  const handleToggleNotifications = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "alert": return "🔔";
      case "ndvi": return "🌱";
      case "weather": return "🌤️";
      case "task": return "📋";
      default: return "📩";
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "alert": return "bg-red-100 text-red-800";
      case "ndvi": return "bg-green-100 text-green-800";
      case "weather": return "bg-blue-100 text-blue-800";
      case "task": return "bg-purple-100 text-purple-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const formatDate = (dateVal: Date) => {
    const date = new Date(dateVal);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Agora";
    if (diffMins < 60) return `${diffMins}m atrás`;
    if (diffHours < 24) return `${diffHours}h atrás`;
    if (diffDays < 7) return `${diffDays}d atrás`;
    return date.toLocaleDateString("pt-BR");
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <button className="relative p-2 rounded-full hover:bg-gray-100 transition-colors">
          <Bell className="w-6 h-6 text-gray-600" />
          {(unreadCount ?? 0) > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-medium">
              {unreadCount! > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </SheetTrigger>
      
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notificações
          </SheetTitle>
          <SheetDescription>
            Receba alertas sobre seus campos
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Toggle de notificações push */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              {isSubscribed ? (
                <Bell className="w-5 h-5 text-green-600" />
              ) : (
                <BellOff className="w-5 h-5 text-gray-400" />
              )}
              <div>
                <p className="font-medium text-sm">Notificações Push</p>
                <p className="text-xs text-gray-500">
                  {!isSupported 
                    ? "Não suportado neste navegador" 
                    : permission === "denied"
                    ? "Bloqueado pelo navegador"
                    : isSubscribed 
                    ? "Ativo" 
                    : "Desativado"}
                </p>
              </div>
            </div>
            <Switch
              checked={isSubscribed}
              onCheckedChange={handleToggleNotifications}
              disabled={!isSupported || permission === "denied" || isLoading}
            />
          </div>

          {/* Ações */}
          {(unreadCount ?? 0) > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => markAllAsReadMutation.mutate()}
              disabled={markAllAsReadMutation.isPending}
            >
              {markAllAsReadMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              Marcar todas como lidas
            </Button>
          )}

          {/* Lista de notificações */}
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {!notificationsList || notificationsList.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nenhuma notificação</p>
                <p className="text-xs mt-1">
                  Você receberá alertas sobre seus campos aqui
                </p>
              </div>
            ) : (
              notificationsList.map((notification: Notification) => (
                <div
                  key={notification.id}
                  className={`p-3 rounded-lg border transition-colors ${
                    notification.read 
                      ? "bg-white border-gray-100" 
                      : "bg-blue-50 border-blue-200"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-lg mt-0.5">
                      {getTypeIcon(notification.type)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm truncate">
                          {notification.title}
                        </p>
                        <Badge 
                          variant="secondary" 
                          className={`text-xs ${getTypeColor(notification.type)}`}
                        >
                          {notification.type}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {notification.body}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDate(notification.createdAt)}
                      </p>
                    </div>
                    {!notification.read && (
                      <button
                        onClick={() => markAsReadMutation.mutate({ id: notification.id })}
                        className="p-1 hover:bg-gray-100 rounded"
                        title="Marcar como lida"
                      >
                        <Check className="w-4 h-4 text-gray-400" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
