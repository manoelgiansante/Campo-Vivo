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
  Crown,
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

// Gráfico NDVI profissional - SÓ DADOS REAIS (sem simulação)
function NdviYearChart({ 
  data, 
  height = 200,
  currentNdvi
}: { 
  data: { date: Date; ndvi: number }[]; 
  height?: number;
  currentNdvi?: number;
}) {
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; ndvi: number; date: Date; index: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  
  // SÓ usa dados reais - se não tiver, mostra mensagem
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    // Ordena por data
    return [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [data]);

  // Se não há dados reais, mostra mensagem
  if (chartData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 bg-slate-50 rounded-xl border border-dashed border-slate-200">
        <Leaf className="h-8 w-8 text-slate-300 mb-2" />
        <p className="text-sm text-slate-500 font-medium">Sem dados de NDVI</p>
        <p className="text-xs text-slate-400">Aguardando imagens de satélite</p>
      </div>
    );
  }

  const width = 600;
  const padding = { top: 30, right: 30, bottom: 50, left: 55 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Escala Y de 0 a 1
  const xScale = (i: number) => padding.left + (i / Math.max(chartData.length - 1, 1)) * chartWidth;
  const yScale = (v: number) => padding.top + chartHeight - (v * chartHeight);

  const points = chartData.map((d, i) => ({ 
    x: xScale(i), 
    y: yScale(d.ndvi),
    ndvi: d.ndvi,
    date: d.date,
    index: i
  }));

  // Criar path suave com curvas bezier
  const createSmoothPath = (pts: typeof points) => {
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
  };

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

  // Gerar labels de eixo X baseado nos dados reais
  const xLabels = useMemo(() => {
    if (chartData.length <= 6) {
      return chartData.map((d, i) => ({
        x: xScale(i),
        label: format(new Date(d.date), "dd/MM", { locale: ptBR })
      }));
    }
    // Se muitos pontos, mostrar apenas alguns
    const step = Math.ceil(chartData.length / 6);
    return chartData
      .filter((_, i) => i % step === 0 || i === chartData.length - 1)
      .map((d, idx, arr) => {
        const originalIndex = chartData.findIndex(cd => cd === d);
        return {
          x: xScale(originalIndex),
          label: format(new Date(d.date), "dd/MM", { locale: ptBR })
        };
      });
  }, [chartData, xScale]);

  // Y-axis ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1];

  // Cor do NDVI baseada no valor
  const getNdviGradientColor = (ndvi: number) => {
    if (ndvi >= 0.7) return { main: "#22c55e", light: "#86efac" };
    if (ndvi >= 0.5) return { main: "#84cc16", light: "#bef264" };
    if (ndvi >= 0.3) return { main: "#eab308", light: "#fde047" };
    return { main: "#ef4444", light: "#fca5a5" };
  };

  const lastNdvi = chartData[chartData.length - 1]?.ndvi || 0.5;
  const colors = getNdviGradientColor(lastNdvi);

  return (
    <div className="relative bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
      <svg 
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`} 
        className="w-full h-auto cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredPoint(null)}
      >
        <defs>
          {/* Gradiente de área */}
          <linearGradient id="ndvi-area-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={colors.main} stopOpacity="0.35" />
            <stop offset="50%" stopColor={colors.main} stopOpacity="0.1" />
            <stop offset="100%" stopColor={colors.main} stopOpacity="0" />
          </linearGradient>
          
          {/* Gradiente de linha */}
          <linearGradient id="ndvi-line-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={colors.light} />
            <stop offset="50%" stopColor={colors.main} />
            <stop offset="100%" stopColor={colors.main} />
          </linearGradient>

          {/* Sombra */}
          <filter id="point-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor={colors.main} floodOpacity="0.3"/>
          </filter>
        </defs>

        {/* Fundo com grid */}
        <rect x={padding.left} y={padding.top} width={chartWidth} height={chartHeight} fill="#f8fafc" rx="8"/>

        {/* Grid horizontal */}
        {yTicks.map(v => (
          <g key={v}>
            <line
              x1={padding.left}
              y1={yScale(v)}
              x2={width - padding.right}
              y2={yScale(v)}
              stroke={v === 0.5 ? "#cbd5e1" : "#e2e8f0"}
              strokeWidth={v === 0.5 ? "1" : "0.5"}
              strokeDasharray={v === 0.5 ? "" : "4 4"}
            />
            <text 
              x={padding.left - 12} 
              y={yScale(v)} 
              fontSize="12" 
              fill="#64748b" 
              textAnchor="end" 
              dominantBaseline="middle"
              fontWeight="500"
            >
              {v.toFixed(2)}
            </text>
          </g>
        ))}

        {/* Linha vertical no hover */}
        {hoveredPoint && (
          <line
            x1={hoveredPoint.x}
            y1={padding.top}
            x2={hoveredPoint.x}
            y2={padding.top + chartHeight}
            stroke={colors.main}
            strokeWidth="1.5"
            strokeDasharray="6 4"
            opacity="0.7"
          />
        )}

        {/* Área preenchida */}
        <path d={areaPath} fill="url(#ndvi-area-grad)" />

        {/* Linha principal com glow */}
        <path 
          d={linePath} 
          fill="none" 
          stroke={colors.main}
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.15"
        />
        <path 
          d={linePath} 
          fill="none" 
          stroke="url(#ndvi-line-grad)" 
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Pontos de dados */}
        {points.map((point, i) => (
          <circle
            key={i}
            cx={point.x}
            cy={point.y}
            r={hoveredPoint?.index === i ? 0 : 5}
            fill="white"
            stroke={colors.main}
            strokeWidth="2.5"
            opacity={hoveredPoint?.index === i ? 0 : 1}
          />
        ))}

        {/* Ponto destacado no hover */}
        {hoveredPoint && (
          <g filter="url(#point-shadow)">
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

        {/* Labels do eixo X */}
        {xLabels.map((label, i) => (
          <text
            key={i}
            x={label.x}
            y={height - 15}
            fontSize="11"
            fill="#64748b"
            textAnchor="middle"
            fontWeight="500"
          >
            {label.label}
          </text>
        ))}

        {/* Título do eixo Y */}
        <text
          x={15}
          y={height / 2}
          fontSize="11"
          fill="#94a3b8"
          textAnchor="middle"
          transform={`rotate(-90, 15, ${height / 2})`}
        >
          NDVI
        </text>
      </svg>

      {/* Tooltip flutuante */}
      {hoveredPoint && (
        <div 
          className="absolute pointer-events-none z-20"
          style={{ 
            left: `${(hoveredPoint.x / width) * 100}%`,
            top: `${((hoveredPoint.y - 20) / height) * 100}%`,
            transform: 'translate(-50%, -100%)'
          }}
        >
          <div className="bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl text-sm whitespace-nowrap backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-1">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: colors.main }}
              />
              <span className="font-bold text-lg">{hoveredPoint.ndvi.toFixed(2)}</span>
            </div>
            <div className="text-slate-400 text-xs">
              {format(new Date(hoveredPoint.date), "dd 'de' MMMM, yyyy", { locale: ptBR })}
            </div>
          </div>
          <div 
            className="w-0 h-0 mx-auto border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[8px]" 
            style={{ borderTopColor: '#0f172a' }}
          />
        </div>
      )}
    </div>
  );
}

// Gráfico de precipitação acumulada PROFISSIONAL com tooltip
function PrecipitationChart({ 
  dates, 
  values,
  height = 120 
}: { 
  dates: string[]; 
  values: number[];
  height?: number;
}) {
  const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; value: number; date: string; index: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  
  const maxValue = Math.max(...values, 200);

  const width = 500;
  const padding = { top: 20, right: 20, bottom: 30, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Agrupar por mês
  const chartData = useMemo(() => {
    return months.map((_, monthIndex) => {
      const monthValues = values.filter((_, i) => {
        if (!dates[i]) return false;
        const date = new Date(dates[i]);
        return date.getMonth() === monthIndex;
      });
      return {
        value: monthValues.length > 0 ? monthValues[monthValues.length - 1] : 0,
        date: `${months[monthIndex]}/2025`
      };
    });
  }, [dates, values]);

  const xScale = (i: number) => padding.left + (i / Math.max(chartData.length - 1, 1)) * chartWidth;
  const yScale = (v: number) => padding.top + chartHeight - ((v / maxValue) * chartHeight);

  const points = chartData.map((d, i) => ({ 
    x: xScale(i), 
    y: yScale(d.value),
    value: d.value,
    date: d.date,
    index: i
  }));

  // Smooth curve
  const createSmoothPath = (pts: typeof points) => {
    if (pts.length < 2) return '';
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
  };

  const linePath = createSmoothPath(points);
  const areaPath = linePath + ` L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${points[0].x} ${padding.top + chartHeight} Z`;

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * width;
    let closestPoint = points[0];
    let minDist = Math.abs(x - points[0].x);
    for (const point of points) {
      const dist = Math.abs(x - point.x);
      if (dist < minDist) { minDist = dist; closestPoint = point; }
    }
    if (minDist < 30) setHoveredPoint(closestPoint);
    else setHoveredPoint(null);
  }, [points, width]);

  const yTicks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="relative">
      <svg 
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`} 
        className="w-full h-auto cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredPoint(null)}
      >
        <defs>
          <linearGradient id="precip-gradient-pro" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.4" />
            <stop offset="50%" stopColor="#3b82f6" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="precip-line-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#93c5fd" />
            <stop offset="50%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
        </defs>

        <rect x={padding.left} y={padding.top} width={chartWidth} height={chartHeight} fill="#fafafa" rx="4"/>

        {yTicks.map(v => (
          <g key={v}>
            <line x1={padding.left} y1={yScale(v * maxValue)} x2={width - padding.right} y2={yScale(v * maxValue)} 
              stroke={v === 0.5 ? "#e5e7eb" : "#f3f4f6"} strokeWidth="1" strokeDasharray={v === 0.5 ? "none" : "4 2"}/>
            <text x={padding.left - 8} y={yScale(v * maxValue)} fontSize="10" fill="#6b7280" textAnchor="end" dominantBaseline="middle">
              {Math.round(v * maxValue)}
            </text>
          </g>
        ))}

        {hoveredPoint && (
          <line x1={hoveredPoint.x} y1={padding.top} x2={hoveredPoint.x} y2={padding.top + chartHeight}
            stroke="#3b82f6" strokeWidth="1" strokeDasharray="4 2" opacity="0.6"/>
        )}

        <path d={areaPath} fill="url(#precip-gradient-pro)" />
        <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth="4" strokeLinecap="round" opacity="0.2"/>
        <path d={linePath} fill="none" stroke="url(#precip-line-gradient)" strokeWidth="2.5" strokeLinecap="round"/>

        {points.map((point, i) => (
          <circle key={i} cx={point.x} cy={point.y} r={hoveredPoint?.index === i ? 0 : 2.5}
            fill="#3b82f6" stroke="white" strokeWidth="1.5" opacity={hoveredPoint?.index === i ? 0 : 0.8}/>
        ))}

        {hoveredPoint && (
          <g>
            <circle cx={hoveredPoint.x} cy={hoveredPoint.y} r="7" fill="white" stroke="#3b82f6" strokeWidth="2.5"/>
            <circle cx={hoveredPoint.x} cy={hoveredPoint.y} r="3" fill="#3b82f6"/>
          </g>
        )}

        {months.map((m, i) => (
          <text key={m} x={padding.left + (i / 11) * chartWidth} y={height - 8} fontSize="10" fill="#6b7280" textAnchor="middle">{m}</text>
        ))}
      </svg>

      {hoveredPoint && (
        <div className="absolute pointer-events-none z-10" style={{ 
          left: `${(hoveredPoint.x / width) * 100}%`, top: `${((hoveredPoint.y - 15) / height) * 100}%`,
          transform: 'translate(-50%, -100%)'
        }}>
          <div className="bg-gray-800 text-white px-3 py-2 rounded-lg shadow-lg text-sm whitespace-nowrap">
            <div className="font-bold text-blue-400">{Math.round(hoveredPoint.value)} mm</div>
            <div className="text-gray-300 text-xs">{hoveredPoint.date}</div>
          </div>
          <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-gray-800 mx-auto" />
        </div>
      )}
    </div>
  );
}

