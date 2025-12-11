import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart,
} from "recharts";

interface NDVIDataPoint {
  date: string;
  ndvi: number;
  ndviMin?: number;
  ndviMax?: number;
  cloudCoverage?: number;
}

interface NDVIChartProps {
  data: NDVIDataPoint[];
  type?: "line" | "area" | "comparison";
  comparisonData?: NDVIDataPoint[];
  showThresholds?: boolean;
  height?: number;
  showLegend?: boolean;
}

// NDVI thresholds for agriculture
const NDVI_THRESHOLDS = {
  stressed: 0.3,
  moderate: 0.5,
  healthy: 0.7,
};

const getNdviStatusColor = (value: number) => {
  if (value < 0.3) return "#ef4444"; // Red - stressed
  if (value < 0.5) return "#f59e0b"; // Yellow - moderate
  if (value < 0.7) return "#84cc16"; // Light green - healthy
  return "#22c55e"; // Green - very healthy
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
        <p className="font-semibold text-gray-900">{label}</p>
        <div className="mt-2 space-y-1">
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: getNdviStatusColor(data.ndvi) }}
            />
            <span className="text-sm">NDVI: <strong>{data.ndvi.toFixed(2)}</strong></span>
          </div>
          {data.ndviMin !== undefined && (
            <p className="text-xs text-gray-500">Min: {data.ndviMin.toFixed(2)}</p>
          )}
          {data.ndviMax !== undefined && (
            <p className="text-xs text-gray-500">Max: {data.ndviMax.toFixed(2)}</p>
          )}
          {data.cloudCoverage !== undefined && (
            <p className="text-xs text-gray-500">
              Nuvens: {data.cloudCoverage}%
            </p>
          )}
        </div>
      </div>
    );
  }
  return null;
};

export function NDVIChart({
  data,
  type = "area",
  comparisonData,
  showThresholds = true,
  height = 200,
  showLegend = false,
}: NDVIChartProps) {
  const chartData = useMemo(() => {
    return data.map((d, index) => ({
      ...d,
      comparison: comparisonData?.[index]?.ndvi,
    }));
  }, [data, comparisonData]);

  if (type === "area") {
    return (
      <div className="w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="ndviGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 10 }}
              stroke="#9ca3af"
            />
            <YAxis 
              domain={[0, 1]} 
              ticks={[0, 0.25, 0.5, 0.75, 1]}
              tick={{ fontSize: 10 }}
              stroke="#9ca3af"
            />
            <Tooltip content={<CustomTooltip />} />
            
            {showThresholds && (
              <>
                <ReferenceLine 
                  y={NDVI_THRESHOLDS.stressed} 
                  stroke="#ef4444" 
                  strokeDasharray="5 5" 
                  strokeWidth={1}
                />
                <ReferenceLine 
                  y={NDVI_THRESHOLDS.moderate} 
                  stroke="#f59e0b" 
                  strokeDasharray="5 5" 
                  strokeWidth={1}
                />
                <ReferenceLine 
                  y={NDVI_THRESHOLDS.healthy} 
                  stroke="#22c55e" 
                  strokeDasharray="5 5" 
                  strokeWidth={1}
                />
              </>
            )}
            
            <Area
              type="monotone"
              dataKey="ndvi"
              stroke="#22c55e"
              strokeWidth={2}
              fill="url(#ndviGradient)"
              dot={{ fill: "#22c55e", strokeWidth: 2, r: 3 }}
              activeDot={{ r: 6, fill: "#16a34a" }}
            />
            
            {comparisonData && (
              <Line
                type="monotone"
                dataKey="comparison"
                stroke="#6366f1"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ fill: "#6366f1", strokeWidth: 2, r: 2 }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
        
        {showLegend && (
          <div className="flex items-center justify-center gap-4 mt-2">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-xs text-gray-600">NDVI Atual</span>
            </div>
            {comparisonData && (
              <div className="flex items-center gap-1">
                <div className="w-3 h-0.5 bg-indigo-500" />
                <span className="text-xs text-gray-600">Ano Anterior</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 10 }}
            stroke="#9ca3af"
          />
          <YAxis 
            domain={[0, 1]} 
            ticks={[0, 0.25, 0.5, 0.75, 1]}
            tick={{ fontSize: 10 }}
            stroke="#9ca3af"
          />
          <Tooltip content={<CustomTooltip />} />
          
          <Line
            type="monotone"
            dataKey="ndvi"
            stroke="#22c55e"
            strokeWidth={2}
            dot={{ fill: "#22c55e", strokeWidth: 2, r: 3 }}
            activeDot={{ r: 6 }}
          />
          
          {comparisonData && (
            <Line
              type="monotone"
              dataKey="comparison"
              stroke="#6366f1"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ fill: "#6366f1", strokeWidth: 2, r: 2 }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Mini sparkline version for cards
export function NDVISparkline({ data, width = 80, height = 30 }: { data: number[]; width?: number; height?: number }) {
  const chartData = data.map((ndvi, i) => ({ index: i, ndvi }));
  const lastValue = data[data.length - 1] || 0;
  const trend = data.length >= 2 ? data[data.length - 1] - data[data.length - 2] : 0;
  
  return (
    <div className="flex items-center gap-2">
      <div style={{ width, height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="sparklineGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={getNdviStatusColor(lastValue)} stopOpacity={0.6}/>
                <stop offset="95%" stopColor={getNdviStatusColor(lastValue)} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="ndvi"
              stroke={getNdviStatusColor(lastValue)}
              strokeWidth={1.5}
              fill="url(#sparklineGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="text-right">
        <span className="font-semibold text-sm">{lastValue.toFixed(2)}</span>
        <span className={`text-xs ml-1 ${trend >= 0 ? "text-green-600" : "text-red-600"}`}>
          {trend >= 0 ? "↑" : "↓"}{Math.abs(trend * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

// NDVI Distribution histogram
export function NDVIDistribution({ data, height = 150 }: { data: NDVIDataPoint[]; height?: number }) {
  const distribution = useMemo(() => {
    const bins = [
      { range: "0-0.2", count: 0, color: "#d73027", label: "Muito baixo" },
      { range: "0.2-0.4", count: 0, color: "#fc8d59", label: "Baixo" },
      { range: "0.4-0.6", count: 0, color: "#fee08b", label: "Moderado" },
      { range: "0.6-0.8", count: 0, color: "#91cf60", label: "Bom" },
      { range: "0.8-1.0", count: 0, color: "#1a9850", label: "Excelente" },
    ];
    
    data.forEach(d => {
      if (d.ndvi < 0.2) bins[0].count++;
      else if (d.ndvi < 0.4) bins[1].count++;
      else if (d.ndvi < 0.6) bins[2].count++;
      else if (d.ndvi < 0.8) bins[3].count++;
      else bins[4].count++;
    });
    
    return bins;
  }, [data]);
  
  const maxCount = Math.max(...distribution.map(d => d.count));
  
  return (
    <div className="w-full" style={{ height }}>
      <div className="flex items-end justify-between h-full gap-1">
        {distribution.map((bin, i) => (
          <div key={i} className="flex-1 flex flex-col items-center">
            <div 
              className="w-full rounded-t transition-all"
              style={{ 
                backgroundColor: bin.color,
                height: `${(bin.count / maxCount) * 100}%`,
                minHeight: bin.count > 0 ? 8 : 0
              }}
            />
            <span className="text-[10px] text-gray-500 mt-1">{bin.label}</span>
            <span className="text-xs font-medium">{bin.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default NDVIChart;
