import { trpc } from "@/lib/trpc";
import { MapboxMap, useMapbox } from "@/components/MapboxMap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { FieldImportDialog } from "@/components/FieldImportDialog";
import { 
  Folder, 
  ChevronDown, 
  Search, 
  Plus,
  Navigation,
  Leaf,
  Satellite,
  Wheat,
  Loader2,
  RefreshCw,
  AlertCircle,
  Upload,
  X,
  MapPin,
} from "lucide-react";
import { useState, useCallback, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import mapboxgl from "mapbox-gl";
import { toast } from "sonner";

type MapLayer = "satellite" | "crop" | "vegetation";
type NdviType = "basic" | "contrasted" | "average" | "heterogenity";

// Interface for search results
interface SearchResult {
  id: string;
  place_name: string;
  center: [number, number];
  place_type: string[];
}

export default function MapView() {
  const [, setLocation] = useLocation();
  const [selectedSeason, setSelectedSeason] = useState("2024");
  const [mapLayer, setMapLayer] = useState<MapLayer>("vegetation");
  const [ndviType, setNdviType] = useState<NdviType>("basic");
  const [showLayerSheet, setShowLayerSheet] = useState(false);
  const [mapInstance, setMapInstance] = useState<mapboxgl.Map | null>(null);
  const { setMap, getUserLocation } = useMapbox();

  // Search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // User location tracking state
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [isTrackingLocation, setIsTrackingLocation] = useState(false);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // Bottom sheet state
  const [selectedFieldId, setSelectedFieldId] = useState<number | null>(null);
  const [showFieldSheet, setShowFieldSheet] = useState(false);

  // Map position save timeout ref (for debouncing)
  const savePositionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ==================== SUPABASE MAP POSITION ====================
  // Get saved map position from Supabase
  const { data: savedMapPosition, isLoading: loadingPosition } = (trpc as any).user?.getMapPosition?.useQuery();
  
  // Mutation to save map position
  const saveMapPositionMutation = (trpc as any).user?.saveMapPosition?.useMutation();

  // Save map position with debouncing (save to Supabase)
  const saveMapPosition = useCallback((center: [number, number], zoom: number) => {
    // Clear previous timeout
    if (savePositionTimeoutRef.current) {
      clearTimeout(savePositionTimeoutRef.current);
    }

    // Debounce: wait 2 seconds before saving to avoid too many requests
    savePositionTimeoutRef.current = setTimeout(() => {
      saveMapPositionMutation.mutate({ center, zoom });
    }, 2000);
  }, [saveMapPositionMutation]);

  // Fetch fields with loading and error states
  const { data: fields, isLoading: loadingFields, error: fieldsError, refetch } = trpc.fields.list.useQuery();
  
  // Mutation for creating fields (for KML import)
  const createField = trpc.fields.create.useMutation({
    onSuccess: () => {
      refetch();
    },
  });
  
  // Fetch NDVI batch data for all fields (otimização)
  const fieldIds = fields?.map(f => f.id) || [];
  const { data: ndviBatch } = trpc.ndvi.getLatestBatch.useQuery(
    { fieldIds },
    { enabled: fieldIds.length > 0 }
  );

  // Search for places using Mapbox Geocoding API
  const searchPlaces = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const token = import.meta.env.VITE_MAPBOX_TOKEN || 'pk.eyJ1IjoibWFub2VsZ2lhbnNhbnRlIiwiYSI6ImNtYXVvMG1lMTBkcG4ya3B6anM5a2VoOW0ifQ.zN4Ra2gAVOJ8Hf1tuYfyQA';
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
        `access_token=${token}&` +
        `country=BR&` +
        `types=place,locality,neighborhood,address,poi&` +
        `limit=5&` +
        `language=pt`
      );
      
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.features || []);
      }
    } catch (error) {
      console.error("Erro na busca:", error);
      toast.error("Erro ao buscar locais");
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchPlaces(searchQuery);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, searchPlaces]);

  // Focus search input when opened
  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearch]);

  // Handle place selection
  const handleSelectPlace = useCallback((result: SearchResult) => {
    if (mapInstance) {
      mapInstance.flyTo({
        center: result.center,
        zoom: 14,
        duration: 1500,
      });
    }
    setShowSearch(false);
    setSearchQuery("");
    setSearchResults([]);
    toast.success(`Navegando para ${result.place_name.split(',')[0]}`);
  }, [mapInstance]);

  // Update user location marker
  const updateUserLocationMarker = useCallback((lng: number, lat: number) => {
    if (!mapInstance) return;

    // Create or update marker
    if (!userMarkerRef.current) {
      // Create custom marker element with pulsing effect
      const el = document.createElement('div');
      el.className = 'user-location-marker';
      el.innerHTML = `
        <div class="user-location-pulse"></div>
        <div class="user-location-dot"></div>
      `;
      
      // Add styles
      const style = document.createElement('style');
      style.textContent = `
        .user-location-marker {
          position: relative;
          width: 24px;
          height: 24px;
        }
        .user-location-dot {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 14px;
          height: 14px;
          background: #4285F4;
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          z-index: 2;
        }
        .user-location-pulse {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 40px;
          height: 40px;
          background: rgba(66, 133, 244, 0.3);
          border-radius: 50%;
          animation: pulse 2s ease-out infinite;
          z-index: 1;
        }
        @keyframes pulse {
          0% {
            transform: translate(-50%, -50%) scale(0.5);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) scale(1.5);
            opacity: 0;
          }
        }
      `;
      
      if (!document.querySelector('style[data-user-location]')) {
        style.setAttribute('data-user-location', 'true');
        document.head.appendChild(style);
      }

      userMarkerRef.current = new mapboxgl.Marker({ element: el })
        .setLngLat([lng, lat])
        .addTo(mapInstance);
    } else {
      userMarkerRef.current.setLngLat([lng, lat]);
    }

    setUserLocation([lng, lat]);
  }, [mapInstance]);

  // Start watching user location
  const startLocationTracking = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error("Geolocalização não suportada neste dispositivo");
      return;
    }

    setIsTrackingLocation(true);

    // Get initial position
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { longitude, latitude } = position.coords;
        updateUserLocationMarker(longitude, latitude);
        
        if (mapInstance) {
          mapInstance.flyTo({
            center: [longitude, latitude],
            zoom: 16,
            duration: 1500,
          });
        }
      },
      (error) => {
        console.error("Erro ao obter localização:", error);
        toast.error("Não foi possível obter sua localização");
        setIsTrackingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );

    // Watch position changes
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { longitude, latitude } = position.coords;
        updateUserLocationMarker(longitude, latitude);
      },
      (error) => {
        console.error("Erro no rastreamento:", error);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 1000,
      }
    );
  }, [mapInstance, updateUserLocationMarker]);

  // Stop watching user location
  const stopLocationTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTrackingLocation(false);
  }, []);

  // Clean up location tracking on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (savePositionTimeoutRef.current) {
        clearTimeout(savePositionTimeoutRef.current);
      }
    };
  }, []);

  // Handle locate me button
  const handleLocateMe = useCallback(() => {
    if (isTrackingLocation) {
      // If already tracking, just center on current location
      if (userLocation && mapInstance) {
        mapInstance.flyTo({
          center: userLocation,
          zoom: 16,
          duration: 1500,
        });
      }
    } else {
      // Start tracking
      startLocationTracking();
    }
  }, [isTrackingLocation, userLocation, mapInstance, startLocationTracking]);

  // Handle KML import
  const handleImportFields = useCallback(async (importedFields: any[]) => {
    let successCount = 0;
    let errorCount = 0;

    for (const field of importedFields) {
      try {
        // Convert coordinates from [lng, lat] to { lat, lng }
        const boundaries = field.coordinates.map((coord: [number, number]) => ({
          lat: coord[1],
          lng: coord[0],
        }));

        // Calculate area (rough approximation)
        const areaHectares = field.area ? Math.round(field.area * 100) : calculatePolygonArea(boundaries);

        await createField.mutateAsync({
          name: field.name,
          boundaries: JSON.stringify(boundaries),
          areaHectares,
          latitude: String(boundaries[0].lat),
          longitude: String(boundaries[0].lng),
        });

        successCount++;
      } catch (error) {
        console.error(`Erro ao importar campo ${field.name}:`, error);
        errorCount++;
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount} campo(s) importado(s) com sucesso!`);
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} campo(s) falharam na importação`);
    }
  }, [createField]);

  // Calculate polygon area in hectares (rough approximation)
  function calculatePolygonArea(points: { lat: number; lng: number }[]): number {
    if (points.length < 3) return 0;
    
    let area = 0;
    const n = points.length;
    
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += points[i].lng * points[j].lat;
      area -= points[j].lng * points[i].lat;
    }
    
    area = Math.abs(area) / 2;
    // Convert to hectares (rough approximation for Brazil's latitude)
    const hectares = area * 111319.9 * 111319.9 * Math.cos(points[0].lat * Math.PI / 180) / 10000;
    return Math.round(hectares * 100);
  }

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
          // Usa NDVI real do banco de dados se disponível, senão usa valor do campo ou default
          const batchData = (ndviBatch as Record<number, { ndviAverage: number | null }> | undefined)?.[field.id];
          const realNdvi = batchData?.ndviAverage;
          const fieldNdvi = (field as any).currentNdvi ? (field as any).currentNdvi / 100 : null;
          const ndviValue = realNdvi ?? fieldNdvi ?? 0.5;
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

      // Fit bounds to show all fields (only if no saved position)
      if (fields.length > 0 && !savedMapPosition) {
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
  }, [mapInstance, fields, mapLayer, setLocation, ndviBatch, savedMapPosition]);

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

  const handleMapReady = useCallback((map: mapboxgl.Map) => {
    setMap(map);
    setMapInstance(map);

    // Salvar posição ao mover o mapa (debounced, salva no Supabase)
    map.on("moveend", () => {
      const center = map.getCenter();
      const zoom = map.getZoom();
      saveMapPosition([center.lng, center.lat], zoom);
    });

    // Se tem posição salva do Supabase, usa ela
    if (savedMapPosition?.center && savedMapPosition?.zoom) {
      map.flyTo({
        center: savedMapPosition.center as [number, number],
        zoom: savedMapPosition.zoom,
        duration: 500,
      });
    } else if (!loadingPosition) {
      // Se não tem posição salva, tenta pegar localização do usuário
      startLocationTracking();
    }
  }, [setMap, savedMapPosition, loadingPosition, saveMapPosition, startLocationTracking]);

  // Apply saved position when it loads
  useEffect(() => {
    if (mapInstance && savedMapPosition?.center && savedMapPosition?.zoom) {
      mapInstance.flyTo({
        center: savedMapPosition.center as [number, number],
        zoom: savedMapPosition.zoom,
        duration: 1000,
      });
    }
  }, [mapInstance, savedMapPosition]);

  // Default position (Brasília)
  const defaultCenter: [number, number] = [-47.9292, -15.7801];
  const defaultZoom = 4;

  return (
    <div className="relative h-screen w-full">
      {/* Mapbox Map */}
      <MapboxMap
        onMapReady={handleMapReady}
        style="satellite"
        initialZoom={savedMapPosition?.zoom ?? defaultZoom}
        initialCenter={(savedMapPosition?.center as [number, number]) ?? defaultCenter}
        className="absolute inset-0"
      />

      {/* Loading Position Indicator */}
      {loadingPosition && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20">
          <div className="bg-gray-900/90 backdrop-blur-sm text-white px-4 py-2 rounded-full flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Carregando posição...</span>
          </div>
        </div>
      )}

      {/* Loading Indicator */}
      {loadingFields && !loadingPosition && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20">
          <div className="bg-gray-900/90 backdrop-blur-sm text-white px-4 py-2 rounded-full flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Carregando campos...</span>
          </div>
        </div>
      )}

      {/* Error Message */}
      {fieldsError && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20">
          <div className="bg-red-500/90 backdrop-blur-sm text-white px-4 py-2 rounded-full flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Erro ao carregar campos</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-white hover:bg-white/20"
              onClick={() => refetch()}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Search Panel */}
      {showSearch && (
        <div className="absolute top-0 left-0 right-0 p-4 z-30">
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden max-w-md mx-auto">
            <div className="flex items-center gap-3 p-3 border-b">
              <Search className="h-5 w-5 text-gray-400" />
              <Input
                ref={searchInputRef}
                type="text"
                placeholder="Buscar cidade, local ou endereço..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border-0 p-0 h-auto text-base focus-visible:ring-0 placeholder:text-gray-400"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => {
                  setShowSearch(false);
                  setSearchQuery("");
                  setSearchResults([]);
                }}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Search Results */}
            {(searchResults.length > 0 || isSearching) && (
              <div className="max-h-64 overflow-y-auto">
                {isSearching ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                  </div>
                ) : (
                  searchResults.map((result) => (
                    <button
                      key={result.id}
                      className="w-full flex items-start gap-3 p-3 hover:bg-gray-50 transition-colors text-left"
                      onClick={() => handleSelectPlace(result)}
                    >
                      <MapPin className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {result.place_name.split(',')[0]}
                        </p>
                        <p className="text-sm text-gray-500 truncate">
                          {result.place_name.split(',').slice(1).join(',').trim()}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Empty State */}
            {searchQuery && !isSearching && searchResults.length === 0 && (
              <div className="py-8 text-center text-gray-500">
                <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhum local encontrado</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      {!showSearch && (
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
              onClick={() => setShowSearch(true)}
            >
              <Search className="h-5 w-5" />
            </Button>
            
            {/* Import KML Button */}
            <FieldImportDialog
              onImport={handleImportFields}
              trigger={
                <Button
                  variant="secondary"
                  size="icon"
                  className="bg-gray-800/90 text-white hover:bg-gray-700 rounded-full h-10 w-10"
                >
                  <Upload className="h-5 w-5" />
                </Button>
              }
            />
            
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
      )}

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
          className={`rounded-full h-10 w-10 ${
            isTrackingLocation 
              ? 'bg-blue-500 text-white hover:bg-blue-600' 
              : 'bg-gray-800/90 text-white hover:bg-gray-700'
          }`}
          onClick={handleLocateMe}
        >
          <Navigation className={`h-5 w-5 ${isTrackingLocation ? 'fill-current' : ''}`} />
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
