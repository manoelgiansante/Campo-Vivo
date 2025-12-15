import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { 
  Plus, 
  Search, 
  StickyNote,
  Calendar,
  Filter,
  ChevronDown,
  X,
  Camera,
  Mic,
  MapPin,
  AlertCircle,
  CheckCircle,
  Clock
} from "lucide-react";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

type FilterType = "all" | "observation" | "problem" | "task" | "harvest" | "application";
type SeverityType = "all" | "low" | "medium" | "high";

export default function Notes() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [filterSeverity, setFilterSeverity] = useState<SeverityType>("all");
  const [showNewNote, setShowNewNote] = useState(false);

  const { data: notes, isLoading } = trpc.notes.listAll.useQuery();
  const { data: fields } = trpc.fields.list.useQuery();

  // Filtrar notas
  const filteredNotes = useMemo(() => {
    if (!notes) return [];

    return notes.filter((note: any) => {
      if (searchQuery && !note.title.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (filterType !== "all" && note.noteType !== filterType) {
        return false;
      }
      if (filterSeverity !== "all" && note.severity !== filterSeverity) {
        return false;
      }
      return true;
    });
  }, [notes, searchQuery, filterType, filterSeverity]);

  // Agrupar por data
  const groupedNotes = useMemo(() => {
    const groups: { [key: string]: typeof filteredNotes } = {};
    
    filteredNotes.forEach((note: any) => {
      const date = new Date(note.createdAt);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let key: string;
      if (date.toDateString() === today.toDateString()) {
        key = "Hoje";
      } else if (date.toDateString() === yesterday.toDateString()) {
        key = "Ontem";
      } else {
        key = date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
      }

      if (!groups[key]) groups[key] = [];
      groups[key].push(note);
    });

    return groups;
  }, [filteredNotes]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return { bg: 'bg-red-100', text: 'text-red-700', icon: AlertCircle };
      case 'medium': return { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: Clock };
      case 'low': return { bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle };
      default: return { bg: 'bg-gray-100', text: 'text-gray-700', icon: StickyNote };
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'observation': return '📝 Observação';
      case 'problem': return '⚠️ Problema';
      case 'task': return '✅ Tarefa';
      case 'harvest': return '🌾 Colheita';
      case 'application': return '💧 Aplicação';
      default: return '📝 Nota';
    }
  };

  return (
    <div 
      className="min-h-[100dvh] bg-gray-50"
      style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}
    >
      {/* Header */}
      <div 
        className="bg-white sticky top-0 z-20 border-b border-gray-100"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Notas</h1>
            <button
              onClick={() => setShowNewNote(true)}
              className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center shadow-md"
            >
              <Plus className="h-5 w-5 text-white" />
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar notas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-100 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1 -mx-4 px-4">
            {([
              { value: 'all', label: 'Todas' },
              { value: 'observation', label: '📝 Observação' },
              { value: 'problem', label: '⚠️ Problema' },
              { value: 'task', label: '✅ Tarefa' },
              { value: 'harvest', label: '🌾 Colheita' },
            ] as const).map((filter) => (
              <button
                key={filter.value}
                onClick={() => setFilterType(filter.value)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  filterType === filter.value 
                    ? 'bg-green-500 text-white' 
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Notes List */}
      <div className="px-4 py-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-4 animate-pulse">
                <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-4 bg-gray-200 rounded w-full mb-2" />
                <div className="h-4 bg-gray-200 rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : Object.keys(groupedNotes).length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <StickyNote className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {searchQuery ? 'Nenhuma nota encontrada' : 'Nenhuma nota ainda'}
            </h3>
            <p className="text-gray-500 mb-6">
              {searchQuery 
                ? 'Tente buscar por outro termo' 
                : 'Crie sua primeira nota para começar a documentar'}
            </p>
            {!searchQuery && (
              <button 
                onClick={() => setShowNewNote(true)}
                className="bg-green-500 text-white px-6 py-3 rounded-xl font-semibold"
              >
                <Plus className="h-4 w-4 inline mr-2" />
                Criar Nota
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedNotes).map(([date, dateNotes]) => (
              <div key={date}>
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <h3 className="text-sm font-medium text-gray-500">{date}</h3>
                </div>

                <div className="space-y-3">
                  {dateNotes.map((note: any, index: number) => {
                    const severity = getSeverityColor(note.severity);
                    const SeverityIcon = severity.icon;
                    const fieldName = fields?.find((f: any) => f.id === note.fieldId)?.name;

                    return (
                      <motion.button
                        key={note.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        onClick={() => note.fieldId && setLocation(`/fields/${note.fieldId}`)}
                        className="w-full bg-white rounded-2xl p-4 shadow-sm text-left active:scale-[0.98] transition-transform"
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 ${severity.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                            <SeverityIcon className={`h-5 w-5 ${severity.text}`} />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="font-semibold text-gray-900 truncate">
                                {note.title}
                              </h4>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${severity.bg} ${severity.text} flex-shrink-0`}>
                                {note.severity === 'high' ? 'Alta' : note.severity === 'medium' ? 'Média' : 'Baixa'}
                              </span>
                            </div>
                            
                            <p className="text-sm text-gray-500 line-clamp-2 mt-1">
                              {note.content}
                            </p>

                            <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                              {note.noteType && (
                                <span>{getTypeLabel(note.noteType)}</span>
                              )}
                              {fieldName && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {fieldName}
                                </span>
                              )}
                              {note.images?.length > 0 && (
                                <span className="flex items-center gap-1">
                                  <Camera className="h-3 w-3" />
                                  {note.images.length}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Note Modal */}
      <AnimatePresence>
        {showNewNote && (
          <NewNoteModal 
            fields={fields || []}
            onClose={() => setShowNewNote(false)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function NewNoteModal({ 
  fields, 
  onClose 
}: { 
  fields: any[];
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState<string>("observation");
  const [severity, setSeverity] = useState<"low" | "medium" | "high" | "critical">("low");
  const [fieldId, setFieldId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const createMutation = trpc.notes.create.useMutation({
    onSuccess: () => {
      utils.notes.listAll.invalidate();
      onClose();
    }
  });

  const handleSubmit = () => {
    if (!title.trim() || !fieldId) return;
    
    createMutation.mutate({
      title,
      content,
      noteType: type as "observation" | "problem" | "task" | "harvest" | "application",
      severity,
      fieldId,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25 }}
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl max-h-[90vh] overflow-auto"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-4 flex items-center justify-between">
          <button onClick={onClose} className="text-gray-500">
            Cancelar
          </button>
          <h3 className="font-semibold text-gray-900">Nova Nota</h3>
          <button 
            onClick={handleSubmit}
            disabled={!title.trim() || createMutation.isPending}
            className="text-green-600 font-semibold disabled:opacity-50"
          >
            {createMutation.isPending ? 'Salvando...' : 'Salvar'}
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Title */}
          <input
            type="text"
            placeholder="Título da nota"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full text-xl font-semibold text-gray-900 placeholder-gray-400 focus:outline-none"
          />

          {/* Content */}
          <textarea
            placeholder="Descreva o que você observou..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            className="w-full text-gray-700 placeholder-gray-400 focus:outline-none resize-none"
          />

          {/* Field Selector */}
          <div>
            <label className="text-sm font-medium text-gray-500 block mb-2">Campo</label>
            <select
              value={fieldId || ''}
              onChange={(e) => setFieldId(e.target.value ? Number(e.target.value) : null)}
              className="w-full bg-gray-100 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">Nenhum campo selecionado</option>
              {fields.map((field) => (
                <option key={field.id} value={field.id}>{field.name}</option>
              ))}
            </select>
          </div>

          {/* Type */}
          <div>
            <label className="text-sm font-medium text-gray-500 block mb-2">Tipo</label>
            <div className="flex gap-2 flex-wrap">
              {[
                { value: 'observation', label: '📝 Observação' },
                { value: 'problem', label: '⚠️ Problema' },
                { value: 'task', label: '✅ Tarefa' },
                { value: 'harvest', label: '🌾 Colheita' },
                { value: 'application', label: '💧 Aplicação' },
              ].map((t) => (
                <button
                  key={t.value}
                  onClick={() => setType(t.value)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                    type === t.value 
                      ? 'bg-green-100 text-green-700 border-2 border-green-500' 
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Severity */}
          <div>
            <label className="text-sm font-medium text-gray-500 block mb-2">Prioridade</label>
            <div className="flex gap-2">
              {[
                { value: 'low', label: 'Baixa' },
                { value: 'medium', label: 'Média' },
                { value: 'high', label: 'Alta' },
                { value: 'critical', label: 'Crítica' },
              ].map((s) => (
                <button
                  key={s.value}
                  onClick={() => setSeverity(s.value as "low" | "medium" | "high" | "critical")}
                  className={`flex-1 py-3 rounded-xl text-sm font-medium transition-colors ${
                    severity === s.value 
                      ? s.value === 'low' ? 'bg-green-100 text-green-700 border-2 border-green-500'
                        : s.value === 'medium' ? 'bg-yellow-100 text-yellow-700 border-2 border-yellow-500'
                        : s.value === 'high' ? 'bg-orange-100 text-orange-700 border-2 border-orange-500'
                        : 'bg-red-100 text-red-700 border-2 border-red-500'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Attachments */}
          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <button className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-100 rounded-xl text-gray-700 font-medium">
              <Camera className="h-5 w-5" />
              Foto
            </button>
            <button className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-100 rounded-xl text-gray-700 font-medium">
              <Mic className="h-5 w-5" />
              Áudio
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
