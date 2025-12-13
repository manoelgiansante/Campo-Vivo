import { trpc } from "@/lib/trpc";
import { MapboxMap, useMapbox } from "@/components/MapboxMap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { 
  X, 
  Navigation,
  Undo2,
  MapPin,
  MousePointer,
  PenTool,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useState, useCallback, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import mapboxgl from "mapbox-gl";
import * as turf from "@turf/turf";

type DrawMode = "select" | "draw";

// Obter posição salva do mapa ou usar padrão
const getSavedMapPosition = (): { center: [number, number]; zoom: number } | null => {
  try {
    const saved = localStorage.getItem('campovivo_map_position');
    if (saved) {
      const pos = JSON.parse(saved);
      let center: [number, number];
      if (pos.center && Array.isArray(pos.center)) {
        center = pos.center;
      } else if (typeof pos.lng === 'number' && typeof pos.lat === 'number') {
        center = [pos.lng, pos.lat];
      } else {
        return null;
      }
      if (isNaN(center[0]) || isNaN(center[1])) {
        return null;
      }
      return { center, zoom: pos.zoom || 15 };
    }
  } catch (e) {
    console.error('Erro ao carregar posição do mapa:', e);
  }
  return null;
};

interface DetectedField {
  id: string;
  name?: string;
  coordinates: [number, number][];
  center: [number, number];
  areaHectares: number;
  source: 'onesoil' | 'osm' | 'car';
  crop?: string;
  ndvi?: number;
}

