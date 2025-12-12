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
import { FieldBottomSheet } from "@/components/FieldBottomSheet";
import { 
  Folder, 
  ChevronDown, 
  Search, 
  Plus,
  Navigation,
  Leaf,
  Satellite,
  Wheat
} from "lucide-react";
import { useState, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import mapboxgl from "mapbox-gl";

type MapLayer = "satellite" | "crop" | "vegetation";
type NdviType = "basic" | "contrasted" | "average" | "heterogenity";

// Salvar e carregar última posição do mapa
const MAP_POSITION_KEY = "campovivo_map_position";

function getSavedMapPosition(): { center: [number, number]; zoom: number } | null {
  try {
    const saved = localStorage.getItem(MAP_POSITION_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn("Erro ao carregar posição do mapa:", e);
  }
  return null;
}

function saveMapPosition(center: [number, number], zoom: number) {
  try {
    localStorage.setItem(MAP_POSITION_KEY, JSON.stringify({ center, zoom }));
  } catch (e) {
    console.warn("Erro ao salvar posição do mapa:", e);
  }
}

export default function MapView() {
  const [, setLocation] = useLocation();
  const [selectedSeason, setSelectedSeason] = useState("2024");
  const [mapLayer, setMapLayer] = useState<MapLayer>("vegetation");
  const [ndviType, setNdviType] = useState<NdviType>("basic");
  const [showLayerSheet, setShowLayerSheet] = useState(false);
  const [mapInstance, setMapInstance] = useState<mapboxgl.Map | null>(null);
  const { setMap, getUserLocation } = useMapbox();

  // Bottom sheet state
  const [selectedFieldId, setSelectedFieldId] = useState<number | null>(null);
  const [showFieldSheet, setShowFieldSheet] = useState(false);

  const { data: fields } = trpc.fields.list.useQuery();

  // Add fields to map when data loads
  useEffect(() => {
    if (!mapInstance || !fields) return;

    const addFieldsToMap = () => {
      fields.forEach((field) => {
        if (!field.boundaries) return;
        
        try {
          // Parse boundaries com validação robusta
          let points: { lat: number; lng: number }[];
          
          if (typeof field.boundaries === 'string') {
            points = JSON.parse(field.boundaries);
          } else {
            points = field.boundaries as { lat: number; lng: number }[];
          }
          
          // Validar formato
          if (!Array.isArray(points) || points.length < 3) {
            console.warn(`Campo ${field.id}: boundaries inválido (menos de 3 pontos)`);
            return;
          }
          
          // Verificar se tem lat/lng válidos
          const hasValidCoords = points.every(p => 
            typeof p.lat === 'number' && 
            typeof p.lng === 'number' &&
            !isNaN(p.lat) && 
            !isNaN(p.lng)
          );
          
          if (!hasValidCoords) {
            console.warn(`Campo ${field.id}: coordenadas inválidas`);
            return;
          }

          // Convert to Mapbox format [lng, lat]
          const coordinates = points.map(p => [p.lng, p.lat] as [number, number]);
          coordinates.push(coordinates[0]); // Close polygon

          const sourceId = `field-${field.id}`;
          const ndviValue = 0.7; // Default NDVI value for visualization
          const fillColor = mapLayer === "vegetation" ? getNdviColor(ndviValue) : "#666666";
          const fillOpacity = mapLayer === "vegetation" ? 0.6 : 0.3;

              // Remove existing layers/sources
              if (mapInstance.getLayer(sourceId)) mapInstance.removeLayer(sourceId);
              if (mapInstance.getLayer(`${sourceId}-outline`)) mapInstance.removeLayer(`${sourceId}-outline`);
              if (mapInstance.getSource(sourceId)) mapInstance.removeSource(sourceId);

              // Add source
              mapInstance.addSource(sourceId, {
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

              // Add fill layer
              mapInstance.addLayer({
                id: sourceId,
                type: "fill",
                source: sourceId,
                paint: {
                  "fill-color": fillColor,
                  "fill-opacity": fillOpacity,
                },
              });

              // Add outline layer
              mapInstance.addLayer({
                id: `${sourceId}-outline`,
                type: "line",
                source: sourceId,
                paint: {
                  "line-color": "#FFFFFF",
                  "line-width": 2,
                },
              });

              // Add click handler - Open Bottom Sheet instead of navigate
              mapInstance.on("click", sourceId, () => {
                setSelectedFieldId(field.id);
                setShowFieldSheet(true);
              });

              // Change cursor on hover
              mapInstance.on("mouseenter", sourceId, () => {
                mapInstance.getCanvas().style.cursor = "pointer";
              });
              mapInstance.on("mouseleave", sourceId, () => {
                mapInstance.getCanvas().style.cursor = "";
              });

              // Add label marker
              const lngs = coordinates.map(c => c[0]);
              const lats = coordinates.map(c => c[1]);
              const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
              const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;

              const areaText = field.areaHectares ? `${(field.areaHectares / 100).toFixed(1)} ha` : "";
              
              const el = document.createElement("div");
              el.innerHTML = `
                <div class="bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-md cursor-pointer hover:bg-white transition-colors flex items-center gap-2">
                  <span class="text-gray-600 text-sm">+</span>
                  <span class="font-medium text-gray-800 text-sm">${areaText}</span>
                </div>
              `;
              el.onclick = () => {
                setSelectedFieldId(field.id);
                setShowFieldSheet(true);
              };

              new mapboxgl.Marker({ element: el })
                .setLngLat([centerLng, centerLat])
                .addTo(mapInstance);
          } catch (e) {
            console.error(`Erro ao processar campo ${field.id}:`, e);
          }
      });

      // Fit bounds to show all fields
      if (fields.length > 0) {
        const allCoords: [number, number][] = [];
        fields.forEach((field) => {
          if (field.boundaries) {
            try {
              const points = JSON.parse(field.boundaries as string) as { lat: number; lng: number }[];
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
  }, [mapInstance, fields, mapLayer, setLocation]);

  // Função para converter valor NDVI em cor (conforme especificação OneSoil)
  const getNdviColor = (ndvi: number): string => {
    if (ndvi < 0) return '#1a1a2e';      // Água/sombra
    if (ndvi < 0.2) return '#b91c1c';    // Vermelho - solo exposto
    if (ndvi < 0.3) return '#dc2626';    // Vermelho claro
    if (ndvi < 0.4) return '#f97316';    // Laranja
    if (ndvi < 0.5) return '#facc15';    // Amarelo
    if (ndvi < 0.6) return '#a3e635';    // Verde-amarelo
    if (ndvi < 0.7) return '#4ade80';    // Verde claro
    if (ndvi < 0.8) return '#22c55e';    // Verde
    return '#15803d';                     // Verde escuro
  };

  // Carregar posição salva
  const savedPosition = getSavedMapPosition();

  const handleMapReady = useCallback((map: mapboxgl.Map) => {
    setMap(map);
    setMapInstance(map);

    // Salvar posição ao mover o mapa
    map.on("moveend", () => {
      const center = map.getCenter();
      const zoom = map.getZoom();
      saveMapPosition([center.lng, center.lat], zoom);
    });

    // Se tem posição salva, usa ela
    if (savedPosition) {
      map.flyTo({
        center: savedPosition.center,
        zoom: savedPosition.zoom,
        duration: 500,
      });
    } else {
      // Senão, tenta pegar localização do usuário
      getUserLocation()
        .then(([lng, lat]) => {
          map.flyTo({
            center: [lng, lat],
            zoom: 14,
            duration: 2000,
          });
        })
        .catch(() => {
          // Keep default center
        });
    }
  }, [setMap, getUserLocation, savedPosition]);

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
      console.error("Could not get location:", error);
    }
  };

  return (
    <div className="relative h-screen w-full">
      {/* Mapbox Map */}
      <MapboxMap
        onMapReady={handleMapReady}
        style="satellite"
        initialZoom={savedPosition?.zoom ?? 4}
        initialCenter={savedPosition?.center ?? [-47.9292, -15.7801]}
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
                <span>Todos os campos</span>
                <span className="text-gray-400">Safra {selectedSeason}</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem onClick={() => setSelectedSeason("2024")}>
                Safra 2024
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSelectedSeason("2023")}>
                Safra 2023
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
            onClick={() => setLocation("/fields/new")}
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* NDVI Scale Legend (bottom) - OneSoil Style */}
      {mapLayer === "vegetation" && (
        <div className="absolute bottom-32 left-4 right-4 pointer-events-none z-10">
          <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl p-3 max-w-md mx-auto">
            <div className="flex items-center justify-between text-xs text-white/80 mb-2">
              <span>Baixo índice</span>
              <span className="text-white font-medium">Índice de Vegetação</span>
              <span>Alto índice</span>
            </div>
            <div className="h-3 rounded-full overflow-hidden" style={{
              background: "linear-gradient(to right, #b91c1c, #dc2626, #f97316, #facc15, #a3e635, #4ade80, #22c55e, #15803d)"
            }} />
            <div className="flex justify-between text-[10px] text-white/60 mt-1">
              <span>0.0</span>
              <span>0.2</span>
              <span>0.4</span>
              <span>0.6</span>
              <span>0.8</span>
              <span>1.0</span>
            </div>
          </div>
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
          className="bg-gray-800/90 text-white hover:bg-gray-700 rounded-full h-10 w-10"
          onClick={handleLocateMe}
        >
          <Navigation className="h-5 w-5" />
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
                label="Satélite"
                active={mapLayer === "satellite"}
                onClick={() => setMapLayer("satellite")}
                color="green"
              />
              <LayerButton
                icon={<Wheat className="h-6 w-6" />}
                label="Cultivos"
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
                  label="Heterogeneidade"
                  active={ndviType === "heterogenity"}
                  onClick={() => setNdviType("heterogenity")}
                />
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Field Details Bottom Sheet */}
      <FieldBottomSheet
        fieldId={selectedFieldId}
        open={showFieldSheet}
        onOpenChange={setShowFieldSheet}
      />
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
