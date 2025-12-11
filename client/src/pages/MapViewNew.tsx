import { MapboxMap, useMapbox } from "@/components/MapboxMap";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { 
  Folder, 
  ChevronDown, 
  ChevronUp,
  Search, 
  Plus,
  Navigation,
  Leaf,
  Satellite,
  Wheat,
  Info,
  Loader2,
  MapPin,
  X
} from "lucide-react";
import { useState, useCallback, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import mapboxgl from "mapbox-gl";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

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

export default function MapViewNew() {
  const [, setLocation] = useLocation();
  const [selectedSeason, setSelectedSeason] = useState("2024");
  const [mapLayer, setMapLayer] = useState<MapLayer>("vegetation");
  const [ndviType, setNdviType] = useState<NdviType>("basic");
  const [showLayerSheet, setShowLayerSheet] = useState(false);
  const [mapInstance, setMapInstance] = useState<mapboxgl.Map | null>(null);
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{
    id: string;
    place_name: string;
    center: [number, number];
  }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const { setMap, getUserLocation } = useMapbox();
  
  // Geocoding mutation
  const geocode = trpc.maps.geocode.useMutation({
    onSuccess: (data) => {
      setSearchResults(data.results);
      setIsSearching(false);
    },
    onError: (error) => {
      toast.error("Erro na busca: " + error.message);
      setIsSearching(false);
    },
  });

  // Buscar campos reais do banco de dados
  const { data: fieldsData, isLoading } = trpc.fields.list.useQuery();
  
  // Processar campos com NDVI
  const fields = useMemo(() => {
    if (!fieldsData) return [];
    return fieldsData.map(field => ({
      ...field,
      ndviValue: 0.5, // Default NDVI, será atualizado com dados reais
      lastUpdate: field.updatedAt ? new Date(field.updatedAt).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }) : 'Recente'
    }));
  }, [fieldsData]);

  // Handle map ready
  const handleMapReady = useCallback((map: mapboxgl.Map) => {
    setMapInstance(map);
    setMap(map);
    
    // Center on Brazil if no fields
    if (fields.length === 0) {
      map.flyTo({
        center: [-54.6, -20.47],
        zoom: 14
      });
    }
  }, [setMap, fields.length]);

  // Add fields to map
  useEffect(() => {
    if (!mapInstance || !fields) return;

    fields.forEach((field) => {
      if (field.boundaries) {
        try {
          const points = JSON.parse(field.boundaries as string) as { lat: number; lng: number }[];
          if (points.length >= 3) {
            const coordinates = points.map(p => [p.lng, p.lat] as [number, number]);
            coordinates.push(coordinates[0]);

            const sourceId = `field-${field.id}`;
            const fillColor = mapLayer === "vegetation" ? getNdviColor(field.ndviValue) : "#666666";

            // Remove existing
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
                "fill-opacity": 0.7,
              },
            });

            // Add outline layer
            mapInstance.addLayer({
              id: `${sourceId}-outline`,
              type: "line",
              source: sourceId,
              paint: {
                "line-color": "#000000",
                "line-width": 2,
              },
            });

            // Click handler
            mapInstance.on("click", sourceId, () => {
              setLocation(`/fields/${field.id}`);
            });

            // Add label
            const lngs = coordinates.map(c => c[0]);
            const lats = coordinates.map(c => c[1]);
            const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
            const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;

            const el = document.createElement("div");
            el.innerHTML = `
              <div class="text-white text-xs font-medium px-2 py-1 rounded bg-black/50 backdrop-blur-sm">
                ${field.lastUpdate}
              </div>
            `;
            el.style.cursor = "pointer";
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

    // Fit to fields
    if (fields.length > 0 && fields[0].boundaries) {
      const points = JSON.parse(fields[0].boundaries as string) as { lat: number; lng: number }[];
      const lngs = points.map(p => p.lng);
      const lats = points.map(p => p.lat);
      
      mapInstance.fitBounds(
        [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
        { padding: 100, maxZoom: 15 }
      );
    }
  }, [mapInstance, fields, mapLayer, setLocation]);

  const handleLocationClick = useCallback(() => {
    getUserLocation();
  }, [getUserLocation]);

  // Handle address search
  const handleSearch = useCallback(() => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    geocode.mutate({ query: searchQuery });
  }, [searchQuery, geocode]);

  // Navigate to search result
  const handleSelectResult = useCallback((result: { center: [number, number]; place_name: string }) => {
    if (mapInstance) {
      mapInstance.flyTo({
        center: result.center,
        zoom: 15,
        duration: 2000
      });
      
      // Add temporary marker
      new mapboxgl.Marker({ color: "#3b82f6" })
        .setLngLat(result.center)
        .setPopup(new mapboxgl.Popup().setHTML(`<p class="text-sm">${result.place_name}</p>`))
        .addTo(mapInstance);
    }
    setShowSearchDialog(false);
    setSearchQuery("");
    setSearchResults([]);
    toast.success("Localização encontrada!");
  }, [mapInstance]);

  const getLayerLabel = () => {
    switch (mapLayer) {
      case "satellite": return "Satellite";
      case "crop": return "Crop";
      case "vegetation": return "Vegetation";
    }
  };

  return (
    <div className="h-screen w-full relative">
      {/* Map */}
      <MapboxMap
        onMapReady={handleMapReady}
        className="h-full w-full"
        initialCenter={[-54.6, -20.47]}
        initialZoom={14}
      />

      {/* Top Header */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
        {/* Season Selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 bg-gray-900/90 backdrop-blur-sm text-white px-4 py-2.5 rounded-full">
              <Folder className="h-4 w-4" />
              <div className="text-left">
                <div className="text-sm font-medium">All fields</div>
                <div className="text-xs text-gray-300">Season {selectedSeason}</div>
              </div>
              <ChevronDown className="h-4 w-4 ml-1" />
            </button>
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

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="icon"
            className="h-11 w-11 rounded-full bg-gray-900/90 backdrop-blur-sm border-0 text-white hover:bg-gray-800"
            onClick={() => setShowSearchDialog(true)}
          >
            <Search className="h-5 w-5" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="h-11 w-11 rounded-full bg-gray-900/90 backdrop-blur-sm border-0 text-white hover:bg-gray-800"
            onClick={() => setLocation("/fields/new")}
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* NDVI Scale (left side) */}
      {mapLayer === "vegetation" && (
        <div className="absolute left-4 bottom-32 z-10">
          <div className="w-2 h-24 rounded-full overflow-hidden" style={{
            background: "linear-gradient(to top, #d73027, #fc8d59, #fee08b, #d9ef8b, #91cf60, #1a9850, #006837)"
          }} />
        </div>
      )}

      {/* Layer Button (center bottom) */}
      <button
        onClick={() => setShowLayerSheet(true)}
        className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-gray-900/90 backdrop-blur-sm text-white px-5 py-3 rounded-full"
      >
        <Leaf className="h-5 w-5" />
        <span className="font-medium">{getLayerLabel()}</span>
      </button>

      {/* Location Button (right side) */}
      <Button
        variant="secondary"
        size="icon"
        className="absolute right-4 bottom-32 z-10 h-12 w-12 rounded-full bg-white shadow-lg border-0"
        onClick={handleLocationClick}
      >
        <Navigation className="h-5 w-5 text-gray-700" />
      </Button>

      {/* Add Field Button */}
      <Button
        variant="secondary"
        size="icon"
        className="absolute right-4 bottom-48 z-10 h-12 w-12 rounded-full bg-white shadow-lg border-0"
        onClick={() => setLocation("/fields/new")}
      >
        <Plus className="h-5 w-5 text-gray-700" />
      </Button>

      {/* Info Button */}
      <button className="absolute right-4 bottom-4 z-10 h-8 w-8 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center">
        <Info className="h-4 w-4 text-gray-600" />
      </button>

      {/* Search Dialog */}
      <Dialog open={showSearchDialog} onOpenChange={setShowSearchDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Buscar localização
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Digite o endereço ou cidade..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="flex-1"
              />
              <Button onClick={handleSearch} disabled={isSearching}>
                {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            
            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {searchResults.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => handleSelectResult(result)}
                    className="w-full text-left p-3 rounded-lg hover:bg-gray-100 transition-colors border"
                  >
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 mt-0.5 text-gray-500 flex-shrink-0" />
                      <span className="text-sm">{result.place_name}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
            
            {searchResults.length === 0 && searchQuery && !isSearching && (
              <p className="text-sm text-gray-500 text-center py-4">
                Nenhum resultado encontrado. Tente outro termo.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Layer Selection Sheet */}
      <Sheet open={showLayerSheet} onOpenChange={setShowLayerSheet}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader className="pb-4">
            <SheetTitle className="text-left">Map layer</SheetTitle>
          </SheetHeader>
          
          {/* Layer Types */}
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

          {/* NDVI Types (only for vegetation) */}
          {mapLayer === "vegetation" && (
            <div className="space-y-1">
              <NdviOption
                label="Basic NDVI"
                selected={ndviType === "basic"}
                onClick={() => setNdviType("basic")}
              />
              <NdviOption
                label="Contrasted NDVI"
                selected={ndviType === "contrasted"}
                onClick={() => setNdviType("contrasted")}
              />
              <NdviOption
                label="Average NDVI"
                selected={ndviType === "average"}
                onClick={() => setNdviType("average")}
              />
              <NdviOption
                label="Heterogenity NDVI"
                selected={ndviType === "heterogenity"}
                onClick={() => setNdviType("heterogenity")}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
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
