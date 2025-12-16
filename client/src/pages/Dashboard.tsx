import { trpc } from "@/lib/trpc";
import { MapboxMap, useMapbox } from "@/components/MapboxMap";
import { clipImageToPolygon, generateClippedNdviGradient } from "@/utils/clipImageToPolygon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  Maximize2,
  Download,
  Leaf,
  CloudRain,
  Thermometer,
  Wind,
  Calendar,
  Search,
  Plus,
  Settings,
  Map,
  Layers,
  BarChart3,
  FileText,
  Users,
  Cloud,
  Check,
  MoreVertical,
  Home,
  Droplets,
  Sun,
  Edit,
  Trash2,
  StickyNote,
  ChevronUp,
  Menu,
  Bell,
  HelpCircle,
  LogOut,
} from "lucide-react";
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { format, subDays, startOfYear, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useLocation } from "wouter";
import mapboxgl from "mapbox-gl";

// ============== UTILITY FUNCTIONS ==============

function getNdviColor(ndvi: number): string {
  if (ndvi < 0.2) return "#d73027";
  if (ndvi < 0.3) return "#f46d43";
  if (ndvi < 0.4) return "#fdae61";
  if (ndvi < 0.5) return "#fee08b";
  if (ndvi < 0.6) return "#d9ef8b";
  if (ndvi < 0.7) return "#a6d96a";
  if (ndvi < 0.8) return "#66bd63";
  return "#1a9850";
}

function formatHectares(value: number | null | undefined): string {
  if (!value) return "0 ha";
  const ha = value / 100;
  return ha >= 1 ? `${ha.toFixed(1)} ha` : `${(ha * 10000).toFixed(0)} m²`;
}

// ============== COMPONENTS ==============

// Thumbnail do polígono do campo
function FieldThumbnail({ 
  boundaries, 
  ndviValue, 
  size = 48 
}: { 
  boundaries: any; 
  ndviValue?: number; 
  size?: number 
}) {
  const coords = useMemo(() => {
    try {
      const parsed = typeof boundaries === "string" ? JSON.parse(boundaries) : boundaries;
      if (!Array.isArray(parsed) || parsed.length < 3) return null;
      
      const lngs = parsed.map((p: any) => p.lng);
      const lats = parsed.map((p: any) => p.lat);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      
      const padding = 4;
      const rangeX = maxLng - minLng || 0.001;
      const rangeY = maxLat - minLat || 0.001;
      const scale = (size - padding * 2) / Math.max(rangeX, rangeY);
      
      return parsed.map((p: any) => ({
        x: padding + (p.lng - minLng) * scale,
        y: padding + (maxLat - p.lat) * scale,
      }));
    } catch {
      return null;
    }
  }, [boundaries, size]);

  const fillColor = useMemo(() => {
    const ndvi = ndviValue ?? 0.5;
    return getNdviColor(ndvi);
  }, [ndviValue]);

  if (!coords) {
    return (
      <div 
        className="bg-gray-100 rounded-lg flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <Map className="h-4 w-4 text-gray-400" />
      </div>
    );
  }

  const pathD = coords.map((c: any, i: number) => 
    `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`
  ).join(' ') + ' Z';

  return (
    <svg width={size} height={size} className="bg-gray-50 rounded-lg">
      <defs>
        <linearGradient id={`ndvi-thumb-${size}-${fillColor}`} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={fillColor} stopOpacity="0.9" />
          <stop offset="100%" stopColor={fillColor} stopOpacity="0.6" />
        </linearGradient>
      </defs>
      <path 
        d={pathD} 
        fill={`url(#ndvi-thumb-${size}-${fillColor})`}
        stroke="#374151" 
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Gráfico NDVI anual estilo OneSoil
function NdviYearChart({ 
  data, 
  height = 120,
  currentNdvi
}: { 
  data: { date: Date; ndvi: number }[]; 
  height?: number;
  currentNdvi?: number;
}) {
  const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  
  const chartData = useMemo(() => {
    if (data.length > 0) return data;
    // Dados simulados se não houver histórico real
    const now = new Date();
    return months.map((_, i) => {
      const date = new Date(now.getFullYear(), i, 15);
      const baseNdvi = 0.4 + Math.sin((i + 3) * 0.5) * 0.25;
      return { date, ndvi: Math.max(0.2, Math.min(0.9, baseNdvi + (Math.random() - 0.5) * 0.1)) };
    });
  }, [data]);

  const width = 400;
  const padding = { top: 15, right: 15, bottom: 25, left: 35 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const xScale = (i: number) => padding.left + (i / Math.max(chartData.length - 1, 1)) * chartWidth;
  const yScale = (v: number) => padding.top + chartHeight - (v * chartHeight);

  const points = chartData.map((d, i) => ({ 
    x: xScale(i), 
    y: yScale(d.ndvi),
    ndvi: d.ndvi 
  }));

  // Criar path suave com curvas bezier
  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx = (prev.x + curr.x) / 2;
    pathD += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
  }

  // Path para área preenchida
  const areaPath = pathD + ` L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${points[0].x} ${padding.top + chartHeight} Z`;

  const lastPoint = points[points.length - 1];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      <defs>
        <linearGradient id="ndvi-area-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {[0.25, 0.5, 0.75, 1].map(v => (
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
            x={padding.left - 8} 
            y={yScale(v)} 
            fontSize="10" 
            fill="#9ca3af" 
            textAnchor="end" 
            dominantBaseline="middle"
          >
            {v.toFixed(1)}
          </text>
        </g>
      ))}

      {/* Area fill */}
      <path d={areaPath} fill="url(#ndvi-area-gradient)" />

      {/* Line */}
      <path 
        d={pathD} 
        fill="none" 
        stroke="#22c55e" 
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Current point marker */}
      <circle
        cx={lastPoint.x}
        cy={lastPoint.y}
        r="6"
        fill="#22c55e"
        stroke="white"
        strokeWidth="2"
      />

      {/* X-axis labels */}
      {months.map((m, i) => (
        <text
          key={m}
          x={padding.left + (i / 11) * chartWidth}
          y={height - 5}
          fontSize="10"
          fill="#9ca3af"
          textAnchor="middle"
        >
          {m}
        </text>
      ))}
    </svg>
  );
}

