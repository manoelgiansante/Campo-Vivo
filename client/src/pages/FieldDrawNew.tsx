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
  Square
} from "lucide-react";
import { useState, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import mapboxgl from "mapbox-gl";
import * as turf from "@turf/turf";

type DrawMode = "select" | "draw";

export default function FieldDrawNew() {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<DrawMode>("draw");
  const [points, setPoints] = useState<[number, number][]>([]); // [lng, lat]
  const [area, setArea] = useState<number>(0);
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [fieldName, setFieldName] = useState("");
  const [mapInstance, setMapInstance] = useState<mapboxgl.Map | null>(null);
  const { setMap, getUserLocation } = useMapbox();
  const markersRef = useState<mapboxgl.Marker[]>([])[0];

  const createField = trpc.fields.create.useMutation({
    onSuccess: (data) => {
      toast.success("Campo criado com sucesso!");
      setLocation(`/fields/${data.id}`);
    },
    onError: () => {
      toast.error("Erro ao criar campo");
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
    markersRef.forEach(m => m.remove());
    markersRef.length = 0;

    // Remove existing polygon
    if (mapInstance.getLayer("draw-polygon")) {
      mapInstance.removeLayer("draw-polygon");
    }
    if (mapInstance.getLayer("draw-polygon-outline")) {
      mapInstance.removeLayer("draw-polygon-outline");
    }
    if (mapInstance.getSource("draw-polygon")) {
      mapInstance.removeSource("draw-polygon");
    }

    if (points.length > 0) {
      // Add markers for each point
      points.forEach((point, index) => {
        const el = document.createElement("div");
        el.className = "w-5 h-5 bg-white rounded-full border-2 border-gray-500 shadow-md cursor-move";
        
        const marker = new mapboxgl.Marker({ 
          element: el, 
          draggable: mode === "select" 
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

        markersRef.push(marker);
      });

      // Draw polygon if we have at least 3 points
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
            "fill-color": "#22C55E",
            "fill-opacity": 0.4,
          },
        });

        mapInstance.addLayer({
          id: "draw-polygon-outline",
          type: "line",
          source: "draw-polygon",
          paint: {
            "line-color": "#FFFFFF",
            "line-width": 2,
          },
        });
      }
    }
  }, [points, mode, mapInstance, markersRef]);

  const handleMapReady = useCallback((map: mapboxgl.Map) => {
    setMap(map);
    setMapInstance(map);

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
        // Keep default center (Brazil)
        map.setCenter([-47.9292, -15.7801]);
        map.setZoom(5);
      });

    // Add click listener for drawing
    map.on("click", (e) => {
      if (mode === "draw") {
        setPoints(prev => [...prev, [e.lngLat.lng, e.lngLat.lat]]);
      }
    });
  }, [setMap, getUserLocation, mode]);

  const handleUndo = () => {
    setPoints(prev => prev.slice(0, -1));
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

    // Calculate center point
    const lngSum = points.reduce((sum, p) => sum + p[0], 0);
    const latSum = points.reduce((sum, p) => sum + p[1], 0);
    const centerLng = lngSum / points.length;
    const centerLat = latSum / points.length;

    // Convert to lat/lng format for storage
    const boundariesForStorage = points.map(p => ({ lat: p[1], lng: p[0] }));

    createField.mutate({
      name: fieldName,
      areaHectares: Math.round(area * 100), // Store as integer (hectares * 100)
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

  return (
    <div className="relative h-screen w-full">
      {/* Mapbox Map */}
      <MapboxMap
        onMapReady={handleMapReady}
        style="satellite"
        initialZoom={5}
        initialCenter={[-47.9292, -15.7801]}
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

        {/* Mode Toggle */}
        <div className="pointer-events-auto bg-gray-800/90 rounded-full p-1 flex">
          <button
            onClick={() => setMode("select")}
            className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors ${
              mode === "select" ? "bg-gray-700 text-white" : "text-gray-400"
            }`}
          >
            <Hand className="h-4 w-4" />
            <span className="text-sm">Select</span>
          </button>
          <button
            onClick={() => setMode("draw")}
            className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors ${
              mode === "draw" ? "bg-gray-700 text-white" : "text-gray-400"
            }`}
          >
            <Pencil className="h-4 w-4" />
            <span className="text-sm">Draw</span>
          </button>
        </div>

        {/* Search Button */}
        <Button
          variant="secondary"
          size="icon"
          className="pointer-events-auto bg-gray-800/90 text-white hover:bg-gray-700 rounded-full h-10 w-10"
        >
          <Search className="h-5 w-5" />
        </Button>
      </div>

      {/* Left Side - Control Buttons */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 pointer-events-auto z-10">
        <Button
          variant="secondary"
          size="icon"
          className="bg-gray-800/90 text-white hover:bg-gray-700 rounded-lg h-10 w-10"
        >
          <Square className="h-5 w-5" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="bg-gray-800/90 text-white hover:bg-gray-700 rounded-lg h-10 w-10"
          onClick={handleLocateMe}
        >
          <Navigation className="h-5 w-5" />
        </Button>
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-4 pointer-events-none z-10">
        {/* Field Name Label */}
        {points.length > 0 && (
          <div className="text-white text-sm mb-2 pointer-events-none">
            <span className="bg-black/50 px-2 py-1 rounded">Novo campo</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          {/* Undo Button */}
          <Button
            variant="secondary"
            className="pointer-events-auto bg-gray-800/90 text-white hover:bg-gray-700 rounded-full px-4 h-10 gap-2"
            onClick={handleUndo}
            disabled={points.length === 0}
          >
            <Undo2 className="h-4 w-4" />
            <span>Undo</span>
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
          className="pointer-events-auto w-full mt-3 bg-green-600 hover:bg-green-700 text-white rounded-xl h-14 text-base font-semibold"
          onClick={handleFinish}
          disabled={points.length < 3}
        >
          Finish field boundary
          {area > 0 && (
            <span className="ml-2 font-normal">
              Area {area.toFixed(1)} ha
            </span>
          )}
        </Button>
      </div>

      {/* Name Dialog */}
      <Dialog open={showNameDialog} onOpenChange={setShowNameDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nome do Campo</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={fieldName}
              onChange={(e) => setFieldName(e.target.value)}
              placeholder="Ex: Pasto 1, Talhão Norte..."
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
