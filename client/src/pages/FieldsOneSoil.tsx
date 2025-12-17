import { trpc } from "@/lib/trpc";
import { MapboxMap, useMapbox } from "@/components/MapboxMap";
import { useNdviOverlay } from "@/hooks/useNdviOverlay";
import { clipImageToPolygon, generateClippedNdviGradient } from "@/utils/clipImageToPolygon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { AddCropDialog } from "@/components/AddCropDialog";
import { NdviChartOneSoil } from "@/components/charts/NdviChartOneSoil";

import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  Maximize2,
  Download,
  Leaf,
  CloudRain,
  Thermometer,
  Wind,
  Calendar,
  Search,
  Plus,
  Settings,
  Map,
  Layers,
  BarChart3,
  FileText,
  Users,
  Cloud,
  Check,
  MoreVertical,
} from "lucide-react";
import { useState, useCallback, useEffect, useMemo } from "react";
import { format, subDays, startOfYear, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import mapboxgl from "mapbox-gl";

// Componente para thumbnail do polígono com preenchimento NDVI
function FieldThumbnail({ boundaries, ndviValue, size = 48 }: { boundaries: any; ndviValue?: number; size?: number }) {
  const coords = useMemo(() => {
    try {
      const parsed = typeof boundaries === "string" ? JSON.parse(boundaries) : boundaries;
      if (!Array.isArray(parsed) || parsed.length < 3) return null;
      
      const lngs = parsed.map((p: any) => p.lng);
      const lats = parsed.map((p: any) => p.lat);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      
      const padding = 4;
      const scale = (size - padding * 2) / Math.max(maxLng - minLng, maxLat - minLat);
      
      return parsed.map((p: any) => ({
        x: padding + (p.lng - minLng) * scale,
        y: padding + (maxLat - p.lat) * scale,
      }));
    } catch {
      return null;
    }
  }, [boundaries, size]);

  // Calcular cor baseada no NDVI
  const fillColor = useMemo(() => {
    const ndvi = ndviValue ?? 0.5;
    if (ndvi >= 0.6) return "#22c55e"; // Verde
    if (ndvi >= 0.4) return "#84cc16"; // Verde-amarelo
    if (ndvi >= 0.2) return "#eab308"; // Amarelo
    return "#ef4444"; // Vermelho
  }, [ndviValue]);

  if (!coords) {
    return (
      <div 
        className="bg-gray-100 rounded flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <Map className="h-4 w-4 text-gray-400" />
      </div>
    );
  }

  const pathD = coords.map((c: any, i: number) => 
    `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`
  ).join(' ') + ' Z';

  return (
    <svg width={size} height={size} className="bg-gray-50 rounded">
      <defs>
        <linearGradient id={`ndvi-gradient-${size}`} x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor={fillColor} stopOpacity="0.8" />
          <stop offset="100%" stopColor={fillColor} stopOpacity="0.4" />
        </linearGradient>
      </defs>
      <path 
        d={pathD} 
        fill={`url(#ndvi-gradient-${size})`}
        stroke="#374151" 
        strokeWidth="1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function FieldsOneSoil() {
  
  const [selectedFieldId, setSelectedFieldId] = useState<number | null>(null);
  const [selectedFields, setSelectedFields] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [ndviMapInstance, setNdviMapInstance] = useState<mapboxgl.Map | null>(null);
  const [satMapInstance, setSatMapInstance] = useState<mapboxgl.Map | null>(null);
  const [showAddCropDialog, setShowAddCropDialog] = useState(false);
  const { setMap } = useMapbox();
  const { removeAllOverlays, calculateBoundsFromPolygon } = useNdviOverlay();

  const { data: fields, isLoading } = trpc.fields.list.useQuery();
  const { data: selectedField } = trpc.fields.getById.useQuery(
    { id: selectedFieldId! },
    { enabled: !!selectedFieldId }
  );
  const { data: ndviHistory } = trpc.ndvi.history.useQuery(
    { fieldId: selectedFieldId!, days: 365, maxCloudCoverage: 30 },
    { enabled: !!selectedFieldId }
  );
  const { data: fieldCrops } = trpc.crops.listByField.useQuery(
    { fieldId: selectedFieldId! },
    { enabled: !!selectedFieldId }
  );

  // Calcular centro do campo para buscar clima
  const fieldCenter = useMemo(() => {
    if (!selectedField?.boundaries) return [-49.5, -20.8] as [number, number];
    const bounds = typeof selectedField.boundaries === "string"
      ? JSON.parse(selectedField.boundaries)
      : selectedField.boundaries;
    if (Array.isArray(bounds) && bounds.length > 0) {
      const lngs = bounds.map((p: any) => p.lng);
      const lats = bounds.map((p: any) => p.lat);
      return [
        (Math.min(...lngs) + Math.max(...lngs)) / 2,
        (Math.min(...lats) + Math.max(...lats)) / 2,
      ] as [number, number];
    }
    return [-49.5, -20.8] as [number, number];
  }, [selectedField?.boundaries]);

  // Buscar dados de clima real baseado na localização do campo
  const { data: weatherData } = trpc.weather.forecast.useQuery(
    { 
      lat: fieldCenter[1], 
      lon: fieldCenter[0] 
    },
    { enabled: !!selectedField && fieldCenter[0] !== -49.5 }
  );

  const proxyImageUrl = useMemo(() => 
    selectedFieldId ? `/api/copernicus-ndvi/${selectedFieldId}?palette=onesoil` : null
  , [selectedFieldId]);

  const filteredFields = useMemo(() => {
    if (!fields) return [];
    if (!searchQuery) return fields;
    return fields.filter((f: any) => 
      f.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [fields, searchQuery]);

  const totalArea = useMemo(() => {
    if (!fields) return 0;
    return fields.reduce((sum: number, f: any) => sum + (f.areaHectares || 0), 0) / 100;
  }, [fields]);

  // Dados formatados para o gráfico NDVI (NdviChartOneSoil espera {date: string, ndvi: number})
  const ndviChartData = useMemo(() => {
    // Usar dados reais do Copernicus se disponíveis
    if (ndviHistory && ndviHistory.length > 0) {
      return ndviHistory
        .filter((d: any) => d.ndvi != null && d.ndvi > 0)
        .map((d: any) => ({
          date: typeof d.date === 'string' ? d.date : new Date(d.date).toISOString().split('T')[0],
          ndvi: d.ndvi || d.value || 0
        }))
        .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }
    // Retornar array vazio se não houver dados
    return [];
  }, [ndviHistory]);

  const toggleFieldSelection = (fieldId: number) => {
    const newSelected = new Set(selectedFields);
    if (newSelected.has(fieldId)) {
      newSelected.delete(fieldId);
    } else {
      newSelected.add(fieldId);
    }
    setSelectedFields(newSelected);
  };

  // Draw NDVI overlay on map
  useEffect(() => {
    if (!ndviMapInstance || !selectedField?.boundaries) return;

    const drawNdviOverlay = async () => {
      try {
        const boundaries = typeof selectedField.boundaries === "string"
          ? JSON.parse(selectedField.boundaries)
          : selectedField.boundaries;

        if (!Array.isArray(boundaries) || boundaries.length < 3) return;

        const coordinates = boundaries.map((p: { lat: number; lng: number }) =>
          [p.lng, p.lat] as [number, number]
        );
        if (coordinates[0][0] !== coordinates[coordinates.length - 1][0] ||
            coordinates[0][1] !== coordinates[coordinates.length - 1][1]) {
          coordinates.push(coordinates[0]);
        }

        // Remove existing layers
        ["ndvi-overlay", "ndvi-outline", "ndvi-image"].forEach(id => {
          if (ndviMapInstance.getLayer(id)) ndviMapInstance.removeLayer(id);
          if (ndviMapInstance.getSource(id)) ndviMapInstance.removeSource(id);
        });

        const lngs = coordinates.map(c => c[0]);
        const lats = coordinates.map(c => c[1]);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);

        // Bounds for image positioning
        const boundsArray = calculateBoundsFromPolygon(coordinates);
        let ndviLoaded = false;

        if (proxyImageUrl) {
          try {
            // Usar a imagem NDVI diretamente do Copernicus (já vem recortada)
            // Adicionar timestamp para evitar cache
            const imageUrl = proxyImageUrl + "&t=" + Date.now();
            
            ndviMapInstance.addSource("ndvi-image", {
              type: "image",
              url: imageUrl,
              coordinates: boundsArray,
            });

            ndviMapInstance.addLayer({
              id: "ndvi-image",
              type: "raster",
              source: "ndvi-image",
              paint: { "raster-opacity": 0.95 },
            });
            ndviLoaded = true;
            console.log("[NDVI] Imagem Copernicus carregada com sucesso");
          } catch (e) {
            console.warn("Falha ao carregar imagem NDVI:", e);
          }
        }

        // Fallback: usar gradiente sintético recortado pelo polígono
        if (!ndviLoaded) {
          const bounds = { minLng, maxLng, minLat, maxLat };
          const ndviValue = selectedField.currentNdvi ? selectedField.currentNdvi / 100 : 0.65;
          const gradientUrl = generateClippedNdviGradient(ndviValue, coordinates, bounds);
          
          ndviMapInstance.addSource("ndvi-image", {
            type: "image",
            url: gradientUrl,
            coordinates: boundsArray,
          });

          ndviMapInstance.addLayer({
            id: "ndvi-image",
            type: "raster",
            source: "ndvi-image",
            paint: { "raster-opacity": 1.0 },
          });
        }

        // Add outline
        ndviMapInstance.addSource("ndvi-outline", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "Polygon", coordinates: [coordinates] },
          },
        });

        ndviMapInstance.addLayer({
          id: "ndvi-outline",
          type: "line",
          source: "ndvi-outline",
          paint: { "line-color": "#ffffff", "line-width": 2 },
        });

        // Fit bounds
        const mapBounds = new mapboxgl.LngLatBounds([minLng, minLat], [maxLng, maxLat]);
        ndviMapInstance.fitBounds(mapBounds, { padding: 40 });
      } catch (e) {
        console.error("Error drawing NDVI:", e);
      }
    };

    if (ndviMapInstance.isStyleLoaded()) drawNdviOverlay();
    else ndviMapInstance.on("style.load", drawNdviOverlay);
  }, [ndviMapInstance, selectedField, proxyImageUrl, calculateBoundsFromPolygon]);

  // Draw satellite map
  useEffect(() => {
    if (!satMapInstance || !selectedField?.boundaries) return;

    const drawSatellite = async () => {
      try {
        const boundaries = typeof selectedField.boundaries === "string"
          ? JSON.parse(selectedField.boundaries)
          : selectedField.boundaries;

        if (!Array.isArray(boundaries) || boundaries.length < 3) return;

        const coordinates = boundaries.map((p: { lat: number; lng: number }) =>
          [p.lng, p.lat] as [number, number]
        );
        if (coordinates[0][0] !== coordinates[coordinates.length - 1][0] ||
            coordinates[0][1] !== coordinates[coordinates.length - 1][1]) {
          coordinates.push(coordinates[0]);
        }

        ["sat-outline"].forEach(id => {
          if (satMapInstance.getLayer(id)) satMapInstance.removeLayer(id);
          if (satMapInstance.getSource(id)) satMapInstance.removeSource(id);
        });

        const lngs = coordinates.map(c => c[0]);
        const lats = coordinates.map(c => c[1]);

        satMapInstance.addSource("sat-outline", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "Polygon", coordinates: [coordinates] },
          },
        });

        satMapInstance.addLayer({
          id: "sat-outline",
          type: "line",
          source: "sat-outline",
          paint: { "line-color": "#000000", "line-width": 2 },
        });

        const bounds = new mapboxgl.LngLatBounds(
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)]
        );
        satMapInstance.fitBounds(bounds, { padding: 40 });
      } catch (e) {
        console.error("Error drawing satellite:", e);
      }
    };

    if (satMapInstance.isStyleLoaded()) drawSatellite();
    else satMapInstance.on("style.load", drawSatellite);
  }, [satMapInstance, selectedField]);

  const handleNdviMapReady = useCallback((map: mapboxgl.Map) => {
    setNdviMapInstance(map);
    setMap(map);
  }, [setMap]);

  const handleSatMapReady = useCallback((map: mapboxgl.Map) => {
    setSatMapInstance(map);
  }, []);

  const currentNdviValue = selectedField?.currentNdvi 
    ? (selectedField.currentNdvi / 100).toFixed(2) 
    : "0.59";

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Sidebar - Coluna 1 */}
      <div className="w-14 bg-[#1f2937] flex flex-col items-center py-4 gap-4">
        <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
          <Leaf className="h-5 w-5 text-white" />
        </div>
        
        <div className="flex-1 flex flex-col items-center gap-3 mt-4">
          <button className="w-10 h-10 rounded-lg hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white">
            <Calendar className="h-5 w-5" />
          </button>
          <button className="w-10 h-10 rounded-lg hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white">
            <Layers className="h-5 w-5" />
          </button>
          <button className="w-10 h-10 rounded-lg hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white">
            <Map className="h-5 w-5" />
          </button>
          <button className="w-10 h-10 rounded-lg hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white">
            <BarChart3 className="h-5 w-5" />
          </button>
          <button className="w-10 h-10 rounded-lg hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white">
            <FileText className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-3">
          <button className="w-10 h-10 rounded-lg hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white">
            <Settings className="h-5 w-5" />
          </button>
          <button className="w-10 h-10 rounded-lg hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white">
            <Users className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Lista de Campos - Coluna 2 */}
      <div className="w-72 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-semibold text-gray-900">Meus talhões</h2>
            <span className="text-xs text-gray-500">Proprietário</span>
          </div>
        </div>

        {/* Season Selector */}
        <div className="px-4 py-3 border-b border-gray-100">
          <button className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Calendar className="h-4 w-4" />
            Safra 2025
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>

        {/* Search & Filter */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
          <Button variant="ghost" size="sm" className="text-xs text-gray-500">
            Classificar
          </Button>
        </div>

        {/* Total Area */}
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Talhões não processados</span>
            <span className="text-gray-700 font-medium">{totalArea.toFixed(1)} ha</span>
          </div>
        </div>

        {/* Fields List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="w-12 h-12 rounded" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-24 mb-1" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div>
              {filteredFields.map((field: any) => (
                <div
                  key={field.id}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 border-b border-gray-50 ${
                    selectedFieldId === field.id ? "bg-blue-50" : ""
                  }`}
                  onClick={() => setSelectedFieldId(field.id)}
                >
                  <FieldThumbnail boundaries={field.boundaries} ndviValue={field.currentNdvi ? field.currentNdvi / 100 : 0.5} size={48} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{field.name}</p>
                    <p className="text-xs text-gray-500">
                      {field.areaHectares ? `${(field.areaHectares / 100).toFixed(1)} ha` : "Área não definida"}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFieldSelection(field.id);
                    }}
                    className={`w-5 h-5 rounded border flex items-center justify-center ${
                      selectedFields.has(field.id)
                        ? "bg-green-500 border-green-500 text-white"
                        : "border-gray-300 hover:border-gray-400"
                    }`}
                  >
                    {selectedFields.has(field.id) && <Check className="h-3 w-3" />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-200">
          <button className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
            <Plus className="h-4 w-4" />
            Criar grupo
          </button>
        </div>

        {/* Selection Bar */}
        {selectedFields.size > 0 && (
          <div className="absolute bottom-0 left-14 right-0 bg-gray-800 text-white px-4 py-3 flex items-center gap-4 z-10" style={{ width: 'calc(100% - 56px)' }}>
            <button onClick={() => setSelectedFields(new Set())} className="p-1">
              <X className="h-4 w-4" />
            </button>
            <span className="text-sm">Selecionado {selectedFields.size} campos</span>
            <div className="flex-1" />
            <button className="text-sm hover:underline">Mover</button>
            <button className="text-sm hover:underline">Excluir</button>
            <button className="text-sm hover:underline">Exportar dados</button>
          </div>
        )}
      </div>

      {/* Painel de Detalhes - Coluna 3 */}
      {selectedFieldId && selectedField ? (
        <div className="flex-1 bg-white overflow-y-auto">
          {/* Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">{selectedField.name}</h1>
                <p className="text-sm text-gray-500 mt-1">
                  {selectedField.areaHectares ? `${(selectedField.areaHectares / 100).toFixed(1)} ha` : "Área não definida"}
                  {fieldCrops && fieldCrops.length > 0 
                    ? `, ${fieldCrops[0].cropType}${fieldCrops[0].variety ? ` (${fieldCrops[0].variety})` : ''}`
                    : ", Sem culturas selecionadas"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
                  Mapa de prescrição
                  <span className="text-[10px] bg-gray-200 px-1.5 py-0.5 rounded">PRO</span>
                </button>
                <button className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
                  Mapa de amostragem
                  <span className="text-[10px] bg-gray-200 px-1.5 py-0.5 rounded">PRO</span>
                </button>
                <Button variant="outline" size="sm">Carregar dados</Button>
                <button 
                  onClick={() => setSelectedFieldId(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 px-6">
            <div className="flex items-center gap-1">
              <button className="px-4 py-3 text-sm font-medium text-green-600 border-b-2 border-green-500">
                Status
              </button>
              <button className="px-4 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 flex items-center gap-1">
                Relatório do talhão
                <span className="text-[10px] bg-gray-200 px-1.5 py-0.5 rounded">PRO</span>
              </button>
              <button className="px-4 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 flex items-center gap-1">
                Mapas de prescrição
                <span className="text-[10px] bg-gray-200 px-1.5 py-0.5 rounded">PRO</span>
              </button>
              <button className="px-4 py-3 text-sm font-medium text-gray-500 hover:text-gray-700">
                Dados
              </button>
              <button className="px-4 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 flex items-center gap-1">
                Análise de rendimento
                <span className="text-[10px] bg-gray-200 px-1.5 py-0.5 rounded">PRO</span>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Quick Actions + Weather */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-2"
                  onClick={() => setShowAddCropDialog(true)}
                >
                  <Leaf className="h-4 w-4" />
                  Adicionar cultura
                </Button>
                <Button variant="outline" size="sm" className="gap-2">
                  <Calendar className="h-4 w-4" />
                  Adicionar data da semeadura
                </Button>
              </div>
              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <Cloud className="h-5 w-5 text-blue-400" />
                  <span className="font-medium">
                    {weatherData?.current?.temperature != null 
                      ? `${Math.round(weatherData.current.temperature)}°` 
                      : '--°'}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-gray-500">
                  <span>
                    {weatherData?.current?.precipitation != null 
                      ? `${weatherData.current.precipitation} mm` 
                      : '-- mm'}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-gray-500">
                  <span>
                    {weatherData?.current?.windSpeed != null 
                      ? `${Math.round(weatherData.current.windSpeed)} m/s` 
                      : '-- m/s'}
                  </span>
                </div>
              </div>
            </div>

            {/* Map Cards */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              {/* NDVI Card */}
              <div className="bg-gray-900 rounded-xl overflow-hidden">
                <div className="px-4 py-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-white">NDVI, 22/nov/2025</span>
                  <div className="flex items-center gap-1">
                    <button className="p-1 hover:bg-gray-700 rounded text-gray-400">
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button className="p-1 hover:bg-gray-700 rounded text-gray-400">
                      <ChevronRight className="h-4 w-4" />
                    </button>
                    <button className="p-1 hover:bg-gray-700 rounded text-gray-400">
                      <Maximize2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="relative h-64">
                  <MapboxMap
                    onMapReady={handleNdviMapReady}
                    className="w-full h-full"
                    initialCenter={fieldCenter}
                    initialZoom={15}
                    style="satellite"
                  />
                  {/* NDVI Scale - Cores OneSoil */}
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col items-center">
                    <span className="text-[10px] text-white font-medium mb-1">1.0</span>
                    <div 
                      className="w-3 h-28 rounded-sm"
                      style={{
                        background: 'linear-gradient(to bottom, #378C37 0%, #5FB944 20%, #78CD4E 35%, #91DA58 50%, #A5E15F 65%, #C3DC5F 80%, #E6DC5A 90%, #A56437 100%)'
                      }}
                    />
                    <span className="text-[10px] text-white font-medium mt-1">0.0</span>
                  </div>
                </div>
              </div>

              {/* Satellite Card */}
              <div className="bg-gray-900 rounded-xl overflow-hidden">
                <div className="px-4 py-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-white">Imagem de satélite, 12/dez/2025</span>
                  <button className="p-1 hover:bg-gray-700 rounded text-gray-400">
                    <Maximize2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="h-64">
                  <MapboxMap
                    onMapReady={handleSatMapReady}
                    className="w-full h-full"
                    initialCenter={fieldCenter}
                    initialZoom={15}
                    style="satellite"
                  />
                </div>
              </div>
            </div>

            {/* Period Selector */}
            <div className="flex items-center gap-3 mb-6">
              <Button variant="outline" size="sm" className="gap-2">
                <Calendar className="h-4 w-4" />
                Selecionar período
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <Calendar className="h-4 w-4" />
                1/jan - 14/dez/2025
                <ChevronDown className="h-3 w-3" />
              </Button>
            </div>

            {/* NDVI Chart - usando componente Recharts com gradiente dinâmico */}
            <div className="bg-white border border-gray-200 rounded-xl">
              <NdviChartOneSoil 
                data={ndviChartData} 
                currentValue={parseFloat(currentNdviValue) || 0}
                lastUpdateDate={ndviChartData.length > 0 ? ndviChartData[ndviChartData.length - 1].date : undefined}
                height={180}
                showDownload={true}
                title="Índice NDVI"
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-gray-100">
          <div className="text-center">
            <Map className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Selecione um campo para ver os detalhes</p>
          </div>
        </div>
      )}
      
      {/* Dialog para adicionar cultura */}
      {selectedField && (
        <AddCropDialog
          open={showAddCropDialog}
          onOpenChange={setShowAddCropDialog}
          fieldId={selectedField.id}
          fieldName={selectedField.name}
        />
      )}
    </div>
  );
}
// force rebuild Wed Dec 17 07:12:12 -03 2025
