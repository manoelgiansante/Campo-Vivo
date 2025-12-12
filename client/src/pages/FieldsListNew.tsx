// @ts-nocheck
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { 
  Folder, 
  ChevronDown, 
  Search, 
  Plus,
  MoreVertical,
  Leaf,
  Satellite,
  Wheat,
  Loader2,
  Building2,
  X
} from "lucide-react";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
// @ts-nocheck
import { trpc } from "@/lib/trpc";

type MapLayer = "satellite" | "crop" | "vegetation";

// NDVI Gradient Component
function NdviGradient({ value, className = "" }: { value: number; className?: string }) {
  const percentage = Math.min(Math.max(value, 0), 1) * 100;
  
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative w-16 h-2 rounded-full overflow-hidden">
        <div 
          className="absolute inset-0"
          style={{
            background: "linear-gradient(to right, #d73027, #fc8d59, #fee08b, #d9ef8b, #91cf60, #1a9850)"
          }}
        />
        <div 
          className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-black"
          style={{ left: `${percentage}%` }}
        />
      </div>
      <span className="text-sm font-medium text-gray-900">{value.toFixed(2)}</span>
    </div>
  );
}

// Field Card Component
function FieldCard({
  field,
  ndviValue,
  onClick
}: {
  field: { id: number; name: string; areaHectares?: number | null };
  ndviValue: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 bg-white rounded-2xl hover:bg-gray-50 transition-colors"
    >
      {/* Thumbnail */}
      <div className="w-16 h-16 rounded-xl bg-gray-200 overflow-hidden flex-shrink-0">
        <div className="w-full h-full bg-gradient-to-br from-green-600 to-green-800 flex items-center justify-center">
          <Leaf className="h-6 w-6 text-white/60" />
        </div>
      </div>
      
      {/* Info */}
      <div className="flex-1 text-left">
        <h3 className="font-semibold text-gray-900">{field.name}</h3>
        <p className="text-sm text-gray-500">{(field.areaHectares ?? 0).toFixed(1)} ha</p>
      </div>
      
      {/* NDVI */}
      <NdviGradient value={ndviValue} />
    </button>
  );
}

