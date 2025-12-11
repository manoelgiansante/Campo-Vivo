import { MapboxMap } from "@/components/MapboxMap";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  X,
  Hand,
  Pencil,
  Search,
  Navigation,
  Undo2,
  Square,
  CircleDot,
  Loader2
} from "lucide-react";
import { useState, useCallback, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import mapboxgl from "mapbox-gl";
import * as turf from "@turf/turf";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type DrawMode = "select" | "draw";

// Mock suggested fields from satellite detection
const suggestedFields = [
  { id: 1, area: 8.8, coordinates: [[-54.62, -20.46], [-54.61, -20.46], [-54.61, -20.47], [-54.62, -20.47]] },
  { id: 2, area: 33.1, coordinates: [[-54.60, -20.46], [-54.59, -20.46], [-54.59, -20.48], [-54.60, -20.48]] },
  { id: 3, area: 6, coordinates: [[-54.63, -20.47], [-54.62, -20.47], [-54.62, -20.48], [-54.63, -20.48]] },
  { id: 4, area: 15, coordinates: [[-54.59, -20.47], [-54.58, -20.47], [-54.58, -20.49], [-54.59, -20.49]] },
  { id: 5, area: 8.2, coordinates: [[-54.62, -20.48], [-54.61, -20.48], [-54.61, -20.49], [-54.62, -20.49]] },
  { id: 6, area: 5.5, coordinates: [[-54.63, -20.49], [-54.62, -20.49], [-54.62, -20.50], [-54.63, -20.50]] },
];

export default function FieldDrawOneSoil() {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<DrawMode>("select");
  const modeRef = useRef<DrawMode>("select"); // Ref para evitar closure stale
  const [mapInstance, setMapInstance] = useState<mapboxgl.Map | null>(null);
  const [drawnPoints, setDrawnPoints] = useState<[number, number][]>([]);
  const [selectedFields, setSelectedFields] = useState<number[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [fieldName, setFieldName] = useState("");
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  
  // Mutation para criar campo
  const createField = trpc.fields.create.useMutation({
    onSuccess: (data) => {
      toast.success("Campo criado com sucesso!");
      setLocation(`/fields/${data.id}`);
    },
    onError: (error) => {
      toast.error("Erro ao criar campo: " + error.message);
    },
  });
  
  // Sincronizar modeRef com mode
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // Calculate area of drawn polygon
  const calculateArea = useCallback(() => {
    if (drawnPoints.length < 3) return 0;
    const closed = [...drawnPoints, drawnPoints[0]];
    const polygon = turf.polygon([closed]);
    const area = turf.area(polygon);
    return area / 10000; // Convert to hectares
  }, [drawnPoints]);

  const handleMapReady = useCallback((map: mapboxgl.Map) => {
    setMapInstance(map);

    // Add suggested fields
    suggestedFields.forEach((field) => {
      const coords = [...field.coordinates, field.coordinates[0]] as [number, number][];
      const sourceId = `suggested-${field.id}`;

      map.addSource(sourceId, {
        type: "geojson",
        data: {
          type: "Feature",
          properties: { id: field.id, area: field.area },
          geometry: {
            type: "Polygon",
            coordinates: [coords]
          }
        }
      });

      // Fill layer
      map.addLayer({
        id: sourceId,
        type: "fill",
        source: sourceId,
        paint: {
          "fill-color": "#9ca3af",
          "fill-opacity": 0.5
        }
      });

      // Outline
      map.addLayer({
        id: `${sourceId}-outline`,
        type: "line",
        source: sourceId,
        paint: {
          "line-color": "#ffffff",
          "line-width": 2
        }
      });

      // Add label marker
      const center = turf.centroid(turf.polygon([coords]));
      const el = document.createElement("div");
      el.innerHTML = `
        <div class="bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-md cursor-pointer hover:bg-white transition-colors flex items-center gap-1.5">
          <span class="text-gray-600 text-sm">+</span>
          <span class="font-medium text-gray-800 text-sm">${field.area} ha</span>
        </div>
      `;
      el.onclick = (e) => {
        e.stopPropagation();
        toggleFieldSelection(field.id, map);
      };

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat(center.geometry.coordinates as [number, number])
        .addTo(map);
      
      markersRef.current.push(marker);
    });

    // Click handler for drawing - usa modeRef para evitar closure stale
    map.on("click", (e) => {
      if (modeRef.current === "draw") {
        const newPoint: [number, number] = [e.lngLat.lng, e.lngLat.lat];
        setDrawnPoints(prev => [...prev, newPoint]);
      }
    });
  }, []); // Remove mode das dependências pois usamos ref

  // Toggle field selection
  const toggleFieldSelection = (fieldId: number, map: mapboxgl.Map) => {
    setSelectedFields(prev => {
      const isSelected = prev.includes(fieldId);
      const newSelection = isSelected 
        ? prev.filter(id => id !== fieldId)
        : [...prev, fieldId];
      
      // Update layer color
      const sourceId = `suggested-${fieldId}`;
      if (map.getLayer(sourceId)) {
        map.setPaintProperty(sourceId, "fill-color", 
          newSelection.includes(fieldId) ? "#22c55e" : "#9ca3af"
        );
        map.setPaintProperty(sourceId, "fill-opacity", 
          newSelection.includes(fieldId) ? 0.7 : 0.5
        );
      }
      
      return newSelection;
    });
  };

  // Update drawn polygon on map
  useEffect(() => {
    if (!mapInstance || drawnPoints.length === 0) return;

    const sourceId = "drawing";
    
    // Remove existing
    if (mapInstance.getLayer(sourceId)) mapInstance.removeLayer(sourceId);
    if (mapInstance.getLayer(`${sourceId}-outline`)) mapInstance.removeLayer(`${sourceId}-outline`);
    if (mapInstance.getLayer(`${sourceId}-points`)) mapInstance.removeLayer(`${sourceId}-points`);
    if (mapInstance.getSource(sourceId)) mapInstance.removeSource(sourceId);
    if (mapInstance.getSource(`${sourceId}-points`)) mapInstance.removeSource(`${sourceId}-points`);

    // Create polygon or line
    const coords = drawnPoints.length >= 3 
      ? [...drawnPoints, drawnPoints[0]]
      : drawnPoints;

    if (drawnPoints.length >= 2) {
      mapInstance.addSource(sourceId, {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: drawnPoints.length >= 3 
            ? { type: "Polygon", coordinates: [coords] }
            : { type: "LineString", coordinates: coords }
        }
      });

      if (drawnPoints.length >= 3) {
        mapInstance.addLayer({
          id: sourceId,
          type: "fill",
          source: sourceId,
          paint: {
            "fill-color": "#22c55e",
            "fill-opacity": 0.4
          }
        });
      }

      mapInstance.addLayer({
        id: `${sourceId}-outline`,
        type: "line",
        source: sourceId,
        paint: {
          "line-color": "#ffffff",
          "line-width": 3,
          "line-dasharray": drawnPoints.length >= 3 ? [1] : [2, 2]
        }
      });
    }

    // Add point markers
    mapInstance.addSource(`${sourceId}-points`, {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: drawnPoints.map((point, i) => ({
          type: "Feature",
          properties: { index: i },
          geometry: { type: "Point", coordinates: point }
        }))
      }
    });

    mapInstance.addLayer({
      id: `${sourceId}-points`,
      type: "circle",
      source: `${sourceId}-points`,
      paint: {
        "circle-radius": 8,
        "circle-color": "#ffffff",
        "circle-stroke-width": 2,
        "circle-stroke-color": "#000000"
      }
    });

  }, [mapInstance, drawnPoints]);

  const handleUndo = () => {
    setDrawnPoints(prev => prev.slice(0, -1));
  };

  const handleFinish = () => {
    if (drawnPoints.length >= 3) {
      setShowNameDialog(true);
    }
  };
  
  const handleSaveField = () => {
    if (!fieldName.trim()) {
      toast.error("Digite um nome para o campo");
      return;
    }
    
    const area = calculateArea();
    const closed = [...drawnPoints, drawnPoints[0]];
    const polygon = turf.polygon([closed]);
    const centroid = turf.centroid(polygon);
    const [centerLng, centerLat] = centroid.geometry.coordinates;
    
    // Converter para formato lat/lng
    const boundaryPoints = drawnPoints.map(([lng, lat]) => ({ lat, lng }));
    
    createField.mutate({
      name: fieldName,
      latitude: centerLat.toString(),
      longitude: centerLng.toString(),
      boundaries: JSON.stringify(boundaryPoints),
      areaHectares: Math.round(area * 100), // hectares * 100 para precisão
    });
  };

  const handleLocationClick = useCallback(() => {
    if (mapInstance && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        mapInstance.flyTo({
          center: [pos.coords.longitude, pos.coords.latitude],
          zoom: 15
        });
      });
    }
  }, [mapInstance]);

  const area = calculateArea();

  return (
    <div className="h-screen w-full relative">
      {/* Map */}
      <MapboxMap
        onMapReady={handleMapReady}
        className="h-full w-full"
        initialCenter={[-54.6, -20.47]}
        initialZoom={13}
      />

      {/* Top Bar */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
        {/* Close Button */}
        <button
          onClick={() => setLocation("/fields")}
          className="h-11 w-11 bg-white rounded-full shadow-lg flex items-center justify-center"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Mode Toggle */}
        <div className="flex bg-gray-900/90 backdrop-blur-sm rounded-full p-1">
          <button
            onClick={() => setMode("select")}
            className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors ${
              mode === "select" ? "bg-white text-gray-900" : "text-white"
            }`}
          >
            <Hand className="h-4 w-4" />
            <span className="font-medium">Select</span>
          </button>
          <button
            onClick={() => setMode("draw")}
            className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors ${
              mode === "draw" ? "bg-white text-gray-900" : "text-white"
            }`}
          >
            <Pencil className="h-4 w-4" />
            <span className="font-medium">Draw</span>
          </button>
        </div>

        {/* Search Button */}
        <button
          onClick={() => setShowSearch(true)}
          className="h-11 w-11 bg-gray-900/90 backdrop-blur-sm text-white rounded-full flex items-center justify-center"
        >
          <Search className="h-5 w-5" />
        </button>
      </div>

      {/* Loading indicator (for select mode) */}
      {mode === "select" && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-10">
          <div className="bg-gray-900/80 backdrop-blur-sm text-white text-sm px-4 py-2 rounded-full">
            Loading field boundaries...
          </div>
        </div>
      )}

      {/* Left side tools (for draw mode) */}
      {mode === "draw" && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-2">
          <button className="h-12 w-12 bg-gray-900/90 backdrop-blur-sm text-white rounded-full flex items-center justify-center">
            <Square className="h-5 w-5" />
          </button>
          <button className="h-12 w-12 bg-gray-900/90 backdrop-blur-sm text-white rounded-full flex items-center justify-center">
            <CircleDot className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Undo Button */}
      {drawnPoints.length > 0 && (
        <button
          onClick={handleUndo}
          className="absolute bottom-32 left-4 z-10 flex items-center gap-2 bg-gray-900/90 backdrop-blur-sm text-white px-4 py-3 rounded-full"
        >
          <Undo2 className="h-4 w-4" />
          <span>Undo</span>
        </button>
      )}

      {/* Location Button */}
      <Button
        variant="secondary"
        size="icon"
        className="absolute right-4 bottom-32 z-10 h-12 w-12 rounded-full bg-white shadow-lg border-0"
        onClick={handleLocationClick}
      >
        <Navigation className="h-5 w-5 text-gray-700" />
      </Button>

      {/* Finish Button */}
      {drawnPoints.length >= 3 && (
        <button
          onClick={handleFinish}
          className="absolute bottom-20 left-4 right-4 z-10 bg-green-600 text-white py-4 rounded-2xl text-center font-semibold"
        >
          <div>Finish field boundary</div>
          <div className="text-sm font-normal opacity-90">Area {area.toFixed(1)} ha</div>
        </button>
      )}

      {/* Selected fields count */}
      {mode === "select" && selectedFields.length > 0 && (
        <button
          onClick={() => setLocation("/fields")}
          className="absolute bottom-20 left-4 right-4 z-10 bg-green-600 text-white py-4 rounded-2xl text-center font-semibold"
        >
          Add {selectedFields.length} field{selectedFields.length > 1 ? "s" : ""}
        </button>
      )}
      
      {/* Dialog para nome do campo */}
      <Dialog open={showNameDialog} onOpenChange={setShowNameDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nome do Campo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="fieldName">Nome</Label>
              <Input
                id="fieldName"
                placeholder="Ex: Pasto Norte, Lavoura Sul..."
                value={fieldName}
                onChange={(e) => setFieldName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="text-sm text-gray-500">
              Área: {calculateArea().toFixed(1)} hectares
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNameDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSaveField}
              disabled={createField.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {createField.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar Campo"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
