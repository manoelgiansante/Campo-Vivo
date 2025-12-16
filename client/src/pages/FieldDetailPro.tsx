import { trpc } from "@/lib/trpc";
import { MapboxMap, useMapbox } from "@/components/MapboxMap";
import { useNdviOverlay } from "@/hooks/useNdviOverlay";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  NdviChart as NdviChartComponent,
  NdviChartOneSoil,
  NdviColorScale,
  PrecipitationChart as PrecipitationChartComponent,
  ThermalSumChart,
  WeatherWidget,
  cropGDDRequirements,
} from "@/components/charts";
import { 
  ChevronLeft,
  ChevronRight,
  ChevronDown, 
  Maximize2,
  Download,
  Leaf,
  CloudRain,
  Thermometer,
  Calendar,
  ArrowLeft,
  Layers,
  Upload,
  Cloud,
  Droplets,
  Wind,
  List,
  Grid3X3,
} from "lucide-react";
import { useState, useCallback, useEffect, useMemo } from "react";
import { useLocation, useParams } from "wouter";
import { format, subDays, subMonths, startOfYear, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import mapboxgl from "mapbox-gl";

// Função para obter cor NDVI estilo OneSoil
function getNdviColorPro(value: number): string {
  if (value >= 0.8) return "#22c55e";    // Verde escuro
  if (value >= 0.7) return "#ADFF2F";    // Verde Lima (OneSoil)
  if (value >= 0.6) return "#7FFF00";    // Chartreuse
  if (value >= 0.5) return "#9ACD32";    // Verde Amarelado
  if (value >= 0.4) return "#FFD700";    // Amarelo Dourado
  if (value >= 0.3) return "#FFA500";    // Laranja
  if (value >= 0.2) return "#FF6347";    // Tomate
  return "#DC143C";                       // Vermelho Carmesim
}

// Gráfico NDVI estilo OneSoil
function NdviChart({ data, height = 140 }: { data: { date: Date; ndvi: number }[]; height?: number }) {
  if (!data.length) return null;
  
  const width = 320;
  const padding = { top: 15, right: 10, bottom: 25, left: 35 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  const minNdvi = -0.35;
  const maxNdvi = 1.05;
  
  const xScale = (i: number) => padding.left + (i / Math.max(data.length - 1, 1)) * chartWidth;
  const yScale = (v: number) => padding.top + chartHeight - ((v - minNdvi) / (maxNdvi - minNdvi)) * chartHeight;
  
  // Criar pontos com cores
  const points = data.map((d, i) => ({ 
    x: xScale(i), 
    y: yScale(d.ndvi),
    color: getNdviColorPro(d.ndvi)
  }));
  
  // Criar path suave usando curvas
  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx = (prev.x + curr.x) / 2;
    pathD += ` Q ${prev.x + (curr.x - prev.x) * 0.5} ${prev.y}, ${cpx} ${(prev.y + curr.y) / 2}`;
    pathD += ` Q ${cpx + (curr.x - cpx) * 0.5} ${curr.y}, ${curr.x} ${curr.y}`;
  }
  
  // Área preenchida
  const areaD = `${pathD} L ${points[points.length - 1].x} ${yScale(minNdvi)} L ${points[0].x} ${yScale(minNdvi)} Z`;
  
  const months = ['Jan', 'Mar', 'May', 'Jul', 'Aug', 'Oct', 'Dec'];
  const yTicks = [1.05, 0.35, -0.35];
  
  // Criar ID único para gradiente
  const gradientId = `ndvi-pro-${Math.random().toString(36).substr(2, 9)}`;
  
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      {/* Gradient definitions */}
      <defs>
        <linearGradient id={`${gradientId}-line`} x1="0%" y1="0%" x2="100%" y2="0%">
          {points.map((p, i) => (
            <stop 
              key={i} 
              offset={`${(i / Math.max(points.length - 1, 1)) * 100}%`} 
              stopColor={p.color} 
            />
          ))}
        </linearGradient>
        <linearGradient id={`${gradientId}-area`} x1="0%" y1="0%" x2="100%" y2="0%">
          {points.map((p, i) => (
            <stop 
              key={i} 
              offset={`${(i / Math.max(points.length - 1, 1)) * 100}%`} 
              stopColor={p.color}
              stopOpacity="0.25"
            />
          ))}
        </linearGradient>
      </defs>
      
      {/* Grid lines */}
      {yTicks.map(v => (
        <g key={v}>
          <line
            x1={padding.left}
            y1={yScale(v)}
            x2={width - padding.right}
            y2={yScale(v)}
            stroke="#f0f0f0"
            strokeWidth="1"
          />
          <text 
            x={padding.left - 5} 
            y={yScale(v)} 
            fontSize="9" 
            fill="#9ca3af" 
            textAnchor="end" 
            dominantBaseline="middle"
          >
            {v.toFixed(2)}
          </text>
        </g>
      ))}
      
      {/* X axis labels */}
      {months.map((m, i) => (
        <text
          key={m}
          x={padding.left + (i / (months.length - 1)) * chartWidth}
          y={height - 5}
          fontSize="9"
          fill="#9ca3af"
          textAnchor="middle"
        >
          {m}
        </text>
      ))}
      
      {/* Area fill */}
      <path d={areaD} fill={`url(#${gradientId}-area)`} />
      
      {/* Main line with gradient */}
      <path 
        d={pathD} 
        fill="none" 
        stroke={`url(#${gradientId}-line)`}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* Points with colors */}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={i === points.length - 1 ? 5 : 3}
          fill={p.color}
          stroke="white"
          strokeWidth={i === points.length - 1 ? 2 : 1}
        />
      ))}
    </svg>
  );
}

