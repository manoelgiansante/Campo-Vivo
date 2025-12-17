import { useMemo, useRef, useCallback } from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { format, parseISO, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Leaf, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import html2canvas from "html2canvas";

interface NdviDataPoint {
  date: string; // formato "yyyy-MM-dd"
  ndvi: number;
}

interface NdviChartOneSoilProps {
  data: NdviDataPoint[];
  currentValue?: number;
  lastUpdateDate?: string;
  height?: number;
  showDownload?: boolean;
  title?: string;
}

// Cores NDVI seguindo exatamente o OneSoil
const NDVI_COLORS = {
  excellent: "#22c55e", // Verde escuro (≥0.7)
  good: "#84cc16",      // Verde lima (0.5-0.7) - VERDE LIMÃO
  moderate: "#eab308",  // Amarelo (0.3-0.5)
  low: "#f97316",       // Laranja (0.2-0.3)
  veryLow: "#ef4444",   // Vermelho (<0.2)
};

// Função para obter cor baseada no valor NDVI
function getNdviColor(value: number): string {
  if (value >= 0.7) return NDVI_COLORS.excellent;
  if (value >= 0.5) return NDVI_COLORS.good;      // 0.6 cai aqui -> verde lima
  if (value >= 0.3) return NDVI_COLORS.moderate;
  if (value >= 0.2) return NDVI_COLORS.low;
  return NDVI_COLORS.veryLow;
}

// Tooltip customizado com cor dinâmica
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;

  const value = payload[0].value;
  const date = label;
  const color = getNdviColor(value);

  return (
    <div className="bg-gray-900 text-white rounded-lg shadow-xl p-3 min-w-[140px]">
      <p className="text-xs text-gray-300 mb-1">
        {format(parseISO(date), "dd MMM yyyy", { locale: ptBR })}
      </p>
      <div className="flex items-center gap-2">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="text-xl font-bold">{value.toFixed(2)}</span>
        <span className="text-xs text-gray-400">NDVI</span>
      </div>
    </div>
  );
}

// Dot customizado com cor baseada no valor do ponto
function CustomDot(props: any) {
  const { cx, cy, payload, index, totalPoints } = props;
  if (!payload || cx === undefined || cy === undefined) return null;
  
  const color = getNdviColor(payload.ndvi);
  const isLast = index === totalPoints - 1;
  
  return (
    <circle
      cx={cx}
      cy={cy}
      r={isLast ? 7 : 4}
      fill="white"
      stroke={color}
      strokeWidth={isLast ? 3 : 2}
    />
  );
}

