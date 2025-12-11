import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  ComposedChart,
  Legend,
} from "recharts";
import {
  ChevronLeft,
  Droplets,
  Thermometer,
  Wind,
  Sun,
  CloudRain,
  Loader2,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocation, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";

type PeriodType = "7d" | "30d" | "90d" | "1y";

interface WeatherDataPoint {
  date: string;
  temperature: number;
  tempMin: number;
  tempMax: number;
  humidity: number;
  precipitation: number;
  windSpeed: number;
}

// Generate mock historical weather data
function generateHistoricalData(days: number): WeatherDataPoint[] {
  const data: WeatherDataPoint[] = [];
  const today = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    // Seasonal variation
    const month = date.getMonth();
    let baseTemp = 25;
    let basePrecip = 5;
    
    // Brazilian seasons
    if (month >= 11 || month <= 2) { // Summer (rainy)
      baseTemp = 28 + Math.random() * 5;
      basePrecip = 10 + Math.random() * 20;
    } else if (month >= 5 && month <= 8) { // Winter (dry)
      baseTemp = 18 + Math.random() * 8;
      basePrecip = Math.random() > 0.7 ? Math.random() * 5 : 0;
    } else { // Transition
      baseTemp = 22 + Math.random() * 8;
      basePrecip = Math.random() > 0.5 ? Math.random() * 15 : 0;
    }
    
    data.push({
      date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
      temperature: parseFloat(baseTemp.toFixed(1)),
      tempMin: parseFloat((baseTemp - 5 - Math.random() * 3).toFixed(1)),
      tempMax: parseFloat((baseTemp + 3 + Math.random() * 4).toFixed(1)),
      humidity: Math.floor(50 + Math.random() * 40),
      precipitation: parseFloat(basePrecip.toFixed(1)),
      windSpeed: parseFloat((5 + Math.random() * 15).toFixed(1)),
    });
  }
  
  return data;
}

// Calculate GDD (Growing Degree Days)
function calculateGDD(data: WeatherDataPoint[], baseTemp: number = 10): number {
  return data.reduce((sum, d) => {
    const avg = (d.tempMax + d.tempMin) / 2;
    const gdd = Math.max(0, avg - baseTemp);
    return sum + gdd;
  }, 0);
}

// Custom tooltip for temperature chart
const TemperatureTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
        <p className="font-semibold text-gray-900 mb-2">{label}</p>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-gray-500">Média:</span>
            <span className="font-medium">{data.temperature}°C</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-500">Máxima:</span>
            <span className="font-medium text-red-500">{data.tempMax}°C</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-500">Mínima:</span>
            <span className="font-medium text-blue-500">{data.tempMin}°C</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

// Custom tooltip for precipitation
const PrecipitationTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
        <p className="font-semibold text-gray-900 mb-2">{label}</p>
        <div className="flex items-center gap-2">
          <Droplets className="h-4 w-4 text-blue-500" />
          <span className="font-medium">{data.precipitation} mm</span>
        </div>
      </div>
    );
  }
  return null;
};

