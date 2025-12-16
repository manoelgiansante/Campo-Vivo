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
  height = 180,
  currentNdvi
}: { 
  data: { date: Date; ndvi: number }[]; 
  height?: number;
  currentNdvi?: number;
}) {
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; ndvi: number; date: Date; index: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  
  const chartData = useMemo(() => {
    if (data.length > 0) return data;
    // Dados simulados se não houver histórico real
    const now = new Date();
    return months.map((_, i) => {
      const date = new Date(now.getFullYear(), i, 15);
      const baseNdvi = 0.45 + Math.sin((i + 3) * 0.5) * 0.25;
      return { date, ndvi: Math.max(0.2, Math.min(0.9, baseNdvi + (Math.random() - 0.5) * 0.08)) };
    });
  }, [data]);

  const width = 600;
  const padding = { top: 25, right: 25, bottom: 45, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const xScale = useCallback((i: number) => padding.left + (i / Math.max(chartData.length - 1, 1)) * chartWidth, [chartData.length, chartWidth]);
  const yScale = useCallback((v: number) => padding.top + chartHeight - (v * chartHeight), [chartHeight]);

  const points = useMemo(() => chartData.map((d, i) => ({ 
    x: xScale(i), 
    y: yScale(d.ndvi),
    ndvi: d.ndvi,
    date: d.date,
    index: i
  })), [chartData, xScale, yScale]);

  // Criar path suave com curvas bezier (Catmull-Rom)
  const createSmoothPath = useCallback((pts: typeof points) => {
    if (pts.length < 2) return `M ${pts[0].x} ${pts[0].y}`;
    
    let path = `M ${pts[0].x} ${pts[0].y}`;
    
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      
      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    
    return path;
  }, []);

  const linePath = createSmoothPath(points);
  const areaPath = linePath + ` L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${points[0].x} ${padding.top + chartHeight} Z`;

  // Mouse tracking
  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * width;
    
    let closestPoint = points[0];
    let minDist = Math.abs(x - points[0].x);
    
    for (const point of points) {
      const dist = Math.abs(x - point.x);
      if (dist < minDist) {
        minDist = dist;
        closestPoint = point;
      }
    }
    
    if (minDist < 40) {
      setHoveredPoint(closestPoint);
    } else {
      setHoveredPoint(null);
    }
  }, [points, width]);

  const handleMouseLeave = useCallback(() => {
    setHoveredPoint(null);
  }, []);

  // Y-axis ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1];
  
  // Cor baseada no NDVI
  const getNdviGradientColors = (ndvi: number) => {
    if (ndvi >= 0.7) return { main: "#16a34a", light: "#4ade80", bg: "rgba(22, 163, 74, 0.15)" };
    if (ndvi >= 0.5) return { main: "#65a30d", light: "#a3e635", bg: "rgba(101, 163, 13, 0.15)" };
    if (ndvi >= 0.3) return { main: "#ca8a04", light: "#facc15", bg: "rgba(202, 138, 4, 0.15)" };
    return { main: "#dc2626", light: "#f87171", bg: "rgba(220, 38, 38, 0.15)" };
  };

  const avgNdvi = chartData.reduce((sum, d) => sum + d.ndvi, 0) / chartData.length;
  const colors = getNdviGradientColors(avgNdvi);

  const lastPoint = points[points.length - 1];

  return (
    <div className="relative">
      <svg 
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`} 
        className="w-full h-auto cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <defs>
          {/* Gradiente de área principal */}
          <linearGradient id="ndvi-area-gradient-pro" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={colors.main} stopOpacity="0.35" />
            <stop offset="50%" stopColor={colors.main} stopOpacity="0.12" />
            <stop offset="100%" stopColor={colors.main} stopOpacity="0.02" />
          </linearGradient>
          
          {/* Gradiente da linha */}
          <linearGradient id="ndvi-line-gradient-pro" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={colors.light} />
            <stop offset="50%" stopColor={colors.main} />
            <stop offset="100%" stopColor={colors.main} />
          </linearGradient>

          {/* Glow effect */}
          <filter id="glow-ndvi" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>

          {/* Shadow para pontos */}
          <filter id="point-shadow-ndvi" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor={colors.main} floodOpacity="0.4"/>
          </filter>
        </defs>

        {/* Background com gradiente sutil */}
        <rect 
          x={padding.left} 
          y={padding.top} 
          width={chartWidth} 
          height={chartHeight} 
          fill="#fafbfc"
          rx="8"
        />

        {/* Grid horizontal */}
        {yTicks.map(v => (
          <g key={v}>
            <line
              x1={padding.left}
              y1={yScale(v)}
              x2={width - padding.right}
              y2={yScale(v)}
              stroke={v === 0.5 ? "#d1d5db" : "#e5e7eb"}
              strokeWidth={v === 0.5 ? "1.5" : "1"}
              strokeDasharray={v === 0.5 ? "" : "4 4"}
            />
            <text 
              x={padding.left - 12} 
              y={yScale(v)} 
              fontSize="11" 
              fill="#6b7280" 
              textAnchor="end" 
              dominantBaseline="middle"
              fontWeight="500"
            >
              {v.toFixed(2)}
            </text>
          </g>
        ))}

        {/* Referência "Bom" e "Ruim" */}
        <text x={width - padding.right + 5} y={yScale(0.75)} fontSize="9" fill="#16a34a" dominantBaseline="middle" fontWeight="600">Bom</text>
        <text x={width - padding.right + 5} y={yScale(0.25)} fontSize="9" fill="#dc2626" dominantBaseline="middle" fontWeight="600">Baixo</text>

        {/* Linha de hover vertical */}
        {hoveredPoint && (
          <line
            x1={hoveredPoint.x}
            y1={padding.top}
            x2={hoveredPoint.x}
            y2={padding.top + chartHeight}
            stroke={colors.main}
            strokeWidth="1.5"
            strokeDasharray="6 4"
            opacity="0.6"
          />
        )}

        {/* Área preenchida */}
        <path d={areaPath} fill="url(#ndvi-area-gradient-pro)" />

        {/* Linha principal com glow */}
        <path 
          d={linePath} 
          fill="none" 
          stroke={colors.main}
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.15"
        />
        <path 
          d={linePath} 
          fill="none" 
          stroke="url(#ndvi-line-gradient-pro)" 
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Pontos de dados */}
        {points.map((point, i) => (
          <g key={i}>
            <circle
              cx={point.x}
              cy={point.y}
              r={hoveredPoint?.index === i ? 0 : 4}
              fill="white"
              stroke={colors.main}
              strokeWidth="2"
              opacity={hoveredPoint?.index === i ? 0 : 0.9}
              className="transition-all duration-150"
            />
          </g>
        ))}

        {/* Ponto destacado no hover */}
        {hoveredPoint && (
          <g filter="url(#point-shadow-ndvi)">
            <circle
              cx={hoveredPoint.x}
              cy={hoveredPoint.y}
              r="10"
              fill="white"
              stroke={colors.main}
              strokeWidth="3"
            />
            <circle
              cx={hoveredPoint.x}
              cy={hoveredPoint.y}
              r="5"
              fill={colors.main}
            />
          </g>
        )}

        {/* Ponto atual destacado */}
        {!hoveredPoint && (
          <g filter="url(#point-shadow-ndvi)">
            <circle
              cx={lastPoint.x}
              cy={lastPoint.y}
              r="8"
              fill="white"
              stroke={colors.main}
              strokeWidth="3"
            />
            <circle
              cx={lastPoint.x}
              cy={lastPoint.y}
              r="4"
              fill={colors.main}
            />
          </g>
        )}

        {/* Labels do eixo X */}
        {months.map((m, i) => (
          <text
            key={m}
            x={padding.left + (i / 11) * chartWidth}
            y={height - 12}
            fontSize="11"
            fill="#6b7280"
            textAnchor="middle"
            fontWeight="500"
          >
            {m}
          </text>
        ))}

        {/* Título do eixo Y */}
        <text
          x={12}
          y={height / 2}
          fontSize="10"
          fill="#9ca3af"
          textAnchor="middle"
          transform={`rotate(-90, 12, ${height / 2})`}
        >
          Índice NDVI
        </text>
      </svg>

      {/* Tooltip flutuante */}
      {hoveredPoint && (
        <div 
          className="absolute pointer-events-none z-20 transform -translate-x-1/2"
          style={{ 
            left: `${(hoveredPoint.x / width) * 100}%`,
            top: `${((hoveredPoint.y - 15) / height) * 100}%`,
            transform: 'translate(-50%, -100%)'
          }}
        >
          <div className="bg-gray-900 text-white px-4 py-2.5 rounded-xl shadow-2xl text-sm whitespace-nowrap backdrop-blur-sm border border-gray-700">
            <div className="flex items-center gap-2 mb-1">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: colors.main }}
              />
              <span className="font-bold text-lg">{hoveredPoint.ndvi.toFixed(2)}</span>
              <span className="text-gray-400 text-xs">NDVI</span>
            </div>
            <div className="text-gray-400 text-xs">
              {format(new Date(hoveredPoint.date), "dd 'de' MMMM, yyyy", { locale: ptBR })}
            </div>
          </div>
          <div className="w-0 h-0 mx-auto border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px] border-t-gray-900" />
        </div>
      )}

      {/* Legenda de status */}
      <div className="flex items-center justify-center gap-6 mt-3 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-gray-600">Excelente (≥0.7)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-lime-500" />
          <span className="text-gray-600">Bom (0.5-0.7)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <span className="text-gray-600">Moderado (0.3-0.5)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-gray-600">Baixo (&lt;0.3)</span>
        </div>
      </div>
    </div>
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
    selectedFieldId ? `/api/copernicus-ndvi/${selectedFieldId}?palette=onesoil` : null
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
