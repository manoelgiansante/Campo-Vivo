import { trpc } from "@/lib/trpc";
import { MapboxMap, useMapbox } from "@/components/MapboxMap";
import { useNdviOverlay } from "@/hooks/useNdviOverlay";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  ChevronLeft,
  ChevronRight,
  ChevronDown, 
  Maximize2,
  MoreHorizontal,
  Download,
  Leaf,
  CloudRain,
  Thermometer,
  Wind,
  Calendar,
  ArrowLeft,
  Layers,
  Upload,
  FileText,
  BarChart3,
  Plus,
} from "lucide-react";
import { useState, useCallback, useEffect, useMemo } from "react";
import { useLocation, useParams } from "wouter";
import { format, subDays, startOfYear, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import mapboxgl from "mapbox-gl";

// Componente de gráfico NDVI simples usando SVG
function NdviChart({ data, height = 120 }: { data: { date: Date; ndvi: number }[]; height?: number }) {
  if (!data.length) return null;
  
  const width = 400;
  const padding = { top: 20, right: 20, bottom: 30, left: 40 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  const minNdvi = -0.35;
  const maxNdvi = 1.05;
  
  const xScale = (i: number) => padding.left + (i / (data.length - 1)) * chartWidth;
  const yScale = (v: number) => padding.top + chartHeight - ((v - minNdvi) / (maxNdvi - minNdvi)) * chartHeight;
  
  const pathD = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(d.ndvi)}`).join(' ');
  
  // Área preenchida
  const areaD = `${pathD} L ${xScale(data.length - 1)} ${yScale(minNdvi)} L ${xScale(0)} ${yScale(minNdvi)} Z`;
  
  const months = ['Jan', 'Mar', 'May', 'Jul', 'Aug', 'Oct', 'Dec'];
  
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      {/* Grid lines */}
      {[0, 0.35, 0.7, 1.05].map(v => (
        <line
          key={v}
          x1={padding.left}
          y1={yScale(v)}
          x2={width - padding.right}
          y2={yScale(v)}
          stroke="#e5e7eb"
          strokeWidth="1"
        />
      ))}
      
      {/* Y axis labels */}
      <text x={padding.left - 8} y={yScale(1.05)} fontSize="10" fill="#9ca3af" textAnchor="end" dominantBaseline="middle">1.05</text>
      <text x={padding.left - 8} y={yScale(0.35)} fontSize="10" fill="#9ca3af" textAnchor="end" dominantBaseline="middle">0.35</text>
      <text x={padding.left - 8} y={yScale(-0.35)} fontSize="10" fill="#9ca3af" textAnchor="end" dominantBaseline="middle">-0.35</text>
      
      {/* X axis labels */}
      {months.map((m, i) => (
        <text
          key={m}
          x={padding.left + (i / (months.length - 1)) * chartWidth}
          y={height - 8}
          fontSize="10"
          fill="#9ca3af"
          textAnchor="middle"
        >
          {m}
        </text>
      ))}
      
      {/* Area fill with gradient */}
      <defs>
        <linearGradient id="ndviGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#ndviGradient)" />
      
      {/* Line */}
      <path d={pathD} fill="none" stroke="#22c55e" strokeWidth="2" />
      
      {/* Current point */}
      {data.length > 0 && (
        <circle
          cx={xScale(data.length - 1)}
          cy={yScale(data[data.length - 1].ndvi)}
          r="4"
          fill="#22c55e"
        />
      )}
    </svg>
  );
}

// Componente de gráfico de precipitação
function PrecipitationChart({ data, height = 120 }: { data: { date: Date; value: number }[]; height?: number }) {
  if (!data.length) return null;
  
  const width = 400;
  const padding = { top: 20, right: 20, bottom: 30, left: 40 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  const maxValue = Math.max(...data.map(d => d.value), 1000);
  
  const xScale = (i: number) => padding.left + (i / (data.length - 1)) * chartWidth;
  const yScale = (v: number) => padding.top + chartHeight - (v / maxValue) * chartHeight;
  
  const pathD = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(d.value)}`).join(' ');
  const areaD = `${pathD} L ${xScale(data.length - 1)} ${yScale(0)} L ${xScale(0)} ${yScale(0)} Z`;
  
  const months = ['Jan', 'Mar', 'May', 'Jul', 'Aug', 'Oct', 'Dec'];
  
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      {/* Grid lines */}
      {[0, 500, 1000].map(v => (
        <line
          key={v}
          x1={padding.left}
          y1={yScale(v)}
          x2={width - padding.right}
          y2={yScale(v)}
          stroke="#e5e7eb"
          strokeWidth="1"
        />
      ))}
      
      {/* Y axis labels */}
      <text x={padding.left - 8} y={yScale(1000)} fontSize="10" fill="#9ca3af" textAnchor="end" dominantBaseline="middle">1000</text>
      <text x={padding.left - 8} y={yScale(500)} fontSize="10" fill="#9ca3af" textAnchor="end" dominantBaseline="middle">500</text>
      
      {/* X axis labels */}
      {months.map((m, i) => (
        <text
          key={m}
          x={padding.left + (i / (months.length - 1)) * chartWidth}
          y={height - 8}
          fontSize="10"
          fill="#9ca3af"
          textAnchor="middle"
        >
          {m}
        </text>
      ))}
      
      {/* Area fill */}
      <defs>
        <linearGradient id="precipGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f97316" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#f97316" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#precipGradient)" />
      
      {/* Line */}
      <path d={pathD} fill="none" stroke="#f97316" strokeWidth="2" />
    </svg>
  );
}

