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

        // SEMPRE tentar carregar a imagem NDVI via proxy
        // O proxy verifica se o campo tem agroPolygonId e retorna a imagem ou 404
        // Isso garante que o overlay seja exibido mesmo se a query tRPC falhar
        {
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
            // boundsArray é [[topLeft], [topRight], [bottomRight], [bottomLeft]]
            mapInstance.addSource("ndvi-image-layer-source", {
              type: "image",
              url: proxyImageUrl,
              coordinates: boundsArray,
            });

            // Adicionar layer de imagem ANTES do fill layer
            mapInstance.addLayer({
              id: "ndvi-image-layer",
              type: "raster",
              source: "ndvi-image-layer-source",
              paint: {
                "raster-opacity": 0.9,
                "raster-fade-duration": 0,
              },
            });
            
            // Listener de erro no source
            mapInstance.on("error", (e: any) => {
              if (e.sourceId === "ndvi-image-layer-source") {
                console.error("[NDVI] Erro no source da imagem:", e.error);
              }
            });

            ndviLoaded = true;
            console.log("[NDVI] Imagem adicionada ao mapa com sucesso!");
          } catch (error) {
            console.warn("[NDVI] Falha ao carregar imagem via proxy:", error);
          }
        }

        // 2) Fallback: usar tiles se imagem falhou
        if (!ndviLoaded && hasNdviConfig && ndviImage?.tileUrl) {
          try {
            console.log("[NDVI] Tentando carregar tiles via proxy:", proxyTileUrl);
            
            // Adicionar source de tiles com proxy local
            mapInstance.addSource("ndvi-tile-layer-source", {
              type: "raster",
              tiles: [proxyTileUrl],
              tileSize: 256,
              bounds: [minLng, minLat, maxLng, maxLat],
            });

            // Adicionar layer de tiles
            mapInstance.addLayer({
              id: "ndvi-tile-layer",
              type: "raster",
              source: "ndvi-tile-layer-source",
              paint: {
                "raster-opacity": 0.85,
                "raster-fade-duration": 300,
              },
            });

            ndviLoaded = true;
            console.log("[NDVI] Imagem carregada com sucesso via proxy");
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

        // Base fill para percepção de área - cores estilo OneSoil
        // PRIMEIRO adicionar o fill layer (camada de fundo)
        const currentNdvi = field.currentNdvi ? field.currentNdvi / 100 : 0.5;
        // Cores OneSoil: Vermelho (ruim) → Laranja → Amarelo → Verde (saudável)
        const fillColor = currentNdvi >= 0.7 ? "#2E7D32" : // Verde escuro
                         currentNdvi >= 0.6 ? "#4CAF50" : // Verde
                         currentNdvi >= 0.5 ? "#8BC34A" : // Verde claro
                         currentNdvi >= 0.4 ? "#CDDC39" : // Amarelo-verde
                         currentNdvi >= 0.3 ? "#FFC107" : // Amarelo
                         currentNdvi >= 0.2 ? "#FF9800" : // Laranja
                         "#E53935"; // Vermelho

        // Adicionar fill layer SOMENTE se não tiver imagem NDVI
        // Se tiver imagem, não mostra fill (só a borda)
        if (!ndviLoaded) {
          mapInstance.addLayer({
            id: fillLayerId,
            type: "fill",
            source: sourceId,
            paint: {
              "fill-color": fillColor,
              "fill-opacity": 0.6,
            },
          });
        }

        // Borda do campo (sempre visível)
        mapInstance.addLayer({
          id: outlineId,
          type: "line",
          source: sourceId,
          paint: {
            "line-color": "#FFFFFF",
            "line-width": 3,
            "line-opacity": 0.9,
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
  }, [mapInstance, field, fieldId, ndviImage, proxyImageUrl, proxyTileUrl, addNdviTileOverlay, addNdviImageOverlay, removeAllOverlays, calculateBoundsFromPolygon, generateNdviGradientOverlay]);


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

            {/* NDVI Color Scale */}
            <div className="mb-4">
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

// Helper function to get NDVI color - Estilo OneSoil
function getNdviColor(ndvi: number): string {
  if (ndvi < 0.2) return "#E53935"; // Vermelho (estresse)
  if (ndvi < 0.3) return "#FF5722"; // Laranja-vermelho
  if (ndvi < 0.4) return "#FF9800"; // Laranja
  if (ndvi < 0.5) return "#FFC107"; // Amarelo
  if (ndvi < 0.6) return "#CDDC39"; // Amarelo-verde
  if (ndvi < 0.7) return "#8BC34A"; // Verde claro
  if (ndvi < 0.8) return "#4CAF50"; // Verde
  return "#2E7D32"; // Verde escuro
}
