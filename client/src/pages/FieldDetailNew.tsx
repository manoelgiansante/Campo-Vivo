import { trpc } from "@/lib/trpc";
import { MapboxMap, useMapbox } from "@/components/MapboxMap";
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
import { useState, useCallback, useEffect } from "react";
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

  const { data: field, isLoading } = trpc.fields.getById.useQuery({ id: fieldId });
  const { data: ndviHistory } = trpc.ndvi.history.useQuery(
    { fieldId, days: 30 },
    { enabled: !!fieldId }
  );

  // Buscar última imagem NDVI (tile e imagem única)
  const { data: ndviImage } = (trpc as any).ndvi?.getLatestNdviImage?.useQuery(
    { fieldId },
    { enabled: !!fieldId }
  ) || { data: null };

  const { data: crops } = trpc.crops.listByField.useQuery(
    { fieldId },
    { enabled: !!fieldId }
  );

  // Draw field on map with NDVI overlay
  useEffect(() => {
    if (!mapInstance || !field?.boundaries) return;

    const drawField = async () => {
      try {
        const boundaries = typeof field.boundaries === 'string' 
          ? JSON.parse(field.boundaries) 
          : field.boundaries;
        
        if (!Array.isArray(boundaries) || boundaries.length < 3) return;

        const coordinates = boundaries.map((p: { lat: number; lng: number }) => 
          [p.lng, p.lat] as [number, number]
        );
        coordinates.push(coordinates[0]); // Close polygon

        const sourceId = "field-detail";
        const ndviLayerId = "ndvi-image-layer";
        const ndviSourceId = "ndvi-image";
        const fillLayerId = "ndvi-fill-layer";

        // Remove existing layers
        [fillLayerId, ndviLayerId, `${sourceId}-outline`].forEach(id => {
          if (mapInstance.getLayer(id)) mapInstance.removeLayer(id);
        });
        [sourceId, ndviSourceId].forEach(id => {
          if (mapInstance.getSource(id)) mapInstance.removeSource(id);
        });

        // Calculate bounds
        const lngs = coordinates.map((c: [number, number]) => c[0]);
        const lats = coordinates.map((c: [number, number]) => c[1]);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);

        // Add field source (for outline and fill)
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

        // 1) Tentar sobrepor imagem NDVI (OneSoil-style)
        let ndviLoaded = false;
        const ndviUrl = ndviImage?.imageUrl || `/api/ndvi-image/${fieldId}`;

        if (ndviUrl) {
          try {
            console.log("[Map] Tentando overlay NDVI:", ndviUrl);
            mapInstance.addSource(ndviSourceId, {
              type: "image",
              url: ndviUrl,
              coordinates: [
                [minLng, maxLat], // top-left
                [maxLng, maxLat], // top-right
                [maxLng, minLat], // bottom-right
                [minLng, minLat], // bottom-left
              ],
            });

            mapInstance.addLayer({
              id: ndviLayerId,
              type: "raster",
              source: ndviSourceId,
              paint: {
                "raster-opacity": 0.75,
                "raster-fade-duration": 0,
              },
            });

            ndviLoaded = true;
            console.log("[Map] Overlay NDVI adicionado com sucesso");
          } catch (error) {
            console.warn("[Map] Falha ao adicionar overlay NDVI, usando fill:", error);
          }
        }

        // 2) Fallback: fill colorido baseado no NDVI atual
        if (!ndviLoaded) {
          const currentNdvi = (field as any).currentNdvi ? (field as any).currentNdvi / 100 : 0.5;
          const fillColor = currentNdvi >= 0.6 ? "#22C55E" : 
                           currentNdvi >= 0.4 ? "#EAB308" : 
                           currentNdvi >= 0.2 ? "#F97316" : "#EF4444";
          console.log("[Map] Fallback fill NDVI:", currentNdvi, fillColor);

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

        // 3) Contorno para melhor visibilidade
        mapInstance.addLayer({
          id: `${sourceId}-outline`,
          type: "line",
          source: sourceId,
          paint: {
            "line-color": "#000000",
            "line-width": 3,
          },
        });

        // Fit bounds
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
  }, [mapInstance, field, fieldId, ndviImage]);


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
            <Button variant="ghost" size="icon" className="h-10 w-10">
              <Search className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-10 w-10">
              <Plus className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-10 w-10">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Field Detail Card */}
      <div className="px-4">
        <div className="bg-white rounded-t-3xl overflow-hidden">
          {/* Drag Handle */}
          <div className="flex justify-center py-2">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>

          {/* Field Header */}
          <div className="px-4 pb-3 flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{field.name}</h2>
              <p className="text-gray-500">
                {field.areaHectares ? (field.areaHectares / 100).toFixed(1) : '?'} ha
              </p>
            </div>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </div>

          {/* Map with NDVI - Using Mapbox */}
          <div className="relative mx-4 rounded-2xl overflow-hidden h-64">
            <MapboxMap
              onMapReady={handleMapReady}
              style="satellite"
              initialZoom={14}
              className="h-full w-full"
            />
            
            {/* NDVI Type Selector */}
            <div className="absolute top-3 left-3 z-10">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="secondary" 
                    className="bg-gray-800/90 text-white hover:bg-gray-700 rounded-full px-4 h-9 gap-2 text-sm"
                  >
                    <Leaf className="h-4 w-4" />
                    <span>NDVI Básico</span>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem>NDVI Básico</DropdownMenuItem>
                  <DropdownMenuItem>NDVI Contrastado</DropdownMenuItem>
                  <DropdownMenuItem>NDVI Médio</DropdownMenuItem>
                  <DropdownMenuItem>NDVI Heterogeneidade</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Expand Button */}
            <Button
              variant="secondary"
              size="icon"
              className="absolute top-3 right-3 bg-gray-800/90 text-white hover:bg-gray-700 rounded-full h-9 w-9 z-10"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>

            {/* NDVI Scale */}
            <div className="absolute left-3 bottom-3 top-12 z-10">
              <div className="w-2 h-full rounded-full overflow-hidden" style={{
                background: "linear-gradient(to bottom, #22C55E, #EAB308, #EF4444)"
              }} />
            </div>

            {/* Info Button */}
            <Button
              variant="secondary"
              size="icon"
              className="absolute bottom-3 right-3 bg-transparent text-white hover:bg-gray-800/50 rounded-full h-8 w-8 z-10"
            >
              <Info className="h-4 w-4" />
            </Button>
          </div>

          {/* History Section */}
          <div className="px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Histórico</h3>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Ocultar dias nublados</span>
                <Switch 
                  checked={hideCloudy} 
                  onCheckedChange={setHideCloudy}
                />
              </div>
            </div>

            {/* Timeline */}
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
              {historyData
                .filter((h: any) => !hideCloudy || !h.cloudy)
                .map((item: any, index: number) => (
                  <button
                    key={index}
                    onClick={() => setSelectedDate(index)}
                    className={`flex-shrink-0 w-24 rounded-xl border-2 overflow-hidden transition-all ${
                      selectedDate === index 
                        ? "border-gray-400" 
                        : "border-transparent"
                    }`}
                  >
                    <div className={`h-16 flex items-center justify-center ${
                      item.cloudy ? "bg-gray-200" : "bg-green-100"
                    }`}>
                      {item.cloudy ? (
                        <div className="w-10 h-10 bg-gray-300 rounded" style={{
                          clipPath: "polygon(0 20%, 30% 20%, 30% 0, 100% 50%, 30% 100%, 30% 80%, 0 80%)"
                        }} />
                      ) : (
                        <div className="w-10 h-10 bg-green-500 rounded" style={{
                          clipPath: "polygon(0 20%, 30% 20%, 30% 0, 100% 50%, 30% 100%, 30% 80%, 0 80%)"
                        }} />
                      )}
                    </div>
                    <div className="p-2 text-center bg-white">
                      <p className="text-xs text-gray-500">
                        {format(item.date, "dd 'de' MMM.", { locale: ptBR })}
                      </p>
                      {item.ndvi && (
                        <p className="text-sm font-semibold">
                          {item.ndvi.toFixed(2).replace('.', ',')}
                          <span className="text-green-500 text-xs ml-1">
                            +{item.ndvi.toFixed(2).replace('.', ',')}
                          </span>
                        </p>
                      )}
                    </div>
                  </button>
                ))}
            </div>
          </div>

          {/* Crop Section */}
          <div className="px-4 pb-4">
            <div className="border-t pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="font-semibold text-gray-900">
                    {currentCrop?.cropType || "Pastagem"}
                  </span>
                </div>
                <Button variant="ghost" size="icon">
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div>
                  <p className="text-sm text-gray-500">Data de plantio</p>
                  <p className="font-medium text-gray-900">
                    {currentCrop?.plantingDate 
                      ? format(new Date(currentCrop.plantingDate), "dd/MM/yyyy")
                      : "Não definida"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Data de colheita</p>
                  <p className="font-medium text-gray-900">
                    {currentCrop?.expectedHarvestDate 
                      ? format(new Date(currentCrop.expectedHarvestDate), "dd/MM/yyyy")
                      : "Não definida"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldDetailSkeleton() {
  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      <div className="px-4 pt-4">
        <Skeleton className="h-8 w-24 mb-2" />
        <Skeleton className="h-5 w-32 mb-4" />
      </div>
      <div className="px-4">
        <div className="bg-white rounded-t-3xl p-4">
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-4 w-16 mb-4" />
          <Skeleton className="h-64 w-full rounded-2xl mb-4" />
          <Skeleton className="h-6 w-24 mb-3" />
          <div className="flex gap-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-24 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