export default function FieldDrawNew() {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<DrawMode>("draw");
  const [points, setPoints] = useState<[number, number][]>([]);
  const [area, setArea] = useState<number>(0);
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [fieldName, setFieldName] = useState("");
  const [mapInstance, setMapInstance] = useState<mapboxgl.Map | null>(null);
  const { setMap, getUserLocation } = useMapbox();
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  
  // Detection state
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectedFields, setDetectedFields] = useState<DetectedField[]>([]);
  const [selectedDetectedField, setSelectedDetectedField] = useState<DetectedField | null>(null);

  const createField = trpc.fields.create.useMutation({
    onMutate: () => {
      setIsSaving(true);
      toast.loading("Salvando campo...", { id: "save-field" });
    },
    onSuccess: (data) => {
      toast.success("Campo criado com sucesso! 🌾", { 
        id: "save-field",
        description: "O campo foi salvo e aparecerá no mapa.",
        duration: 3000,
      });
      setIsSaving(false);
      setShowNameDialog(false);
      setFieldName("");
      setPoints([]);
      setSelectedDetectedField(null);
      setTimeout(() => {
        setLocation(`/fields/${data.id}`);
      }, 1000);
    },
    onError: (error) => {
      setIsSaving(false);
      toast.error("Erro ao criar campo", { 
        id: "save-field",
        description: error.message || "Tente novamente",
      });
    },
  });

  // Calculate area when points change
  useEffect(() => {
    if (points.length >= 3) {
      try {
        const closedPoints = [...points, points[0]];
        const polygon = turf.polygon([closedPoints]);
        const areaM2 = turf.area(polygon);
        const areaHa = areaM2 / 10000;
        setArea(areaHa);
      } catch (e) {
        setArea(0);
      }
    } else {
      setArea(0);
    }
  }, [points]);

  // Update polygon on map
  useEffect(() => {
    if (!mapInstance) return;

    // Clear existing markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // Remove existing layers
    ["draw-polygon", "draw-line", "detected-fields-fill", "detected-fields-outline", "selected-field-fill", "selected-field-outline"].forEach(layerId => {
      if (mapInstance.getLayer(layerId)) {
        mapInstance.removeLayer(layerId);
      }
    });
    ["draw-polygon", "draw-line", "detected-fields", "selected-field"].forEach(sourceId => {
      if (mapInstance.getSource(sourceId)) {
        mapInstance.removeSource(sourceId);
      }
    });

    // Draw mode - show points and polygon being drawn
    if (mode === "draw" && points.length > 0) {
      // Add markers for each point
      points.forEach((point, index) => {
        const el = document.createElement("div");
        el.className = "w-4 h-4 bg-white rounded-full border-[3px] border-green-500 shadow-lg cursor-move";
        el.style.cssText = "box-shadow: 0 2px 8px rgba(0,0,0,0.3);";
        
        const marker = new mapboxgl.Marker({ 
          element: el, 
          draggable: true 
        })
          .setLngLat(point)
          .addTo(mapInstance);

        marker.on("dragend", () => {
          const lngLat = marker.getLngLat();
          setPoints(prev => {
            const newPoints = [...prev];
            newPoints[index] = [lngLat.lng, lngLat.lat];
            return newPoints;
          });
        });

        markersRef.current.push(marker);
      });

      // Draw line between points
      if (points.length >= 2) {
        const lineCoords = points.length >= 3 
          ? [...points, points[0]]
          : points;

        mapInstance.addSource("draw-line", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: lineCoords,
            },
          },
        });

        mapInstance.addLayer({
          id: "draw-line",
          type: "line",
          source: "draw-line",
          paint: {
            "line-color": "#FFFFFF",
            "line-width": 3,
          },
        });
      }

      // Draw polygon fill
      if (points.length >= 3) {
        const closedPoints = [...points, points[0]];
        
        mapInstance.addSource("draw-polygon", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "Polygon",
              coordinates: [closedPoints],
            },
          },
        });

        mapInstance.addLayer({
          id: "draw-polygon",
          type: "fill",
          source: "draw-polygon",
          paint: {
            "fill-color": "#22c55e",
            "fill-opacity": 0.3,
          },
        });
      }
    }

    // Select mode - show detected fields
    if (mode === "select" && detectedFields.length > 0) {
      const features = detectedFields.map(field => ({
        type: "Feature" as const,
        properties: { id: field.id, area: field.areaHectares },
        geometry: {
          type: "Polygon" as const,
          coordinates: [[...field.coordinates, field.coordinates[0]]],
        },
      }));

      mapInstance.addSource("detected-fields", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features,
        },
      });

      mapInstance.addLayer({
        id: "detected-fields-fill",
        type: "fill",
        source: "detected-fields",
        paint: {
          "fill-color": "#94a3b8",
          "fill-opacity": 0.4,
        },
      });

      mapInstance.addLayer({
        id: "detected-fields-outline",
        type: "line",
        source: "detected-fields",
        paint: {
          "line-color": "#64748b",
          "line-width": 2,
        },
      });
    }

    // Show selected detected field
    if (selectedDetectedField) {
      mapInstance.addSource("selected-field", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "Polygon",
            coordinates: [[...selectedDetectedField.coordinates, selectedDetectedField.coordinates[0]]],
          },
        },
      });

      mapInstance.addLayer({
        id: "selected-field-fill",
        type: "fill",
        source: "selected-field",
        paint: {
          "fill-color": "#22c55e",
          "fill-opacity": 0.5,
        },
      });

      mapInstance.addLayer({
        id: "selected-field-outline",
        type: "line",
        source: "selected-field",
        paint: {
          "line-color": "#16a34a",
          "line-width": 3,
        },
      });
    }
  }, [points, mapInstance, mode, detectedFields, selectedDetectedField]);

  // Detect fields in area
  const handleDetectFields = useCallback(async (center: [number, number]) => {
    setIsDetecting(true);
    try {
      const response = await fetch(`/api/trpc/fields.detectInArea?input=${encodeURIComponent(JSON.stringify({
        centerLng: center[0],
        centerLat: center[1],
        radiusKm: 2,
      }))}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.result?.data) {
          setDetectedFields(data.result.data);
        }
      }
    } catch (error) {
      console.error("Error detecting fields:", error);
    } finally {
      setIsDetecting(false);
    }
  }, []);

  const handleMapReady = useCallback((map: mapboxgl.Map) => {
    setMap(map);
    setMapInstance(map);

    // Set initial position
    const savedPos = getSavedMapPosition();
    if (savedPos && savedPos.center && !isNaN(savedPos.center[0]) && !isNaN(savedPos.center[1])) {
      map.setCenter(savedPos.center);
      map.setZoom(Math.max(savedPos.zoom, 15));
    } else {
      getUserLocation()
        .then(([lng, lat]) => {
          if (!isNaN(lng) && !isNaN(lat)) {
            map.flyTo({
              center: [lng, lat],
              zoom: 16,
              duration: 2000,
            });
          }
        })
        .catch(() => {
          map.setCenter([-54.6, -20.47]);
          map.setZoom(15);
        });
    }

    // Click handler for drawing
    map.on("click", (e: mapboxgl.MapMouseEvent) => {
      const newPoint: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      setPoints(prev => [...prev, newPoint]);
    });
    
  }, [setMap, getUserLocation]);

  const handleUndo = () => {
    setPoints(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPoints([]);
    setSelectedDetectedField(null);
    setArea(0);
  };

  const handleFinish = () => {
    if (points.length < 3) {
      toast.error("Desenhe pelo menos 3 pontos para criar um campo");
      return;
    }
    setShowNameDialog(true);
  };

  const handleCreateField = () => {
    if (!fieldName.trim()) {
      toast.error("Digite um nome para o campo");
      return;
    }

    const lngSum = points.reduce((sum, p) => sum + p[0], 0);
    const latSum = points.reduce((sum, p) => sum + p[1], 0);
    const centerLng = lngSum / points.length;
    const centerLat = latSum / points.length;

    const boundariesForStorage = points.map(p => ({ lat: p[1], lng: p[0] }));

    createField.mutate({
      name: fieldName,
      areaHectares: Math.round(area * 100),
      latitude: centerLat.toString(),
      longitude: centerLng.toString(),
      boundaries: JSON.stringify(boundariesForStorage),
    });
  };

  const handleLocateMe = async () => {
    if (!mapInstance) return;
    try {
      const [lng, lat] = await getUserLocation();
      mapInstance.flyTo({
        center: [lng, lat],
        zoom: 16,
        duration: 1500,
      });
    } catch (error) {
      toast.error("Não foi possível obter sua localização");
    }
  };

  const canFinish = points.length >= 3;

  return (
    <div className="relative h-screen w-full">
      {/* Mapbox Map */}
      <MapboxMap
        onMapReady={handleMapReady}
        style="satellite"
        initialZoom={15}
        initialCenter={[-54.6, -20.47]}
        className="absolute inset-0"
      />

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between pointer-events-none z-10">
        {/* Close Button */}
        <Button
          variant="secondary"
          size="icon"
          className="pointer-events-auto bg-white hover:bg-gray-100 rounded-full h-10 w-10 shadow-md"
          onClick={() => setLocation("/fields")}
        >
          <X className="h-5 w-5" />
        </Button>

        {/* Title */}
        <div className="pointer-events-none">
          <div className="bg-gray-800/90 text-white px-4 py-2 rounded-full">
            <span className="text-sm font-medium">Desenhar área do campo</span>
          </div>
        </div>

        {/* Spacer */}
        <div className="w-10" />
      </div>

      {/* Instructions */}
      {points.length === 0 && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <div className="bg-black/70 text-white px-4 py-2 rounded-full text-sm flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Toque no mapa para marcar os pontos do campo
          </div>
        </div>
      )}

      {points.length > 0 && points.length < 3 && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <div className="bg-black/70 text-white px-4 py-2 rounded-full text-sm">
            Continue tocando para desenhar ({points.length}/3 pontos mínimos)
          </div>
        </div>
      )}

      {/* Area display */}
      {area > 0 && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <div className="bg-green-600 text-white px-4 py-2 rounded-full text-sm font-medium">
            Área: {area.toFixed(1)} hectares
          </div>
        </div>
      )}

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-4 pointer-events-none z-10">
        <div className="flex items-center justify-between mb-3">
          {/* Undo Button */}
          <Button
            variant="secondary"
            className="pointer-events-auto bg-gray-800/90 text-white hover:bg-gray-700 rounded-full px-4 h-10 gap-2"
            onClick={handleUndo}
            disabled={points.length === 0}
          >
            <Undo2 className="h-4 w-4" />
            <span>Desfazer</span>
          </Button>

          {/* Location Button */}
          <Button
            variant="secondary"
            size="icon"
            className="pointer-events-auto bg-gray-800/90 text-white hover:bg-gray-700 rounded-full h-10 w-10"
            onClick={handleLocateMe}
          >
            <Navigation className="h-5 w-5" />
          </Button>
        </div>

        {/* Finish Button */}
        <Button
          className="pointer-events-auto w-full bg-green-600 hover:bg-green-700 text-white rounded-xl h-14 flex flex-col items-center justify-center gap-0"
          onClick={handleFinish}
          disabled={!canFinish}
        >
          <span className="text-base font-semibold">
            Finalizar limite do campo
          </span>
          {area > 0 && (
            <span className="text-sm font-normal opacity-90">
              Área: {area.toFixed(1)} ha
            </span>
          )}
        </Button>

        {/* Clear button */}
        {points.length > 0 && (
          <button
            className="pointer-events-auto w-full mt-2 text-white/80 text-sm underline"
            onClick={handleClear}
          >
            Limpar e recomeçar
          </button>
        )}
      </div>

      {/* Name Dialog */}
      <Dialog open={showNameDialog} onOpenChange={setShowNameDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nome do Campo</DialogTitle>
            <DialogDescription>
              Digite um nome para identificar este campo
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={fieldName}
              onChange={(e) => setFieldName(e.target.value)}
              placeholder="Ex: Pasto Norte, Talhão 1..."
              autoFocus
            />
            <p className="text-sm text-gray-500 mt-2">
              Área: {area.toFixed(1)} hectares
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowNameDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreateField}
              disabled={createField.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {createField.isPending ? "Criando..." : "Criar Campo"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