// Gráfico de soma térmica PROFISSIONAL com tooltip
function ThermalSumChart({ 
  dates, 
  values,
  height = 120 
}: { 
  dates: string[]; 
  values: number[];
  height?: number;
}) {
  const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; value: number; date: string; index: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  
  const maxValue = Math.max(...values, 2000);

  const width = 500;
  const padding = { top: 20, right: 20, bottom: 30, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Agrupar por mês ou usar dados diretamente
  const chartData = useMemo(() => {
    if (values.length <= 12) {
      return months.map((_, monthIndex) => {
        const monthValues = values.filter((_, i) => {
          if (!dates[i]) return false;
          const date = new Date(dates[i]);
          return date.getMonth() === monthIndex;
        });
        return {
          value: monthValues.length > 0 ? monthValues[monthValues.length - 1] : 0,
          date: `${months[monthIndex]}/2025`
        };
      });
    }
    // Amostrar dados se houver muitos
    const step = Math.ceil(values.length / 12);
    return values.filter((_, i) => i % step === 0).map((v, i) => ({
      value: v,
      date: dates[i * step] || ''
    }));
  }, [dates, values]);

  const xScale = (i: number) => padding.left + (i / Math.max(chartData.length - 1, 1)) * chartWidth;
  const yScale = (v: number) => padding.top + chartHeight - ((v / maxValue) * chartHeight);

  const points = chartData.map((d, i) => ({ 
    x: xScale(i), 
    y: yScale(d.value),
    value: d.value,
    date: d.date,
    index: i
  }));

  // Smooth curve
  const createSmoothPath = (pts: typeof points) => {
    if (pts.length < 2) return '';
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
  };

  const linePath = createSmoothPath(points);
  const areaPath = linePath + ` L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${points[0].x} ${padding.top + chartHeight} Z`;

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * width;
    let closestPoint = points[0];
    let minDist = Math.abs(x - points[0].x);
    for (const point of points) {
      const dist = Math.abs(x - point.x);
      if (dist < minDist) { minDist = dist; closestPoint = point; }
    }
    if (minDist < 30) setHoveredPoint(closestPoint);
    else setHoveredPoint(null);
  }, [points, width]);

  const yTicks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="relative">
      <svg 
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`} 
        className="w-full h-auto cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredPoint(null)}
      >
        <defs>
          <linearGradient id="thermal-gradient-pro" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fb923c" stopOpacity="0.4" />
            <stop offset="50%" stopColor="#f97316" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="thermal-line-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#fdba74" />
            <stop offset="50%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#ea580c" />
          </linearGradient>
        </defs>

        <rect x={padding.left} y={padding.top} width={chartWidth} height={chartHeight} fill="#fafafa" rx="4"/>

        {yTicks.map(v => (
          <g key={v}>
            <line x1={padding.left} y1={yScale(v * maxValue)} x2={width - padding.right} y2={yScale(v * maxValue)} 
              stroke={v === 0.5 ? "#e5e7eb" : "#f3f4f6"} strokeWidth="1" strokeDasharray={v === 0.5 ? "none" : "4 2"}/>
            <text x={padding.left - 8} y={yScale(v * maxValue)} fontSize="10" fill="#6b7280" textAnchor="end" dominantBaseline="middle">
              {Math.round(v * maxValue)}
            </text>
          </g>
        ))}

        {hoveredPoint && (
          <line x1={hoveredPoint.x} y1={padding.top} x2={hoveredPoint.x} y2={padding.top + chartHeight}
            stroke="#f97316" strokeWidth="1" strokeDasharray="4 2" opacity="0.6"/>
        )}

        <path d={areaPath} fill="url(#thermal-gradient-pro)" />
        <path d={linePath} fill="none" stroke="#f97316" strokeWidth="4" strokeLinecap="round" opacity="0.2"/>
        <path d={linePath} fill="none" stroke="url(#thermal-line-gradient)" strokeWidth="2.5" strokeLinecap="round"/>

        {points.map((point, i) => (
          <circle key={i} cx={point.x} cy={point.y} r={hoveredPoint?.index === i ? 0 : 2.5}
            fill="#f97316" stroke="white" strokeWidth="1.5" opacity={hoveredPoint?.index === i ? 0 : 0.8}/>
        ))}

        {hoveredPoint && (
          <g>
            <circle cx={hoveredPoint.x} cy={hoveredPoint.y} r="7" fill="white" stroke="#f97316" strokeWidth="2.5"/>
            <circle cx={hoveredPoint.x} cy={hoveredPoint.y} r="3" fill="#f97316"/>
          </g>
        )}

        {months.map((m, i) => (
          <text key={m} x={padding.left + (i / 11) * chartWidth} y={height - 8} fontSize="10" fill="#6b7280" textAnchor="middle">{m}</text>
        ))}
      </svg>

      {hoveredPoint && (
        <div className="absolute pointer-events-none z-10" style={{ 
          left: `${(hoveredPoint.x / width) * 100}%`, top: `${((hoveredPoint.y - 15) / height) * 100}%`,
          transform: 'translate(-50%, -100%)'
        }}>
          <div className="bg-gray-800 text-white px-3 py-2 rounded-lg shadow-lg text-sm whitespace-nowrap">
            <div className="font-bold text-orange-400">+{Math.round(hoveredPoint.value)}°</div>
            <div className="text-gray-300 text-xs">{hoveredPoint.date}</div>
          </div>
          <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-gray-800 mx-auto" />
        </div>
      )}
    </div>
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
  const [searchQuery, setSearchQuery] = useState("");
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
    { 
      fieldId: selectedFieldId!, 
      startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0]
    },
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

  // SÓ DADOS REAIS - sem simulação
  const ndviChartData = useMemo(() => {
    if (!ndviHistory?.length) return [];
    return ndviHistory.map((n: any) => ({
      date: new Date(n.captureDate || n.date),
      ndvi: n.ndviAverage ? n.ndviAverage / 100 : (n.ndvi || 0.5)
    }));
  }, [ndviHistory]);

  const currentNdviValue = selectedField?.currentNdvi 
    ? (selectedField.currentNdvi / 100).toFixed(2) 
    : "--";

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

  // Estado da navegação de abas no estilo mobile
  const [activeNavTab, setActiveNavTab] = useState<"fields" | "map" | "charts" | "notes" | "settings">("fields");

  return (
    <div className="h-screen flex flex-col bg-[#fafafa] overflow-hidden">
      {/* ===== HEADER TOP BAR ===== */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shrink-0 safe-area-top">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-green-400 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
            <Leaf className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Campo Vivo</h1>
            <p className="text-xs text-gray-500">Safra 2025</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center text-amber-900 hover:from-amber-300 hover:to-yellow-400 transition-all shadow-lg shadow-amber-500/20"
            onClick={() => setLocation("/safra")}
          >
            <Crown className="h-4 w-4" />
          </button>
          <button className="w-10 h-10 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-500">
            <Bell className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* ===== MAIN CONTENT AREA ===== */}
      <div className="flex-1 overflow-hidden">
        {activeNavTab === "fields" && (
          <div className="h-full flex flex-col">
            {/* Se não tiver campo selecionado, mostra lista de campos */}
            {!selectedFieldId ? (
              <div className="h-full bg-white flex flex-col">
                {/* Search */}
                <div className="p-4 border-b border-gray-100">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Buscar talhão..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-10 text-sm bg-gray-50 border-gray-200 rounded-xl"
                    />
                  </div>
                </div>

                {/* Stats */}
                <div className="px-4 py-2 bg-gradient-to-r from-green-50 to-emerald-50 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-sm text-gray-600">{filteredFields.length} talhões</span>
                  <span className="text-sm text-green-700 font-semibold">{totalArea.toFixed(1)} ha</span>
                </div>

                {/* Fields List - Full Width */}
                <div className="flex-1 overflow-y-auto">
                  {fieldsLoading ? (
                    <div className="p-4 space-y-3">
                      {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                          <Skeleton className="w-14 h-14 rounded-xl" />
                          <div className="flex-1">
                            <Skeleton className="h-4 w-28 mb-2" />
                            <Skeleton className="h-3 w-20" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 space-y-2">
                      {filteredFields.map((field: any) => (
                        <div
                          key={field.id}
                          className="flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-all bg-white border border-gray-100 hover:border-green-300 hover:shadow-md active:scale-[0.99]"
                          onClick={() => setSelectedFieldId(field.id)}
                        >
                          <FieldThumbnail 
                            boundaries={field.boundaries} 
                            ndviValue={field.currentNdvi ? field.currentNdvi / 100 : 0.5} 
                            size={56} 
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">{field.name}</p>
                            <p className="text-sm text-gray-500">{formatHectares(field.areaHectares)}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span 
                              className="text-sm font-bold px-2.5 py-1 rounded-lg"
                              style={{ 
                                backgroundColor: getNdviColor(field.currentNdvi ? field.currentNdvi / 100 : 0.5) + '20',
                                color: getNdviColor(field.currentNdvi ? field.currentNdvi / 100 : 0.5)
                              }}
                            >
                              {field.currentNdvi ? (field.currentNdvi / 100).toFixed(2) : '--'}
                            </span>
                            <span className="text-[10px] text-gray-400">NDVI</span>
                          </div>
                          <ChevronRight className="h-5 w-5 text-gray-300" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Add Button */}
                <div className="p-4 border-t border-gray-100">
                  <Button 
                    onClick={() => setLocation("/fields/new")}
                    className="w-full bg-green-600 hover:bg-green-700 text-white gap-2 h-12 rounded-xl text-base font-medium"
                  >
                    <Plus className="h-5 w-5" />
                    Novo talhão
                  </Button>
                </div>
              </div>
            ) : (
              /* Campo selecionado - mostra detalhes em tela cheia */
              <div className="h-full flex flex-col overflow-hidden bg-gray-50">
                {/* Header com botão voltar */}
                <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
                  <button 
                    onClick={() => setSelectedFieldId(null)}
                    className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <div className="flex-1">
                    <h2 className="font-semibold text-gray-900">{selectedField?.name}</h2>
                    <p className="text-xs text-gray-500">{formatHectares(selectedField?.areaHectares)}</p>
                  </div>
                  <button 
                    onClick={() => setLocation(`/fields/${selectedFieldId}/edit`)}
                    className="w-10 h-10 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-500"
                  >
                    <Edit className="h-5 w-5" />
                  </button>
                  <button 
                    className="w-10 h-10 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-500"
                  >
                    <Download className="h-5 w-5" />
                  </button>
                </div>

                {/* Tabs */}
                <div className="bg-white border-b border-gray-200 px-4">
                  <div className="flex gap-1">
                    {[
                      { id: "status", label: "Visão Geral", icon: Home },
                      { id: "data", label: "Dados", icon: BarChart3 },
                      { id: "notes", label: "Notas", icon: FileText },
                    ].map((tab) => {
                      const Icon = tab.icon;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id as any)}
                          className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                            activeTab === tab.id
                              ? "text-green-600 border-green-500"
                              : "text-gray-500 border-transparent hover:text-gray-700"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4">
                  {activeTab === "status" && selectedField && (
                    <div className="space-y-4">
                      {/* Weather Card */}
                      <div className="bg-gradient-to-br from-blue-500 to-sky-600 rounded-2xl p-5 text-white shadow-lg">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <p className="text-white/80 text-sm">Clima Atual</p>
                            <p className="text-3xl font-bold">
                              {weather?.current?.temperature != null 
                                ? `${Math.round(weather.current.temperature)}°C` 
                                : '--°C'}
                            </p>
                          </div>
                          <Sun className="h-12 w-12 text-yellow-300" />
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="bg-white/20 rounded-xl p-3 text-center">
                            <Droplets className="h-5 w-5 mx-auto mb-1 text-blue-200" />
                            <p className="text-lg font-semibold">{weather?.current?.precipitation ?? 0} mm</p>
                            <p className="text-xs text-white/70">Chuva</p>
                          </div>
                          <div className="bg-white/20 rounded-xl p-3 text-center">
                            <Wind className="h-5 w-5 mx-auto mb-1 text-blue-200" />
                            <p className="text-lg font-semibold">{weather?.current?.windSpeed?.toFixed(0) ?? '--'}</p>
                            <p className="text-xs text-white/70">km/h</p>
                          </div>
                          <div className="bg-white/20 rounded-xl p-3 text-center">
                            <Cloud className="h-5 w-5 mx-auto mb-1 text-blue-200" />
                            <p className="text-lg font-semibold">{weather?.current?.humidity ?? '--'}%</p>
                            <p className="text-xs text-white/70">Umidade</p>
                          </div>
                        </div>
                      </div>

                      {/* NDVI Card */}
                      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                              <Leaf className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900">Índice NDVI</h3>
                              <p className="text-xs text-gray-500">Saúde da vegetação</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-green-600">{currentNdviValue}</p>
                            <p className="text-xs text-gray-400">Atual</p>
                          </div>
                        </div>
                        <div className="p-4">
                          <NdviYearChart 
                            data={ndviChartData} 
                            height={160}
                            currentNdvi={selectedField?.currentNdvi ? selectedField.currentNdvi / 100 : undefined}
                          />
                        </div>
                      </div>

                      {/* Maps Grid */}
                      <div className="grid grid-cols-1 gap-4">
                        {/* NDVI Map */}
                        <div className="bg-gray-900 rounded-2xl overflow-hidden shadow-lg">
                          <div className="px-4 py-3 flex items-center justify-between border-b border-gray-800">
                            <div className="flex items-center gap-2">
                              <Leaf className="h-4 w-4 text-green-400" />
                              <span className="text-sm font-medium text-white">Mapa NDVI</span>
                            </div>
                            <span className="text-xs text-gray-400">
                              {format(new Date(), "dd/MMM", { locale: ptBR })}
                            </span>
                          </div>
                          <div className="relative h-56">
                            <MapboxMap
                              onMapReady={handleNdviMapReady}
                              className="w-full h-full"
                              initialCenter={fieldCenter}
                              initialZoom={15}
                              style="satellite"
                            />
                            <div className="absolute left-3 top-1/2 -translate-y-1/2">
                              <NdviScale />
                            </div>
                          </div>
                        </div>

                        {/* Satellite Map */}
                        <div className="bg-gray-900 rounded-2xl overflow-hidden shadow-lg">
                          <div className="px-4 py-3 flex items-center justify-between border-b border-gray-800">
                            <div className="flex items-center gap-2">
                              <Layers className="h-4 w-4 text-blue-400" />
                              <span className="text-sm font-medium text-white">Satélite</span>
                            </div>
                            <span className="text-xs text-gray-400">
                              {format(new Date(), "dd/MMM", { locale: ptBR })}
                            </span>
                          </div>
                          <div className="h-56">
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

                      {/* Weather Charts */}
                      {historicalWeather && (
                        <div className="space-y-4">
                          <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <Droplets className="h-5 w-5 text-blue-500" />
                                <h3 className="font-semibold text-gray-900">Precipitação</h3>
                              </div>
                              <span className="text-xl font-bold text-blue-600">
                                {historicalWeather.totalPrecipitation} mm
                              </span>
                            </div>
                            <PrecipitationChart 
                              dates={historicalWeather.dates || []} 
                              values={historicalWeather.accumulatedPrecipitation || []}
                              height={100}
                            />
                          </div>

                          <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <Thermometer className="h-5 w-5 text-orange-500" />
                                <h3 className="font-semibold text-gray-900">Soma Térmica</h3>
                              </div>
                              <span className="text-xl font-bold text-orange-600">
                                +{historicalWeather.totalThermalSum}°
                              </span>
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

                  {activeTab === "data" && selectedField && (
                    <div className="space-y-4">
                      <div className="bg-white rounded-2xl border border-gray-200 p-5">
                        <h3 className="font-semibold text-gray-900 mb-4">Informações do Talhão</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-gray-50 rounded-xl p-4">
                            <p className="text-sm text-gray-500 mb-1">Nome</p>
                            <p className="font-medium text-gray-900">{selectedField.name}</p>
                          </div>
                          <div className="bg-gray-50 rounded-xl p-4">
                            <p className="text-sm text-gray-500 mb-1">Área</p>
                            <p className="font-medium text-gray-900">{formatHectares(selectedField.areaHectares)}</p>
                          </div>
                          <div className="bg-gray-50 rounded-xl p-4">
                            <p className="text-sm text-gray-500 mb-1">Cultura</p>
                            <p className="font-medium text-gray-900">{(selectedField as any).crop || "Não definida"}</p>
                          </div>
                          <div className="bg-gray-50 rounded-xl p-4">
                            <p className="text-sm text-gray-500 mb-1">NDVI Atual</p>
                            <p className="font-medium text-green-600">{currentNdviValue}</p>
                          </div>
                        </div>
                      </div>

                      {/* NDVI History */}
                      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-100">
                          <h3 className="font-semibold text-gray-900">Histórico NDVI</h3>
                        </div>
                        {ndviChartData.length > 0 ? (
                          <div className="divide-y divide-gray-100">
                            {ndviChartData.slice(0, 10).map((item, index) => (
                              <div key={index} className="px-5 py-3 flex items-center justify-between">
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
                        ) : (
                          <div className="p-8 text-center">
                            <Leaf className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                            <p className="text-gray-500">Sem dados históricos</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === "notes" && (
                    <div className="space-y-4">
                      <Button 
                        className="w-full bg-green-600 hover:bg-green-700 gap-2 h-12 rounded-xl"
                        onClick={() => setLocation(`/notes?fieldId=${selectedFieldId}`)}
                      >
                        <Plus className="h-5 w-5" />
                        Nova nota
                      </Button>

                      {notes?.length ? (
                        <div className="space-y-3">
                          {notes.map((note: any) => (
                            <div key={note.id} className="bg-white rounded-xl border border-gray-200 p-4">
                              <p className="text-gray-900">{note.content}</p>
                              <div className="flex items-center justify-between mt-3">
                                <p className="text-xs text-gray-400">
                                  {format(new Date(note.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                </p>
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
                        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                          <StickyNote className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                          <p className="text-gray-500 font-medium">Nenhuma nota</p>
                          <p className="text-sm text-gray-400 mt-1">Adicione observações sobre este talhão</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeNavTab === "map" && (
          <div className="h-full relative">
            <MapboxMap
              onMapReady={(map) => setMap(map)}
              className="w-full h-full"
              initialCenter={fieldCenter}
              initialZoom={14}
              style="satellite"
            />
          </div>
        )}

        {activeNavTab === "charts" && (
          <div className="h-full overflow-y-auto p-4">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Relatórios</h2>
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-900 mb-4">Resumo Geral</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-green-50 rounded-xl p-4 text-center">
                    <p className="text-3xl font-bold text-green-600">{fields?.length || 0}</p>
                    <p className="text-sm text-gray-600">Talhões</p>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-4 text-center">
                    <p className="text-3xl font-bold text-blue-600">{totalArea.toFixed(1)}</p>
                    <p className="text-sm text-gray-600">Hectares</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeNavTab === "notes" && (
          <div className="h-full overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Notas de Campo</h2>
              <Button 
                size="sm"
                className="bg-green-600 hover:bg-green-700 gap-2 rounded-xl"
                onClick={() => setLocation("/notes")}
              >
                <Plus className="h-4 w-4" />
                Nova
              </Button>
            </div>
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Selecione um talhão para ver as notas</p>
            </div>
          </div>
        )}

        {activeNavTab === "settings" && (
          <div className="h-full overflow-y-auto p-4">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Configurações</h2>
            <div className="space-y-3">
              <button 
                onClick={() => setLocation("/profile")}
                className="w-full bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 hover:bg-gray-50 transition-colors"
              >
                <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                  <Users className="h-5 w-5 text-gray-600" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-gray-900">Perfil</p>
                  <p className="text-sm text-gray-500">Configurações da conta</p>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </button>
              
              <button 
                onClick={() => setLocation("/safra")}
                className="w-full bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl border border-amber-200 p-4 flex items-center gap-4 hover:from-amber-100 hover:to-yellow-100 transition-colors"
              >
                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                  <Crown className="h-5 w-5 text-amber-600" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-amber-900">Plano Safra</p>
                  <p className="text-sm text-amber-700">Recursos premium</p>
                </div>
                <ChevronRight className="h-5 w-5 text-amber-400" />
              </button>
              
              <button className="w-full bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 hover:bg-gray-50 transition-colors">
                <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                  <HelpCircle className="h-5 w-5 text-gray-600" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium text-gray-900">Ajuda</p>
                  <p className="text-sm text-gray-500">Central de suporte</p>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ===== BOTTOM NAVIGATION BAR ===== */}
      <div className="bg-white border-t border-gray-200 px-2 py-2 shrink-0 safe-area-bottom">
        <div className="flex items-center justify-around max-w-lg mx-auto">
          {[
            { id: "fields", label: "Talhões", icon: Layers },
            { id: "map", label: "Mapa", icon: Map },
            { id: "charts", label: "Relatórios", icon: BarChart3 },
            { id: "notes", label: "Notas", icon: FileText },
            { id: "settings", label: "Mais", icon: Menu },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeNavTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveNavTab(item.id as any)}
                className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${
                  isActive 
                    ? "bg-green-100 text-green-600" 
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Icon className={`h-5 w-5 ${isActive ? "text-green-600" : ""}`} />
                <span className={`text-[10px] font-medium ${isActive ? "text-green-600" : ""}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
