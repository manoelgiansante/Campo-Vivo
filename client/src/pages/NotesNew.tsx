import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Folder, 
  ChevronDown, 
  FileText,
  FilePlus,
  MapPin,
  Calendar,
  AlertTriangle
} from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export default function NotesNew() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newNote, setNewNote] = useState({
    fieldId: "",
    title: "",
    content: "",
    severity: "low" as "low" | "medium" | "high" | "critical",
  });

  const { data: notes, isLoading, refetch } = trpc.notes.listAll.useQuery();
  const { data: fields } = trpc.fields.list.useQuery();
  const createNote = trpc.notes.create.useMutation({
    onSuccess: () => {
      toast.success("Nota criada com sucesso!");
      setShowAddDialog(false);
      setNewNote({ fieldId: "", title: "", content: "", severity: "low" });
      refetch();
    },
    onError: () => {
      toast.error("Erro ao criar nota");
    },
  });

  const handleCreateNote = () => {
    if (!newNote.fieldId || !newNote.title) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    createNote.mutate({
      fieldId: parseInt(newNote.fieldId),
      title: newNote.title,
      content: newNote.content || "Nota de campo",
      severity: newNote.severity,
    });
  };

  if (isLoading) {
    return <NotesListSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      {/* Header */}
      <div className="bg-gray-100 sticky top-0 z-10 px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notes</h1>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 text-green-600 text-sm font-medium">
                  <Folder className="h-4 w-4" />
                  <span>All fields</span>
                  <ChevronDown className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem>All fields</DropdownMenuItem>
                {fields?.map((field) => (
                  <DropdownMenuItem key={field.id}>{field.name}</DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4">
        {notes && notes.length > 0 ? (
          <div className="space-y-2">
            {notes.map((note) => (
              <NoteCard key={note.id} note={note} />
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="bg-white rounded-3xl p-8 mt-4">
            <div className="flex flex-col items-center justify-center min-h-[400px]">
              <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mb-6">
                <FileText className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-500 text-center max-w-xs mb-6">
                Adicione notas durante suas vistorias de campo ou quando quiser marcar um local importante no mapa.
              </p>
              <Button 
                onClick={() => setShowAddDialog(true)}
                className="bg-green-600 hover:bg-green-700 rounded-full px-6 h-11 gap-2"
              >
                <FilePlus className="h-5 w-5" />
                Adicionar nota
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Floating Add Button (when notes exist) */}
      {notes && notes.length > 0 && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40">
          <Button
            onClick={() => setShowAddDialog(true)}
            className="bg-green-600 hover:bg-green-700 rounded-full px-6 h-11 gap-2 shadow-lg"
          >
            <FilePlus className="h-5 w-5" />
            Adicionar nota
          </Button>
        </div>
      )}

      {/* Add Note Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Nota</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Campo *</Label>
              <Select
                value={newNote.fieldId}
                onValueChange={(value) => setNewNote({ ...newNote, fieldId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um campo" />
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
              <Label>Título *</Label>
              <Input
                value={newNote.title}
                onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                placeholder="Ex: Praga identificada"
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={newNote.content}
                onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
                placeholder="Descreva o que você observou..."
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>Severidade</Label>
              <Select
                value={newNote.severity}
                onValueChange={(value: "low" | "medium" | "high" | "critical") => 
                  setNewNote({ ...newNote, severity: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="critical">Crítica</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleCreateNote}
              disabled={createNote.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {createNote.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface NoteType {
  id: number;
  title: string | null;
  content: string;
  severity: string | null;
  latitude: string | null;
  longitude: string | null;
  createdAt: Date;
}

function NoteCard({ note }: { note: NoteType }) {
  const severityColors: Record<string, string> = {
    low: "bg-blue-100 text-blue-700",
    medium: "bg-yellow-100 text-yellow-700",
    high: "bg-orange-100 text-orange-700",
    critical: "bg-red-100 text-red-700",
  };

  return (
    <div className="bg-white rounded-2xl p-4">
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-gray-900">{note.title}</h3>
        {note.severity && (
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${severityColors[note.severity] || severityColors.low}`}>
            {note.severity === "low" ? "Baixa" : note.severity === "medium" ? "Média" : note.severity === "high" ? "Alta" : "Crítica"}
          </span>
        )}
      </div>
      {note.content && (
        <p className="text-gray-600 text-sm mb-3 line-clamp-2">{note.content}</p>
      )}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        {note.latitude && note.longitude && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            GPS
          </span>
        )}
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {format(new Date(note.createdAt), "dd/MM/yyyy", { locale: ptBR })}
        </span>
      </div>
    </div>
  );
}

function NotesListSkeleton() {
  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      <div className="px-4 pt-4">
        <Skeleton className="h-8 w-20 mb-2" />
        <Skeleton className="h-5 w-32 mb-4" />
      </div>
      <div className="px-4">
        <div className="bg-white rounded-3xl p-8">
          <div className="flex flex-col items-center justify-center min-h-[400px]">
            <Skeleton className="h-16 w-16 rounded-full mb-6" />
            <Skeleton className="h-4 w-48 mb-2" />
            <Skeleton className="h-4 w-40 mb-6" />
            <Skeleton className="h-11 w-32 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
