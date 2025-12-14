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

interface ThermalSumDataPoint {
  date: string;
  thermalSum: number;
  temperatureMean?: number;
}

interface ThermalSumChartProps {
  data: ThermalSumDataPoint[];
  totalThermalSum?: number;
  baseTemperature?: number;
  targetGDD?: number; // Target GDD for crop maturity
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
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500" />
            <span className="text-sm text-muted-foreground">Soma Térmica:</span>
            <span className="text-sm font-medium">
              {payload[0].value.toFixed(0)} GD
            </span>
          </div>
          {payload[0].payload.temperatureMean !== undefined && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <span className="text-sm text-muted-foreground">Temp. Média:</span>
              <span className="text-sm font-medium">
                {payload[0].payload.temperatureMean.toFixed(1)}°C
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

export function ThermalSumChart({
  data,
  totalThermalSum,
  baseTemperature = 10,
  targetGDD,
  height = 200,
}: ThermalSumChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-muted-foreground">
        Sem dados de soma térmica disponíveis
      </div>
    );
  }

  // Sort data by date
  const sortedData = [...data].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const maxThermalSum = Math.max(...sortedData.map((d) => d.thermalSum || 0));

  // Calculate progress percentage if target is defined
  const progressPercentage = targetGDD
    ? Math.min(100, (totalThermalSum || 0) / targetGDD * 100)
    : null;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-muted-foreground">Soma Térmica Acumulada</p>
          <div className="flex items-center gap-2">
            <span className="text-3xl font-bold text-orange-500">
              {(totalThermalSum || 0).toFixed(0)}
            </span>
            <span className="text-lg text-muted-foreground">GD</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Temperatura base: {baseTemperature}°C
          </p>
        </div>
        {targetGDD && progressPercentage !== null && (
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Progresso</p>
            <p className="text-lg font-medium">
              {progressPercentage.toFixed(0)}%
            </p>
            <p className="text-xs text-muted-foreground">
              Meta: {targetGDD} GD
            </p>
          </div>
        )}
      </div>

      {/* Progress bar if target is defined */}
      {targetGDD && progressPercentage !== null && (
        <div className="mb-4">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-400 to-orange-600 rounded-full transition-all duration-500"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>0 GD</span>
            <span>{targetGDD} GD</span>
          </div>
        </div>
      )}

      <ResponsiveContainer width="100%" height={height}>
        <AreaChart
          data={sortedData}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="thermalGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f97316" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#f97316" stopOpacity={0.1} />
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
            domain={[0, Math.ceil(maxThermalSum * 1.1)]}
            className="text-xs"
            tick={{ fill: "hsl(var(--muted-foreground))" }}
            label={{
              value: "Graus-dia (GD)",
              angle: -90,
              position: "insideLeft",
              style: { textAnchor: "middle", fill: "hsl(var(--muted-foreground))" },
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          {targetGDD && (
            <ReferenceLine
              y={targetGDD}
              stroke="#22c55e"
              strokeDasharray="5 5"
              label={{
                value: "Meta",
                position: "right",
                fill: "#22c55e",
                fontSize: 12,
              }}
            />
          )}
          <Area
            type="monotone"
            dataKey="thermalSum"
            stroke="#f97316"
            strokeWidth={2}
            fill="url(#thermalGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>

      <div className="mt-4 p-3 bg-muted/50 rounded-lg">
        <p className="text-sm font-medium mb-2">O que é Soma Térmica?</p>
        <p className="text-xs text-muted-foreground">
          A soma térmica (graus-dia) mede o acúmulo de calor disponível para o
          desenvolvimento das plantas. É calculada pela diferença entre a
          temperatura média diária e a temperatura base da cultura.
        </p>
      </div>
    </div>
  );
}

// Common crop GDD requirements
export const cropGDDRequirements: Record<string, { min: number; max: number; label: string }> = {
  soja: { min: 1200, max: 1500, label: "Soja" },
  milho: { min: 1400, max: 1800, label: "Milho" },
  trigo: { min: 1200, max: 1500, label: "Trigo" },
  algodao: { min: 1800, max: 2200, label: "Algodão" },
  feijao: { min: 900, max: 1100, label: "Feijão" },
  arroz: { min: 1500, max: 2000, label: "Arroz" },
  cafe: { min: 2500, max: 3000, label: "Café" },
  cana: { min: 2000, max: 2500, label: "Cana-de-açúcar" },
};
