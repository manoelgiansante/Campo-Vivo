import { useState, useMemo, useCallback } from "react";
import { Drawer } from "vaul";
import { MapboxMap } from "@/components/MapboxMap";
import { NDVIChart, NDVISparkline } from "@/components/NDVIChart";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronDown,
  Maximize2,
  MoreVertical,
  Info,
  Leaf,
  FileText,
  Plus,
  Check,
  Cloud,
  Pencil,
  Share2,
  Trash2,
  MapPin,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Sun,
  Droplets,
  Loader2,
} from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import mapboxgl from "mapbox-gl";

// Types
type NdviType = "basic" | "contrast" | "moisture" | "heterogeneity";

interface FieldBottomSheetProps {
  fieldId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// NDVI color based on value
const getNdviColor = (value: number): string => {
  if (value < 0.2) return "#ef4444";
  if (value < 0.4) return "#f59e0b";
  if (value < 0.5) return "#eab308";
  if (value < 0.6) return "#84cc16";
  if (value < 0.7) return "#22c55e";
  return "#16a34a";
};

// Health status based on NDVI
const getHealthStatus = (ndvi: number) => {
  if (ndvi >= 0.7) return { label: "Excelente", color: "bg-green-500", textColor: "text-green-700" };
  if (ndvi >= 0.5) return { label: "Bom", color: "bg-lime-500", textColor: "text-lime-700" };
  if (ndvi >= 0.3) return { label: "Atenção", color: "bg-yellow-500", textColor: "text-yellow-700" };
  return { label: "Crítico", color: "bg-red-500", textColor: "text-red-700" };
};

// Suggested crops for Brazil
const SUGGESTED_CROPS = [
  "Soja",
  "Milho para grãos",
  "Milho para silagem",
  "Cana-de-açúcar",
  "Feijão",
  "Algodão",
  "Café",
  "Trigo",
  "Pasto",
  "Brachiaria",
  "Sorgo",
  "Girassol",
];

// NDVI type options
const NDVI_TYPES = [
  { value: "basic", label: "NDVI Básico" },
  { value: "contrast", label: "NDVI com Contraste" },
  { value: "moisture", label: "Umidade do Solo" },
  { value: "heterogeneity", label: "Heterogeneidade" },
];

export function FieldBottomSheet({ fieldId, open, onOpenChange }: FieldBottomSheetProps) {
  const [, setLocation] = useLocation();
  const [ndviType, setNdviType] = useState<NdviType>("basic");
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState(0);
  const [hideCloudyDays, setHideCloudyDays] = useState(false);
  const [selectedCrops, setSelectedCrops] = useState<string[]>([]);
  const [mapInstance, setMapInstance] = useState<mapboxgl.Map | null>(null);

  // Fetch field data
  const { data: field, isLoading: loadingField } = trpc.fields.getById.useQuery(
    { id: fieldId! },
    { enabled: !!fieldId && open }
  );

  // Fetch current weather
  const { data: currentWeather } = (trpc as any).weather?.getCurrent?.useQuery(
    { fieldId: fieldId! },
    { enabled: !!fieldId && open }
  ) || { data: null };

  // Fetch latest NDVI image for map overlay
  const { data: ndviImage } = (trpc as any).ndvi?.getLatestNdviImage?.useQuery(
    { fieldId: fieldId! },
    { enabled: !!fieldId && open }
  ) || { data: null };

  // Fetch NDVI history with thumbnails
  const { data: ndviHistoryWithImages } = (trpc as any).ndvi?.history?.useQuery(
    { fieldId: fieldId!, days: 60 },
    { enabled: !!fieldId && open }
  ) || { data: null };

  // Fetch NDVI history from database
  const { data: ndviHistoryReal, isLoading: loadingNdvi, refetch: refetchNdvi } = (trpc.ndvi as any).getByField.useQuery(
    { fieldId: fieldId!, limit: 30 },
    { enabled: !!fieldId && open }
  );

  // NDVI sync mutation
  const syncNdviMutation = (trpc.ndvi as any).fetchFromSatellite.useMutation({
    onSuccess: () => {
      toast.success("NDVI sincronizado com sucesso!");
      refetchNdvi();
    },
    onError: (error: { message?: string }) => {
      toast.error(error.message || "Erro ao sincronizar NDVI");
    },
  });

  // Get current NDVI from field data
  const currentNdviData = useMemo(() => {
    const fieldData = field as any;
    return {
      ndvi: fieldData?.currentNdvi ? fieldData.currentNdvi / 100 : null,
      lastSync: fieldData?.lastNdviSync,
      agroPolygonId: fieldData?.agroPolygonId,
    };
  }, [field]);

  // Use real NDVI data or generate mock if no data available
  const ndviHistory = useMemo(() => {
    if (ndviHistoryReal && ndviHistoryReal.length > 0) {
      return ndviHistoryReal.map((h: any) => ({
        id: h.id || Math.random(),
        fieldId,
        captureDate: h.captureDate instanceof Date ? h.captureDate.toISOString() : h.captureDate,
        ndviAverage: h.ndviAverage || h.ndvi || 0.5,
        cloudCoverage: h.cloudCoverage || 0,
        ndviMin: h.ndviMin || h.min,
        ndviMax: h.ndviMax || h.max,
        satellite: h.satellite,
      }));
    }
    // Fallback mock data if no real data
    if (!fieldId) return [];
    const history: any[] = [];
    for (let i = 0; i < 10; i++) {
      const date = new Date(Date.now() - i * 5 * 24 * 60 * 60 * 1000);
      history.push({
        id: i + 1,
        fieldId,
        captureDate: date.toISOString(),
        ndviAverage: 0.5 + Math.random() * 0.4,
        cloudCoverage: Math.random() * 30,
      });
    }
    return history;
  }, [fieldId, ndviHistoryReal]);

  // Fetch real crops from database
  const { data: cropsData } = trpc.crops.listByField.useQuery(
    { fieldId: fieldId! },
    { enabled: !!fieldId && open }
  );
  const crops = cropsData || [];

  // Fetch real notes from database
  const { data: notesData } = trpc.notes.listByField.useQuery(
    { fieldId: fieldId! },
    { enabled: !!fieldId && open }
  );
  const notes = notesData || [];

  // Real mutation for adding crops
  const addCropMutation = trpc.crops.create.useMutation({
    onSuccess: () => {
      toast.success("Cultura adicionada!");
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao adicionar cultura");
    },
  });

  const addCrop = {
    mutateAsync: async (data: any) => {
      return addCropMutation.mutateAsync(data);
    },
  };

  // Format history data (with thumbnail support from Agromonitoring)
  const formattedHistory = useMemo(() => {
    // Prefer history with images if available
    if (ndviHistoryWithImages?.length) {
      return ndviHistoryWithImages.map((n: any, index: number) => {
        const prevNdvi = ndviHistoryWithImages[index + 1]?.ndvi;
        const delta = prevNdvi && n.ndvi ? n.ndvi - prevNdvi : null;

        return {
          date: new Date(n.date).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "short",
          }),
          fullDate: new Date(n.date),
          ndvi: n.ndvi,
          cloudy: (n.cloudCoverage ?? 0) > 50,
          delta,
          thumbnailUrl: n.thumbnailUrl || null,
        };
      });
    }

    if (!ndviHistory?.length) {
      // Generate mock data if no real data
      const mockData = [];
      const today = new Date();
      for (let i = 0; i < 6; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i * 5);
        mockData.push({
          date: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
          fullDate: date,
          ndvi: i < 2 ? null : 0.3 + Math.random() * 0.4,
          cloudy: i < 2,
          delta: i < 3 ? null : (Math.random() - 0.3) * 0.1,
          thumbnailUrl: null,
        });
      }
      return mockData.reverse();
    }