export default function WeatherCharts() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/fields/:id/weather");
  const fieldId = params?.id ? parseInt(params.id) : null;
  
  const [period, setPeriod] = useState<PeriodType>("30d");
  const [activeTab, setActiveTab] = useState("temperature");
  
  // Get field details
  const { data: field, isLoading } = trpc.fields.getById.useQuery(
    { id: fieldId! },
    { enabled: !!fieldId }
  );
  
  // Generate data based on period
  const weatherData = useMemo(() => {
    const days = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : 365;
    return generateHistoricalData(days);
  }, [period]);
  
  // Calculate statistics
  const stats = useMemo(() => {
    const totalPrecip = weatherData.reduce((sum, d) => sum + d.precipitation, 0);
    const avgTemp = weatherData.reduce((sum, d) => sum + d.temperature, 0) / weatherData.length;
    const maxTemp = Math.max(...weatherData.map(d => d.tempMax));
    const minTemp = Math.min(...weatherData.map(d => d.tempMin));
    const gdd = calculateGDD(weatherData);
    const rainyDays = weatherData.filter(d => d.precipitation > 0.1).length;
    
    return { totalPrecip, avgTemp, maxTemp, minTemp, gdd, rainyDays };
  }, [weatherData]);
  
  // Accumulate precipitation for chart
  const accumulatedPrecip = useMemo(() => {
    let accumulated = 0;
    return weatherData.map(d => {
      accumulated += d.precipitation;
      return { ...d, accumulated: parseFloat(accumulated.toFixed(1)) };
    });
  }, [weatherData]);
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-100 pb-8">
      {/* Header */}
      <div className="bg-white px-4 pt-4 pb-3 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => setLocation(fieldId ? `/fields/${fieldId}` : "/fields")} className="p-1">
            <ChevronLeft className="h-6 w-6" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Gráficos de Clima</h1>
            {field && <p className="text-sm text-gray-500">{field.name}</p>}
          </div>
        </div>
        
        {/* Period Selector */}
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-500" />
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodType)}>
            <SelectTrigger className="w-[140px] h-8">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
              <SelectItem value="1y">Último ano</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {/* Statistics Cards */}
      <div className="px-4 mt-4">
        <div className="grid grid-cols-3 gap-2">
          <StatCard
            icon={<Thermometer className="h-4 w-4 text-orange-500" />}
            label="Temp. Média"
            value={`${stats.avgTemp.toFixed(1)}°C`}
            sublabel={`${stats.minTemp.toFixed(0)}° - ${stats.maxTemp.toFixed(0)}°`}
          />
          <StatCard
            icon={<Droplets className="h-4 w-4 text-blue-500" />}
            label="Precipitação"
            value={`${stats.totalPrecip.toFixed(0)} mm`}
            sublabel={`${stats.rainyDays} dias`}
          />
          <StatCard
            icon={<Sun className="h-4 w-4 text-yellow-500" />}
            label="Soma Térmica"
            value={`${stats.gdd.toFixed(0)}`}
            sublabel="GDD"
          />
        </div>
      </div>
      
      {/* Charts Tabs */}
      <div className="px-4 mt-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="temperature" className="text-xs">Temp.</TabsTrigger>
            <TabsTrigger value="precipitation" className="text-xs">Chuva</TabsTrigger>
            <TabsTrigger value="humidity" className="text-xs">Umidade</TabsTrigger>
            <TabsTrigger value="gdd" className="text-xs">GDD</TabsTrigger>
          </TabsList>
          
          {/* Temperature Chart */}
          <TabsContent value="temperature">
            <div className="bg-white rounded-2xl p-4">
              <h3 className="font-semibold text-gray-900 mb-4">Temperatura</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={weatherData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 10 }}
                      stroke="#9ca3af"
                      interval={Math.floor(weatherData.length / 6)}
                    />
                    <YAxis 
                      tick={{ fontSize: 10 }}
                      stroke="#9ca3af"
                      domain={['auto', 'auto']}
                    />
                    <Tooltip content={<TemperatureTooltip />} />
                    
                    <Area
                      type="monotone"
                      dataKey="tempMax"
                      fill="#fecaca"
                      stroke="#ef4444"
                      strokeWidth={1}
                      fillOpacity={0.3}
                    />
                    <Area
                      type="monotone"
                      dataKey="tempMin"
                      fill="#bfdbfe"
                      stroke="#3b82f6"
                      strokeWidth={1}
                      fillOpacity={0.3}
                    />
                    <Line
                      type="monotone"
                      dataKey="temperature"
                      stroke="#f97316"
                      strokeWidth={2}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-4 mt-2">
                <LegendItem color="#ef4444" label="Máxima" />
                <LegendItem color="#f97316" label="Média" />
                <LegendItem color="#3b82f6" label="Mínima" />
              </div>
            </div>
          </TabsContent>
          
          {/* Precipitation Chart */}
          <TabsContent value="precipitation">
            <div className="bg-white rounded-2xl p-4">
              <h3 className="font-semibold text-gray-900 mb-4">Precipitação</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={accumulatedPrecip}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 10 }}
                      stroke="#9ca3af"
                      interval={Math.floor(weatherData.length / 6)}
                    />
                    <YAxis 
                      yAxisId="left"
                      tick={{ fontSize: 10 }}
                      stroke="#9ca3af"
                    />
                    <YAxis 
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 10 }}
                      stroke="#9ca3af"
                    />
                    <Tooltip content={<PrecipitationTooltip />} />
                    
                    <Bar
                      yAxisId="left"
                      dataKey="precipitation"
                      fill="#3b82f6"
                      radius={[4, 4, 0, 0]}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="accumulated"
                      stroke="#1d4ed8"
                      strokeWidth={2}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-4 mt-2">
                <LegendItem color="#3b82f6" label="Diária (mm)" />
                <LegendItem color="#1d4ed8" label="Acumulada (mm)" dashed />
              </div>
            </div>
          </TabsContent>
          
          {/* Humidity Chart */}
          <TabsContent value="humidity">
            <div className="bg-white rounded-2xl p-4">
              <h3 className="font-semibold text-gray-900 mb-4">Umidade Relativa</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weatherData}>
                    <defs>
                      <linearGradient id="humidityGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 10 }}
                      stroke="#9ca3af"
                      interval={Math.floor(weatherData.length / 6)}
                    />
                    <YAxis 
                      domain={[0, 100]}
                      tick={{ fontSize: 10 }}
                      stroke="#9ca3af"
                    />
                    <Tooltip />
                    
                    <Area
                      type="monotone"
                      dataKey="humidity"
                      stroke="#06b6d4"
                      strokeWidth={2}
                      fill="url(#humidityGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </TabsContent>
          
          {/* GDD Chart */}
          <TabsContent value="gdd">
            <div className="bg-white rounded-2xl p-4">
              <h3 className="font-semibold text-gray-900 mb-4">Soma Térmica (GDD)</h3>
              <p className="text-sm text-gray-500 mb-4">
                Growing Degree Days acumulados (base 10°C)
              </p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weatherData.map((d, i, arr) => ({
                    ...d,
                    gdd: arr.slice(0, i + 1).reduce((sum, item) => {
                      const avg = (item.tempMax + item.tempMin) / 2;
                      return sum + Math.max(0, avg - 10);
                    }, 0)
                  }))}>
                    <defs>
                      <linearGradient id="gddGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 10 }}
                      stroke="#9ca3af"
                      interval={Math.floor(weatherData.length / 6)}
                    />
                    <YAxis 
                      tick={{ fontSize: 10 }}
                      stroke="#9ca3af"
                    />
                    <Tooltip />
                    
                    <Area
                      type="monotone"
                      dataKey="gdd"
                      stroke="#22c55e"
                      strokeWidth={2}
                      fill="url(#gddGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              
              {/* GDD Milestones */}
              <div className="mt-4 space-y-2">
                <h4 className="text-sm font-medium text-gray-700">Marcos de Cultivo</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <GDDMilestone label="Emergência" gdd={100} current={stats.gdd} />
                  <GDDMilestone label="Floração" gdd={800} current={stats.gdd} />
                  <GDDMilestone label="Enchimento" gdd={1200} current={stats.gdd} />
                  <GDDMilestone label="Maturação" gdd={1600} current={stats.gdd} />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Wind Analysis */}
      <div className="px-4 mt-6">
        <div className="bg-white rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <Wind className="h-5 w-5 text-gray-500" />
            <h3 className="font-semibold text-gray-900">Velocidade do Vento</h3>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weatherData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 10 }}
                  stroke="#9ca3af"
                  interval={Math.floor(weatherData.length / 6)}
                />
                <YAxis 
                  tick={{ fontSize: 10 }}
                  stroke="#9ca3af"
                />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="windSpeed"
                  stroke="#64748b"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({ 
  icon, 
  label, 
  value, 
  sublabel 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string; 
  sublabel?: string;
}) {
  return (
    <div className="bg-white rounded-xl p-3">
      <div className="flex items-center gap-1 mb-1">
        {icon}
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <p className="font-bold text-lg text-gray-900">{value}</p>
      {sublabel && <p className="text-xs text-gray-400">{sublabel}</p>}
    </div>
  );
}

// Legend Item
function LegendItem({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <div className="flex items-center gap-1">
      <div 
        className="w-4 h-0.5" 
        style={{ 
          backgroundColor: color,
          borderStyle: dashed ? 'dashed' : 'solid'
        }} 
      />
      <span className="text-xs text-gray-600">{label}</span>
    </div>
  );
}

// GDD Milestone
function GDDMilestone({ label, gdd, current }: { label: string; gdd: number; current: number }) {
  const progress = Math.min(100, (current / gdd) * 100);
  const completed = current >= gdd;
  
  return (
    <div className="bg-gray-50 rounded-lg p-2">
      <div className="flex justify-between items-center mb-1">
        <span className="text-gray-700">{label}</span>
        <span className={`text-xs font-medium ${completed ? "text-green-600" : "text-gray-500"}`}>
          {gdd} GDD
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-1.5">
        <div 
          className={`h-1.5 rounded-full transition-all ${completed ? "bg-green-500" : "bg-yellow-500"}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