export function NdviChartOneSoil({
  data,
  currentValue,
  lastUpdateDate,
  height = 200,
  showDownload = true,
  title = "Índice NDVI",
}: NdviChartOneSoilProps) {
  const chartRef = useRef<HTMLDivElement>(null);

  // Processar dados para o gráfico
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];

    // Ordenar por data
    const sorted = [...data].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    return sorted.map((point) => ({
      ...point,
      // Adicionar mês formatado para o eixo X
      month: format(parseISO(point.date), "MMM", { locale: ptBR }),
      color: getNdviColor(point.ndvi),
    }));
  }, [data]);

  // Calcular valor atual e dias desde última atualização
  const displayValue = useMemo(() => {
    if (currentValue !== undefined) return currentValue;
    if (chartData.length > 0) return chartData[chartData.length - 1].ndvi;
    return 0;
  }, [currentValue, chartData]);

  const daysSinceUpdate = useMemo(() => {
    if (lastUpdateDate) {
      return differenceInDays(new Date(), parseISO(lastUpdateDate));
    }
    if (chartData.length > 0) {
      return differenceInDays(
        new Date(),
        parseISO(chartData[chartData.length - 1].date)
      );
    }
    return 0;
  }, [lastUpdateDate, chartData]);

  // Função para download do gráfico
  const handleDownload = useCallback(async () => {
    if (!chartRef.current) return;

    try {
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
      });
      const link = document.createElement("a");
      link.download = `ndvi-chart-${format(new Date(), "yyyy-MM-dd")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (error) {
      console.error("Erro ao exportar gráfico:", error);
    }
  }, []);

  // Criar gradiente único baseado nos dados
  const gradientId = useMemo(() => `ndviGradient-${Math.random().toString(36).substr(2, 9)}`, []);

  // Calcular stops do gradiente baseado nos valores NDVI
  const gradientStops = useMemo(() => {
    if (chartData.length === 0) return [];

    // Criar stops baseados nos valores reais com porcentagens
    return chartData.map((point, index) => {
      const percentage = chartData.length > 1 
        ? (index / (chartData.length - 1)) * 100 
        : 50;
      return {
        offset: `${percentage}%`,
        color: getNdviColor(point.ndvi),
      };
    });
  }, [chartData]);

  // Log para debug
  console.log("NDVI Chart Data:", chartData.map(p => ({ date: p.date, ndvi: p.ndvi, color: getNdviColor(p.ndvi) })));
  console.log("Gradient Stops:", gradientStops);

  if (chartData.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-gray-50 rounded-lg"
        style={{ height }}
      >
        <p className="text-gray-400 text-sm">Sem dados de NDVI disponíveis</p>
      </div>
    );
  }

  return (
    <div ref={chartRef} className="bg-white rounded-xl p-4">
      {/* Header com título e botão de download */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-700">{title}</h3>
        {showDownload && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-gray-400 hover:text-gray-600"
            onClick={handleDownload}
          >
            <Download className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Container do gráfico com valor à direita */}
      <div className="flex items-start gap-6">
        {/* Gráfico */}
        <div className="flex-1" style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              {/* Definição dos gradientes */}
              <defs>
                {/* Gradiente horizontal para a linha */}
                <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                  {gradientStops.map((stop, index) => (
                    <stop
                      key={index}
                      offset={stop.offset}
                      stopColor={stop.color}
                      stopOpacity={1}
                    />
                  ))}
                </linearGradient>
                {/* Gradiente horizontal para o preenchimento */}
                <linearGradient id={`${gradientId}-fill`} x1="0%" y1="0%" x2="100%" y2="0%">
                  {gradientStops.map((stop, index) => (
                    <stop
                      key={index}
                      offset={stop.offset}
                      stopColor={stop.color}
                      stopOpacity={0.25}
                    />
                  ))}
                </linearGradient>
              </defs>

              {/* Linhas de referência horizontais */}
              <ReferenceLine y={0.25} stroke="#f3f4f6" strokeDasharray="3 3" />
              <ReferenceLine y={0.5} stroke="#e5e7eb" strokeDasharray="3 3" />
              <ReferenceLine y={0.75} stroke="#f3f4f6" strokeDasharray="3 3" />
              <ReferenceLine y={1} stroke="#e5e7eb" strokeDasharray="3 3" />

              {/* Eixo X com meses */}
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                tickFormatter={(value) => {
                  try {
                    return format(parseISO(value), "MMM", { locale: ptBR });
                  } catch {
                    return value;
                  }
                }}
                interval="preserveStartEnd"
                minTickGap={30}
              />

              {/* Eixo Y de 0 a 1 */}
              <YAxis
                domain={[0, 1]}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                ticks={[0, 0.25, 0.5, 0.75, 1]}
                tickFormatter={(value) => value.toFixed(2)}
                width={40}
              />

              {/* Tooltip */}
              <Tooltip content={<CustomTooltip />} />

              {/* Área preenchida */}
              <Area
                type="monotone"
                dataKey="ndvi"
                stroke="none"
                fill={`url(#${gradientId}-fill)`}
                fillOpacity={1}
              />

              {/* Linha com gradiente e dots coloridos */}
              <Line
                type="monotone"
                dataKey="ndvi"
                stroke={`url(#${gradientId})`}
                strokeWidth={3}
                dot={(props: any) => (
                  <CustomDot {...props} totalPoints={chartData.length} />
                )}
                activeDot={{
                  r: 8,
                  fill: "white",
                  stroke: getNdviColor(displayValue),
                  strokeWidth: 3,
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Valor atual à direita */}
        <div className="min-w-[140px] text-right">
          <div className="flex items-center justify-end gap-2 mb-1">
            <Leaf
              className="h-5 w-5"
              style={{ color: getNdviColor(displayValue) }}
            />
            <span className="text-3xl font-bold text-gray-900">
              {displayValue.toFixed(2)}
            </span>
          </div>
          <p className="text-xs text-gray-400">
            Última atualização há {daysSinceUpdate} dias
          </p>
        </div>
      </div>

      {/* Legenda de cores */}
      <div className="flex items-center justify-center gap-3 mt-3 flex-wrap">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: NDVI_COLORS.excellent }} />
          <span className="text-xs text-gray-500">Excelente (≥0.7)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: NDVI_COLORS.good }} />
          <span className="text-xs text-gray-500">Bom (0.5-0.7)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: NDVI_COLORS.moderate }} />
          <span className="text-xs text-gray-500">Moderado (0.3-0.5)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: NDVI_COLORS.low }} />
          <span className="text-xs text-gray-500">Baixo (&lt;0.3)</span>
        </div>
      </div>
    </div>
  );
}

export default NdviChartOneSoil;