// Gráfico de precipitação acumulada
function PrecipitationChart({ 
  dates, 
  values,
  height = 100 
}: { 
  dates: string[]; 
  values: number[];
  height?: number;
}) {
  const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const maxValue = Math.max(...values, 200);

  const width = 400;
  const padding = { top: 15, right: 15, bottom: 25, left: 40 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Agrupar por mês
  const monthlyData = months.map((_, monthIndex) => {
    const monthValues = values.filter((_, i) => {
      if (!dates[i]) return false;
      const date = new Date(dates[i]);
      return date.getMonth() === monthIndex;
    });
    return monthValues.length > 0 ? monthValues[monthValues.length - 1] : 0;
  });

  const xScale = (i: number) => padding.left + (i / 11) * chartWidth;
  const yScale = (v: number) => padding.top + chartHeight - ((v / maxValue) * chartHeight);

  const points = monthlyData.map((v, i) => ({ x: xScale(i), y: yScale(v) }));

  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx = (prev.x + curr.x) / 2;
    pathD += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
  }

  const areaPath = pathD + ` L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${points[0].x} ${padding.top + chartHeight} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      <defs>
        <linearGradient id="precip-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Grid */}
      {[0.25, 0.5, 0.75, 1].map(v => (
        <line
          key={v}
          x1={padding.left}
          y1={yScale(v * maxValue)}
          x2={width - padding.right}
          y2={yScale(v * maxValue)}
          stroke="#f0f0f0"
          strokeWidth="1"
        />
      ))}

      <path d={areaPath} fill="url(#precip-gradient)" />
      <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />

      {months.map((m, i) => (
        <text key={m} x={xScale(i)} y={height - 5} fontSize="10" fill="#9ca3af" textAnchor="middle">
          {m}
        </text>
      ))}

      <text x={padding.left - 8} y={padding.top} fontSize="10" fill="#9ca3af" textAnchor="end">
        {Math.round(maxValue)}
      </text>
      <text x={padding.left - 8} y={padding.top + chartHeight} fontSize="10" fill="#9ca3af" textAnchor="end">
        0
      </text>
    </svg>
  );
}

// Gráfico de soma térmica
function ThermalSumChart({ 
  dates, 
  values,
  height = 100 
}: { 
  dates: string[]; 
  values: number[];
  height?: number;
}) {
  const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const maxValue = Math.max(...values, 2000);

  const width = 400;
  const padding = { top: 15, right: 15, bottom: 25, left: 45 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const monthlyData = months.map((_, monthIndex) => {
    const monthValues = values.filter((_, i) => {
      if (!dates[i]) return false;
      const date = new Date(dates[i]);
      return date.getMonth() === monthIndex;
    });
    return monthValues.length > 0 ? monthValues[monthValues.length - 1] : 0;
  });

  const xScale = (i: number) => padding.left + (i / 11) * chartWidth;
  const yScale = (v: number) => padding.top + chartHeight - ((v / maxValue) * chartHeight);

  const points = monthlyData.map((v, i) => ({ x: xScale(i), y: yScale(v) }));

  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    pathD += ` L ${points[i].x} ${points[i].y}`;
  }

  const areaPath = pathD + ` L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${points[0].x} ${padding.top + chartHeight} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      <defs>
        <linearGradient id="thermal-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f97316" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#f97316" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {[0.25, 0.5, 0.75, 1].map(v => (
        <line
          key={v}
          x1={padding.left}
          y1={yScale(v * maxValue)}
          x2={width - padding.right}
          y2={yScale(v * maxValue)}
          stroke="#f0f0f0"
          strokeWidth="1"
        />
      ))}

      <path d={areaPath} fill="url(#thermal-gradient)" />
      <path d={pathD} fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" />

      {months.map((m, i) => (
        <text key={m} x={xScale(i)} y={height - 5} fontSize="10" fill="#9ca3af" textAnchor="middle">
          {m}
        </text>
      ))}

      <text x={padding.left - 8} y={padding.top} fontSize="10" fill="#9ca3af" textAnchor="end">
        {Math.round(maxValue)}
      </text>
    </svg>
  );
}

