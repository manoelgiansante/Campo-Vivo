import { trpc } from "@/lib/trpc";
import { MapboxMap, useMapbox } from "@/components/MapboxMap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  X, 
  Hand, 
  Pencil, 
  Search,
  Navigation,
  Undo2,
  Trash2,
  Check,
  MapPin
} from "lucide-react";
import { useState, useCallback, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import mapboxgl from "mapbox-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import * as turf from "@turf/turf";

type DrawMode = "select" | "draw";

// Custom styles for Mapbox Draw
const drawStyles = [
  // Polygon fill
  {
    id: "gl-draw-polygon-fill",
    type: "fill",
    filter: ["all", ["==", "$type", "Polygon"], ["!=", "mode", "static"]],
    paint: {
      "fill-color": "#22C55E",
      "fill-outline-color": "#22C55E",
      "fill-opacity": 0.3,
    },
  },
  // Polygon outline stroke
  {
    id: "gl-draw-polygon-stroke-active",
    type: "line",
    filter: ["all", ["==", "$type", "Polygon"], ["!=", "mode", "static"]],
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-color": "#FFFFFF",
      "line-dasharray": [0.2, 2],
      "line-width": 3,
    },
  },
  // Vertex point halos
  {
    id: "gl-draw-polygon-and-line-vertex-halo-active",
    type: "circle",
    filter: ["all", ["==", "meta", "vertex"], ["==", "$type", "Point"], ["!=", "mode", "static"]],
    paint: {
      "circle-radius": 7,
      "circle-color": "#FFF",
    },
  },
  // Vertex points
  {
    id: "gl-draw-polygon-and-line-vertex-active",
    type: "circle",
    filter: ["all", ["==", "meta", "vertex"], ["==", "$type", "Point"], ["!=", "mode", "static"]],
    paint: {
      "circle-radius": 5,
      "circle-color": "#22C55E",
    },
  },
  // Midpoint
  {
    id: "gl-draw-polygon-midpoint",
    type: "circle",
    filter: ["all", ["==", "$type", "Point"], ["==", "meta", "midpoint"]],
    paint: {
      "circle-radius": 4,
      "circle-color": "#22C55E",
      "circle-opacity": 0.8,
    },
  },
];

