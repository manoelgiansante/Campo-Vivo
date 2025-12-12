import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  MapPin, 
  Leaf, 
  CheckSquare, 
  AlertTriangle, 
  Plus,
  ArrowRight,
  Cloud,
  Droplets,
  Sun,
  FileText
} from "lucide-react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: overview, isLoading } = trpc.dashboard.summary.useQuery();

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  const stats = { 
    totalFields: overview?.totalFields ?? 0, 
    activeCrops: 0, 
    pendingTasks: overview?.tasks?.length ?? 0, 
    unreadAlerts: overview?.alerts?.length ?? 0 
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Visão geral da sua propriedade agrícola
          </p>
        </div>
        <Button onClick={() => setLocation("/fields/new")} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Campo
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Campos Ativos"
          value={stats.totalFields}
          icon={MapPin}
          description="Campos cadastrados"
          onClick={() => setLocation("/fields")}
        />
        <StatsCard
          title="Cultivos em Andamento"
          value={stats.activeCrops}
          icon={Leaf}
          description="Cultivos em crescimento"
          onClick={() => setLocation("/crops")}
        />
        <StatsCard
          title="Tarefas Pendentes"
          value={stats.pendingTasks}
          icon={CheckSquare}
          description="Tarefas a realizar"
          onClick={() => setLocation("/tasks")}
        />
        <StatsCard
          title="Alertas"
          value={stats.unreadAlerts}
          icon={AlertTriangle}
          description="Alertas não lidos"
          variant={stats.unreadAlerts > 0 ? "warning" : "default"}
          onClick={() => setLocation("/alerts")}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Fields */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-lg">Meus Campos</CardTitle>
              <CardDescription>Últimos campos cadastrados</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setLocation("/fields")} className="gap-1">
              Ver todos <ArrowRight className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {overview?.recentFields && overview.recentFields.length > 0 ? (
              <div className="space-y-3">
                {overview.recentFields.map((field: any) => (
                  <div
                    key={field.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => setLocation(`/fields/${field.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <MapPin className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{field.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {field.areaHectares ? `${(field.areaHectares / 100).toFixed(1)} ha` : "Área não definida"}
                          {field.city && ` • ${field.city}`}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={MapPin}
                title="Nenhum campo cadastrado"
                description="Adicione seu primeiro campo para começar"
                action={
                  <Button onClick={() => setLocation("/fields/new")} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Campo
                  </Button>
                }
              />
            )}
          </CardContent>
        </Card>

        {/* Pending Tasks */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-lg">Tarefas Pendentes</CardTitle>
              <CardDescription>Próximas atividades a realizar</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setLocation("/tasks")} className="gap-1">
              Ver todas <ArrowRight className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {overview?.tasks && overview.tasks.length > 0 ? (
              <div className="space-y-3">
                {overview.tasks.map((task: any) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => setLocation("/tasks")}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center">
                        <CheckSquare className="h-5 w-5 text-accent-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">{task.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {task.dueDate 
                            ? format(new Date(task.dueDate), "dd 'de' MMM", { locale: ptBR })
                            : "Sem prazo"}
                        </p>
                      </div>
                    </div>
                    <Badge variant={getPriorityVariant(task.priority)}>
                      {getPriorityLabel(task.priority)}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={CheckSquare}
                title="Nenhuma tarefa pendente"
                description="Você está em dia com suas atividades"
              />
            )}
          </CardContent>
        </Card>

        {/* Weather Alerts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-lg">Alertas Climáticos</CardTitle>
              <CardDescription>Condições importantes para seus campos</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {overview?.alerts && overview.alerts.length > 0 ? (
              <div className="space-y-3">
                {overview.alerts.map((alert: any) => (
                  <div
                    key={alert.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      alert.severity === "critical" ? "border-destructive/50 bg-destructive/5" :
                      alert.severity === "warning" ? "border-yellow-500/50 bg-yellow-50" :
                      "border-blue-500/50 bg-blue-50"
                    }`}
                  >
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                      alert.severity === "critical" ? "bg-destructive/10" :
                      alert.severity === "warning" ? "bg-yellow-100" :
                      "bg-blue-100"
                    }`}>
                      {getAlertIcon(alert.alertType)}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{alert.title}</p>
                      <p className="text-sm text-muted-foreground">{alert.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Cloud}
                title="Sem alertas climáticos"
                description="Condições favoráveis para seus campos"
              />
            )}
          </CardContent>
        </Card>

        {/* Recent Notes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-lg">Notas Recentes</CardTitle>
              <CardDescription>Últimas observações de campo</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setLocation("/notes")} className="gap-1">
              Ver todas <ArrowRight className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {overview?.notes && overview.notes.length > 0 ? (
              <div className="space-y-3">
                {overview.notes.slice(0, 4).map((note: any) => (
                  <div
                    key={note.id}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => setLocation(`/notes/${note.id}`)}
                  >
                    <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                      <FileText className="h-5 w-5 text-secondary-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{note.title || "Sem título"}</p>
                      <p className="text-sm text-muted-foreground truncate">{note.content}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(note.createdAt), "dd/MM")}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={FileText}
                title="Nenhuma nota registrada"
                description="Registre observações durante suas vistorias"
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatsCard({ 
  title, 
  value, 
  icon: Icon, 
  description, 
  variant = "default",
  onClick 
}: { 
  title: string; 
  value: number; 
  icon: React.ElementType; 
  description: string;
  variant?: "default" | "warning";
  onClick?: () => void;
}) {
  return (
    <Card 
      className={`cursor-pointer transition-all hover:shadow-md ${
        variant === "warning" && value > 0 ? "border-yellow-500/50" : ""
      }`}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className={`h-4 w-4 ${variant === "warning" && value > 0 ? "text-yellow-600" : "text-muted-foreground"}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function EmptyState({ 
  icon: Icon, 
  title, 
  description, 
  action 
}: { 
  icon: React.ElementType; 
  title: string; 
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground mb-4">{description}</p>
      {action}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-1" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[...Array(3)].map((_, j) => (
                  <Skeleton key={j} className="h-16 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function getPriorityVariant(priority: string | null): "default" | "secondary" | "destructive" | "outline" {
  switch (priority) {
    case "urgent": return "destructive";
    case "high": return "destructive";
    case "medium": return "default";
    default: return "secondary";
  }
}

function getPriorityLabel(priority: string | null): string {
  switch (priority) {
    case "urgent": return "Urgente";
    case "high": return "Alta";
    case "medium": return "Média";
    case "low": return "Baixa";
    default: return "Normal";
  }
}

function getAlertIcon(alertType: string) {
  switch (alertType) {
    case "rain": return <Droplets className="h-5 w-5 text-blue-600" />;
    case "frost": return <Cloud className="h-5 w-5 text-blue-400" />;
    case "heat": return <Sun className="h-5 w-5 text-orange-500" />;
    case "drought": return <Sun className="h-5 w-5 text-yellow-600" />;
    default: return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
  }
}