// Gráfico de Precipitação estilo OneSoil
function PrecipitationChart({ data, height = 140 }: { data: { date: Date; value: number }[]; height?: number }) {
  if (!data.length) return null;
  
  const width = 320;
  const padding = { top: 15, right: 10, bottom: 25, left: 35 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  const maxValue = 1000;
  
  const xScale = (i: number) => padding.left + (i / Math.max(data.length - 1, 1)) * chartWidth;
  const yScale = (v: number) => padding.top + chartHeight - (v / maxValue) * chartHeight;
  
  const points = data.map((d, i) => ({ x: xScale(i), y: yScale(d.value) }));
  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    pathD += ` L ${points[i].x} ${points[i].y}`;
  }
  
  const areaD = `${pathD} L ${points[points.length - 1].x} ${yScale(0)} L ${points[0].x} ${yScale(0)} Z`;
  
  const months = ['Jan', 'Mar', 'May', 'Jul', 'Aug', 'Oct', 'Dec'];
  
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      {/* Grid lines */}
      {[1000, 500, 0].map(v => (
        <g key={v}>
          <line
            x1={padding.left}
            y1={yScale(v)}
            x2={width - padding.right}
            y2={yScale(v)}
            stroke="#f0f0f0"
            strokeWidth="1"
          />
          <text 
            x={padding.left - 5} 
            y={yScale(v)} 
            fontSize="9" 
            fill="#9ca3af" 
            textAnchor="end" 
            dominantBaseline="middle"
          >
            {v}
          </text>
        </g>
      ))}
      
      {/* X axis labels */}
      {months.map((m, i) => (
        <text
          key={m}
          x={padding.left + (i / (months.length - 1)) * chartWidth}
          y={height - 5}
          fontSize="9"
          fill="#9ca3af"
          textAnchor="middle"
        >
          {m}
        </text>
      ))}
      
      {/* Gradient */}
      <defs>
        <linearGradient id="precipAreaGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f97316" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#f97316" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      
      <path d={areaD} fill="url(#precipAreaGradient)" />
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
    { fieldId, days: 365, maxCloudCoverage: 30 },
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

  // Weather queries
  const [dateRange] = useState({
    start: format(subMonths(new Date(), 6), "yyyy-MM-dd"),
    end: format(new Date(), "yyyy-MM-dd"),
  });

  const { data: weather } = trpc.weather.getByField.useQuery(
    { fieldId },
    { enabled: !!fieldId }
  );

  const { data: historicalWeather } = trpc.weather.getHistorical.useQuery(
    {
      fieldId,
      startDate: dateRange.start,
      endDate: dateRange.end,
      baseTemp: 10,
    },
    { enabled: !!fieldId }
  );

  // Buscar dados NDVI REAIS do Sentinel Hub (Copernicus)
  const { data: ndviRealData, isLoading: isLoadingNdviReal } = trpc.ndvi.getTimeSeriesReal.useQuery(
    {
      fieldId,
      startDate: format(startOfYear(new Date()), "yyyy-MM-dd") + "T00:00:00Z",
      endDate: format(new Date(), "yyyy-MM-dd") + "T23:59:59Z",
      aggregationInterval: "P10D", // Intervalos de 10 dias
    },
    { enabled: !!fieldId }
  );

  const proxyImageUrl = useMemo(() => `/api/ndvi-image/${fieldId}`, [fieldId]);

  // Dados para gráficos - USAR DADOS REAIS DO SENTINEL HUB
  const ndviChartData = useMemo(() => {
    // Priorizar dados reais do Sentinel Hub
    if (ndviRealData && ndviRealData.length > 0) {
      return ndviRealData.map((d: any) => ({
        date: new Date(d.date),
        ndvi: d.ndvi,
      }));
    }

    // Fallback para dados do banco (se houver)
    if (ndviHistory?.length) {
      return ndviHistory.map((n: any) => ({
        date: new Date(n.captureDate || n.date),
        ndvi: n.ndviAverage ? n.ndviAverage / 100 : (n.ndvi || 0.5),
      }));
    }

    // Último fallback: dados mockados (apenas se não houver dados reais)
    const mockData = [];
    for (let i = 0; i < 12; i++) {
      const date = subDays(new Date(), (11 - i) * 30);
      const baseNdvi = 0.4 + Math.sin(i * 0.5) * 0.25;
      mockData.push({ date, ndvi: Math.max(0, Math.min(1, baseNdvi + Math.random() * 0.1)) });
    }
    return mockData;
  }, [ndviRealData, ndviHistory]);

  // Prepare chart data from real weather data
  const precipitationChartData = useMemo(() => {
    if (!historicalWeather?.dates) {
      // Fallback mock data
      const data = [];
      let accumulated = 0;
      for (let i = 0; i < 12; i++) {
        accumulated += 50 + Math.random() * 80;
        data.push({ 
          date: format(subDays(new Date(), (11 - i) * 30), "yyyy-MM-dd"), 
          precipitation: 20 + Math.random() * 40,
          accumulated: Math.min(accumulated, 900) 
        });
      }
      return data;
    }
    return historicalWeather.dates.map((date, i) => ({
      date,
      precipitation: historicalWeather.precipitation[i] || 0,
      accumulated: historicalWeather.accumulatedPrecipitation[i] || 0,
    }));
  }, [historicalWeather]);

  const thermalSumChartData = useMemo(() => {
    if (!historicalWeather?.dates) return [];
    return historicalWeather.dates.map((date, i) => ({
      date,
      thermalSum: historicalWeather.thermalSum[i] || 0,
      temperatureMean: historicalWeather.temperatureMean[i] || 0,
    }));
  }, [historicalWeather]);

  // Get target GDD based on current crop
  const targetGDD = crops?.[0]?.cropType 
    ? cropGDDRequirements[crops[0].cropType.toLowerCase()]?.max 
    : undefined;

  const availableImages = useMemo(() => {
    if (!ndviHistory?.length) {
      return [
        { date: subDays(new Date(), 22), ndvi: 0.69, cloudy: false },
        { date: subDays(new Date(), 27), ndvi: 0.65, cloudy: true },
        { date: subDays(new Date(), 32), ndvi: 0.72, cloudy: false },
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
  const daysSinceUpdate = currentImage ? differenceInDays(new Date(), currentImage.date) : 22;

  const goToPrevImage = () => setCurrentImageIndex(prev => Math.max(0, prev - 1));
  const goToNextImage = () => setCurrentImageIndex(prev => Math.min(availableImages.length - 1, prev + 1));

  // Draw NDVI map
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
        if (coordinates[0][0] !== coordinates[coordinates.length - 1][0] || 
            coordinates[0][1] !== coordinates[coordinates.length - 1][1]) {
          coordinates.push(coordinates[0]);
        }

        const sourceId = "field-ndvi";
        const outlineId = `${sourceId}-outline`;

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

        // Tentar carregar imagem NDVI
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
            paint: { "raster-opacity": 1.0, "raster-fade-duration": 0 },
          });
        } catch {
          const ndvi = field.currentNdvi ? field.currentNdvi / 100 : 0.5;
          generateNdviGradientOverlay(mapInstance, "ndvi-fallback", ndvi, boundsArray);
        }

        mapInstance.addSource(sourceId, {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "Polygon", coordinates: [coordinates] },
          },
        });

        // Borda branca grossa
        mapInstance.addLayer({
          id: outlineId,
          type: "line",
          source: sourceId,
          paint: { "line-color": "#FFFFFF", "line-width": 3, "line-opacity": 1 },
        });

        const bounds = new mapboxgl.LngLatBounds([minLng, minLat], [maxLng, maxLat]);
        mapInstance.fitBounds(bounds, { padding: 30 });
      } catch (e) {
        console.error("Error drawing field:", e);
      }
    };

    if (mapInstance.isStyleLoaded()) drawField();
    else mapInstance.on("style.load", drawField);
  }, [mapInstance, field, proxyImageUrl, removeAllOverlays, calculateBoundsFromPolygon, generateNdviGradientOverlay]);

  // Draw satellite map
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
        if (coordinates[0][0] !== coordinates[coordinates.length - 1][0] || 
            coordinates[0][1] !== coordinates[coordinates.length - 1][1]) {
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

        satMapInstance.addSource(sourceId, {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "Polygon", coordinates: [coordinates] },
          },
        });

        // Borda preta
        satMapInstance.addLayer({
          id: outlineId,
          type: "line",
          source: sourceId,
          paint: { "line-color": "#000000", "line-width": 2, "line-opacity": 0.8 },
        });

        const bounds = new mapboxgl.LngLatBounds(
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)]
        );
        satMapInstance.fitBounds(bounds, { padding: 30 });
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
  const periodDays = differenceInDays(new Date(), startOfYear(new Date()));

  if (isLoading) return <FieldDetailProSkeleton />;

  if (!field) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center">
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

  const ndviDate = currentImage ? format(currentImage.date, "MMM d, yyyy") : "Nov 22, 2025";
  const satDate = format(new Date(), "MMM d, yyyy");

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      {/* Header - Estilo OneSoil */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setLocation("/fields")}
                className="hover:bg-gray-100 rounded-full"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">{field.name}</h1>
                <p className="text-sm text-gray-500">
                  {field.areaHectares ? `${(field.areaHectares / 100).toFixed(1)} ha` : "Área não definida"}
                  {currentCrop ? `, ${currentCrop.cropType}` : ", No crop"}
                </p>
              </div>
            </div>
            
            {/* PRO Buttons */}
            <div className="flex items-center gap-3">
              <button className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
                <span>Prescription map</span>
                <span className="text-[10px] bg-gray-200 px-1.5 py-0.5 rounded font-medium">PRO</span>
              </button>
              <button className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
                <span>Soil sampling map</span>
                <span className="text-[10px] bg-gray-200 px-1.5 py-0.5 rounded font-medium">PRO</span>
              </button>
              <Button variant="outline" size="sm" className="gap-2 text-gray-600">
                <Upload className="h-4 w-4" />
                Upload data
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs - Estilo OneSoil */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center gap-1">
            <button className="px-4 py-3 text-sm font-medium text-green-600 border-b-2 border-green-500">
              Status
            </button>
            <button className="px-4 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 flex items-center gap-1">
              Field report
              <span className="text-[10px] bg-gray-200 px-1.5 py-0.5 rounded">PRO</span>
            </button>
            <button className="px-4 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 flex items-center gap-1">
              Prescription maps
              <span className="text-[10px] bg-gray-200 px-1.5 py-0.5 rounded">PRO</span>
            </button>
            <button className="px-4 py-3 text-sm font-medium text-gray-500 hover:text-gray-700">
              Data
            </button>
            <button className="px-4 py-3 text-sm font-medium text-gray-500 hover:text-gray-700 flex items-center gap-1">
              Yield Analysis
              <span className="text-[10px] bg-gray-200 px-1.5 py-0.5 rounded">PRO</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Quick Actions + Weather */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="gap-2 text-gray-600 bg-white">
              <Leaf className="h-4 w-4" />
              Add crop
            </Button>
            <Button variant="outline" size="sm" className="gap-2 text-gray-600 bg-white">
              <Calendar className="h-4 w-4" />
              Add planting date
            </Button>
          </div>
          
          {/* Weather Widget - Estilo OneSoil */}
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Cloud className="h-5 w-5 text-blue-400" />
              <span className="font-medium text-gray-700">+34°</span>
            </div>
            <div className="flex items-center gap-1 text-gray-500">
              <CloudRain className="h-4 w-4" />
              <span>0 mm</span>
            </div>
            <div className="flex items-center gap-1 text-gray-500">
              <Wind className="h-4 w-4" />
              <span>3 m/s</span>
            </div>
          </div>
        </div>

        {/* Map Cards - Estilo OneSoil */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* NDVI Card */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {/* Card Header */}
            <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
              <span className="text-sm font-medium text-gray-700">NDVI, {ndviDate}</span>
              <div className="flex items-center gap-1">
                <button 
                  onClick={goToPrevImage}
                  disabled={currentImageIndex === 0}
                  className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
                >
                  <ChevronLeft className="h-4 w-4 text-gray-500" />
                </button>
                <button 
                  onClick={goToNextImage}
                  disabled={currentImageIndex >= availableImages.length - 1}
                  className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
                >
                  <ChevronRight className="h-4 w-4 text-gray-500" />
                </button>
                <button className="p-1 hover:bg-gray-100 rounded">
                  <List className="h-4 w-4 text-gray-500" />
                </button>
                <button className="p-1 hover:bg-gray-100 rounded">
                  <Grid3X3 className="h-4 w-4 text-gray-500" />
                </button>
                <button className="p-1 hover:bg-gray-100 rounded">
                  <Maximize2 className="h-4 w-4 text-gray-500" />
                </button>
              </div>
            </div>
            
            {/* Map Container */}
            <div className="relative h-72">
              <MapboxMap
                onMapReady={handleNdviMapReady}
                className="w-full h-full"
                initialCenter={fieldCenter}
                initialZoom={15}
                style="satellite"
              />
              
              {/* NDVI Color Scale - Vertical, inside map */}
              <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col items-center">
                <span className="text-[11px] text-white font-semibold mb-1 drop-shadow-lg">1.0</span>
                <div 
                  className="w-4 h-36 rounded-sm shadow-lg"
                  style={{
                    background: 'linear-gradient(to bottom, #22c55e 0%, #84cc16 25%, #eab308 50%, #f97316 75%, #ef4444 100%)'
                  }}
                />
                <span className="text-[11px] text-white font-semibold mt-1 drop-shadow-lg">0.0</span>
              </div>
              
              {/* Bottom controls */}
              <div className="absolute bottom-3 left-4 flex gap-2">
                <button className="bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg text-xs font-medium text-gray-700 shadow-sm flex items-center gap-1">
                  <Layers className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>

          {/* Satellite Card */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
              <span className="text-sm font-medium text-gray-700">Satellite image, {satDate}</span>
              <button className="p-1 hover:bg-gray-100 rounded">
                <Maximize2 className="h-4 w-4 text-gray-500" />
              </button>
            </div>
            <div className="h-72">
              <MapboxMap
                onMapReady={handleSatMapReady}
                className="w-full h-full"
                initialCenter={fieldCenter}
                initialZoom={15}
                style="satellite"
              />
            </div>
          </div>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="outline" size="sm" className="gap-2 text-gray-600 bg-white">
            <Calendar className="h-4 w-4" />
            Custom period
          </Button>
          <Button variant="outline" size="sm" className="gap-2 text-gray-600 bg-white">
            <Calendar className="h-4 w-4" />
            Jan 1 – Dec 14, 2025
            <ChevronDown className="h-3 w-3" />
          </Button>
        </div>

        {/* Weather Widget */}
        {weather?.current && (
          <div className="bg-white rounded-xl shadow-sm p-5 mb-4">
            <WeatherWidget current={weather.current} location={field.city || field.name} />
          </div>
        )}

        {/* Charts - Estilo OneSoil */}
        <div className="space-y-4">
          {/* NDVI Chart - Estilo OneSoil */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <NdviChartOneSoil
              data={ndviChartData.map(d => ({ date: format(d.date, "yyyy-MM-dd"), ndvi: d.ndvi }))}
              currentValue={parseFloat(currentNdviValue)}
              lastUpdateDate={ndviChartData.length > 0 ? format(ndviChartData[ndviChartData.length - 1].date, "yyyy-MM-dd") : undefined}
              height={200}
              showDownload={true}
              title="Índice NDVI"
            />
          </div>

          {/* Precipitation Chart */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Droplets className="h-5 w-5 text-blue-500" />
                <span className="text-sm font-medium text-gray-700">Precipitação</span>
              </div>
              <button className="p-1 hover:bg-gray-100 rounded">
                <Download className="h-4 w-4 text-gray-400" />
              </button>
            </div>
            <PrecipitationChartComponent 
              data={precipitationChartData}
              totalPrecipitation={historicalWeather?.totalPrecipitation || precipitationChartData[precipitationChartData.length - 1]?.accumulated}
              height={180}
            />
          </div>

          {/* Growing Degree Days */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Thermometer className="h-5 w-5 text-orange-500" />
                <span className="text-sm font-medium text-gray-700">Soma Térmica (Graus-dia)</span>
              </div>
              <button className="p-1 hover:bg-gray-100 rounded">
                <Download className="h-4 w-4 text-gray-400" />
              </button>
            </div>
            <ThermalSumChart 
              data={thermalSumChartData}
              totalThermalSum={historicalWeather?.totalThermalSum}
              baseTemperature={10}
              targetGDD={targetGDD}
              height={180}
            />
          </div>

          {/* Weather Forecast */}
          {weather?.daily && weather.daily.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <Cloud className="h-5 w-5 text-blue-400" />
                <span className="text-sm font-medium text-gray-700">Previsão para 7 Dias</span>
              </div>
              <div className="grid grid-cols-7 gap-2">
                {weather.daily.slice(0, 7).map((day, index) => (
                  <div key={index} className="text-center p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                    <p className="text-xs font-medium text-gray-600">
                      {index === 0 ? "Hoje" : format(new Date(day.date), "EEE", { locale: ptBR })}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {format(new Date(day.date), "dd/MM")}
                    </p>
                    <p className="text-lg font-bold text-gray-900 mt-1">{day.temperatureMax?.toFixed(0)}°</p>
                    <p className="text-sm text-gray-500">{day.temperatureMin?.toFixed(0)}°</p>
                    {day.precipitation > 0 && (
                      <p className="text-xs text-blue-500 mt-1 flex items-center justify-center gap-0.5">
                        <Droplets className="h-3 w-3" />
                        {day.precipitation.toFixed(0)}mm
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FieldDetailProSkeleton() {
  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <div className="bg-white border-b p-6">
        <Skeleton className="h-7 w-48 mb-2" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
        <Skeleton className="h-48 rounded-xl mb-4" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    </div>
  );
}
