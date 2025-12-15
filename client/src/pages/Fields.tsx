import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { 
  Plus, 
  Search, 
  Leaf, 
  ChevronRight,
  Filter,
  ArrowUpDown,
  MoreVertical,
  Trash2,
  Edit,
  MapPin,
  TrendingUp,
  TrendingDown
} from "lucide-react";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";

type SortOption = "name" | "area" | "ndvi" | "recent";
type FilterOption = "all" | "healthy" | "attention" | "critical";

export default function Fields() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [filterBy, setFilterBy] = useState<FilterOption>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedField, setSelectedField] = useState<number | null>(null);

  const { data: fields, isLoading } = trpc.fields.list.useQuery();
  const deleteMutation = trpc.fields.delete.useMutation();
  const utils = trpc.useUtils();

  // Filtrar e ordenar campos
  const filteredFields = useMemo(() => {
    if (!fields) return [];

    let result = [...fields];

    // Filtro de busca
    if (searchQuery) {
      result = result.filter(f => 
        f.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filtro de saúde
    if (filterBy !== "all") {
      result = result.filter(f => {
        const ndvi = f.currentNdvi || 65;
        if (filterBy === "healthy") return ndvi >= 60;
        if (filterBy === "attention") return ndvi >= 40 && ndvi < 60;
        if (filterBy === "critical") return ndvi < 40;
        return true;
      });
    }

    // Ordenação
    result.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "area":
          return (b.areaHectares || 0) - (a.areaHectares || 0);
        case "ndvi":
          return (b.currentNdvi || 0) - (a.currentNdvi || 0);
        case "recent":
        default:
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }
    });

    return result;
  }, [fields, searchQuery, sortBy, filterBy]);

  const handleDelete = async (id: number) => {
    if (confirm("Tem certeza que deseja excluir este campo?")) {
      await deleteMutation.mutateAsync({ id });
      utils.fields.list.invalidate();
      setSelectedField(null);
    }
  };

  const getHealthColor = (ndvi: number) => {
    if (ndvi >= 60) return { bg: "bg-green-100", text: "text-green-700", bar: "bg-green-500" };
    if (ndvi >= 40) return { bg: "bg-yellow-100", text: "text-yellow-700", bar: "bg-yellow-500" };
    return { bg: "bg-red-100", text: "text-red-700", bar: "bg-red-500" };
  };

  const getHealthLabel = (ndvi: number) => {
    if (ndvi >= 60) return "Saudável";
    if (ndvi >= 40) return "Atenção";
    return "Crítico";
  };

  return (
    <div className="min-h-[100dvh] bg-gray-50 pb-[calc(80px+env(safe-area-inset-bottom))]">
      {/* Header */}
      <div 
        className="bg-white sticky top-0 z-20 border-b border-gray-100"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Meus Campos</h1>
            <button
              onClick={() => setLocation('/fields/new')}
              className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center shadow-md"
            >
              <Plus className="h-5 w-5 text-white" />
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar campos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-100 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1 -mx-4 px-4">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                showFilters ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
              }`}
            >
              <Filter className="h-4 w-4" />
              Filtros
            </button>
            
            {(['all', 'healthy', 'attention', 'critical'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setFilterBy(filter)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  filterBy === filter 
                    ? 'bg-green-500 text-white' 
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {filter === 'all' && 'Todos'}
                {filter === 'healthy' && '🟢 Saudável'}
                {filter === 'attention' && '🟡 Atenção'}
                {filter === 'critical' && '🔴 Crítico'}
              </button>
            ))}
          </div>
        </div>

        {/* Sort Options */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-gray-100"
            >
              <div className="px-4 py-3 bg-gray-50">
                <p className="text-xs text-gray-500 mb-2">Ordenar por</p>
                <div className="flex gap-2 flex-wrap">
                  {([
                    { value: 'recent', label: 'Mais recentes' },
                    { value: 'name', label: 'Nome' },
                    { value: 'area', label: 'Área' },
                    { value: 'ndvi', label: 'Saúde' },
                  ] as const).map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setSortBy(option.value)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        sortBy === option.value 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-white text-gray-600 border border-gray-200'
                      }`}
                    >
                      <ArrowUpDown className="h-3 w-3" />
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Fields List */}
      <div className="px-4 py-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-4 animate-pulse">
                <div className="flex gap-3">
                  <div className="w-16 h-16 bg-gray-200 rounded-xl" />
                  <div className="flex-1">
                    <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
                    <div className="h-4 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredFields.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MapPin className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {searchQuery ? 'Nenhum campo encontrado' : 'Nenhum campo cadastrado'}
            </h3>
            <p className="text-gray-500 mb-6">
              {searchQuery 
                ? 'Tente buscar por outro termo' 
                : 'Comece cadastrando seu primeiro campo para monitorar'}
            </p>
            {!searchQuery && (
              <Button onClick={() => setLocation('/fields/new')}>
                <Plus className="h-4 w-4 mr-2" />
                Cadastrar Campo
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredFields.map((field, index) => {
              const ndvi = field.currentNdvi || 65;
              const health = getHealthColor(ndvi);
              const isSelected = selectedField === field.id;

              return (
                <motion.div
                  key={field.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="relative"
                >
                  <button
                    onClick={() => setLocation(`/fields/${field.id}`)}
                    className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 active:scale-[0.98] transition-transform text-left"
                  >
                    <div className="flex gap-3">
                      {/* Field Icon */}
                      <div className={`w-16 h-16 ${health.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                        <Leaf className={`h-8 w-8 ${health.text}`} />
                      </div>

                      {/* Field Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <h3 className="font-semibold text-gray-900 truncate pr-2">
                            {field.name}
                          </h3>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedField(isSelected ? null : field.id);
                            }}
                            className="w-8 h-8 -mr-2 flex items-center justify-center"
                          >
                            <MoreVertical className="h-4 w-4 text-gray-400" />
                          </button>
                        </div>
                        
                        <p className="text-sm text-gray-500 mt-0.5">
                          {field.areaHectares ? `${field.areaHectares} ha` : 'Área não definida'}
                          {field.crop && ` • ${field.crop}`}
                        </p>

                        {/* Health Bar */}
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className={`font-medium ${health.text}`}>
                              {getHealthLabel(ndvi)}
                            </span>
                            <span className="text-gray-500">NDVI: {(ndvi / 100).toFixed(2)}</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${health.bar} rounded-full transition-all`}
                              style={{ width: `${ndvi}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Trend indicator */}
                    {field.ndviTrend && (
                      <div className="absolute top-3 right-10 flex items-center gap-0.5">
                        {field.ndviTrend > 0 ? (
                          <TrendingUp className="h-3 w-3 text-green-500" />
                        ) : (
                          <TrendingDown className="h-3 w-3 text-red-500" />
                        )}
                      </div>
                    )}
                  </button>

                  {/* Actions Menu */}
                  <AnimatePresence>
                    {isSelected && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="absolute top-12 right-4 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-10"
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setLocation(`/fields/${field.id}/edit`);
                          }}
                          className="flex items-center gap-2 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 w-full"
                        >
                          <Edit className="h-4 w-4" />
                          Editar
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(field.id);
                          }}
                          className="flex items-center gap-2 px-4 py-3 text-sm text-red-600 hover:bg-red-50 w-full border-t border-gray-100"
                        >
                          <Trash2 className="h-4 w-4" />
                          Excluir
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Summary */}
        {fields && fields.length > 0 && (
          <div className="mt-6 bg-green-50 rounded-2xl p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-green-700">{fields.length}</p>
                <p className="text-xs text-green-600">Campos</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-700">
                  {fields.reduce((acc: number, f: any) => acc + (f.areaHectares || 0), 0).toFixed(1)}
                </p>
                <p className="text-xs text-green-600">Hectares</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-700">
                  {(fields.reduce((acc: number, f: any) => acc + (f.currentNdvi || 65), 0) / fields.length / 100).toFixed(2)}
                </p>
                <p className="text-xs text-green-600">NDVI Médio</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