// Escala NDVI vertical
function NdviScale() {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] text-white/80 font-medium">1.0</span>
      <div 
        className="w-3 h-32 rounded-sm shadow-lg"
        style={{
          background: 'linear-gradient(to bottom, #1a9850 0%, #66bd63 15%, #a6d96a 30%, #d9ef8b 45%, #fee08b 55%, #fdae61 70%, #f46d43 85%, #d73027 100%)'
        }}
      />
      <span className="text-[10px] text-white/80 font-medium">0.0</span>
    </div>
  );
}

// ============== MAIN COMPONENT ==============

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [selectedFieldId, setSelectedFieldId] = useState<number | null>(null);
  const [selectedFields, setSelectedFields] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<"status" | "data" | "notes">("status");
  const [ndviMapInstance, setNdviMapInstance] = useState<mapboxgl.Map | null>(null);
  const [satMapInstance, setSatMapInstance] = useState<mapboxgl.Map | null>(null);
  const { setMap } = useMapbox();

  // Queries
  const { data: fields, isLoading: fieldsLoading } = trpc.fields.list.useQuery();
  const { data: selectedField } = trpc.fields.getById.useQuery(
    { id: selectedFieldId! },
    { enabled: !!selectedFieldId }
  );
  const { data: ndviHistory } = trpc.ndvi.history.useQuery(
    { fieldId: selectedFieldId!, days: 365 },
    { enabled: !!selectedFieldId }
  );
  const { data: weather } = trpc.weather.getByField.useQuery(
    { fieldId: selectedFieldId! },
    { enabled: !!selectedFieldId }
  );
  const { data: historicalWeather } = trpc.weather.getHistorical.useQuery(
    { fieldId: selectedFieldId!, days: 365 },
    { enabled: !!selectedFieldId }
  );
  const { data: notes } = trpc.notes.listByField.useQuery(
    { fieldId: selectedFieldId! },
    { enabled: !!selectedFieldId }
  );

  // Computed values
  const proxyImageUrl = useMemo(() => 
    selectedFieldId ? `/api/copernicus-ndvi/${selectedFieldId}?palette=contrast` : null
  , [selectedFieldId]);

  const filteredFields = useMemo(() => {
    if (!fields) return [];
    if (!searchQuery) return fields;
    return fields.filter((f: any) => 
      f.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [fields, searchQuery]);

  const totalArea = useMemo(() => {
    if (!fields) return 0;
    return fields.reduce((sum: number, f: any) => sum + (f.areaHectares || 0), 0) / 100;
  }, [fields]);

  const ndviChartData = useMemo(() => {
    if (ndviHistory?.length) {
      return ndviHistory.map((n: any) => ({
        date: new Date(n.captureDate || n.date),
        ndvi: n.ndviAverage ? n.ndviAverage / 100 : (n.ndvi || 0.5)
      }));
    }
    // Dados simulados
    return Array.from({ length: 12 }, (_, i) => {
      const date = new Date(2025, i, 15);
      return { date, ndvi: 0.4 + Math.sin((i + 3) * 0.5) * 0.2 };
    });
  }, [ndviHistory]);

  const currentNdviValue = selectedField?.currentNdvi 
    ? (selectedField.currentNdvi / 100).toFixed(2) 
    : "0.65";

  const fieldCenter = useMemo(() => {
    if (!selectedField?.boundaries) return [-49.5, -20.8] as [number, number];
    try {
      const bounds = typeof selectedField.boundaries === "string"
        ? JSON.parse(selectedField.boundaries)
        : selectedField.boundaries;
      if (Array.isArray(bounds) && bounds.length > 0) {
        const lngs = bounds.map((p: any) => p.lng);
        const lats = bounds.map((p: any) => p.lat);
        return [
          (Math.min(...lngs) + Math.max(...lngs)) / 2,
          (Math.min(...lats) + Math.max(...lats)) / 2,
        ] as [number, number];
      }
    } catch {}
    return [-49.5, -20.8] as [number, number];
  }, [selectedField]);

  // Selecionar primeiro campo automaticamente
  useEffect(() => {
    if (fields?.length && !selectedFieldId) {
      setSelectedFieldId(fields[0].id);
    }
  }, [fields, selectedFieldId]);

  // Draw NDVI overlay
  useEffect(() => {
    if (!ndviMapInstance || !selectedField?.boundaries) return;

    const drawNdviOverlay = async () => {
      try {
        const boundaries = typeof selectedField.boundaries === "string"
          ? JSON.parse(selectedField.boundaries)
          : selectedField.boundaries;

        if (!Array.isArray(boundaries) || boundaries.length < 3) return;

        const coordinates = boundaries.map((p: { lat: number; lng: number }) =>
          [p.lng, p.lat] as [number, number]
        );
        if (coordinates[0][0] !== coordinates[coordinates.length - 1][0] ||
            coordinates[0][1] !== coordinates[coordinates.length - 1][1]) {
          coordinates.push(coordinates[0]);
        }

        // Remove existing layers
        ["ndvi-overlay", "ndvi-outline", "ndvi-image"].forEach(id => {
          if (ndviMapInstance.getLayer(id)) ndviMapInstance.removeLayer(id);
          if (ndviMapInstance.getSource(id)) ndviMapInstance.removeSource(id);
        });

        const lngs = coordinates.map(c => c[0]);
        const lats = coordinates.map(c => c[1]);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);

        const bounds = { minLng, maxLng, minLat, maxLat };
        const boundsArray: [[number, number], [number, number], [number, number], [number, number]] = [
          [minLng, maxLat],
          [maxLng, maxLat],
          [maxLng, minLat],
          [minLng, minLat],
        ];

        let ndviLoaded = false;

        if (proxyImageUrl) {
          try {
            const clippedImageUrl = await clipImageToPolygon(
              proxyImageUrl + "?t=" + Date.now(),
              coordinates,
              bounds
            );
            
            ndviMapInstance.addSource("ndvi-image", {
              type: "image",
              url: clippedImageUrl,
              coordinates: boundsArray,
            });

            ndviMapInstance.addLayer({
              id: "ndvi-image",
              type: "raster",
              source: "ndvi-image",
              paint: { "raster-opacity": 1.0 },
            });
            ndviLoaded = true;
          } catch (e) {
            console.warn("Falha ao carregar NDVI:", e);
          }
        }

        if (!ndviLoaded) {
          const ndviValue = selectedField.currentNdvi ? selectedField.currentNdvi / 100 : 0.65;
          const gradientUrl = generateClippedNdviGradient(ndviValue, coordinates, bounds);
          
          ndviMapInstance.addSource("ndvi-image", {
            type: "image",
            url: gradientUrl,
            coordinates: boundsArray,
          });

          ndviMapInstance.addLayer({
            id: "ndvi-image",
            type: "raster",
            source: "ndvi-image",
            paint: { "raster-opacity": 1.0 },
          });
        }

        // Outline
        ndviMapInstance.addSource("ndvi-outline", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "Polygon", coordinates: [coordinates] },
          },
        });

        ndviMapInstance.addLayer({
          id: "ndvi-outline",
          type: "line",
          source: "ndvi-outline",
          paint: { "line-color": "#ffffff", "line-width": 2.5 },
        });

        const mapBounds = new mapboxgl.LngLatBounds([minLng, minLat], [maxLng, maxLat]);
        ndviMapInstance.fitBounds(mapBounds, { padding: 50 });
      } catch (e) {
        console.error("Erro NDVI:", e);
      }
    };

    if (ndviMapInstance.isStyleLoaded()) drawNdviOverlay();
    else ndviMapInstance.on("style.load", drawNdviOverlay);
  }, [ndviMapInstance, selectedField, proxyImageUrl]);

  // Draw satellite
  useEffect(() => {
    if (!satMapInstance || !selectedField?.boundaries) return;

    const drawSatellite = async () => {
      try {
        const boundaries = typeof selectedField.boundaries === "string"
          ? JSON.parse(selectedField.boundaries)
          : selectedField.boundaries;

        if (!Array.isArray(boundaries) || boundaries.length < 3) return;

        const coordinates = boundaries.map((p: { lat: number; lng: number }) =>
          [p.lng, p.lat] as [number, number]
        );
        if (coordinates[0][0] !== coordinates[coordinates.length - 1][0] ||
            coordinates[0][1] !== coordinates[coordinates.length - 1][1]) {
          coordinates.push(coordinates[0]);
        }

        ["sat-outline"].forEach(id => {
          if (satMapInstance.getLayer(id)) satMapInstance.removeLayer(id);
          if (satMapInstance.getSource(id)) satMapInstance.removeSource(id);
        });

        const lngs = coordinates.map(c => c[0]);
        const lats = coordinates.map(c => c[1]);

        satMapInstance.addSource("sat-outline", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "Polygon", coordinates: [coordinates] },
          },
        });

        satMapInstance.addLayer({
          id: "sat-outline",
          type: "line",
          source: "sat-outline",
          paint: { "line-color": "#000000", "line-width": 2 },
        });

        const bounds = new mapboxgl.LngLatBounds(
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)]
        );
        satMapInstance.fitBounds(bounds, { padding: 50 });
      } catch (e) {
        console.error("Erro satélite:", e);
      }
    };

    if (satMapInstance.isStyleLoaded()) drawSatellite();
    else satMapInstance.on("style.load", drawSatellite);
  }, [satMapInstance, selectedField]);

  const handleNdviMapReady = useCallback((map: mapboxgl.Map) => {
    setNdviMapInstance(map);
    setMap(map);
  }, [setMap]);

  const handleSatMapReady = useCallback((map: mapboxgl.Map) => {
    setSatMapInstance(map);
  }, []);

  const toggleFieldSelection = (fieldId: number) => {
    const newSelected = new Set(selectedFields);
    if (newSelected.has(fieldId)) {
      newSelected.delete(fieldId);
    } else {
      newSelected.add(fieldId);
    }
    setSelectedFields(newSelected);
  };

  return (
    <div className="h-screen flex bg-[#fafafa] overflow-hidden">
      {/* ===== SIDEBAR ICONS ===== */}
      <div className="w-14 bg-[#1e293b] flex flex-col items-center py-4 shrink-0">
        {/* Logo */}
        <div className="w-9 h-9 bg-gradient-to-br from-green-400 to-green-600 rounded-xl flex items-center justify-center mb-6 shadow-lg">
          <Leaf className="h-5 w-5 text-white" />
        </div>
        
        {/* Main Navigation */}
        <div className="flex-1 flex flex-col items-center gap-1">
          <button 
            className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center text-green-400"
            title="Dashboard"
          >
            <Home className="h-5 w-5" />
          </button>
          <button 
            className="w-10 h-10 rounded-xl hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
            title="Mapa"
            onClick={() => setLocation("/map")}
          >
            <Map className="h-5 w-5" />
          </button>
          <button 
            className="w-10 h-10 rounded-xl hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
            title="Camadas"
          >
            <Layers className="h-5 w-5" />
          </button>
          <button 
            className="w-10 h-10 rounded-xl hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
            title="Relatórios"
          >
            <BarChart3 className="h-5 w-5" />
          </button>
          <button 
            className="w-10 h-10 rounded-xl hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
            title="Notas"
            onClick={() => setLocation("/notes")}
          >
            <FileText className="h-5 w-5" />
          </button>
          
          {/* PRO Button */}
          <button 
            className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center text-white hover:from-amber-400 hover:to-orange-400 transition-all mt-2 shadow-lg shadow-orange-500/20"
            title="CampoVivo PRO"
            onClick={() => setLocation("/pro")}
          >
            <span className="text-[10px] font-bold">PRO</span>
          </button>
        </div>

        {/* Bottom Navigation */}
        <div className="flex flex-col items-center gap-1">
          <button 
            className="w-10 h-10 rounded-xl hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
            title="Ajuda"
          >
            <HelpCircle className="h-5 w-5" />
          </button>
          <button 
            className="w-10 h-10 rounded-xl hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
            title="Configurações"
            onClick={() => setLocation("/profile")}
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* ===== FIELDS LIST SIDEBAR ===== */}
      <div className={`bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ${sidebarCollapsed ? 'w-0 overflow-hidden' : 'w-72'}`}>
        {/* Header */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">Meus talhões</h2>
              <span className="text-xs text-gray-500">Proprietário</span>
            </div>
            <button 
              onClick={() => setSidebarCollapsed(true)}
              className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Season */}
        <div className="px-4 py-3 border-b border-gray-100">
          <button className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900">
            <Calendar className="h-4 w-4 text-green-600" />
            <span>Safra 2025</span>
            <ChevronDown className="h-3 w-3 text-gray-400" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar talhão..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm bg-gray-50 border-gray-200"
            />
          </div>
        </div>

        {/* Stats */}
        <div className="px-4 py-2 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between text-xs">
          <span className="text-gray-500">{filteredFields.length} talhões</span>
          <span className="text-gray-700 font-medium">{totalArea.toFixed(1)} ha total</span>
        </div>

        {/* Fields List */}
        <div className="flex-1 overflow-y-auto">
          {fieldsLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="w-12 h-12 rounded-lg" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-28 mb-1.5" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-1">
              {filteredFields.map((field: any) => (
                <div
                  key={field.id}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-l-3 transition-colors ${
                    selectedFieldId === field.id 
                      ? "bg-green-50 border-l-green-500" 
                      : "border-l-transparent hover:bg-gray-50"
                  }`}
                  onClick={() => setSelectedFieldId(field.id)}
                >
                  <FieldThumbnail 
                    boundaries={field.boundaries} 
                    ndviValue={field.currentNdvi ? field.currentNdvi / 100 : 0.5} 
                    size={48} 
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{field.name}</p>
                    <p className="text-xs text-gray-500">{formatHectares(field.areaHectares)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span 
                      className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{ 
                        backgroundColor: getNdviColor(field.currentNdvi ? field.currentNdvi / 100 : 0.5) + '20',
                        color: getNdviColor(field.currentNdvi ? field.currentNdvi / 100 : 0.5)
                      }}
                    >
                      {field.currentNdvi ? (field.currentNdvi / 100).toFixed(2) : '0.50'}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFieldSelection(field.id);
                      }}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        selectedFields.has(field.id)
                          ? "bg-green-500 border-green-500 text-white"
                          : "border-gray-300 hover:border-green-400"
                      }`}
                    >
                      {selectedFields.has(field.id) && <Check className="h-3 w-3" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Button */}
        <div className="p-4 border-t border-gray-200">
          <Button 
            onClick={() => setLocation("/fields/new")}
            className="w-full bg-green-600 hover:bg-green-700 text-white gap-2"
          >
            <Plus className="h-4 w-4" />
            Adicionar talhão
          </Button>
        </div>
      </div>

      {/* Collapsed sidebar toggle */}
      {sidebarCollapsed && (
        <button
          onClick={() => setSidebarCollapsed(false)}
          className="absolute left-14 top-1/2 -translate-y-1/2 z-20 w-6 h-12 bg-white border border-gray-200 rounded-r-lg flex items-center justify-center text-gray-400 hover:text-gray-600 shadow-sm"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}

      {/* ===== MAIN CONTENT ===== */}
      {selectedFieldId && selectedField ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{selectedField.name}</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  {formatHectares(selectedField.areaHectares)}
                  {selectedField.crop && ` • ${selectedField.crop}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  Exportar
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-2"
                  onClick={() => setLocation(`/fields/${selectedFieldId}/edit`)}
                >
                  <Edit className="h-4 w-4" />
                  Editar
                </Button>
                <button 
                  onClick={() => setSelectedFieldId(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg text-gray-400"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 mt-4 border-b border-gray-100 -mb-4">
              {[
                { id: "status", label: "Status" },
                { id: "data", label: "Dados" },
                { id: "notes", label: "Notas" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? "text-green-600 border-green-500"
                      : "text-gray-500 border-transparent hover:text-gray-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === "status" && (
              <div className="space-y-6">
                {/* Weather + Quick Actions */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" className="gap-2">
                      <Leaf className="h-4 w-4 text-green-600" />
                      Adicionar cultura
                    </Button>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      Data de semeadura
                    </Button>
                  </div>
                  
                  {/* Weather Widget */}
                  <div className="flex items-center gap-6 bg-gradient-to-r from-blue-50 to-sky-50 px-5 py-3 rounded-xl">
                    <div className="flex items-center gap-2">
                      <Sun className="h-6 w-6 text-yellow-500" />
                      <span className="text-xl font-bold text-gray-900">
                        {weather?.current?.temperature != null 
                          ? `${Math.round(weather.current.temperature)}°` 
                          : '--°'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-600 text-sm">
                      <Droplets className="h-4 w-4 text-blue-500" />
                      <span>{weather?.current?.precipitation ?? 0} mm</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-600 text-sm">
                      <Wind className="h-4 w-4 text-gray-400" />
                      <span>{weather?.current?.windSpeed?.toFixed(0) ?? '--'} km/h</span>
                    </div>
                  </div>
                </div>

                {/* Maps Row */}
                <div className="grid grid-cols-2 gap-4">
                  {/* NDVI Map */}
                  <div className="bg-gray-900 rounded-2xl overflow-hidden shadow-lg">
                    <div className="px-4 py-3 flex items-center justify-between border-b border-gray-800">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-white">NDVI</span>
                        <span className="text-xs text-gray-400">
                          {format(new Date(), "dd/MMM/yyyy", { locale: ptBR })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button className="p-1.5 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white">
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button className="p-1.5 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white">
                          <ChevronRight className="h-4 w-4" />
                        </button>
                        <button className="p-1.5 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white ml-1">
                          <Maximize2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="relative h-72">
                      <MapboxMap
                        onMapReady={handleNdviMapReady}
                        className="w-full h-full"
                        initialCenter={fieldCenter}
                        initialZoom={15}
                        style="satellite"
                      />
                      {/* NDVI Scale */}
                      <div className="absolute left-4 top-1/2 -translate-y-1/2">
                        <NdviScale />
                      </div>
                    </div>
                  </div>

                  {/* Satellite Map */}
                  <div className="bg-gray-900 rounded-2xl overflow-hidden shadow-lg">
                    <div className="px-4 py-3 flex items-center justify-between border-b border-gray-800">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-white">Satélite</span>
                        <span className="text-xs text-gray-400">
                          {format(new Date(), "dd/MMM/yyyy", { locale: ptBR })}
                        </span>
                      </div>
                      <button className="p-1.5 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white">
                        <Maximize2 className="h-4 w-4" />
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

                {/* NDVI Chart Card */}
                <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-gray-900">Índice NDVI</h3>
                      <p className="text-xs text-gray-500 mt-0.5">Evolução ao longo do ano</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <Leaf className="h-5 w-5 text-green-500" />
                        <span className="text-3xl font-bold text-gray-900">{currentNdviValue}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">Última leitura</p>
                    </div>
                  </div>
                  <NdviYearChart 
                    data={ndviChartData} 
                    height={140}
                    currentNdvi={selectedField?.currentNdvi ? selectedField.currentNdvi / 100 : 0.65}
                  />
                </div>

                {/* Weather Charts */}
                {historicalWeather && (
                  <div className="grid grid-cols-2 gap-4">
                    {/* Precipitation */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-gray-900">Precipitação</h3>
                          <p className="text-xs text-gray-500 mt-0.5">Acumulada no período</p>
                        </div>
                        <div className="text-right">
                          <span className="text-2xl font-bold text-blue-600">
                            {historicalWeather.totalPrecipitation} mm
                          </span>
                        </div>
                      </div>
                      <PrecipitationChart 
                        dates={historicalWeather.dates || []} 
                        values={historicalWeather.accumulatedPrecipitation || []}
                        height={100}
                      />
                    </div>

                    {/* Thermal Sum */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-gray-900">Soma Térmica</h3>
                          <p className="text-xs text-gray-500 mt-0.5">Graus-dia (base 10°C)</p>
                        </div>
                        <div className="text-right">
                          <span className="text-2xl font-bold text-orange-600">
                            +{historicalWeather.totalThermalSum}°
                          </span>
                        </div>
                      </div>
                      <ThermalSumChart 
                        dates={historicalWeather.dates || []} 
                        values={historicalWeather.thermalSum || []}
                        height={100}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "data" && (
              <div className="space-y-6">
                <div className="bg-white rounded-2xl border border-gray-200 p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Informações do Talhão</h3>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-sm text-gray-500">Nome</p>
                      <p className="text-gray-900 font-medium">{selectedField.name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Área</p>
                      <p className="text-gray-900 font-medium">{formatHectares(selectedField.areaHectares)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Cultura</p>
                      <p className="text-gray-900 font-medium">{selectedField.crop || "Não definida"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">NDVI Atual</p>
                      <p className="text-gray-900 font-medium">{currentNdviValue}</p>
                    </div>
                  </div>
                </div>

                {/* NDVI History Table */}
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-900">Histórico NDVI</h3>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {ndviChartData.slice(0, 10).map((item, index) => (
                      <div key={index} className="px-6 py-3 flex items-center justify-between">
                        <span className="text-sm text-gray-600">
                          {format(item.date, "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                        <span 
                          className="text-sm font-medium px-3 py-1 rounded-full"
                          style={{ 
                            backgroundColor: getNdviColor(item.ndvi) + '20',
                            color: getNdviColor(item.ndvi)
                          }}
                        >
                          {item.ndvi.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "notes" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">Notas de campo</h3>
                  <Button 
                    size="sm" 
                    className="gap-2 bg-green-600 hover:bg-green-700"
                    onClick={() => setLocation(`/notes?fieldId=${selectedFieldId}`)}
                  >
                    <Plus className="h-4 w-4" />
                    Nova nota
                  </Button>
                </div>

                {notes?.length ? (
                  <div className="space-y-3">
                    {notes.map((note: any) => (
                      <div key={note.id} className="bg-white rounded-xl border border-gray-200 p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm text-gray-900">{note.content}</p>
                            <p className="text-xs text-gray-400 mt-2">
                              {format(new Date(note.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </p>
                          </div>
                          {note.type && (
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                              {note.type}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-gray-50 rounded-xl">
                    <StickyNote className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">Nenhuma nota registrada</p>
                    <p className="text-sm text-gray-400 mt-1">Adicione observações sobre este talhão</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-gray-100">
          <div className="text-center">
            <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <Map className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">Selecione um talhão</h3>
            <p className="text-gray-500 text-sm">Escolha um talhão na lista para ver os detalhes</p>
          </div>
        </div>
      )}
    </div>
  );
}
