// @ts-nocheck
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
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
  FileText, 
  Plus, 
  MapPin,
  Loader2,
  Search,
  Camera,
  AlertCircle
} from "lucide-react";
// @ts-nocheck
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useLocation } from "wouter";

type NoteFormData = {
  fieldId: number | null;
  title: string;
  content: string;
  noteType: "observation" | "problem" | "task" | "harvest" | "application";
  severity: "low" | "medium" | "high" | "critical" | null;
  latitude: string;
  longitude: string;
};

const initialFormData: NoteFormData = {
  fieldId: null,
  title: "",
  content: "",
  noteType: "observation",
  severity: null,
  latitude: "",
  longitude: "",
};

export default function Notes() {
  const [, setLocation] = useLocation();
  const [showNewNoteDialog, setShowNewNoteDialog] = useState(false);
  const [formData, setFormData] = useState<NoteFormData>(initialFormData);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  const { data: notes, isLoading, refetch } = trpc.notes.listAll.useQuery();
  const { data: fields } = trpc.fields.list.useQuery();
  
  const createMutation = trpc.notes.create.useMutation({
    onSuccess: () => {
      toast.success("Nota criada com sucesso!");
      setShowNewNoteDialog(false);
      setFormData(initialFormData);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao criar nota");
    },
  });

  const filteredNotes = useMemo(() => {
    if (!notes) return [];
    
    let result = notes;
    
    if (searchQuery) {
      result = result.filter(note => 
        note.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.content.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    if (filterType !== "all") {
      result = result.filter(note => note.noteType === filterType);
    }
    
    return result;
  }, [notes, searchQuery, filterType]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.content.trim()) {
      toast.error("Conteúdo é obrigatório");
      return;
    }
    if (!formData.fieldId) {
      toast.error("Selecione um campo");
      return;
    }

    createMutation.mutate({
      fieldId: formData.fieldId,
      title: formData.title.trim() || undefined,
      content: formData.content.trim(),
      noteType: formData.noteType,
      severity: formData.severity || undefined,
      latitude: formData.latitude || undefined,
      longitude: formData.longitude || undefined,
    });
  };

  const handleGetLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData(prev => ({
            ...prev,
            latitude: position.coords.latitude.toFixed(6),
            longitude: position.coords.longitude.toFixed(6),
          }));
          toast.success("Localização obtida com sucesso!");
        },
        () => {
          toast.error("Não foi possível obter a localização");
        }
      );
    } else {
      toast.error("Geolocalização não suportada pelo navegador");
    }
  };

  if (isLoading) {
    return <NotesSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notas de Campo</h1>
          <p className="text-muted-foreground">
            {notes?.length || 0} notas registradas
          </p>
        </div>
        <Button onClick={() => setShowNewNoteDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Nota
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar notas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrar por tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="observation">Observação</SelectItem>
            <SelectItem value="problem">Problema</SelectItem>
            <SelectItem value="task">Tarefa</SelectItem>
            <SelectItem value="harvest">Colheita</SelectItem>
            <SelectItem value="application">Aplicação</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Notes List */}
      {filteredNotes.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredNotes.map((note) => (
            <Card key={note.id} className="cursor-pointer hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                      note.noteType === "problem" ? "bg-destructive/10" :
                      note.noteType === "task" ? "bg-primary/10" :
                      note.noteType === "harvest" ? "bg-green-100" :
                      "bg-secondary"
                    }`}>
                      {note.noteType === "problem" ? (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      ) : (
                        <FileText className={`h-4 w-4 ${
                          note.noteType === "task" ? "text-primary" :
                          note.noteType === "harvest" ? "text-green-600" :
                          "text-secondary-foreground"
                        }`} />
                      )}
                    </div>
                    <Badge variant={getNoteTypeVariant(note.noteType)}>
                      {getNoteTypeLabel(note.noteType)}
                    </Badge>
                  </div>
                  {note.severity && (
                    <Badge variant={getSeverityVariant(note.severity)}>
                      {getSeverityLabel(note.severity)}
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-base mt-2">{note.title || "Sem título"}</CardTitle>
                <CardDescription>
                  {format(new Date(note.createdAt), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-3">{note.content}</p>
                {note.latitude && note.longitude && (
                  <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {note.latitude}, {note.longitude}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">
              {searchQuery || filterType !== "all" ? "Nenhuma nota encontrada" : "Nenhuma nota registrada"}
            </h3>
            <p className="text-muted-foreground text-center mb-4">
              {searchQuery || filterType !== "all"
                ? "Tente alterar os filtros de busca"
                : "Registre observações durante suas vistorias de campo"}
            </p>
            {!searchQuery && filterType === "all" && (
              <Button onClick={() => setShowNewNoteDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Nota
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* New Note Dialog */}
      <Dialog open={showNewNoteDialog} onOpenChange={setShowNewNoteDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova Nota de Campo</DialogTitle>
            <DialogDescription>
              Registre uma observação ou problema encontrado no campo
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Campo *</Label>
                <Select
                  value={formData.fieldId?.toString() || ""}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, fieldId: parseInt(value) }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o campo" />
                  </SelectTrigger>
                  <SelectContent>
                    {fields?.map((field) => (
                      <SelectItem key={field.id} value={field.id.toString()}>
                        {field.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Título</Label>
                <Input
                  id="title"
                  placeholder="Ex: Praga identificada no setor norte"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">Descrição *</Label>
                <Textarea
                  id="content"
                  placeholder="Descreva a observação em detalhes..."
                  value={formData.content}
                  onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                  rows={4}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select
                    value={formData.noteType}
                    onValueChange={(value: NoteFormData["noteType"]) => 
                      setFormData(prev => ({ ...prev, noteType: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="observation">Observação</SelectItem>
                      <SelectItem value="problem">Problema</SelectItem>
                      <SelectItem value="task">Tarefa</SelectItem>
                      <SelectItem value="harvest">Colheita</SelectItem>
                      <SelectItem value="application">Aplicação</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.noteType === "problem" && (
                  <div className="space-y-2">
                    <Label>Severidade</Label>
                    <Select
                      value={formData.severity || ""}
                      onValueChange={(value) => 
                        setFormData(prev => ({ ...prev, severity: value as NoteFormData["severity"] }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Baixa</SelectItem>
                        <SelectItem value="medium">Média</SelectItem>
                        <SelectItem value="high">Alta</SelectItem>
                        <SelectItem value="critical">Crítica</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Localização GPS</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Latitude"
                    value={formData.latitude}
                    onChange={(e) => setFormData(prev => ({ ...prev, latitude: e.target.value }))}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Longitude"
                    value={formData.longitude}
                    onChange={(e) => setFormData(prev => ({ ...prev, longitude: e.target.value }))}
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" size="icon" onClick={handleGetLocation}>
                    <MapPin className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowNewNoteDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Salvar Nota
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NotesSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <Skeleton className="h-8 w-40 mb-2" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="flex gap-4">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-44" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <Skeleton className="h-5 w-20" />
              </div>
              <Skeleton className="h-5 w-3/4 mt-2" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function getNoteTypeVariant(type: string | null): "default" | "secondary" | "destructive" | "outline" {
  switch (type) {
    case "problem": return "destructive";
    case "task": return "default";
    case "harvest": return "secondary";
    default: return "outline";
  }
}

function getNoteTypeLabel(type: string | null): string {
  const labels: Record<string, string> = {
    observation: "Observação",
    problem: "Problema",
    task: "Tarefa",
    harvest: "Colheita",
    application: "Aplicação",
  };
  return labels[type || "observation"] || type || "Observação";
}

function getSeverityVariant(severity: string | null): "default" | "secondary" | "destructive" | "outline" {
  switch (severity) {
    case "critical":
    case "high": return "destructive";
    case "medium": return "default";
    default: return "secondary";
  }
}

function getSeverityLabel(severity: string | null): string {
  const labels: Record<string, string> = {
    low: "Baixa",
    medium: "Média",
    high: "Alta",
    critical: "Crítica",
  };
  return labels[severity || ""] || "";
}
