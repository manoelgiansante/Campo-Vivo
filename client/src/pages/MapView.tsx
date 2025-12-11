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
  Wheat
} from "lucide-react";
import { useState, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import mapboxgl from "mapbox-gl";

type MapLayer = "satellite" | "crop" | "vegetation";
type NdviType = "basic" | "contrasted" | "average" | "heterogenity";

export default function MapView() {
  const [, setLocation] = useLocation();
  const [selectedSeason, setSelectedSeason] = useState("2024");
  const [mapLayer, setMapLayer] = useState<MapLayer>("vegetation");
  const [ndviType, setNdviType] = useState<NdviType>("basic");
  const [showLayerSheet, setShowLayerSheet] = useState(false);
  const [mapInstance, setMapInstance] = useState<mapboxgl.Map | null>(null);
  const { setMap, getUserLocation } = useMapbox();

  const { data: fields } = trpc.fields.list.useQuery();

  // Add fields to map when data loads
  useEffect(() => {
    if (!mapInstance || !fields) return;

    const addFieldsToMap = () => {
      fields.forEach((field) => {
        if (field.boundaries) {
          try {
            const points = JSON.parse(field.boundaries as string) as { lat: number; lng: number }[];
            if (points.length >= 3) {
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

              // Add click handler
              mapInstance.on("click", sourceId, () => {
                setLocation(`/fields/${field.id}`);
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
              el.onclick = () => setLocation(`/fields/${field.id}`);

              new mapboxgl.Marker({ element: el })
                .setLngLat([centerLng, centerLat])
                .addTo(mapInstance);
            }
          } catch (e) {
            console.error("Error parsing boundaries:", e);
          }
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

  const getNdviColor = (value: number): string => {
    if (value < 0.3) return "#EF4444";
    if (value < 0.5) return "#F59E0B";
    if (value < 0.7) return "#EAB308";
    if (value < 0.85) return "#84CC16";
    return "#22C55E";
  };

  const handleMapReady = useCallback((map: mapboxgl.Map) => {
    setMap(map);
    setMapInstance(map);

    // Try to get user location
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
  }, [setMap, getUserLocation]);

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
            onClick={() => setLocation("/fields/new")}
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* NDVI Scale (left side) */}
      {mapLayer === "vegetation" && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none z-10">
          <div className="w-3 h-32 rounded-full overflow-hidden" style={{
            background: "linear-gradient(to bottom, #22C55E, #EAB308, #EF4444)"
          }} />
        </div>
      )}

      {/* Bottom Controls */}
      <div className="absolute bottom-20 left-0 right-0 flex flex-col items-center gap-3 pointer-events-none z-10">
        <Button
          onClick={() => setShowLayerSheet(true)}
          className="pointer-events-auto bg-gray-800/90 text-white hover:bg-gray-700 rounded-full px-6 h-10 gap-2"
        >
          <Leaf className="h-4 w-4" />
          <span>Vegetation</span>
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
            <SheetTitle>Map layer</SheetTitle>
          </SheetHeader>
          <div className="py-6">
            <div className="flex gap-4 mb-6">
              <LayerButton
                icon={<Satellite className="h-6 w-6" />}
                label="Satellite image"
                active={mapLayer === "satellite"}
                onClick={() => setMapLayer("satellite")}
                color="green"
              />
              <LayerButton
                icon={<Wheat className="h-6 w-6" />}
                label="Crop"
                active={mapLayer === "crop"}
                onClick={() => setMapLayer("crop")}
                color="blue"
              />
              <LayerButton
                icon={<Leaf className="h-6 w-6" />}
                label="Vegetation"
                active={mapLayer === "vegetation"}
                onClick={() => setMapLayer("vegetation")}
                color="green"
              />
            </div>

            {mapLayer === "vegetation" && (
              <div className="space-y-2">
                <NdviOption
                  label="Basic NDVI"
                  active={ndviType === "basic"}
                  onClick={() => setNdviType("basic")}
                />
                <NdviOption
                  label="Contrasted NDVI"
                  active={ndviType === "contrasted"}
                  onClick={() => setNdviType("contrasted")}
                />
                <NdviOption
                  label="Average NDVI"
                  active={ndviType === "average"}
                  onClick={() => setNdviType("average")}
                />
                <NdviOption
                  label="Heterogenity NDVI"
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
