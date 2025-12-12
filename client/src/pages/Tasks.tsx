// @ts-nocheck
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  CheckSquare, 
  Plus, 
  Calendar,
  Loader2,
  Filter
} from "lucide-react";
// @ts-nocheck
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type TaskFormData = {
  title: string;
  description: string;
  taskType: "planting" | "irrigation" | "fertilization" | "spraying" | "harvest" | "maintenance" | "inspection" | "other";
  priority: "low" | "medium" | "high" | "urgent";
  dueDate: string;
};

const initialFormData: TaskFormData = {
  title: "",
  description: "",
  taskType: "other",
  priority: "medium",
  dueDate: "",
};

export default function Tasks() {
  const [showNewTaskDialog, setShowNewTaskDialog] = useState(false);
  const [formData, setFormData] = useState<TaskFormData>(initialFormData);
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "completed">("all");

  const { data: tasks, isLoading, refetch } = trpc.tasks.list.useQuery();
  
  const createMutation = trpc.tasks.create.useMutation({
    onSuccess: () => {
      toast.success("Tarefa criada com sucesso!");
      setShowNewTaskDialog(false);
      setFormData(initialFormData);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao criar tarefa");
    },
  });

  const completeMutation = trpc.tasks.complete.useMutation({
    onSuccess: () => {
      toast.success("Tarefa concluída!");
      refetch();
    },
    onError: () => {
      toast.error("Erro ao concluir tarefa");
    },
  });

  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    if (filterStatus === "all") return tasks;
    if (filterStatus === "pending") return tasks.filter(t => t.status === "pending" || t.status === "in_progress");
    return tasks.filter(t => t.status === "completed");
  }, [tasks, filterStatus]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      toast.error("Título é obrigatório");
      return;
    }

    createMutation.mutate({
      title: formData.title.trim(),
      description: formData.description.trim() || undefined,
      taskType: formData.taskType,
      priority: formData.priority,
      dueDate: formData.dueDate ? new Date(formData.dueDate) : undefined,
    });
  };

  const handleComplete = (taskId: number) => {
    completeMutation.mutate({ id: taskId });
  };

  if (isLoading) {
    return <TasksSkeleton />;
  }

  const pendingCount = tasks?.filter(t => t.status === "pending" || t.status === "in_progress").length || 0;
  const completedCount = tasks?.filter(t => t.status === "completed").length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tarefas</h1>
          <p className="text-muted-foreground">
            {pendingCount} pendentes • {completedCount} concluídas
          </p>
        </div>
        <Button onClick={() => setShowNewTaskDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Tarefa
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <Button 
          variant={filterStatus === "all" ? "default" : "outline"} 
          size="sm"
          onClick={() => setFilterStatus("all")}
        >
          Todas
        </Button>
        <Button 
          variant={filterStatus === "pending" ? "default" : "outline"} 
          size="sm"
          onClick={() => setFilterStatus("pending")}
        >
          Pendentes
        </Button>
        <Button 
          variant={filterStatus === "completed" ? "default" : "outline"} 
          size="sm"
          onClick={() => setFilterStatus("completed")}
        >
          Concluídas
        </Button>
      </div>

      {/* Tasks List */}
      {filteredTasks.length > 0 ? (
        <div className="space-y-3">
          {filteredTasks.map((task) => (
            <Card key={task.id} className={task.status === "completed" ? "opacity-60" : ""}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <Checkbox
                    checked={task.status === "completed"}
                    onCheckedChange={() => {
                      if (task.status !== "completed") {
                        handleComplete(task.id);
                      }
                    }}
                    disabled={task.status === "completed" || completeMutation.isPending}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className={`font-medium ${task.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                          {task.title}
                        </p>
                        {task.description && (
                          <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-xs">
                            {getTaskTypeLabel(task.taskType)}
                          </Badge>
                          {task.dueDate && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(task.dueDate), "dd/MM/yyyy")}
                            </span>
                          )}
                        </div>
                      </div>
                      <Badge variant={getPriorityVariant(task.priority)}>
                        {getPriorityLabel(task.priority)}
                      </Badge>
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
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <CheckSquare className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">
              {filterStatus === "all" ? "Nenhuma tarefa" : 
               filterStatus === "pending" ? "Nenhuma tarefa pendente" : 
               "Nenhuma tarefa concluída"}
            </h3>
            <p className="text-muted-foreground text-center mb-4">
              {filterStatus === "all" 
                ? "Crie sua primeira tarefa para organizar suas atividades"
                : "Altere o filtro para ver outras tarefas"}
            </p>
            {filterStatus === "all" && (
              <Button onClick={() => setShowNewTaskDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Tarefa
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* New Task Dialog */}
      <Dialog open={showNewTaskDialog} onOpenChange={setShowNewTaskDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Tarefa</DialogTitle>
            <DialogDescription>
              Adicione uma nova tarefa para sua propriedade
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título *</Label>
                <Input
                  id="title"
                  placeholder="Ex: Aplicar fertilizante no Talhão 1"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  placeholder="Detalhes da tarefa..."
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select
                    value={formData.taskType}
                    onValueChange={(value: TaskFormData["taskType"]) => 
                      setFormData(prev => ({ ...prev, taskType: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planting">Plantio</SelectItem>
                      <SelectItem value="irrigation">Irrigação</SelectItem>
                      <SelectItem value="fertilization">Adubação</SelectItem>
                      <SelectItem value="spraying">Pulverização</SelectItem>
                      <SelectItem value="harvest">Colheita</SelectItem>
                      <SelectItem value="maintenance">Manutenção</SelectItem>
                      <SelectItem value="inspection">Inspeção</SelectItem>
                      <SelectItem value="other">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Prioridade</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value: TaskFormData["priority"]) => 
                      setFormData(prev => ({ ...prev, priority: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Baixa</SelectItem>
                      <SelectItem value="medium">Média</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                      <SelectItem value="urgent">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dueDate">Data de Vencimento</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowNewTaskDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Criar Tarefa
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TasksSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <Skeleton className="h-8 w-24 mb-2" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <Skeleton className="h-5 w-5 rounded" />
                <div className="flex-1">
                  <Skeleton className="h-5 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
                <Skeleton className="h-5 w-16" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function getTaskTypeLabel(type: string | null): string {
  const labels: Record<string, string> = {
    planting: "Plantio",
    irrigation: "Irrigação",
    fertilization: "Adubação",
    spraying: "Pulverização",
    harvest: "Colheita",
    maintenance: "Manutenção",
    inspection: "Inspeção",
    other: "Outro",
  };
  return labels[type || "other"] || type || "Outro";
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
  const labels: Record<string, string> = {
    low: "Baixa",
    medium: "Média",
    high: "Alta",
    urgent: "Urgente",
  };
  return labels[priority || "medium"] || "Média";
}
