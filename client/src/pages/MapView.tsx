import { trpc } from "@/lib/trpc";
import { MapboxMap, useMapbox } from "@/components/MapboxMap";
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
import { 
  Folder, 
  ChevronDown, 
  Search, 
  Plus,
  Navigation,
  Leaf,
  Satellite,
  Wheat,
  Locate
} from "lucide-react";
import { useState, useCallback, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import mapboxgl from "mapbox-gl";
import { clipImageToPolygon } from "@/utils/clipImageToPolygon";

type MapLayer = "satellite" | "crop" | "vegetation";
type NdviType = "basic" | "contrasted" | "average" | "heterogenity";

export default function MapView() {
  const [, setLocation] = useLocation();
  const [selectedSeason, setSelectedSeason] = useState("2024");
  const [mapLayer, setMapLayer] = useState<MapLayer>("vegetation");
  const [ndviType, setNdviType] = useState<NdviType>("basic");
  const [showLayerSheet, setShowLayerSheet] = useState(false);
  const [mapInstance, setMapInstance] = useState<mapboxgl.Map | null>(null);
  const { setMap, getUserLocation, watchUserLocation, clearWatchLocation } = useMapbox();
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const loadedOverlaysRef = useRef<Set<number>>(new Set());
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

  const { data: fields } = trpc.fields.list.useQuery();

  // Watch user location continuously
  useEffect(() => {
    if (!mapInstance) return;

    watchIdRef.current = watchUserLocation(
      (coords) => {
        setUserLocation(coords);
        updateUserMarker(coords);
      },
      (error) => {
        console.log("Location watch:", error.message);
      }
    );

    return () => {
      if (watchIdRef.current !== null) {
        clearWatchLocation(watchIdRef.current);
      }
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
      }
    };
  }, [mapInstance, watchUserLocation, clearWatchLocation]);

  // Update user marker on map
  const updateUserMarker = useCallback((coords: [number, number]) => {
    if (!mapInstance) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.setLngLat(coords);
    } else {
      // Create pulsing blue dot
      const el = document.createElement("div");
      el.innerHTML = `
        <div style="position: relative; width: 24px; height: 24px;">
          <div style="position: absolute; inset: 0; background: #3B82F6; border-radius: 50%; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite; opacity: 0.75;"></div>
          <div style="position: relative; width: 16px; height: 16px; margin: 4px; background: #3B82F6; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>
        </div>
      `;
      
      // Add CSS animation if not exists
      if (!document.getElementById('user-marker-style')) {
        const style = document.createElement('style');
        style.id = 'user-marker-style';
        style.textContent = `
          @keyframes ping {
            75%, 100% { transform: scale(2); opacity: 0; }
          }
        `;
        document.head.appendChild(style);
      }

      userMarkerRef.current = new mapboxgl.Marker({ element: el })
        .setLngLat(coords)
        .addTo(mapInstance);
    }
  }, [mapInstance]);

  // Função para obter cor NDVI - Estilo OneSoil
  const getNdviColor = (value: number): string => {
    if (value < 0.2) return "#E53935"; // Vermelho (estresse)
    if (value < 0.3) return "#FF5722"; // Laranja-vermelho
    if (value < 0.4) return "#FF9800"; // Laranja
    if (value < 0.5) return "#FFC107"; // Amarelo
    if (value < 0.6) return "#CDDC39"; // Amarelo-verde
    if (value < 0.7) return "#8BC34A"; // Verde claro
    if (value < 0.8) return "#4CAF50"; // Verde
    return "#2E7D32"; // Verde escuro
  };

  // Função para carregar overlay NDVI de um campo específico
  const loadNdviOverlayForField = useCallback(async (
    map: mapboxgl.Map,
    field: { id: number; boundaries: string | null; agroPolygonId?: string | null; currentNdvi?: number | null; areaHectares?: number | null; name: string }
  ) => {
    if (!field.boundaries || loadedOverlaysRef.current.has(field.id)) return;
    
    try {
      const points = (typeof field.boundaries === 'string' ? JSON.parse(field.boundaries) : field.boundaries) as { lat: number; lng: number }[];
      if (points.length < 3) return;

      const coordinates = points.map(p => [p.lng, p.lat] as [number, number]);
      if (coordinates[0][0] !== coordinates[coordinates.length - 1][0] || 
          coordinates[0][1] !== coordinates[coordinates.length - 1][1]) {
        coordinates.push(coordinates[0]);
      }

      const sourceId = `field-${field.id}`;
      const ndviImageSourceId = `field-ndvi-image-${field.id}`;
      const ndviImageLayerId = `field-ndvi-layer-${field.id}`;
      const fillLayerId = `field-fill-${field.id}`;
      const outlineLayerId = `field-outline-${field.id}`;

      // Calcular bounds
      const lngs = coordinates.map(c => c[0]);
      const lats = coordinates.map(c => c[1]);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);

      // Limpar layers/sources existentes
      [ndviImageLayerId, fillLayerId, outlineLayerId].forEach(id => {
        if (map.getLayer(id)) map.removeLayer(id);
      });
      [ndviImageSourceId, sourceId].forEach(id => {
        if (map.getSource(id)) map.removeSource(id);
      });

      // Adicionar source do polígono
      map.addSource(sourceId, {
        type: "geojson",
        data: {
          type: "Feature",
          properties: { id: field.id, name: field.name },
          geometry: {
            type: "Polygon",
            coordinates: [coordinates],
          },
        },
      });

      // Se o campo tem agroPolygonId, tentar carregar imagem NDVI real
      if (field.agroPolygonId && mapLayer === "vegetation") {
        try {
          const proxyUrl = `/api/copernicus-ndvi/${field.id}?palette=onesoil`;
          
          // Carregar e recortar a imagem NDVI para seguir o contorno do polígono (estilo OneSoil)
          const clippedImageUrl = await clipImageToPolygon(
            proxyUrl,
            coordinates,
            { minLng, maxLng, minLat, maxLat }
          );

          // Adicionar source da imagem NDVI recortada
          map.addSource(ndviImageSourceId, {
            type: "image",
            url: clippedImageUrl,
            coordinates: [
              [minLng, maxLat], // top-left
              [maxLng, maxLat], // top-right
              [maxLng, minLat], // bottom-right
              [minLng, minLat], // bottom-left
            ],
          });

          // Adicionar layer da imagem NDVI
          map.addLayer({
            id: ndviImageLayerId,
            type: "raster",
            source: ndviImageSourceId,
            paint: {
              "raster-opacity": 0.9,
              "raster-fade-duration": 0,
            },
          });

          console.log(`[MapView] NDVI overlay loaded for field ${field.id}`);
          loadedOverlaysRef.current.add(field.id);
        } catch (error) {
          console.warn(`[MapView] Failed to load NDVI for field ${field.id}:`, error);
          // Fallback: usar cor sólida baseada no NDVI
          addFallbackFill(map, fillLayerId, sourceId, field.currentNdvi);
        }
      } else {
        // Sem agroPolygonId ou não está em modo vegetation
        addFallbackFill(map, fillLayerId, sourceId, field.currentNdvi);
      }

      // Adicionar contorno do campo (sempre visível)
      map.addLayer({
        id: outlineLayerId,
        type: "line",
        source: sourceId,
        paint: {
          "line-color": mapLayer === "vegetation" ? "#FFFFFF" : "#000000",
          "line-width": 2,
          "line-opacity": 0.9,
        },
      });

      // Click handler
      map.on("click", outlineLayerId, () => {
        setLocation(`/fields/${field.id}`);
      });

      // Cursor handlers
      map.on("mouseenter", outlineLayerId, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", outlineLayerId, () => {
        map.getCanvas().style.cursor = "";
      });

      // Adicionar label com área em hectares
      const centerLng = (minLng + maxLng) / 2;
      const centerLat = (minLat + maxLat) / 2;
      const areaText = field.areaHectares ? `${(field.areaHectares / 100).toFixed(1)} ha` : "";

      if (areaText) {
        const el = document.createElement("div");
        el.innerHTML = `
          <div class="bg-white/95 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-lg cursor-pointer hover:bg-white transition-colors flex items-center gap-1.5 border border-gray-200/50">
            <span class="text-gray-500 text-sm font-medium">+</span>
            <span class="font-semibold text-gray-800 text-sm">${areaText}</span>
          </div>
        `;
        el.onclick = () => setLocation(`/fields/${field.id}`);

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([centerLng, centerLat])
          .addTo(map);
        
        markersRef.current.push(marker);
      }
    } catch (e) {
      console.error(`[MapView] Error processing field ${field.id}:`, e);
    }
  }, [mapLayer, setLocation]);

  // Função auxiliar para adicionar fill de fallback
  const addFallbackFill = (
    map: mapboxgl.Map,
    layerId: string,
    sourceId: string,
    currentNdvi: number | null | undefined
  ) => {
    const ndviValue = currentNdvi ? currentNdvi / 100 : 0.5;
    const fillColor = mapLayer === "vegetation" ? getNdviColor(ndviValue) : "#666666";
    const fillOpacity = mapLayer === "vegetation" ? 0.6 : 0.3;

    map.addLayer({
      id: layerId,
      type: "fill",
      source: sourceId,
      paint: {
        "fill-color": fillColor,
        "fill-opacity": fillOpacity,
      },
    });
  };

  // Adicionar campos ao mapa quando os dados carregam
  useEffect(() => {
    if (!mapInstance || !fields) return;

    const addFieldsToMap = async () => {
      // Limpar markers anteriores
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      loadedOverlaysRef.current.clear();

      // Carregar overlays para cada campo
      for (const field of fields) {
        await loadNdviOverlayForField(mapInstance, field as any);
      }

      // Ajustar bounds para mostrar todos os campos
      if (fields.length > 0) {
        const allCoords: [number, number][] = [];
        fields.forEach((field) => {
          if (field.boundaries) {
            try {
              const points = (typeof field.boundaries === 'string' ? JSON.parse(field.boundaries) : field.boundaries) as { lat: number; lng: number }[];
              points.forEach(p => allCoords.push([p.lng, p.lat]));
            } catch (e) {}
          } else if (field.latitude && field.longitude) {
            allCoords.push([parseFloat(field.longitude), parseFloat(field.latitude)]);
          }
        });

        if (allCoords.length > 0) {
          const bounds = allCoords.reduce(
            (bounds, coord) => bounds.extend(coord),
            new mapboxgl.LngLatBounds(allCoords[0], allCoords[0])
          );
          mapInstance.fitBounds(bounds, { padding: 50, maxZoom: 15 });
        }
      }
    };

    if (mapInstance.isStyleLoaded()) {
      addFieldsToMap();
    } else {
      mapInstance.on("style.load", addFieldsToMap);
    }
  }, [mapInstance, fields, mapLayer, loadNdviOverlayForField]);

  const handleMapReady = useCallback((map: mapboxgl.Map) => {
    setMap(map);
    setMapInstance(map);

    // Tentar obter localização do usuário
    getUserLocation()
      .then(([lng, lat]) => {
        map.flyTo({
          center: [lng, lat],
          zoom: 14,
          duration: 2000,
        });
      })
      .catch(() => {
        // Manter centro padrão
      });
  }, [setMap, getUserLocation]);

  const handleLocateMe = async () => {
    if (!mapInstance) return;
    
    toast.loading("Obtendo localização...", { id: "map-location" });
    
    try {
      const [lng, lat] = await getUserLocation();
      setUserLocation([lng, lat]);
      updateUserMarker([lng, lat]);
      mapInstance.flyTo({
        center: [lng, lat],
        zoom: 16,
        duration: 1500,
      });
      toast.success("Localização encontrada!", { id: "map-location" });
    } catch (error: any) {
      toast.error(error.message || "Não foi possível obter sua localização", { id: "map-location" });
    }
  };

  return (
    <div className="relative h-screen w-full">
      {/* Mapbox Map */}
      <MapboxMap
        onMapReady={handleMapReady}
        style="satellite"
        initialZoom={4}
        initialCenter={[-47.9292, -15.7801]}
        className="absolute inset-0"
      />

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between pointer-events-none z-10">
        <div className="pointer-events-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="secondary" 
                className="bg-gray-800/90 text-white hover:bg-gray-700 rounded-full px-4 h-10 gap-2"
              >
                <Folder className="h-4 w-4" />
                <span>All fields</span>
                <span className="text-gray-400">Season {selectedSeason}</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem onClick={() => setSelectedSeason("2024")}>
                Season 2024
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelectedSeason("2023")}>
                Season 2023
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          <Button
            variant="secondary"
            size="icon"
            className="bg-gray-800/90 text-white hover:bg-gray-700 rounded-full h-10 w-10"
          >
            <Search className="h-5 w-5" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="bg-gray-800/90 text-white hover:bg-gray-700 rounded-full h-10 w-10"
            onClick={() => {
              // Passar posição atual do mapa para a página de criação
              if (mapInstance) {
                const center = mapInstance.getCenter();
                const zoom = mapInstance.getZoom();
                setLocation(`/fields/new?lat=${center.lat.toFixed(6)}&lng=${center.lng.toFixed(6)}&zoom=${Math.round(zoom)}`);
              } else {
                setLocation("/fields/new");
              }
            }}
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* NDVI Scale (left side) - Estilo OneSoil */}
      {mapLayer === "vegetation" && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none z-10 flex flex-col items-center gap-1">
          <span className="text-white text-xs font-medium drop-shadow-lg">1.0</span>
          <div className="w-3 h-32 rounded-full overflow-hidden shadow-lg" style={{
            background: "linear-gradient(to bottom, #15803D, #22C55E, #84CC16, #EAB308, #F97316, #EF4444)"
          }} />
          <span className="text-white text-xs font-medium drop-shadow-lg">0.0</span>
        </div>
      )}

      {/* Bottom Controls */}
      <div className="absolute bottom-20 left-0 right-0 flex flex-col items-center gap-3 pointer-events-none z-10">
        <Button
          onClick={() => setShowLayerSheet(true)}
          className="pointer-events-auto bg-gray-800/90 text-white hover:bg-gray-700 rounded-full px-6 h-10 gap-2"
        >
          <Leaf className="h-4 w-4" />
          <span>Vegetação</span>
        </Button>
      </div>

      {/* Right Side Controls */}
      <div className="absolute right-4 bottom-24 flex flex-col gap-2 pointer-events-auto z-10">
        <Button
          variant="secondary"
          size="icon"
          className="bg-blue-500 text-white hover:bg-blue-600 rounded-full h-12 w-12 shadow-lg"
          onClick={handleLocateMe}
        >
          <Locate className="h-5 w-5" />
        </Button>
      </div>

      {/* Layer Selection Sheet */}
      <Sheet open={showLayerSheet} onOpenChange={setShowLayerSheet}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>Camada do Mapa</SheetTitle>
          </SheetHeader>
          <div className="py-6">
            <div className="flex gap-4 mb-6">
              <LayerButton
                icon={<Satellite className="h-6 w-6" />}
                label="Imagem Satélite"
                active={mapLayer === "satellite"}
                onClick={() => setMapLayer("satellite")}
                color="green"
              />
              <LayerButton
                icon={<Wheat className="h-6 w-6" />}
                label="Cultivo"
                active={mapLayer === "crop"}
                onClick={() => setMapLayer("crop")}
                color="blue"
              />
              <LayerButton
                icon={<Leaf className="h-6 w-6" />}
                label="Vegetação"
                active={mapLayer === "vegetation"}
                onClick={() => setMapLayer("vegetation")}
                color="green"
              />
            </div>

            {mapLayer === "vegetation" && (
              <div className="space-y-2">
                <NdviOption
                  label="NDVI Básico"
                  active={ndviType === "basic"}
                  onClick={() => setNdviType("basic")}
                />
                <NdviOption
                  label="NDVI Contrastado"
                  active={ndviType === "contrasted"}
                  onClick={() => setNdviType("contrasted")}
                />
                <NdviOption
                  label="NDVI Médio"
                  active={ndviType === "average"}
                  onClick={() => setNdviType("average")}
                />
                <NdviOption
                  label="NDVI Heterogeneidade"
                  active={ndviType === "heterogenity"}
                  onClick={() => setNdviType("heterogenity")}
                />
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function LayerButton({ 
  icon, 
  label, 
  active, 
  onClick, 
  color 
}: { 
  icon: React.ReactNode; 
  label: string; 
  active: boolean; 
  onClick: () => void;
  color: "green" | "blue";
}) {
  const bgColor = color === "green" ? "bg-green-500" : "bg-blue-400";
  
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all ${
        active ? "ring-2 ring-gray-400 ring-offset-2" : ""
      }`}
    >
      <div className={`h-16 w-16 rounded-xl ${bgColor} flex items-center justify-center text-white`}>
        {icon}
      </div>
      <span className="text-xs text-center">{label}</span>
    </button>
  );
}

function NdviOption({ 
  label, 
  active, 
  onClick 
}: { 
  label: string; 
  active: boolean; 
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 rounded-xl transition-colors ${
        active ? "bg-gray-100 font-medium" : "hover:bg-gray-50"
      }`}
    >
      {label}
    </button>
  );
}
