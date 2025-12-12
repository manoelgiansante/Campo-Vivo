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

  // Simular dados de NDVI history (o endpoint real pode não ter tipos gerados)
  const ndviHistory = useMemo(() => {
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
  }, [fieldId]);

  // Simular dados de crops
  const crops = useMemo(() => {
    if (!fieldId) return [];
    return [
      { id: 1, fieldId, cropType: "Soja", plantingDate: new Date(), status: "active" },
      { id: 2, fieldId, cropType: "Milho", plantingDate: new Date(), status: "completed" },
    ];
  }, [fieldId]);

  // Simular dados de notes
  const notes = useMemo(() => {
    if (!fieldId) return [];
    return [
      { 
        id: 1, 
        fieldId, 
        title: "Inspeção de campo",
        content: "Campo em boas condições", 
        createdAt: new Date(),
      },
    ];
  }, [fieldId]);

  // Mutations (simulado)
  const addCrop = {
    mutateAsync: async (data: any) => {
      toast.success("Cultura adicionada!");
      return data;
    },
  };

  // Format history data
  const formattedHistory = useMemo(() => {
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
        });
      }
      return mockData.reverse();
    }

    return ndviHistory.map((n, index) => {
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
      };
    });
  }, [ndviHistory]);

  // Filter cloudy days
  const filteredHistory = hideCloudyDays
    ? formattedHistory.filter((h) => !h.cloudy)
    : formattedHistory;

  // Current NDVI value
  const currentNdvi = filteredHistory[selectedHistoryIndex]?.ndvi ?? 0.5;
  const healthStatus = getHealthStatus(currentNdvi);

  // Area in hectares
  const areaHectares = parseFloat(field?.areaHectares || "0") / 100;

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

      if (!(field as any)?.polygonCoordinates) return;

      try {
        const boundariesData =
          typeof (field as any).polygonCoordinates === "string"
            ? JSON.parse((field as any).polygonCoordinates)
            : (field as any).polygonCoordinates;

        if (!Array.isArray(boundariesData) || boundariesData.length < 3) return;

        const coordinates = boundariesData.map(
          (p: any) => [p.lng || p.lon || p[0], p.lat || p[1]] as [number, number]
        );
        coordinates.push(coordinates[0]);

        map.on("load", () => {
          if (map.getSource("field-preview")) return;

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

          map.addLayer({
            id: "field-preview-fill",
            type: "fill",
            source: "field-preview",
            paint: {
              "fill-color": getNdviColor(currentNdvi),
              "fill-opacity": 0.7,
            },
          });

          map.addLayer({
            id: "field-preview-outline",
            type: "line",
            source: "field-preview",
            paint: {
              "line-color": "#000",
              "line-width": 2,
            },
          });

          // Fit to bounds
          const lngs = coordinates.map((c) => c[0]);
          const lats = coordinates.map((c) => c[1]);
          map.fitBounds(
            [
              [Math.min(...lngs), Math.min(...lats)],
              [Math.max(...lngs), Math.max(...lats)],
            ],
            { padding: 30 }
          );
        });
      } catch (e) {
        console.error("Error rendering field preview:", e);
      }
    },
    [(field as any)?.polygonCoordinates, currentNdvi]
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
                            .filter((h) => h.ndvi !== null)
                            .map((h) => h.ndvi as number)}
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
                        initialCenter={[
                          parseFloat(field?.centerLng || "-54.608"),
                          parseFloat(field?.centerLat || "-20.474"),
                        ]}
                        initialZoom={14}
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

                  {/* History Section */}
                  <div className="px-4 mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-base font-semibold text-gray-900">Histórico</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Ocultar dias nublados</span>
                        <Switch
                          checked={hideCloudyDays}
                          onCheckedChange={setHideCloudyDays}
                        />
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

                  {/* Weather Preview */}
                  <div className="px-4 mb-6">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-4">
                      <h3 className="font-semibold text-gray-900 mb-3">
                        Previsão do Tempo
                      </h3>
                      <div className="grid grid-cols-3 gap-2">
                        <WeatherCard day="Hoje" icon="sun" temp={28} />
                        <WeatherCard day="Amanhã" icon="cloud" temp={26} />
                        <WeatherCard day="Sáb" icon="rain" temp={24} />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full mt-2 text-blue-600"
                        onClick={() => setLocation(`/fields/${fieldId}/weather`)}
                      >
                        Ver previsão completa
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

// History Card Component
function HistoryCard({
  date,
  ndvi,
  delta,
  cloudy,
  selected,
  onClick,
}: {
  date: string;
  ndvi: number | null;
  delta: number | null;
  cloudy: boolean;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 w-20 rounded-xl overflow-hidden transition-all ${
        selected ? "ring-2 ring-green-500 ring-offset-2" : ""
      }`}
    >
      {/* Thumbnail */}
      <div
        className="h-14 relative flex items-center justify-center"
        style={{
          backgroundColor: cloudy || ndvi === null ? "#e5e7eb" : getNdviColor(ndvi),
        }}
      >
        {cloudy && <Cloud className="h-6 w-6 text-gray-400" />}
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

// Weather Card Component
function WeatherCard({
  day,
  icon,
  temp,
}: {
  day: string;
  icon: "sun" | "cloud" | "rain";
  temp: number;
}) {
  const icons = {
    sun: <Sun className="h-6 w-6 text-yellow-500" />,
    cloud: <Cloud className="h-6 w-6 text-gray-400" />,
    rain: <Droplets className="h-6 w-6 text-blue-500" />,
  };

  return (
    <div className="bg-white/60 rounded-xl p-2 text-center">
      <p className="text-xs text-gray-500 mb-1">{day}</p>
      {icons[icon]}
      <p className="text-sm font-semibold text-gray-900 mt-1">{temp}°</p>
    </div>
  );
}

export default FieldBottomSheet;