export default function FieldsListNew() {
  const [, setLocation] = useLocation();
  const [showLayerSheet, setShowLayerSheet] = useState(false);
  const [mapLayer, setMapLayer] = useState<MapLayer>("vegetation");
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch real data from API
  const { data: fieldsData, isLoading: loadingFields } = trpc.fields.list.useQuery();
  
  // Campos com valores processados
  const fields = fieldsData ?? [];
  const fieldIds = fields.map(f => f.id);
  
  // Usar batch query para buscar NDVI de todos os campos de uma vez
  const { data: ndviBatchData } = trpc.ndvi.getLatestBatch.useQuery(
    { fieldIds },
    { enabled: fieldIds.length > 0 }
  );
  
  const ndviByFieldId = useMemo(() => {
    const map: Record<number, number> = {};
    fields.forEach(field => {
      const ndviData = ndviBatchData?.[field.id];
      map[field.id] = ndviData?.ndviAverage ?? 0.5;
    });
    return map;
  }, [fields, ndviBatchData]);
  
  const totalArea = fields.reduce((sum, f) => sum + (f.areaHectares ?? 0), 0);

  // Filtrar campos pela busca
  const filteredFields = useMemo(() => {
    if (!searchQuery.trim()) return fields;
    const query = searchQuery.toLowerCase();
    return fields.filter(field => 
      field.name.toLowerCase().includes(query) ||
      field.city?.toLowerCase().includes(query) ||
      field.state?.toLowerCase().includes(query)
    );
  }, [fields, searchQuery]);

  const getLayerLabel = () => {
    switch (mapLayer) {
      case "satellite": return "Satélite";
      case "crop": return "Cultivo";
      case "vegetation": return "Vegetação";
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-gray-100 sticky top-0 z-10 px-4 pt-4 pb-2">
        {showSearch ? (
          /* Search Bar */
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Buscar campo por nome, cidade..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10"
                autoFocus
              />
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-10 w-10"
              onClick={() => {
                setShowSearch(false);
                setSearchQuery("");
              }}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        ) : (
          /* Normal Header */
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Campos</h1>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1 text-green-600 text-sm font-medium">
                    <Folder className="h-4 w-4" />
                    <span>Todos os campos</span>
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem>Todos os campos</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setLocation("/farms")}>
                    <Building2 className="h-4 w-4 mr-2" />
                    Gerenciar Fazendas
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-10 w-10"
                onClick={() => setShowSearch(true)}
              >
                <Search className="h-5 w-5" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-10 w-10"
                onClick={() => setLocation("/fields/new")}
              >
                <Plus className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-10 w-10">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-4 pb-32">
        {/* Group Header */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
          <span className="font-medium text-gray-700">
            {searchQuery ? `${filteredFields.length} resultado(s)` : "Sem grupos"}
          </span>
          <span>{totalArea.toFixed(1)} ha</span>
        </div>

        {/* Loading State */}
        {loadingFields && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-green-600" />
          </div>
        )}

        {/* Fields List */}
        {!loadingFields && filteredFields.length > 0 ? (
          <div className="space-y-2">
            {filteredFields.map((field) => (
              <FieldCard
                key={field.id}
                field={field}
                ndviValue={ndviByFieldId[field.id] ?? 0.5}
                onClick={() => setLocation(`/fields/${field.id}`)}
              />
            ))}
          </div>
        ) : !loadingFields && searchQuery && filteredFields.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <Search className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Nenhum campo encontrado</h3>
            <p className="text-gray-500 text-sm">
              Nenhum campo corresponde a "{searchQuery}"
            </p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => setSearchQuery("")}
            >
              Limpar busca
            </Button>
          </div>
        ) : !loadingFields && fields.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <Leaf className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Nenhum campo ainda</h3>
            <p className="text-sm text-gray-500 mb-4">
              Adicione seu primeiro campo para começar o monitoramento
            </p>
            <Button
              onClick={() => setLocation("/fields/new")}
              className="bg-green-600 hover:bg-green-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar campo
            </Button>
          </div>
        ) : null}
      </div>

      {/* Layer Button (floating) */}
      <button
        onClick={() => setShowLayerSheet(true)}
        className="fixed bottom-24 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-gray-900 text-white px-5 py-3 rounded-full shadow-lg"
      >
        <Leaf className="h-5 w-5" />
        <span className="font-medium">{getLayerLabel()}</span>
      </button>

      {/* Layer Selection Sheet */}
      <Sheet open={showLayerSheet} onOpenChange={setShowLayerSheet}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader className="pb-4">
            <SheetTitle className="text-left">Camada do mapa</SheetTitle>
          </SheetHeader>
          
          {/* Layer Types */}
          <div className="flex gap-3 mb-6">
            <LayerOption
              icon={<Satellite className="h-6 w-6" />}
              label="Imagem de satélite"
              selected={mapLayer === "satellite"}
              onClick={() => setMapLayer("satellite")}
              bgColor="bg-green-100"
            />
            <LayerOption
              icon={<Wheat className="h-6 w-6" />}
              label="Cultivo"
              selected={mapLayer === "crop"}
              onClick={() => setMapLayer("crop")}
              bgColor="bg-blue-100"
            />
            <LayerOption
              icon={<Leaf className="h-6 w-6" />}
              label="Vegetação"
              selected={mapLayer === "vegetation"}
              onClick={() => setMapLayer("vegetation")}
              bgColor="bg-lime-100"
            />
          </div>

          {/* NDVI Types */}
          {mapLayer === "vegetation" && (
            <div className="space-y-1">
              <NdviOption label="NDVI Básico" selected={true} onClick={() => {}} />
              <NdviOption label="NDVI Contrastado" selected={false} onClick={() => {}} />
              <NdviOption label="NDVI Médio" selected={false} onClick={() => {}} />
              <NdviOption label="NDVI Heterogeneidade" selected={false} onClick={() => {}} />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// Layer Option Component
function LayerOption({
  icon,
  label,
  selected,
  onClick,
  bgColor
}: {
  icon: React.ReactNode;
  label: string;
  selected: boolean;
  onClick: () => void;
  bgColor: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all ${
        selected ? "ring-2 ring-gray-900 ring-offset-2" : ""
      }`}
    >
      <div className={`w-16 h-16 rounded-xl ${bgColor} flex items-center justify-center`}>
        {icon}
      </div>
      <span className="text-xs text-gray-700 text-center">{label}</span>
    </button>
  );
}

// NDVI Option Component
function NdviOption({
  label,
  selected,
  onClick
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 rounded-xl transition-colors ${
        selected ? "bg-gray-100 font-medium" : "hover:bg-gray-50"
      }`}
    >
      {label}
    </button>
  );
}