export default function FieldDetailPro() {
  const params = useParams<{ id: string }>();
  const fieldId = parseInt(params.id || "0");
  const [, setLocation] = useLocation();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [mapInstance, setMapInstance] = useState<mapboxgl.Map | null>(null);
  const [satMapInstance, setSatMapInstance] = useState<mapboxgl.Map | null>(null);
  const { setMap } = useMapbox();
  const {
    removeAllOverlays,
    calculateBoundsFromPolygon,
    generateNdviGradientOverlay,
  } = useNdviOverlay();

  const { data: field, isLoading } = trpc.fields.getById.useQuery({ id: fieldId });
  const { data: ndviHistory } = trpc.ndvi.history.useQuery(
    { fieldId, days: 365 },
    { enabled: !!fieldId }
  );
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

  // Processar histórico de NDVI para os gráficos
  const ndviChartData = useMemo(() => {
    if (!ndviHistory?.length) {
      // Dados mock para demonstração
      const mockData = [];
      const now = new Date();
      for (let i = 0; i < 12; i++) {
        const date = subDays(now, (11 - i) * 30);
        const baseNdvi = 0.4 + Math.sin(i * 0.5) * 0.3;
        mockData.push({ date, ndvi: Math.max(0, Math.min(1, baseNdvi + Math.random() * 0.1)) });
      }
      return mockData;
    }
    return ndviHistory.map((n: any) => ({
      date: new Date(n.captureDate || n.date),
      ndvi: n.ndviAverage ? n.ndviAverage / 100 : (n.ndvi || 0.5),
    }));
  }, [ndviHistory]);

  // Dados mock de precipitação
  const precipitationData = useMemo(() => {
    const data = [];
    let accumulated = 0;
    for (let i = 0; i < 12; i++) {
      accumulated += 50 + Math.random() * 100;
      data.push({ date: subDays(new Date(), (11 - i) * 30), value: accumulated });
    }
    return data;
  }, []);

  // Lista de imagens disponíveis (do histórico)
  const availableImages = useMemo(() => {
    if (!ndviHistory?.length) {
      return [
        { date: new Date(), ndvi: 0.69, cloudy: false },
        { date: subDays(new Date(), 5), ndvi: 0.65, cloudy: true },
        { date: subDays(new Date(), 10), ndvi: 0.72, cloudy: false },
      ];
    }
    return ndviHistory.map((n: any) => ({
      date: new Date(n.captureDate || n.date),
      ndvi: n.ndviAverage ? n.ndviAverage / 100 : (n.ndvi || 0.5),
      cloudy: n.cloudCoverage ? n.cloudCoverage > 50 : false,
    }));
  }, [ndviHistory]);

  const currentImage = availableImages[currentImageIndex] || availableImages[0];
  const currentNdviValue = field?.currentNdvi ? (field.currentNdvi / 100).toFixed(2) : "0.69";
  const daysSinceUpdate = currentImage ? differenceInDays(new Date(), currentImage.date) : 0;

  // Navegação entre imagens
  const goToPrevImage = () => {
    setCurrentImageIndex(prev => Math.max(0, prev - 1));
  };
  const goToNextImage = () => {
    setCurrentImageIndex(prev => Math.min(availableImages.length - 1, prev + 1));
  };

  // Draw field on NDVI map
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

        const sourceId = "field-ndvi";
        const outlineId = `${sourceId}-outline`;

        // Limpar layers anteriores
        removeAllOverlays(mapInstance);
        [outlineId, sourceId, "ndvi-image-layer", "ndvi-image-layer-source"].forEach((id) => {
          if (mapInstance.getLayer(id)) mapInstance.removeLayer(id);
          if (mapInstance.getSource(id)) mapInstance.removeSource(id);
        });

        const boundsArray = calculateBoundsFromPolygon(coordinates);
        const lngs = coordinates.map((c) => c[0]);
        const lats = coordinates.map((c) => c[1]);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);

        // Tentar carregar imagem NDVI via proxy
        try {
          const img = new Image();
          img.crossOrigin = "anonymous";
          
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error("Failed to load"));
            img.src = proxyImageUrl + "?t=" + Date.now();
          });
          
          mapInstance.addSource("ndvi-image-layer-source", {
            type: "image",
            url: proxyImageUrl,
            coordinates: boundsArray,
          });

          mapInstance.addLayer({
            id: "ndvi-image-layer",
            type: "raster",
            source: "ndvi-image-layer-source",
            paint: { "raster-opacity": 0.95 },
          });
        } catch {
          // Fallback: gradiente sintético
          const ndvi = field.currentNdvi ? field.currentNdvi / 100 : 0.5;
          generateNdviGradientOverlay(mapInstance, "ndvi-fallback", ndvi, boundsArray);
        }

        // Adicionar fonte do campo para borda
        mapInstance.addSource(sourceId, {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "Polygon", coordinates: [coordinates] },
          },
        });

        // Borda branca
        mapInstance.addLayer({
          id: outlineId,
          type: "line",
          source: sourceId,
          paint: { "line-color": "#FFFFFF", "line-width": 2, "line-opacity": 0.8 },
        });

        // Ajustar visualização
        const bounds = new mapboxgl.LngLatBounds([minLng, minLat], [maxLng, maxLat]);
        mapInstance.fitBounds(bounds, { padding: 20 });
      } catch (e) {
        console.error("Error drawing field:", e);
      }
    };

    if (mapInstance.isStyleLoaded()) drawField();
    else mapInstance.on("style.load", drawField);
  }, [mapInstance, field, proxyImageUrl, removeAllOverlays, calculateBoundsFromPolygon, generateNdviGradientOverlay]);

  // Draw field on satellite map (sem NDVI)
  useEffect(() => {
    if (!satMapInstance || !field?.boundaries) return;

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

        const sourceId = "field-sat";
        const outlineId = `${sourceId}-outline`;

        [outlineId, sourceId].forEach((id) => {
          if (satMapInstance.getLayer(id)) satMapInstance.removeLayer(id);
          if (satMapInstance.getSource(id)) satMapInstance.removeSource(id);
        });

        const lngs = coordinates.map((c) => c[0]);
        const lats = coordinates.map((c) => c[1]);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);

        satMapInstance.addSource(sourceId, {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "Polygon", coordinates: [coordinates] },
          },
        });

        // Borda preta para contraste
        satMapInstance.addLayer({
          id: outlineId,
          type: "line",
          source: sourceId,
          paint: { "line-color": "#000000", "line-width": 2, "line-opacity": 0.8 },
        });

        const bounds = new mapboxgl.LngLatBounds([minLng, minLat], [maxLng, maxLat]);
        satMapInstance.fitBounds(bounds, { padding: 20 });
      } catch (e) {
        console.error("Error drawing satellite field:", e);
      }
    };

    if (satMapInstance.isStyleLoaded()) drawField();
    else satMapInstance.on("style.load", drawField);
  }, [satMapInstance, field]);

  const handleNdviMapReady = useCallback((map: mapboxgl.Map) => {
    setMapInstance(map);
    setMap(map);
  }, [setMap]);

  const handleSatMapReady = useCallback((map: mapboxgl.Map) => {
    setSatMapInstance(map);
  }, []);

  const currentCrop = crops?.[0];
  const periodStart = format(startOfYear(new Date()), "MMM d", { locale: ptBR });
  const periodEnd = format(new Date(), "MMM d, yyyy", { locale: ptBR });
  const periodDays = differenceInDays(new Date(), startOfYear(new Date()));

  if (isLoading) {
    return <FieldDetailProSkeleton />;
  }

  if (!field) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-500">Campo não encontrado</p>
      </div>
    );
  }

  const fieldCenter = field.boundaries
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
    : [-49.5, -20.8] as [number, number];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => setLocation("/fields")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{field.name}</h1>
                <p className="text-sm text-gray-500">
                  {field.areaHectares ? `${(field.areaHectares / 100).toFixed(1)} ha` : "Área não definida"}
                  {currentCrop ? `, ${currentCrop.cropType}` : ", Sem cultivo"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1">
                <Upload className="h-4 w-4" />
                Upload data
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setLocation(`/fields/${fieldId}/edit`)}>
                    Editar campo
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-6">
            <button className="py-3 border-b-2 border-green-500 text-green-600 font-medium text-sm">
              Status
            </button>
            <button className="py-3 border-b-2 border-transparent text-gray-500 font-medium text-sm hover:text-gray-700">
              Field report <span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded ml-1">PRO</span>
            </button>
            <button className="py-3 border-b-2 border-transparent text-gray-500 font-medium text-sm hover:text-gray-700">
              Prescription maps <span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded ml-1">PRO</span>
            </button>
            <button className="py-3 border-b-2 border-transparent text-gray-500 font-medium text-sm hover:text-gray-700">
              Data
            </button>
            <button className="py-3 border-b-2 border-transparent text-gray-500 font-medium text-sm hover:text-gray-700">
              Yield Analysis <span className="text-xs bg-gray-200 px-1.5 py-0.5 rounded ml-1">PRO</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Quick Actions */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="sm" className="gap-2">
            <Leaf className="h-4 w-4" />
            Add crop
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Calendar className="h-4 w-4" />
            Add planting date
          </Button>
          
          {/* Weather Widget */}
          <div className="ml-auto flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <Thermometer className="h-4 w-4 text-orange-500" />
              <span>+34°</span>
            </div>
            <div className="flex items-center gap-1">
              <CloudRain className="h-4 w-4 text-blue-500" />
              <span>0 mm</span>
            </div>
            <div className="flex items-center gap-1">
              <Wind className="h-4 w-4 text-gray-400" />
              <span>3 m/s</span>
            </div>
          </div>
        </div>

        {/* Map Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* NDVI Card */}
          <Card className="overflow-hidden">
            <CardHeader className="p-3 pb-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-700">
                  NDVI, {currentImage ? format(currentImage.date, "MMM d, yyyy", { locale: ptBR }) : "N/A"}
                </CardTitle>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goToPrevImage} disabled={currentImageIndex === 0}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goToNextImage} disabled={currentImageIndex >= availableImages.length - 1}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 relative">
              <div className="h-64 relative">
                <MapboxMap
                  onMapReady={handleNdviMapReady}
                  className="w-full h-full"
                  initialCenter={fieldCenter}
                  initialZoom={15}
                  style="satellite"
                />
                
                {/* NDVI Color Scale */}
                <div className="absolute left-3 top-1/2 -translate-y-1/2 flex flex-col items-center">
                  <span className="text-[10px] text-white font-medium mb-1 drop-shadow">1.0</span>
                  <div className="w-3 h-32 rounded-full bg-gradient-to-b from-green-500 via-yellow-500 to-red-500 shadow-lg" />
                  <span className="text-[10px] text-white font-medium mt-1 drop-shadow">0.0</span>
                </div>
                
                {/* Layer toggle buttons */}
                <div className="absolute bottom-3 left-3 flex gap-1">
                  <Button variant="secondary" size="sm" className="h-7 px-2 bg-white/90 hover:bg-white text-xs">
                    <Layers className="h-3 w-3 mr-1" />
                    NDVI
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Satellite Card */}
          <Card className="overflow-hidden">
            <CardHeader className="p-3 pb-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-700">
                  Satellite image, {format(new Date(), "MMM d, yyyy", { locale: ptBR })}
                </CardTitle>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-64">
                <MapboxMap
                  onMapReady={handleSatMapReady}
                  className="w-full h-full"
                  initialCenter={fieldCenter}
                  initialZoom={15}
                  style="satellite"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="sm" className="gap-2">
            <Calendar className="h-4 w-4" />
            Custom period
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Calendar className="h-4 w-4" />
            {periodStart} – {periodEnd}
            <ChevronDown className="h-3 w-3" />
          </Button>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 gap-4">
          {/* NDVI Chart */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <NdviChart data={ndviChartData} height={140} />
                </div>
                <div className="text-right ml-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm text-gray-500">NDVI</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <Download className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Leaf className="h-5 w-5 text-green-500" />
                    <span className="text-2xl font-bold">{currentNdviValue}</span>
                  </div>
                  <p className="text-xs text-gray-400">Last updated {daysSinceUpdate} days ago</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Precipitation Chart */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <PrecipitationChart data={precipitationData} height={140} />
                </div>
                <div className="text-right ml-4">
                  <p className="text-sm text-gray-500 mb-1">Accumulated precipitation</p>
                  <div className="flex items-center gap-2">
                    <CloudRain className="h-5 w-5 text-orange-500" />
                    <span className="text-2xl font-bold">{precipitationData[precipitationData.length - 1]?.value.toFixed(0) || 0} mm</span>
                  </div>
                  <p className="text-xs text-gray-400">{periodDays} day period</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Growing Degree Days */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm text-gray-500 mb-2">Growing degree-days</p>
                  <div className="h-20 bg-gray-50 rounded flex items-center justify-center text-gray-400 text-sm">
                    Chart placeholder
                  </div>
                </div>
                <div className="text-right ml-4">
                  <div className="flex items-center gap-2">
                    <Thermometer className="h-5 w-5 text-red-500" />
                    <span className="text-2xl font-bold">+5,471°</span>
                  </div>
                  <p className="text-xs text-gray-400 max-w-[200px]">
                    In {periodDays - 19} of {periodDays} days, the temperature was between +10° and +30°
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function FieldDetailProSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b p-4">
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Skeleton className="h-72 rounded-lg" />
          <Skeleton className="h-72 rounded-lg" />
        </div>
        <Skeleton className="h-48 rounded-lg mb-4" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    </div>
  );
}
