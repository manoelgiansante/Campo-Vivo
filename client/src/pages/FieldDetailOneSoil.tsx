import { MapboxMap } from "@/components/MapboxMap";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { 
  ChevronDown, 
  ChevronLeft,
  MoreVertical,
  Maximize2,
  Minimize2,
  Leaf,
  Satellite,
  Wheat,
  Pencil,
  Info,
  Loader2
} from "lucide-react";
import { useState, useCallback, useMemo } from "react";
import { useLocation, useRoute } from "wouter";
import mapboxgl from "mapbox-gl";
import { trpc } from "@/lib/trpc";

type MapLayer = "satellite" | "crop" | "vegetation";
type NdviType = "basic" | "contrasted" | "average" | "heterogenity";

// NDVI color scale
const getNdviColor = (value: number): string => {
  if (value < 0.2) return "#d73027";
  if (value < 0.4) return "#fc8d59";
  if (value < 0.5) return "#fee08b";
  if (value < 0.6) return "#d9ef8b";
  if (value < 0.7) return "#91cf60";
  if (value < 0.8) return "#1a9850";
  return "#006837";
};

export default function FieldDetailOneSoil() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/fields/:id");
  const fieldId = params?.id ? parseInt(params.id) : null;
  
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showLayerSheet, setShowLayerSheet] = useState(false);
  const [mapLayer, setMapLayer] = useState<MapLayer>("vegetation");
  const [ndviType, setNdviType] = useState<NdviType>("basic");
  const [selectedHistoryIndex, setSelectedHistoryIndex] = useState(0);
  const [hideCloudyDays, setHideCloudyDays] = useState(false);
  const [mapInstance, setMapInstance] = useState<mapboxgl.Map | null>(null);
  
  // Fetch real data from API
  const { data: field, isLoading: loadingField } = trpc.fields.getById.useQuery(
    { id: fieldId! },
    { enabled: !!fieldId }
  );
  
  const { data: ndviHistory } = trpc.ndvi.getByField.useQuery(
    { fieldId: fieldId!, limit: 10 },
    { enabled: !!fieldId }
  );
  
  const { data: crops } = trpc.crops.listByField.useQuery(
    { fieldId: fieldId! },
    { enabled: !!fieldId }
  );
  
  // Format NDVI history for display
  const formattedHistory = useMemo(() => {
    if (!ndviHistory?.length) {
      return [{ date: "Sem dados", ndvi: 0.5, hasImage: false, cloudy: false }];
    }
    return ndviHistory.map(n => ({
      date: new Date(n.captureDate).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }),
      ndvi: n.ndviAverage ?? 0.5,
      hasImage: !!n.imageUrl,
      cloudy: (n.cloudCoverage ?? 0) > 50,
    }));
  }, [ndviHistory]);
  
  // Get current NDVI value
  const currentNdvi = ndviHistory?.[selectedHistoryIndex]?.ndviAverage ?? 0.5;
  
  // Get area in hectares (stored as hectares * 100)
  const areaHectares = (field?.areaHectares ?? 0) / 100;
  
  // Get current crop
  const currentCrop = crops?.[0];

  const filteredHistory = hideCloudyDays 
    ? formattedHistory.filter(h => !h.cloudy)
    : formattedHistory;

  const handleMapReady = useCallback((map: mapboxgl.Map) => {
    setMapInstance(map);
    
    // Add field polygon if we have boundaries
    if (!field?.boundaries) return;
    
    try {
      const boundariesData = typeof field.boundaries === 'string' 
        ? JSON.parse(field.boundaries) 
        : field.boundaries;
      
      if (!Array.isArray(boundariesData) || boundariesData.length < 3) return;
      
      const coordinates = boundariesData.map((p: any) => [
        p.lng || p.lon || p[0], 
        p.lat || p[1]
      ] as [number, number]);
      coordinates.push(coordinates[0]); // Close the polygon

      map.on('load', () => {
        if (map.getSource('field')) return; // Already added
        
        map.addSource('field', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Polygon',
              coordinates: [coordinates]
            }
          }
        });

        map.addLayer({
          id: 'field-fill',
          type: 'fill',
          source: 'field',
          paint: {
            'fill-color': getNdviColor(currentNdvi),
            'fill-opacity': 0.7
          }
        });

        map.addLayer({
          id: 'field-outline',
          type: 'line',
          source: 'field',
          paint: {
            'line-color': '#000000',
            'line-width': 2
          }
        });

        // Fit to bounds
        const lngs = coordinates.map(c => c[0]);
        const lats = coordinates.map(c => c[1]);
        map.fitBounds(
          [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
          { padding: 40 }
        );
      });
    } catch (e) {
      console.error("Error parsing field boundaries:", e);
    }
  }, [field?.boundaries, currentNdvi]);

  const getNdviLabel = () => {
    switch (ndviType) {
      case "basic": return "Basic NDVI";
      case "contrasted": return "Contrasted NDVI";
      case "average": return "Average NDVI";
      case "heterogenity": return "Heterogenity NDVI";
    }
  };

  // Loading state
  if (loadingField) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    );
  }
  
  // Not found state
  if (!field) {
    return (
      <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
        <p className="text-gray-500 mb-4">Campo não encontrado</p>
        <Button onClick={() => setLocation("/fields")}>Voltar</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => setLocation("/fields")} className="p-1">
            <ChevronLeft className="h-6 w-6" />
          </button>
          <Button variant="ghost" size="icon">
            <MoreVertical className="h-5 w-5" />
          </Button>
        </div>
        
        {/* Field Name & Area */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{field.name}</h1>
            <p className="text-gray-500">{areaHectares.toFixed(1)} ha</p>
          </div>
          <Button variant="ghost" size="icon">
            <MoreVertical className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Map Section */}
      <div className={`relative ${isFullScreen ? "fixed inset-0 z-50" : "mx-4 mt-4 rounded-2xl overflow-hidden h-80"}`}>
        <MapboxMap
          onMapReady={handleMapReady}
          className="w-full h-full"
          initialCenter={[
            parseFloat(field.longitude || "-54.608"), 
            parseFloat(field.latitude || "-20.474")
          ]}
          initialZoom={14}
        />
        
        {/* Layer Selector */}
        <button
          onClick={() => setShowLayerSheet(true)}
          className="absolute top-4 left-4 flex items-center gap-2 bg-gray-900/90 backdrop-blur-sm text-white px-4 py-2 rounded-full"
        >
          <Leaf className="h-4 w-4" />
          <span className="text-sm font-medium">{getNdviLabel()}</span>
          <ChevronDown className="h-4 w-4" />
        </button>

        {/* Fullscreen Toggle */}
        <button
          onClick={() => setIsFullScreen(!isFullScreen)}
          className="absolute top-4 right-4 h-10 w-10 bg-gray-900/90 backdrop-blur-sm text-white rounded-full flex items-center justify-center"
        >
          {isFullScreen ? (
            <Minimize2 className="h-5 w-5" />
          ) : (
            <Maximize2 className="h-5 w-5" />
          )}
        </button>

        {/* Info Button */}
        <button className="absolute bottom-4 right-4 h-8 w-8 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center">
          <Info className="h-4 w-4 text-gray-600" />
        </button>

        {/* NDVI Scale */}
        {mapLayer === "vegetation" && (
          <div className="absolute left-4 bottom-4 w-2 h-20 rounded-full overflow-hidden" style={{
            background: "linear-gradient(to top, #d73027, #fc8d59, #fee08b, #d9ef8b, #91cf60, #1a9850)"
          }} />
        )}
      </div>

      {/* History Section */}
      <div className="px-4 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">History</h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Hide cloudy days</span>
            <Switch 
              checked={hideCloudyDays} 
              onCheckedChange={setHideCloudyDays}
            />
          </div>
        </div>

        {/* History Timeline */}
        <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4">
          {filteredHistory.map((item, index) => (
            <HistoryCard
              key={index}
              date={item.date}
              ndvi={item.ndvi}
              hasImage={item.hasImage}
              cloudy={item.cloudy}
              selected={selectedHistoryIndex === index}
              onClick={() => setSelectedHistoryIndex(index)}
            />
          ))}
        </div>
      </div>

      {/* Crop Info Section */}
      <div className="px-4 mt-4 pb-24">
        <div className="bg-white rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: currentCrop?.status === "growing" ? "#22c55e" : "#ef4444" }}
              />
              <span className="font-semibold text-gray-900">{currentCrop?.cropType || "Sem cultivo"}</span>
            </div>
            <Button variant="ghost" size="icon">
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <p className="text-sm text-gray-500">Data de plantio</p>
              <p className="text-gray-900">
                {currentCrop?.plantingDate 
                  ? new Date(currentCrop.plantingDate).toLocaleDateString('pt-BR') 
                  : "Não definida"}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Data de colheita</p>
              <p className="text-gray-900">
                {currentCrop?.expectedHarvestDate 
                  ? new Date(currentCrop.expectedHarvestDate).toLocaleDateString('pt-BR') 
                  : "Não definida"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Layer Selection Sheet */}
      <Sheet open={showLayerSheet} onOpenChange={setShowLayerSheet}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader className="pb-4">
            <SheetTitle className="text-left">Map layer</SheetTitle>
          </SheetHeader>
          
          <div className="flex gap-3 mb-6">
            <LayerOption
              icon={<Satellite className="h-6 w-6" />}
              label="Satellite image"
              selected={mapLayer === "satellite"}
              onClick={() => setMapLayer("satellite")}
              bgColor="bg-green-100"
            />
            <LayerOption
              icon={<Wheat className="h-6 w-6" />}
              label="Crop"
              selected={mapLayer === "crop"}
              onClick={() => setMapLayer("crop")}
              bgColor="bg-blue-100"
            />
            <LayerOption
              icon={<Leaf className="h-6 w-6" />}
              label="Vegetation"
              selected={mapLayer === "vegetation"}
              onClick={() => setMapLayer("vegetation")}
              bgColor="bg-lime-100"
            />
          </div>

          {mapLayer === "vegetation" && (
            <div className="space-y-1">
              <NdviOption label="Basic NDVI" selected={ndviType === "basic"} onClick={() => setNdviType("basic")} />
              <NdviOption label="Contrasted NDVI" selected={ndviType === "contrasted"} onClick={() => setNdviType("contrasted")} />
              <NdviOption label="Average NDVI" selected={ndviType === "average"} onClick={() => setNdviType("average")} />
              <NdviOption label="Heterogenity NDVI" selected={ndviType === "heterogenity"} onClick={() => setNdviType("heterogenity")} />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// History Card Component
function HistoryCard({
  date,
  ndvi,
  hasImage,
  cloudy,
  selected,
  onClick
}: {
  date: string;
  ndvi: number | null;
  hasImage: boolean;
  cloudy: boolean;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 w-24 rounded-xl overflow-hidden transition-all ${
        selected ? "ring-2 ring-gray-900" : ""
      }`}
    >
      {/* Thumbnail */}
      <div className="h-20 bg-gray-200 relative">
        {hasImage ? (
          <div className="w-full h-full bg-gradient-to-br from-green-600 to-green-800" />
        ) : (
          <div className="w-full h-full bg-gray-300 flex items-center justify-center">
            {cloudy && (
              <svg className="h-8 w-8 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/>
              </svg>
            )}
          </div>
        )}
      </div>
      
      {/* Info */}
      <div className="bg-white p-2 text-center">
        <p className="text-xs text-gray-500">{date}</p>
        {ndvi && (
          <div className="flex items-center justify-center gap-1 mt-1">
            <span className="text-sm font-semibold">{ndvi.toFixed(2)}</span>
            <span className="text-xs text-green-600">+{ndvi.toFixed(2)}</span>
          </div>
        )}
      </div>
    </button>
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