    return ndviHistory.map((n: any, index: number) => {
      const prevNdvi = ndviHistory[index + 1]?.ndviAverage;
      const delta = prevNdvi && n.ndviAverage ? n.ndviAverage - prevNdvi : null;

      return {
        date: new Date(n.captureDate).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "short",
        }),
        fullDate: new Date(n.captureDate),
        ndvi: n.ndviAverage,
        cloudy: (n.cloudCoverage ?? 0) > 50,
        delta,
        thumbnailUrl: null,
      };
    });
  }, [ndviHistory, ndviHistoryWithImages]);

  // Filter cloudy days
  const filteredHistory = hideCloudyDays
    ? formattedHistory.filter((h: any) => !h.cloudy)
    : formattedHistory;

  // Current NDVI value
  const currentNdvi = filteredHistory[selectedHistoryIndex]?.ndvi ?? 0.5;
  const healthStatus = getHealthStatus(currentNdvi);

  // Area in hectares
  const areaHectares = (Number(field?.areaHectares) || 0) / 100;

  // Selected crops from database
  const existingCrops = useMemo(() => {
    return crops?.map((c: any) => c.cropType) ?? [];
  }, [crops]);

  // Handle crop selection
  const handleCropSelect = async (crop: string) => {
    if (existingCrops.includes(crop)) return;

    if (selectedCrops.includes(crop)) {
      setSelectedCrops(selectedCrops.filter((c) => c !== crop));
    } else {
      setSelectedCrops([...selectedCrops, crop]);
      
      // Save to database
      if (fieldId) {
        await addCrop.mutateAsync({
          fieldId,
          cropType: crop,
          plantingDate: new Date(),
        });
      }
    }
  };

  // Handle map ready
  const handleMapReady = useCallback(
    (map: mapboxgl.Map) => {
      setMapInstance(map);

      const drawFieldOnMap = () => {
        if (!(field as any)?.boundaries) return;

        try {
          const boundariesData =
            typeof (field as any).boundaries === "string"
              ? JSON.parse((field as any).boundaries)
              : (field as any).boundaries;

          if (!Array.isArray(boundariesData) || boundariesData.length < 3) return;

          const coordinates = boundariesData.map(
            (p: any) => [p.lng || p.lon || p[0], p.lat || p[1]] as [number, number]
          );
          coordinates.push(coordinates[0]);

          // Calculate bounds for the field
          const lngs = coordinates.map((c) => c[0]);
          const lats = coordinates.map((c) => c[1]);
          const minLng = Math.min(...lngs);
          const maxLng = Math.max(...lngs);
          const minLat = Math.min(...lats);
          const maxLat = Math.max(...lats);

          // Remove existing layers/sources first
          if (map.getLayer("field-preview-fill")) map.removeLayer("field-preview-fill");
          if (map.getLayer("field-preview-outline")) map.removeLayer("field-preview-outline");
          if (map.getLayer("ndvi-image-layer")) map.removeLayer("ndvi-image-layer");
          if (map.getSource("field-preview")) map.removeSource("field-preview");
          if (map.getSource("ndvi-image")) map.removeSource("ndvi-image");

          map.addSource("field-preview", {
            type: "geojson",
            data: {
              type: "Feature",
              properties: {},
              geometry: {
                type: "Polygon",
                coordinates: [coordinates],
              },
            },
          });

          // Add NDVI image layer if available (OneSoil-style pixel overlay)
          if (ndviImage?.imageUrl) {
            map.addSource("ndvi-image", {
              type: "image",
              url: ndviImage.imageUrl,
              coordinates: [
                [minLng, maxLat], // top-left
                [maxLng, maxLat], // top-right
                [maxLng, minLat], // bottom-right
                [minLng, minLat], // bottom-left
              ],
            });

            map.addLayer({
              id: "ndvi-image-layer",
              type: "raster",
              source: "ndvi-image",
              paint: {
                "raster-opacity": 0.85,
                "raster-fade-duration": 0,
              },
            });
          } else {
            // Fallback to solid color fill if no image
            map.addLayer({
              id: "field-preview-fill",
              type: "fill",
              source: "field-preview",
              paint: {
                "fill-color": getNdviColor(currentNdvi),
                "fill-opacity": 0.7,
              },
            });
          }

          map.addLayer({
            id: "field-preview-outline",
            type: "line",
            source: "field-preview",
            paint: {
              "line-color": "#fff",
              "line-width": 2,
            },
          });

          // Fit to bounds
          map.fitBounds(
            [
              [minLng, minLat],
              [maxLng, maxLat],
            ],
            { padding: 30, duration: 0 }
          );
        } catch (e) {
          console.error("Error rendering field preview:", e);
        }
      };

      // Draw immediately if style loaded, otherwise wait
      if (map.isStyleLoaded()) {
        drawFieldOnMap();
      } else {
        map.once("style.load", drawFieldOnMap);
      }
    },
    [(field as any)?.boundaries, currentNdvi, ndviImage]
  );

  // Navigate to full detail page
  const handleExpandMap = () => {
    onOpenChange(false);
    setLocation(`/fields/${fieldId}`);
  };

  // Navigate to add note
  const handleAddNote = () => {
    onOpenChange(false);
    setLocation(`/notes?fieldId=${fieldId}`);
  };

  if (!fieldId) return null;

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 outline-none">
          <div className="bg-white rounded-t-3xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Drag Handle */}
            <div className="flex justify-center py-3 flex-shrink-0">
              <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
            </div>

            {/* Scrollable Content */}
            <div className="overflow-y-auto flex-1 pb-8">
              {loadingField ? (
                <div className="flex items-center justify-center h-48">
                  <Loader2 className="h-8 w-8 animate-spin text-green-600" />
                </div>
              ) : (
                <>
                  {/* Header */}
                  <div className="px-4 pb-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div>
                          <h2 className="text-xl font-bold text-gray-900">
                            {field?.name || "Campo"}
                          </h2>
                          <p className="text-sm text-gray-500">
                            {areaHectares.toFixed(1)} ha
                          </p>
                        </div>
                        {/* Health Badge */}
                        <Badge
                          className={`${healthStatus.color} text-white text-xs`}
                        >
                          {healthStatus.label}
                        </Badge>
                      </div>

                      {/* Menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-5 w-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => setLocation(`/fields/${fieldId}/edit`)}
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setLocation(`/fields/${fieldId}/share`)}
                          >
                            <Share2 className="h-4 w-4 mr-2" />
                            Compartilhar
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Mini Sparkline */}
                    {filteredHistory.length > 0 && (
                      <div className="mt-3 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-gray-400" />
                        <span className="text-xs text-gray-500">Tendência 30 dias:</span>
                        <NDVISparkline
                          data={filteredHistory
                            .filter((h: any) => h.ndvi !== null)
                            .map((h: any) => h.ndvi as number)}
                          width={100}
                          height={24}
                        />
                      </div>
                    )}
                  </div>

                  {/* Map Section */}
                  <div className="px-4 mb-4">
                    <div className="relative rounded-2xl overflow-hidden h-48">
                      <MapboxMap
                        onMapReady={handleMapReady}
                        className="w-full h-full"
                        initialCenter={(() => {
                          // Calcular centro a partir dos boundaries se disponível
                          try {
                            const fieldData = field as any;
                            if (fieldData?.boundaries) {
                              const bounds = typeof fieldData.boundaries === 'string' 
                                ? JSON.parse(fieldData.boundaries) 
                                : fieldData.boundaries;
                              if (Array.isArray(bounds) && bounds.length > 0) {
                                const lngs = bounds.map((p: any) => p.lng || p.lon || p[0]);
                                const lats = bounds.map((p: any) => p.lat || p[1]);
                                return [
                                  (Math.min(...lngs) + Math.max(...lngs)) / 2,
                                  (Math.min(...lats) + Math.max(...lats)) / 2
                                ] as [number, number];
                              }
                            }
                            // Fallback para latitude/longitude do campo
                            if (fieldData?.longitude && fieldData?.latitude) {
                              return [
                                parseFloat(fieldData.longitude),
                                parseFloat(fieldData.latitude)
                              ] as [number, number];
                            }
                          } catch (e) {
                            console.error('Error calculating center:', e);
                          }
                          return [-54.608, -20.474] as [number, number];
                        })()}
                        initialZoom={15}
                      />

                      {/* NDVI Type Dropdown */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="absolute top-3 left-3 flex items-center gap-2 bg-gray-900/80 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-sm">
                            <Leaf className="h-3.5 w-3.5" />
                            <span>{NDVI_TYPES.find((t) => t.value === ndviType)?.label}</span>
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          {NDVI_TYPES.map((type) => (
                            <DropdownMenuItem
                              key={type.value}
                              onClick={() => setNdviType(type.value as NdviType)}
                            >
                              {type.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {/* Expand Button */}
                      <button
                        onClick={handleExpandMap}
                        className="absolute top-3 right-3 h-8 w-8 bg-gray-900/80 backdrop-blur-sm text-white rounded-full flex items-center justify-center"
                      >
                        <Maximize2 className="h-4 w-4" />
                      </button>

                      {/* NDVI Scale */}
                      <div
                        className="absolute left-3 bottom-3 w-2 h-16 rounded-full overflow-hidden"
                        style={{
                          background:
                            "linear-gradient(to top, #ef4444, #f59e0b, #eab308, #84cc16, #22c55e)",
                        }}
                      />

                      {/* Info Button */}
                      <button className="absolute bottom-3 right-3 h-6 w-6 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center">
                        <Info className="h-3.5 w-3.5 text-gray-600" />
                      </button>
                    </div>
                  </div>

                  {/* Weather Section - OneSoil style */}
                  {currentWeather && (
                    <div className="px-4 mb-6">
                      <div className="bg-gradient-to-br from-blue-50 to-sky-50 rounded-2xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-xl">
                              {currentWeather.current?.icon === 'sun' && <Sun className="h-5 w-5 text-yellow-500" />}
                              {currentWeather.current?.icon === 'cloud-sun' && <Cloud className="h-5 w-5 text-gray-500" />}
                              {currentWeather.current?.icon === 'cloud' && <Cloud className="h-5 w-5 text-gray-600" />}
                              {currentWeather.current?.icon === 'cloud-rain' && <Droplets className="h-5 w-5 text-blue-500" />}
                              {!currentWeather.current?.icon && <Sun className="h-5 w-5 text-yellow-500" />}
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900">Clima agora</h3>
                              <p className="text-xs text-gray-500">{currentWeather.current?.description}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-3xl font-bold text-gray-900">{currentWeather.current?.temp}°</p>
                          </div>
                        </div>

                        {/* Weather Details */}
                        <div className="grid grid-cols-3 gap-3 mb-3">
                          <div className="bg-white/60 rounded-xl p-2 text-center">
                            <Droplets className="h-4 w-4 text-blue-500 mx-auto mb-1" />
                            <p className="text-xs text-gray-500">Umidade</p>
                            <p className="text-sm font-semibold">{currentWeather.current?.humidity}%</p>
                          </div>
                          <div className="bg-white/60 rounded-xl p-2 text-center">
                            <svg className="h-4 w-4 text-gray-500 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                            </svg>
                            <p className="text-xs text-gray-500">Vento</p>
                            <p className="text-sm font-semibold">{currentWeather.current?.windSpeed} km/h</p>
                          </div>
                          <div className="bg-white/60 rounded-xl p-2 text-center">
                            <Cloud className="h-4 w-4 text-gray-400 mx-auto mb-1" />
                            <p className="text-xs text-gray-500">Nuvens</p>
                            <p className="text-sm font-semibold">{currentWeather.current?.cloudCover}%</p>
                          </div>
                        </div>

                        {/* 7-day Forecast */}
                        {currentWeather.daily && currentWeather.daily.length > 0 && (
                          <div className="border-t border-blue-100 pt-3">
                            <p className="text-xs text-gray-500 mb-2">Próximos dias</p>
                            <div className="flex gap-2 overflow-x-auto pb-1">
                              {currentWeather.daily.slice(0, 7).map((day: any, i: number) => (
                                <div key={i} className="flex-shrink-0 bg-white/60 rounded-lg p-2 text-center min-w-[60px]">
                                  <p className="text-[10px] text-gray-500">
                                    {i === 0 ? 'Hoje' : new Date(day.date).toLocaleDateString('pt-BR', { weekday: 'short' })}
                                  </p>
                                  {day.icon === 'sun' && <Sun className="h-4 w-4 text-yellow-500 mx-auto my-1" />}
                                  {day.icon === 'cloud-sun' && <Cloud className="h-4 w-4 text-gray-400 mx-auto my-1" />}
                                  {day.icon === 'cloud' && <Cloud className="h-4 w-4 text-gray-500 mx-auto my-1" />}
                                  {day.icon === 'cloud-rain' && <Droplets className="h-4 w-4 text-blue-500 mx-auto my-1" />}
                                  <p className="text-xs font-medium">{day.tempMax}°</p>
                                  <p className="text-[10px] text-gray-400">{day.tempMin}°</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* History Section */}
                  <div className="px-4 mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-gray-900">Histórico NDVI</h3>
                        {currentNdviData?.lastSync && (
                          <span className="text-xs text-gray-400">
                            Atualizado: {new Date(currentNdviData.lastSync).toLocaleDateString("pt-BR")}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => fieldId && syncNdviMutation.mutate({ fieldId })}
                          disabled={syncNdviMutation.isPending}
                          className="text-xs"
                        >
                          {syncNdviMutation.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                          ) : (
                            <TrendingUp className="h-3.5 w-3.5 mr-1" />
                          )}
                          Atualizar
                        </Button>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-500">Nublados</span>
                          <Switch
                            checked={hideCloudyDays}
                            onCheckedChange={setHideCloudyDays}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Timeline */}
                    <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
                      {filteredHistory.map((item: any, index: number) => (
                        <HistoryCard
                          key={index}
                          date={item.date}
                          ndvi={item.ndvi}
                          delta={item.delta}
                          cloudy={item.cloudy}
                          selected={selectedHistoryIndex === index}
                          onClick={() => setSelectedHistoryIndex(index)}
                          thumbnailUrl={item.thumbnailUrl}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Crop Section */}
                  <div className="px-4 mb-6">
                    <div className="bg-gray-50 rounded-2xl p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-green-100 rounded-xl">
                          <Leaf className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            O que está crescendo aqui?
                          </h3>
                          <p className="text-xs text-gray-500">
                            Adicione culturas para acompanhar seu desenvolvimento
                          </p>
                        </div>
                      </div>

                      {/* Crop Tags */}
                      <div className="flex flex-wrap gap-2">
                        {SUGGESTED_CROPS.map((crop) => {
                          const isSelected =
                            existingCrops.includes(crop) || selectedCrops.includes(crop);
                          return (
                            <button
                              key={crop}
                              onClick={() => handleCropSelect(crop)}
                              className={`px-3 py-1.5 rounded-full text-sm transition-all flex items-center gap-1 ${
                                isSelected
                                  ? "bg-green-100 text-green-700 font-medium"
                                  : "bg-white text-gray-600 hover:bg-gray-100"
                              }`}
                            >
                              {isSelected && <Check className="h-3.5 w-3.5" />}
                              {crop}
                            </button>
                          );
                        })}
                        <button className="px-3 py-1.5 rounded-full text-sm border-2 border-dashed border-gray-300 text-gray-500 hover:border-green-500 hover:text-green-600 transition-colors flex items-center gap-1">
                          <Plus className="h-3.5 w-3.5" />
                          Adicionar cultura
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Notes Section */}
                  <div className="px-4 mb-6">
                    <div className="bg-gray-50 rounded-2xl p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-amber-100 rounded-xl">
                          <FileText className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            Como está seu campo?
                          </h3>
                          <p className="text-xs text-gray-500">
                            Adicione anotações durante inspeções ou para marcar locais
                            importantes
                          </p>
                        </div>
                      </div>

                      {/* Recent Notes */}
                      {notes && notes.length > 0 && (
                        <div className="space-y-2 mb-3">
                          {notes.slice(0, 2).map((note: any) => (
                            <div
                              key={note.id}
                              className="bg-white rounded-xl p-3 border border-gray-100"
                            >
                              <div className="flex items-start gap-2">
                                <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                                <div>
                                  <p className="text-sm text-gray-900 line-clamp-1">
                                    {note.title || "Anotação"}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {new Date(note.createdAt).toLocaleDateString("pt-BR")}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add Note Button */}
                      <Button
                        onClick={handleAddNote}
                        className="w-full bg-green-600 hover:bg-green-700 text-white rounded-xl h-11"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Adicionar anotação
                      </Button>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="px-4 pb-4">
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        variant="outline"
                        className="h-12 rounded-xl"
                        onClick={() => setLocation(`/fields/${fieldId}/compare`)}
                      >
                        Comparar Satélite
                      </Button>
                      <Button
                        variant="outline"
                        className="h-12 rounded-xl"
                        onClick={() => setLocation(`/fields/${fieldId}/prescription`)}
                      >
                        Mapa de Prescrição
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

// History Card Component with thumbnail support (OneSoil-style)
function HistoryCard({
  date,
  ndvi,
  delta,
  cloudy,
  selected,
  onClick,
  thumbnailUrl,
}: {
  date: string;
  ndvi: number | null;
  delta: number | null;
  cloudy: boolean;
  selected: boolean;
  onClick: () => void;
  thumbnailUrl?: string | null;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 w-20 rounded-xl overflow-hidden transition-all ${
        selected ? "ring-2 ring-green-500 ring-offset-2" : ""
      }`}
    >
      {/* Thumbnail - shows real NDVI image if available */}
      <div
        className="h-14 relative flex items-center justify-center bg-cover bg-center"
        style={{
          backgroundColor: cloudy || ndvi === null ? "#e5e7eb" : getNdviColor(ndvi),
          backgroundImage: thumbnailUrl ? `url(${thumbnailUrl})` : undefined,
        }}
      >
        {cloudy && !thumbnailUrl && <Cloud className="h-6 w-6 text-gray-400" />}
        {thumbnailUrl && cloudy && (
          <div className="absolute inset-0 bg-gray-500/50 flex items-center justify-center">
            <Cloud className="h-6 w-6 text-white" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="bg-white p-2 text-center border-t">
        <p className="text-[10px] text-gray-500">{date}</p>
        {ndvi !== null ? (
          <>
            <p className="text-sm font-semibold text-gray-900">
              {ndvi.toFixed(2).replace(".", ",")}
            </p>
            {delta !== null && (
              <p
                className={`text-[10px] font-medium flex items-center justify-center gap-0.5 ${
                  delta >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {delta >= 0 ? (
                  <TrendingUp className="h-2.5 w-2.5" />
                ) : (
                  <TrendingDown className="h-2.5 w-2.5" />
                )}
                {delta >= 0 ? "+" : ""}
                {delta.toFixed(2).replace(".", ",")}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-400">--</p>
        )}
      </div>
    </button>
  );
}

export default FieldBottomSheet;
