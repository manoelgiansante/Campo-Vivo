import { useOfflineSync } from "@/hooks/useOfflineSync";
import { Badge } from "@/components/ui/badge";
import { WifiOff, Wifi, CloudOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function OfflineIndicator() {
  const { isOnline, pendingCount, isSyncing } = useOfflineSync();

  if (isOnline && pendingCount === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!isOnline ? (
        <div className="flex items-center gap-2 bg-yellow-100 border border-yellow-300 rounded-lg px-4 py-2 shadow-lg">
          <WifiOff className="h-4 w-4 text-yellow-600" />
          <span className="text-sm font-medium text-yellow-800">Modo Offline</span>
          {pendingCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {pendingCount} pendente{pendingCount > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      ) : pendingCount > 0 ? (
        <div className="flex items-center gap-2 bg-blue-100 border border-blue-300 rounded-lg px-4 py-2 shadow-lg">
          {isSyncing ? (
            <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />
          ) : (
            <CloudOff className="h-4 w-4 text-blue-600" />
          )}
          <span className="text-sm font-medium text-blue-800">
            {isSyncing ? "Sincronizando..." : `${pendingCount} ação pendente`}
          </span>
        </div>
      ) : null}
    </div>
  );
}

export function ConnectionStatus() {
  const { isOnline } = useOfflineSync();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${
          isOnline ? "text-green-600" : "text-yellow-600 bg-yellow-50"
        }`}>
          {isOnline ? (
            <Wifi className="h-4 w-4" />
          ) : (
            <WifiOff className="h-4 w-4" />
          )}
          <span className="text-xs font-medium">
            {isOnline ? "Online" : "Offline"}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        {isOnline 
          ? "Conectado à internet" 
          : "Sem conexão. Os dados serão sincronizados quando a conexão for restaurada."}
      </TooltipContent>
    </Tooltip>
  );
}
