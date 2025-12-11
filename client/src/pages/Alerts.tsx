import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  AlertTriangle, 
  Bell,
  Check,
  X,
  Cloud,
  CloudRain,
  CloudSnow,
  Sun,
  Wind,
  Droplets,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Alerts() {
  const { data: alerts, isLoading, refetch } = trpc.weather.getAlerts.useQuery();
  
  const dismissMutation = trpc.weather.dismissAlert.useMutation({
    onSuccess: () => {
      toast.success("Alerta dispensado");
      refetch();
    },
    onError: () => {
      toast.error("Erro ao dispensar alerta");
    },
  });

  const activeAlerts = alerts?.filter(a => !a.isDismissed) || [];
  const dismissedAlerts = alerts?.filter(a => a.isDismissed) || [];

  if (isLoading) {
    return <AlertsSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Alertas</h1>
          <p className="text-muted-foreground">
            {activeAlerts.length} alertas ativos
          </p>
        </div>
      </div>

      {/* Active Alerts */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Alertas Ativos</h2>
        {activeAlerts.length > 0 ? (
          <div className="space-y-3">
            {activeAlerts.map((alert) => (
              <Card 
                key={alert.id} 
                className={`${
                  alert.severity === "critical" ? "border-destructive/50 bg-destructive/5" :
                  alert.severity === "warning" ? "border-yellow-500/50 bg-yellow-50" :
                  "border-blue-500/50 bg-blue-50"
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                      alert.severity === "critical" ? "bg-destructive/10" :
                      alert.severity === "warning" ? "bg-yellow-100" :
                      "bg-blue-100"
                    }`}>
                      {getAlertIcon(alert.alertType, alert.severity)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium">{alert.title}</p>
                            <Badge variant={getSeverityVariant(alert.severity)}>
                              {getSeverityLabel(alert.severity)}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{alert.message}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span>
                              {format(new Date(alert.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </span>
                            {alert.validFrom && alert.validUntil && (
                              <span>
                                Válido: {format(new Date(alert.validFrom), "dd/MM")} - {format(new Date(alert.validUntil), "dd/MM")}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => dismissMutation.mutate({ id: alert.id })}
                          disabled={dismissMutation.isPending}
                        >
                          {dismissMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <X className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold mb-1">Tudo em ordem!</h3>
              <p className="text-muted-foreground text-center">
                Não há alertas ativos no momento
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dismissed Alerts */}
      {dismissedAlerts.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-muted-foreground">Alertas Dispensados</h2>
          <div className="space-y-3">
            {dismissedAlerts.slice(0, 5).map((alert) => (
              <Card key={alert.id} className="opacity-60">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      {getAlertIcon(alert.alertType, null)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{alert.title}</p>
                      <p className="text-sm text-muted-foreground">{alert.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(alert.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Alert Types Info */}
      <Card>
        <CardHeader>
          <CardTitle>Tipos de Alertas</CardTitle>
          <CardDescription>
            Entenda os diferentes tipos de alertas climáticos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <AlertTypeInfo
              icon={<CloudRain className="h-5 w-5 text-blue-500" />}
              title="Chuva"
              description="Alertas de precipitação intensa ou prolongada"
            />
            <AlertTypeInfo
              icon={<CloudSnow className="h-5 w-5 text-blue-300" />}
              title="Geada"
              description="Risco de temperaturas abaixo de zero"
            />
            <AlertTypeInfo
              icon={<Sun className="h-5 w-5 text-orange-500" />}
              title="Calor"
              description="Temperaturas extremamente altas"
            />
            <AlertTypeInfo
              icon={<Wind className="h-5 w-5 text-gray-500" />}
              title="Vento"
              description="Ventos fortes que podem afetar culturas"
            />
            <AlertTypeInfo
              icon={<Droplets className="h-5 w-5 text-yellow-600" />}
              title="Seca"
              description="Períodos prolongados sem precipitação"
            />
            <AlertTypeInfo
              icon={<Cloud className="h-5 w-5 text-green-500" />}
              title="Janela de Pulverização"
              description="Condições ideais para aplicação de defensivos"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AlertTypeInfo({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted">
      <div className="h-10 w-10 rounded-lg bg-background flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function AlertsSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-24 mb-2" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="flex-1">
                    <Skeleton className="h-5 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function getAlertIcon(alertType: string | null, severity: string | null) {
  const iconClass = severity === "critical" ? "text-destructive" : 
                    severity === "warning" ? "text-yellow-600" : 
                    severity ? "text-blue-500" : "text-muted-foreground";
  
  switch (alertType) {
    case "rain":
      return <CloudRain className={`h-5 w-5 ${iconClass}`} />;
    case "frost":
      return <CloudSnow className={`h-5 w-5 ${iconClass}`} />;
    case "heat":
      return <Sun className={`h-5 w-5 ${iconClass}`} />;
    case "drought":
      return <Droplets className={`h-5 w-5 ${iconClass}`} />;
    case "wind":
      return <Wind className={`h-5 w-5 ${iconClass}`} />;
    case "spray_window":
      return <Cloud className={`h-5 w-5 text-green-500`} />;
    default:
      return <AlertTriangle className={`h-5 w-5 ${iconClass}`} />;
  }
}

function getSeverityVariant(severity: string | null): "default" | "secondary" | "destructive" | "outline" {
  switch (severity) {
    case "critical": return "destructive";
    case "warning": return "default";
    default: return "secondary";
  }
}

function getSeverityLabel(severity: string | null): string {
  const labels: Record<string, string> = {
    critical: "Crítico",
    warning: "Atenção",
    info: "Informativo",
  };
  return labels[severity || "info"] || "Informativo";
}
