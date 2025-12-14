import { trpc } from "@/lib/trpc";
import { MapboxMap, useMapbox } from "@/components/MapboxMap";
import { useNdviOverlay } from "@/hooks/useNdviOverlay";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Folder, 
  ChevronDown, 
  Search, 
  Plus,
  MoreVertical,
  Leaf,
  Maximize2,
  Pencil,
  Info
} from "lucide-react";
import { useState, useCallback, useEffect, useMemo } from "react";
import { useLocation, useParams } from "wouter";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import mapboxgl from "mapbox-gl";

export default function FieldDetailNew() {
  const params = useParams<{ id: string }>();
  const fieldId = parseInt(params.id || "0");
  const [, setLocation] = useLocation();
  const [hideCloudy, setHideCloudy] = useState(false);
  const [selectedDate, setSelectedDate] = useState<number>(0);
  const [selectedPalette, setSelectedPalette] = useState<string>('contrast');
  const [useCopernicus, setUseCopernicus] = useState<boolean>(true);
  const [mapInstance, setMapInstance] = useState<mapboxgl.Map | null>(null);
  const { setMap } = useMapbox();
  const {
    addNdviImageOverlay,
    addNdviTileOverlay,
    removeAllOverlays,
    calculateBoundsFromPolygon,
    generateNdviGradientOverlay,
  } = useNdviOverlay();

  const { data: field, isLoading } = trpc.fields.getById.useQuery({ id: fieldId });
  const { data: ndviHistory } = trpc.ndvi.history.useQuery(
    { fieldId, days: 30 },
    { enabled: !!fieldId }
  );

  // Buscar última imagem NDVI (tile e imagem única)
  const { data: ndviImage } = trpc.ndvi.getLatestNdviImage.useQuery(
    { fieldId, days: 60 },
    { enabled: !!fieldId }
  );

  const { data: crops } = trpc.crops.listByField.useQuery(
    { fieldId },
    { enabled: !!fieldId }
  );

  // URLs do proxy local para evitar CORS
  const proxyImageUrl = useMemo(() => `/api/ndvi-image/${fieldId}`, [fieldId]);
  const proxyTileUrl = useMemo(() => `/api/ndvi-tiles/${fieldId}/{z}/{x}/{y}.png`, [fieldId]);
  
  // URL do Copernicus para imagens de alta qualidade
  const copernicusImageUrl = useMemo(() => 
    `/api/copernicus-ndvi/${fieldId}?palette=${selectedPalette}`, 
    [fieldId, selectedPalette]
  );

  // Paletas de cores disponíveis
  const palettes = [
    { key: 'contrast', name: 'Contraste', description: 'Estilo OneSoil (vermelho-verde)' },
    { key: 'classic', name: 'Clássica', description: 'Verde tradicional' },
    { key: 'viridis', name: 'Viridis', description: 'Paleta científica' },
    { key: 'rdylgn', name: 'RdYlGn', description: 'Vermelho-Amarelo-Verde' },
    { key: 'pasture', name: 'Pastagem', description: 'Otimizada para gado' },
  ];

  // Draw field on map with NDVI overlay
  useEffect(() => {
    if (!mapInstance || !field?.boundaries) return;

    const drawField = async () => {
      try {
        const boundaries = typeof field.boundaries === "string"
          ? JSON.parse(field.boundaries)
          : field.boundaries;

        if (!Array.isArray(boundaries) || boundaries.length < 3) return;

        const coordinates = boundaries.map((p: { lat: number; lng: number }) =>
          [p.lng, p.lat] as [number, number]
        );
        if (coordinates[0][0] !== coordinates[coordinates.length - 1][0] || coordinates[0][1] !== coordinates[coordinates.length - 1][1]) {
          coordinates.push(coordinates[0]);
        }

        const sourceId = "field-detail";
        const fillLayerId = "ndvi-fill-layer";
        const outlineId = `${sourceId}-outline`;

        // Limpar overlays/layers anteriores
        removeAllOverlays(mapInstance);
        [fillLayerId, outlineId, sourceId, "ndvi-tile-layer", "ndvi-tile-layer-source", "ndvi-image-layer", "ndvi-image-layer-source", "ndvi-fallback-layer", "ndvi-fallback-layer-source"].forEach((id) => {
          if (mapInstance.getLayer(id)) mapInstance.removeLayer(id);
          if (mapInstance.getSource(id)) mapInstance.removeSource(id);
        });

        // Bounds e fonte do campo
        const boundsArray = calculateBoundsFromPolygon(coordinates);
        const lngs = coordinates.map((c) => c[0]);
        const lats = coordinates.map((c) => c[1]);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);

        mapInstance.addSource(sourceId, {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "Polygon",
              coordinates: [coordinates],
            },
          },
        });

        let ndviLoaded = false;

        // Verificar se o campo tem agroPolygonId configurado
        const hasAgroPolygon = !!(field as any).agroPolygonId;
        const hasNdviConfig = ndviImage?.configured && (ndviImage?.imageUrl || ndviImage?.tileUrl);
        
        console.log("[NDVI] Config:", { 
          hasAgroPolygon,
          fieldId,
          configured: ndviImage?.configured, 
          hasImageUrl: !!ndviImage?.imageUrl, 
          hasTileUrl: !!ndviImage?.tileUrl,
          cloudCoverage: ndviImage?.cloudCoverage,
          bounds: boundsArray,
          proxyImageUrl
        });

        // 1) PRIMEIRA OPÇÃO: Usar Copernicus para imagens de alta qualidade
        if (useCopernicus) {
          try {
            console.log("[NDVI] Carregando imagem do Copernicus:", copernicusImageUrl);
            console.log("[NDVI] Bounds para overlay:", boundsArray);
            
            // Pré-carregar a imagem para verificar se está acessível
            const img = new Image();
            img.crossOrigin = "anonymous";
            
            await new Promise<void>((resolve, reject) => {
              img.onload = () => {
                console.log("[NDVI] Imagem Copernicus carregada:", img.width, "x", img.height);
                resolve();
              };
              img.onerror = () => {
                console.warn("[NDVI] Copernicus não disponível, usando Agromonitoring");
                reject(new Error("Failed to load Copernicus image"));
              };
              img.src = copernicusImageUrl + "&t=" + Date.now();
            });
            
            // Adicionar source de imagem do Copernicus
            mapInstance.addSource("ndvi-image-layer-source", {
              type: "image",
              url: copernicusImageUrl,
              coordinates: boundsArray,
            });

            // Adicionar layer de imagem com alta opacidade
            mapInstance.addLayer({
              id: "ndvi-image-layer",
              type: "raster",
              source: "ndvi-image-layer-source",
              paint: {
                "raster-opacity": 0.95,
                "raster-fade-duration": 0,
              },
            });

            ndviLoaded = true;
            console.log("[NDVI] Imagem Copernicus adicionada ao mapa!");
          } catch (error) {
            console.warn("[NDVI] Falha ao carregar Copernicus, tentando Agromonitoring:", error);
          }
        }

        // 2) SEGUNDA OPÇÃO: Usar imagem estática NDVI do Agromonitoring
        if (!ndviLoaded) {
          try {
            console.log("[NDVI] Carregando imagem via proxy:", proxyImageUrl);
            console.log("[NDVI] Bounds para overlay:", boundsArray);
            
            // Pré-carregar a imagem para verificar se está acessível
            const img = new Image();
            img.crossOrigin = "anonymous";
            
            await new Promise<void>((resolve, reject) => {
              img.onload = () => {
                console.log("[NDVI] Imagem pré-carregada:", img.width, "x", img.height);
                resolve();
              };
              img.onerror = () => {
                console.error("[NDVI] Erro ao pré-carregar imagem: falha no carregamento");
                reject(new Error("Failed to preload image"));
              };
              img.src = proxyImageUrl + "?t=" + Date.now();
            });
            
            // Adicionar source de imagem com proxy local
            mapInstance.addSource("ndvi-image-layer-source", {
              type: "image",
              url: proxyImageUrl,
              coordinates: boundsArray,
            });

            // Adicionar layer de imagem com alta opacidade
            mapInstance.addLayer({
              id: "ndvi-image-layer",
              type: "raster",
              source: "ndvi-image-layer-source",
              paint: {
                "raster-opacity": 0.95,
                "raster-fade-duration": 0,
              },
            });

            ndviLoaded = true;
            console.log("[NDVI] Imagem Agromonitoring adicionada ao mapa!");
          } catch (error) {
            console.warn("[NDVI] Falha ao carregar imagem via proxy:", error);
          }
        }

        // 3) Fallback final: gradiente sintético usando NDVI atual
        if (!ndviLoaded) {
          const currentNdvi = field.currentNdvi ? field.currentNdvi / 100 : 0.5;
          console.log("[NDVI] Usando gradiente sintético, NDVI:", currentNdvi);
          generateNdviGradientOverlay(mapInstance, "ndvi-fallback-layer", currentNdvi, boundsArray);
          ndviLoaded = true;
        }

        // Base fill para percepção de área (apenas se NDVI não carregou)
        if (!ndviLoaded) {
          const currentNdvi = field.currentNdvi ? field.currentNdvi / 100 : 0.5;
          const fillColor = currentNdvi >= 0.6 ? "#22C55E" :
                           currentNdvi >= 0.4 ? "#EAB308" :
                           currentNdvi >= 0.2 ? "#F97316" : "#EF4444";

          mapInstance.addLayer({
            id: fillLayerId,
            type: "fill",
            source: sourceId,
            paint: {
              "fill-color": fillColor,
              "fill-opacity": 0.4,
            },
          });
        }

        // Borda do campo (preta igual OneSoil)
        mapInstance.addLayer({
          id: outlineId,
          type: "line",
          source: sourceId,
          paint: {
            "line-color": "#1a1a1a",
            "line-width": 2.5,
            "line-opacity": 1,
          },
        });

        // Ajustar visualização para o campo
        const bounds = new mapboxgl.LngLatBounds(
          [minLng, minLat],
          [maxLng, maxLat]
        );
        mapInstance.fitBounds(bounds, { padding: 40 });
      } catch (e) {
        console.error("Error drawing field:", e);
      }
    };

    if (mapInstance.isStyleLoaded()) {
      drawField();
    } else {
      mapInstance.on("style.load", drawField);
    }

    // Log errors do Mapbox para capturar falhas de carregamento de imagem/tile
    const errorHandler = (e: any) => {
      console.warn("[Map] erro mapbox:", e?.error || e);
    };
    mapInstance.on("error", errorHandler);

    return () => {
      mapInstance.off("error", errorHandler);
    };
  }, [mapInstance, field, fieldId, ndviImage, proxyImageUrl, proxyTileUrl, copernicusImageUrl, useCopernicus, selectedPalette, addNdviTileOverlay, addNdviImageOverlay, removeAllOverlays, calculateBoundsFromPolygon, generateNdviGradientOverlay]);


  const handleMapReady = useCallback((map: mapboxgl.Map) => {
    setMap(map);
    setMapInstance(map);
  }, [setMap]);

  // Mock NDVI history data
  const mockHistory = [
    { date: new Date(2024, 10, 7), ndvi: null, cloudy: true },
    { date: new Date(2024, 10, 12), ndvi: 0.68, cloudy: false },
    { date: new Date(2024, 10, 17), ndvi: null, cloudy: true },
    { date: new Date(2024, 10, 22), ndvi: 0.74, cloudy: false },
  ];

  const historyData = ndviHistory?.length ? ndviHistory.map((n: any) => ({
    date: new Date(n.captureDate || n.date),
    ndvi: n.ndviAverage ? n.ndviAverage / 100 : (n.ndvi || null),
    cloudy: n.cloudCoverage ? n.cloudCoverage > 50 : false,
  })) : mockHistory;

  const currentCrop = crops?.[0];

  if (isLoading) {
    return <FieldDetailSkeleton />;
  }

  if (!field) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-500">Campo não encontrado</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      {/* Header */}
      <div className="bg-gray-100 sticky top-0 z-10 px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Campos</h1>
            <button className="flex items-center gap-1 text-green-600 text-sm font-medium">
              <Folder className="h-4 w-4" />
              <span>Todos os campos</span>
              <ChevronDown className="h-3 w-3" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="rounded-full">
              <Search className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Plus className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Field Card with Map */}
      <div className="px-4 mb-4">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {/* Map Section */}
          <div className="relative h-48">
            <MapboxMap
              onMapReady={handleMapReady}
              className="w-full h-full"
              initialCenter={
                field.boundaries
                  ? (() => {
                      const bounds = typeof field.boundaries === "string"
                        ? JSON.parse(field.boundaries)
                        : field.boundaries;
                      if (Array.isArray(bounds) && bounds.length > 0) {
                        const lngs = bounds.map((p: any) => p.lng);
                        const lats = bounds.map((p: any) => p.lat);
                        return [
                          (Math.min(...lngs) + Math.max(...lngs)) / 2,
                          (Math.min(...lats) + Math.max(...lats)) / 2,
                        ] as [number, number];
                      }
                      return [-49.5, -20.8] as [number, number];
                    })()
                  : [-49.5, -20.8] as [number, number]
              }
              initialZoom={14}
              style="satellite"
            />
            
            {/* NDVI Badge */}
            <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 flex items-center gap-2">
              <Leaf className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">
                NDVI: {field.currentNdvi ? (field.currentNdvi / 100).toFixed(2) : "N/A"}
              </span>
            </div>

            {/* Escala de cores vertical igual OneSoil */}
            <div className="absolute bottom-12 left-3 flex flex-col items-center gap-1">
              <span className="text-[10px] font-medium text-white drop-shadow-md">1.0</span>
              <div className="w-3 h-24 rounded-sm bg-gradient-to-b from-green-500 via-yellow-400 to-red-500 shadow-md" />
              <span className="text-[10px] font-medium text-white drop-shadow-md">0.0</span>
            </div>

            {/* Cloud Coverage Warning */}
            {ndviImage?.cloudCoverage && ndviImage.cloudCoverage > 30 && (
              <div className="absolute top-3 right-3 bg-yellow-500/90 backdrop-blur-sm rounded-lg px-3 py-1.5 flex items-center gap-2">
                <Info className="h-4 w-4 text-white" />
                <span className="text-sm font-medium text-white">
                  {ndviImage.cloudCoverage}% nuvens
                </span>
              </div>
            )}
            
            {/* Expand Button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-sm rounded-lg"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Field Info */}
          <div className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{field.name}</h2>
                <p className="text-sm text-gray-500">
                  {field.areaHectares ? `${(field.areaHectares / 100).toFixed(1)} ha` : "Área não definida"}
                  {currentCrop && ` • ${currentCrop.cropType}`}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setLocation(`/fields/${fieldId}/edit`)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Editar campo
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Seletor de Paleta de Cores */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-600">Paleta de cores</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 text-xs">
                      {palettes.find(p => p.key === selectedPalette)?.name || 'Contraste'}
                      <ChevronDown className="h-3 w-3 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {palettes.map((palette) => (
                      <DropdownMenuItem 
                        key={palette.key}
                        onClick={() => setSelectedPalette(palette.key)}
                        className={selectedPalette === palette.key ? 'bg-green-50' : ''}
                      >
                        <div>
                          <div className="font-medium">{palette.name}</div>
                          <div className="text-xs text-gray-500">{palette.description}</div>
                        </div>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              {/* NDVI Color Scale */}
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                <span>Baixo</span>
                <span>NDVI</span>
                <span>Alto</span>
              </div>
              <div className="h-2 rounded-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Timeline Section */}
      <div className="px-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-700">Histórico</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Ocultar nublados</span>
            <Switch
              checked={hideCloudy}
              onCheckedChange={setHideCloudy}
              className="scale-75"
            />
          </div>
        </div>

        {/* Timeline Thumbnails */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {historyData
            .filter((item: any) => !hideCloudy || !item.cloudy)
            .map((item: any, index: number) => (
              <button
                key={index}
                onClick={() => setSelectedDate(index)}
                className={`flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
                  selectedDate === index
                    ? "border-green-500 ring-2 ring-green-200"
                    : "border-transparent"
                }`}
              >
                <div className="w-16 h-16 relative">
                  {item.cloudy ? (
                    <div className="w-full h-full bg-gray-300 flex items-center justify-center">
                      <span className="text-2xl">☁️</span>
                    </div>
                  ) : (
                    <div
                      className="w-full h-full"
                      style={{
                        background: item.ndvi
                          ? `linear-gradient(135deg, ${getNdviColor(item.ndvi)} 0%, ${getNdviColor(item.ndvi * 0.8)} 100%)`
                          : "#ccc",
                      }}
                    />
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] text-center py-0.5">
                    {format(item.date, "dd/MM", { locale: ptBR })}
                  </div>
                </div>
              </button>
            ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-4">
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="h-auto py-3 flex flex-col items-center gap-1"
            onClick={() => setLocation(`/notes/new?fieldId=${fieldId}`)}
          >
            <Plus className="h-5 w-5 text-green-600" />
            <span className="text-sm">Nova nota</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto py-3 flex flex-col items-center gap-1"
            onClick={() => setLocation(`/fields/${fieldId}/crops`)}
          >
            <Leaf className="h-5 w-5 text-green-600" />
            <span className="text-sm">Cultivos</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

function FieldDetailSkeleton() {
  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      <div className="px-4 pt-4">
        <Skeleton className="h-8 w-32 mb-2" />
        <Skeleton className="h-4 w-24 mb-4" />
      </div>
      <div className="px-4">
        <Skeleton className="h-64 w-full rounded-2xl mb-4" />
        <Skeleton className="h-20 w-full rounded-lg" />
      </div>
    </div>
  );
}

// Helper function to get NDVI color
function getNdviColor(ndvi: number): string {
  if (ndvi < 0.2) return "#EF4444"; // Red
  if (ndvi < 0.4) return "#F97316"; // Orange
  if (ndvi < 0.6) return "#EAB308"; // Yellow
  if (ndvi < 0.8) return "#84CC16"; // Light green
  return "#22C55E"; // Green
}
