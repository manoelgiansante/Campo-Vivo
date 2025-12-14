import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PrecipitationDataPoint {
  date: string;
  precipitation: number;
  accumulated: number;
}

interface PrecipitationChartProps {
  data: PrecipitationDataPoint[];
  totalPrecipitation?: number;
  height?: number;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
        <p className="text-sm font-medium">
          {format(new Date(label), "dd 'de' MMMM, yyyy", { locale: ptBR })}
        </p>
        <div className="space-y-1 mt-2">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-sm text-muted-foreground">
                {entry.name}:
              </span>
              <span className="text-sm font-medium">
                {entry.value.toFixed(1)} mm
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export function PrecipitationChart({
  data,
  totalPrecipitation,
  height = 200,
}: PrecipitationChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-muted-foreground">
        Sem dados de precipitação disponíveis
      </div>
    );
  }

  // Sort data by date
  const sortedData = [...data].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Calculate max values for dual Y-axis
  const maxPrecipitation = Math.max(...sortedData.map((d) => d.precipitation || 0));
  const maxAccumulated = Math.max(...sortedData.map((d) => d.accumulated || 0));

  return (
    <div className="w-full">
      {totalPrecipitation !== undefined && (
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-muted-foreground">Precipitação Acumulada</p>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold text-blue-500">
                {totalPrecipitation.toFixed(1)}
              </span>
              <span className="text-lg text-muted-foreground">mm</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Período</p>
            <p className="text-lg font-medium">
              {sortedData.length > 0 && (
                <>
                  {format(new Date(sortedData[0].date), "dd/MM", { locale: ptBR })}
                  {" - "}
                  {format(
                    new Date(sortedData[sortedData.length - 1].date),
                    "dd/MM",
                    { locale: ptBR }
                  )}
                </>
              )}
            </p>
          </div>
        </div>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart
          data={sortedData}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="precipGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.3} />
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
            yAxisId="left"
            orientation="left"
            domain={[0, Math.ceil(maxPrecipitation * 1.2)]}
            className="text-xs"
            tick={{ fill: "hsl(var(--muted-foreground))" }}
            label={{
              value: "mm/dia",
              angle: -90,
              position: "insideLeft",
              style: { textAnchor: "middle", fill: "hsl(var(--muted-foreground))" },
            }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={[0, Math.ceil(maxAccumulated * 1.1)]}
            className="text-xs"
            tick={{ fill: "hsl(var(--muted-foreground))" }}
            label={{
              value: "Acumulado (mm)",
              angle: 90,
              position: "insideRight",
              style: { textAnchor: "middle", fill: "hsl(var(--muted-foreground))" },
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Bar
            yAxisId="left"
            dataKey="precipitation"
            name="Diária"
            fill="url(#precipGradient)"
            radius={[4, 4, 0, 0]}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="accumulated"
            name="Acumulada"
            stroke="#1d4ed8"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