export default function FieldDrawPro() {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<DrawMode>("draw");
  const [area, setArea] = useState<number>(0);
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [fieldName, setFieldName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [mapInstance, setMapInstance] = useState<mapboxgl.Map | null>(null);
  const [drawInstance, setDrawInstance] = useState<MapboxDraw | null>(null);
  const [currentPolygon, setCurrentPolygon] = useState<any>(null);
  const { setMap, getUserLocation } = useMapbox();

  const createField = trpc.fields.create.useMutation({
    onSuccess: (data) => {
      toast.success("Campo criado com sucesso!");
      setLocation(`/fields/${data.id}`);
    },
    onError: () => {
      toast.error("Erro ao criar campo");
    },
  });

  // Geocoding search
  const handleSearch = async () => {
    if (!searchQuery.trim() || !mapInstance) return;

    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?access_token=${import.meta.env.VITE_MAPBOX_TOKEN}&country=br&types=place,locality,neighborhood,address`
      );
      const data = await response.json();

      if (data.features && data.features.length > 0) {
        const [lng, lat] = data.features[0].center;
        mapInstance.flyTo({
          center: [lng, lat],
          zoom: 15,
          duration: 2000,
        });
        toast.success(`Localização: ${data.features[0].place_name}`);
      } else {
        toast.error("Localização não encontrada");
      }
    } catch (error) {
      toast.error("Erro ao buscar localização");
    }
  };

  const handleMapReady = useCallback((map: mapboxgl.Map) => {
    setMap(map);
    setMapInstance(map);

    // Initialize Mapbox Draw
    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {},
      defaultMode: "draw_polygon",
      styles: drawStyles,
    });

    map.addControl(draw);
    setDrawInstance(draw);

    // Event listeners with proper typing
    map.on("draw.create", (e: { features: GeoJSON.Feature[] }) => {
      const polygon = e.features[0];
      if (polygon) {
        setCurrentPolygon(polygon);
        const areaM2 = turf.area(polygon);
        const areaHa = areaM2 / 10000;
        setArea(areaHa);
      }
    });

    map.on("draw.update", (e: { features: GeoJSON.Feature[] }) => {
      const polygon = e.features[0];
      if (polygon) {
        setCurrentPolygon(polygon);
        const areaM2 = turf.area(polygon);
        const areaHa = areaM2 / 10000;
        setArea(areaHa);
      }
    });

    map.on("draw.delete", () => {
      setCurrentPolygon(null);
      setArea(0);
    });

    map.on("draw.modechange", (e: { mode: string }) => {
      if (e.mode === "simple_select") {
        setMode("select");
      } else if (e.mode === "draw_polygon") {
        setMode("draw");
      }
    });

    // Try to get user location
    getUserLocation()
      .then(([lng, lat]) => {
        map.flyTo({
          center: [lng, lat],
          zoom: 16,
          duration: 2000,
        });
      })
      .catch(() => {
        map.setCenter([-47.9292, -15.7801]);
        map.setZoom(5);
      });
  }, [setMap, getUserLocation]);

  const handleModeChange = (newMode: DrawMode) => {
    setMode(newMode);
    if (drawInstance) {
      if (newMode === "draw") {
        drawInstance.changeMode("draw_polygon");
      } else {
        drawInstance.changeMode("simple_select");
      }
    }
  };

  const handleUndo = () => {
    if (drawInstance) {
      const all = drawInstance.getAll();
      if (all.features.length > 0) {
        const lastFeature = all.features[all.features.length - 1];
        drawInstance.delete(lastFeature.id as string);
        setCurrentPolygon(null);
        setArea(0);
      }
    }
  };

  const handleClear = () => {
    if (drawInstance) {
      drawInstance.deleteAll();
      setCurrentPolygon(null);
      setArea(0);
    }
  };

  const handleFinish = () => {
    if (!currentPolygon) {
      toast.error("Desenhe um campo primeiro");
      return;
    }
    setShowNameDialog(true);
  };

  const handleCreateField = () => {
    if (!fieldName.trim()) {
      toast.error("Digite um nome para o campo");
      return;
    }

    if (!currentPolygon) {
      toast.error("Desenhe um campo primeiro");
      return;
    }

    // Get coordinates from polygon
    const coordinates = currentPolygon.geometry.coordinates[0];
    
    // Calculate center
    const centroid = turf.centroid(currentPolygon);
    const [centerLng, centerLat] = centroid.geometry.coordinates;

    // Convert to lat/lng format for storage
    const boundaryPoints = coordinates.slice(0, -1).map((coord: [number, number]) => ({
      lat: coord[1],
      lng: coord[0],
    }));

    createField.mutate({
      name: fieldName,
      latitude: centerLat.toString(),
      longitude: centerLng.toString(),
      boundaries: JSON.stringify(boundaryPoints),
      areaHectares: Math.round(area * 100), // Store as hectares * 100 for precision (150.5 ha = 15050)
    });
  };

  const centerOnLocation = async () => {
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

  return (
    <div className="relative h-screen w-full">
      {/* Map */}
      <MapboxMap
        onMapReady={handleMapReady}
        style="satellite"
        className="absolute inset-0"
      />

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4 safe-area-top">
        <div className="flex items-center gap-3">
          {/* Close Button */}
          <Button
            variant="secondary"
            size="icon"
            className="rounded-full bg-white/90 backdrop-blur-sm shadow-lg h-10 w-10"
            onClick={() => setLocation("/fields")}
          >
            <X className="h-5 w-5" />
          </Button>

          {/* Search Bar */}
          <div className="flex-1 flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg">
            <Search className="h-4 w-4 text-gray-500" />
            <Input
              type="text"
              placeholder="Buscar localização..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSearch()}
              className="border-0 bg-transparent focus-visible:ring-0 p-0 h-auto text-sm"
            />
          </div>
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="absolute top-20 right-4 z-10">
        <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg overflow-hidden">
          <button
            onClick={() => handleModeChange("select")}
            className={`flex items-center gap-2 px-4 py-3 w-full transition-colors ${
              mode === "select" ? "bg-green-500 text-white" : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            <Hand className="h-5 w-5" />
            <span className="text-sm font-medium">Selecionar</span>
          </button>
          <button
            onClick={() => handleModeChange("draw")}
            className={`flex items-center gap-2 px-4 py-3 w-full transition-colors ${
              mode === "draw" ? "bg-green-500 text-white" : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            <Pencil className="h-5 w-5" />
            <span className="text-sm font-medium">Desenhar</span>
          </button>
        </div>
      </div>

      {/* Right Side Controls */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-2">
        <Button
          variant="secondary"
          size="icon"
          className="rounded-full bg-white/90 backdrop-blur-sm shadow-lg h-12 w-12"
          onClick={centerOnLocation}
        >
          <Navigation className="h-5 w-5 text-green-600" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="rounded-full bg-white/90 backdrop-blur-sm shadow-lg h-12 w-12"
          onClick={handleUndo}
          disabled={!currentPolygon}
        >
          <Undo2 className="h-5 w-5" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="rounded-full bg-white/90 backdrop-blur-sm shadow-lg h-12 w-12"
          onClick={handleClear}
          disabled={!currentPolygon}
        >
          <Trash2 className="h-5 w-5 text-red-500" />
        </Button>
      </div>

      {/* Bottom Panel */}
      <div className="absolute bottom-0 left-0 right-0 z-10 safe-area-bottom">
        <div className="bg-white/95 backdrop-blur-sm rounded-t-3xl shadow-lg p-6">
          {/* Area Display */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-gray-500">Área do campo</p>
              <p className="text-3xl font-bold text-gray-900">
                {area > 0 ? area.toFixed(2) : "0.00"} <span className="text-lg font-normal text-gray-500">ha</span>
              </p>
            </div>
            {currentPolygon && (
              <div className="flex items-center gap-1 text-green-600">
                <Check className="h-5 w-5" />
                <span className="text-sm font-medium">Campo desenhado</span>
              </div>
            )}
          </div>

          {/* Instructions */}
          {!currentPolygon && (
            <p className="text-sm text-gray-500 mb-4">
              {mode === "draw" 
                ? "Toque no mapa para desenhar os limites do campo. Feche o polígono clicando no primeiro ponto."
                : "Arraste os pontos para ajustar os limites do campo."
              }
            </p>
          )}

          {/* Finish Button */}
          <Button
            className="w-full bg-green-600 hover:bg-green-700 text-white h-14 text-lg font-semibold rounded-xl"
            onClick={handleFinish}
            disabled={!currentPolygon || createField.isPending}
          >
            {createField.isPending ? "Salvando..." : "Finalizar e Salvar"}
          </Button>
        </div>
      </div>

      {/* Name Dialog */}
      <Dialog open={showNameDialog} onOpenChange={setShowNameDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nome do Campo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Input
                placeholder="Ex: Talhão Norte, Área de Soja..."
                value={fieldName}
                onChange={(e) => setFieldName(e.target.value)}
                className="h-12"
                autoFocus
              />
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Área total:</span>
                <span className="font-semibold">{area.toFixed(2)} ha</span>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowNameDialog(false)}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={handleCreateField}
                disabled={createField.isPending}
              >
                {createField.isPending ? "Salvando..." : "Salvar Campo"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
