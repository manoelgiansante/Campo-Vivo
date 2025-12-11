import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  Folder, 
  ChevronDown, 
  FileText,
  Plus,
  Camera,
  X,
  Loader2,
  MapPin
} from "lucide-react";
import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type NoteType = "observation" | "problem" | "task" | "harvest" | "application";

export default function NotesOneSoil() {
  const [, setLocation] = useLocation();
  const [selectedFolder, setSelectedFolder] = useState("Todos os campos");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newNote, setNewNote] = useState({
    title: "",
    content: "",
    noteType: "observation" as NoteType,
    fieldId: 0,
    photos: [] as string[],
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch real data
  const { data: notes, isLoading: loadingNotes } = trpc.notes.listAll.useQuery();
  const { data: fields } = trpc.fields.list.useQuery();

  // Type for notes
  type Note = NonNullable<typeof notes>[number];
  
  // Mutations
  const createNote = trpc.notes.create.useMutation({
    onSuccess: () => {
      toast.success("Nota criada com sucesso!");
      setShowCreateDialog(false);
      resetForm();
    },
    onError: (error) => {
      toast.error("Erro ao criar nota: " + error.message);
    },
  });
  
  const uploadPhoto = trpc.upload.photo.useMutation();

  const resetForm = () => {
    setNewNote({
      title: "",
      content: "",
      noteType: "observation",
      fieldId: 0,
      photos: [],
    });
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    for (const file of Array.from(files)) {
      // Convert to base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        try {
          const result = await uploadPhoto.mutateAsync({
            base64,
            fileName: file.name,
            contentType: file.type,
          });
          if (result.success && result.url) {
            setNewNote(prev => ({
              ...prev,
              photos: [...prev.photos, result.url],
            }));
          }
        } catch (error) {
          toast.error("Erro ao fazer upload da foto");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = (index: number) => {
    setNewNote(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index),
    }));
  };

  const handleCreateNote = () => {
    if (!newNote.title.trim()) {
      toast.error("Digite um título para a nota");
      return;
    }
    if (!newNote.fieldId) {
      toast.error("Selecione um campo");
      return;
    }
    
    createNote.mutate({
      ...newNote,
      photos: newNote.photos.length > 0 ? newNote.photos : undefined,
    });
  };

  // Filter notes by selected field
  const filteredNotes: Note[] = notes?.filter((note: Note) => 
    selectedFolder === "Todos os campos" || 
    fields?.find(f => f.id === note.fieldId)?.name === selectedFolder
  ) ?? [];

  return (
    <div className="min-h-screen bg-gray-100 pb-24">
      {/* Header */}
      <div className="bg-gray-100 sticky top-0 z-10 px-4 pt-4 pb-2">
        <h1 className="text-2xl font-bold text-gray-900">Notas</h1>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1 text-green-600 text-sm font-medium">
              <Folder className="h-4 w-4" />
              <span>{selectedFolder}</span>
              <ChevronDown className="h-3 w-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setSelectedFolder("Todos os campos")}>
              Todos os campos
            </DropdownMenuItem>
            {fields?.map(field => (
              <DropdownMenuItem 
                key={field.id} 
                onClick={() => setSelectedFolder(field.name)}
              >
                {field.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Content */}
      <div className="px-4 mt-4">
        {loadingNotes ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-green-600" />
          </div>
        ) : filteredNotes.length > 0 ? (
          <div className="space-y-3">
            {filteredNotes.map((note) => (
              <NoteCard key={note.id} note={note} fields={fields ?? []} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <FileText className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-gray-600 mb-6 max-w-xs mx-auto">
              Adicione notas durante as visitas ao campo ou quando quiser marcar um local importante no mapa.
            </p>
            <Button 
              className="bg-green-600 hover:bg-green-700 text-white font-semibold rounded-full px-6"
              onClick={() => setShowCreateDialog(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar nota
            </Button>
          </div>
        )}
      </div>

      {/* FAB */}
      {filteredNotes.length > 0 && (
        <button
          onClick={() => setShowCreateDialog(true)}
          className="fixed bottom-24 right-4 w-14 h-14 bg-green-600 text-white rounded-full shadow-lg flex items-center justify-center z-20"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      {/* Create Note Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Nota</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="field">Campo</Label>
              <Select
                value={newNote.fieldId.toString()}
                onValueChange={(v) => setNewNote(prev => ({ ...prev, fieldId: parseInt(v) }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um campo" />
                </SelectTrigger>
                <SelectContent>
                  {fields?.map(field => (
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
                placeholder="Ex: Praga detectada, Solo úmido..."
                value={newNote.title}
                onChange={(e) => setNewNote(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="type">Tipo</Label>
              <Select
                value={newNote.noteType}
                onValueChange={(v) => setNewNote(prev => ({ ...prev, noteType: v as NoteType }))}
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
            
            <div className="space-y-2">
              <Label htmlFor="content">Descrição</Label>
              <Textarea
                id="content"
                placeholder="Descreva a nota..."
                rows={3}
                value={newNote.content}
                onChange={(e) => setNewNote(prev => ({ ...prev, content: e.target.value }))}
              />
            </div>
            
            {/* Photos */}
            <div className="space-y-2">
              <Label>Fotos</Label>
              <div className="flex flex-wrap gap-2">
                {newNote.photos.map((photo, index) => (
                  <div key={index} className="relative w-20 h-20">
                    <img 
                      src={photo} 
                      alt={`Foto ${index + 1}`}
                      className="w-full h-full object-cover rounded-lg"
                    />
                    <button
                      onClick={() => removePhoto(index)}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 hover:border-green-500 hover:text-green-500 transition-colors"
                  disabled={uploadPhoto.isPending}
                >
                  {uploadPhoto.isPending ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <Camera className="h-6 w-6" />
                  )}
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handlePhotoSelect}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleCreateNote}
              disabled={createNote.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {createNote.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar Nota"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Note Card Component
function NoteCard({ note, fields }: { note: any; fields: any[] }) {
  const field = fields.find(f => f.id === note.fieldId);
  const photos = note.photos ? (typeof note.photos === 'string' ? JSON.parse(note.photos) : note.photos) : [];
  
  const typeLabels: Record<string, string> = {
    observation: "Observação",
    problem: "Problema",
    task: "Tarefa",
    harvest: "Colheita",
    application: "Aplicação",
  };
  
  const typeColors: Record<string, string> = {
    observation: "bg-blue-100 text-blue-700",
    problem: "bg-red-100 text-red-700",
    task: "bg-yellow-100 text-yellow-700",
    harvest: "bg-green-100 text-green-700",
    application: "bg-purple-100 text-purple-700",
  };
  
  return (
    <div className="bg-white rounded-2xl p-4">
      <div className="flex items-start gap-3">
        {photos.length > 0 && (
          <div className="w-16 h-16 rounded-xl bg-gray-200 overflow-hidden flex-shrink-0">
            <img src={photos[0]} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs px-2 py-0.5 rounded-full ${typeColors[note.noteType] || typeColors.observation}`}>
              {typeLabels[note.noteType] || "Observação"}
            </span>
          </div>
          <h3 className="font-semibold text-gray-900">{note.title}</h3>
          {note.content && (
            <p className="text-sm text-gray-500 line-clamp-2">{note.content}</p>
          )}
          <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
            {field && (
              <>
                <MapPin className="h-3 w-3" />
                <span>{field.name}</span>
                <span>•</span>
              </>
            )}
            <span>{new Date(note.createdAt).toLocaleDateString('pt-BR')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
