import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface NdviDataPoint {
  date: string;
  ndvi: number;
  cloudCoverage?: number;
}

interface NdviChartProps {
  data: NdviDataPoint[];
  currentValue?: number;
  height?: number;
}

// NDVI color scale - matches OneSoil
function getNdviColor(value: number): string {
  if (value < 0.1) return "#d73027"; // Red - bare soil/water
  if (value < 0.2) return "#f46d43"; // Orange-red
  if (value < 0.3) return "#fdae61"; // Orange
  if (value < 0.4) return "#fee08b"; // Yellow
  if (value < 0.5) return "#d9ef8b"; // Light green
  if (value < 0.6) return "#a6d96a"; // Green
  if (value < 0.7) return "#66bd63"; // Medium green
  if (value < 0.8) return "#1a9850"; // Dark green
  return "#006837"; // Very dark green - dense vegetation
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const value = payload[0].value;
    return (
      <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
        <p className="text-sm font-medium">
          {format(new Date(label), "dd 'de' MMMM, yyyy", { locale: ptBR })}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: getNdviColor(value) }}
          />
          <p className="text-lg font-bold">{value.toFixed(2)}</p>
        </div>
        {payload[0].payload.cloudCoverage !== undefined && (
          <p className="text-xs text-muted-foreground mt-1">
            Nuvens: {payload[0].payload.cloudCoverage}%
          </p>
        )}
      </div>
    );
  }
  return null;
};

export function NdviChart({ data, currentValue, height = 200 }: NdviChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-muted-foreground">
        Sem dados de NDVI disponíveis
      </div>
    );
  }

  // Sort data by date
  const sortedData = [...data].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <div className="w-full">
      {currentValue !== undefined && (
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-muted-foreground">NDVI Atual</p>
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: getNdviColor(currentValue) }}
              />
              <span className="text-3xl font-bold">{currentValue.toFixed(2)}</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Classificação</p>
            <p className="text-lg font-medium">
              {currentValue < 0.2
                ? "Solo exposto"
                : currentValue < 0.4
                ? "Vegetação esparsa"
                : currentValue < 0.6
                ? "Vegetação moderada"
                : currentValue < 0.8
                ? "Vegetação densa"
                : "Vegetação muito densa"}
            </p>
          </div>
        </div>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart
          data={sortedData}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="ndviGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#1a9850" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#1a9850" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="date"
            tickFormatter={(value) => format(new Date(value), "dd/MM", { locale: ptBR })}
            className="text-xs"
            tick={{ fill: "hsl(var(--muted-foreground))" }}
          />
          <YAxis
            domain={[0, 1]}
            ticks={[0, 0.2, 0.4, 0.6, 0.8, 1]}
            className="text-xs"
            tick={{ fill: "hsl(var(--muted-foreground))" }}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={0.4} stroke="#f59e0b" strokeDasharray="3 3" />
          <ReferenceLine y={0.6} stroke="#22c55e" strokeDasharray="3 3" />
          <Area
            type="monotone"
            dataKey="ndvi"
            stroke="#1a9850"
            strokeWidth={2}
            fill="url(#ndviGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="flex justify-between text-xs text-muted-foreground mt-2">
        <span>0.0 - Solo</span>
        <span>0.4 - Esparsa</span>
        <span>0.6 - Moderada</span>
        <span>1.0 - Densa</span>
      </div>
    </div>
  );
}

// NDVI Color Scale Legend Component
export function NdviColorScale({ vertical = false }: { vertical?: boolean }) {
  const colors = [
    { value: "0.0", color: "#d73027", label: "Solo" },
    { value: "0.2", color: "#fdae61", label: "" },
    { value: "0.4", color: "#fee08b", label: "Esparsa" },
    { value: "0.6", color: "#a6d96a", label: "" },
    { value: "0.8", color: "#1a9850", label: "Densa" },
    { value: "1.0", color: "#006837", label: "" },
  ];

  if (vertical) {
    return (
      <div className="flex flex-col items-center gap-1">
        {colors.reverse().map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-xs text-muted-foreground w-8">{item.value}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {colors.map((item, index) => (
        <div key={index} className="flex flex-col items-center">
          <div
            className="w-8 h-3 rounded"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-xs text-muted-foreground mt-1">{item.value}</span>
        </div>
      ))}
    </div>
  );
}
