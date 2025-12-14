import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Cloud, 
  Droplets, 
  Wind, 
  Thermometer,
  Sun,
  CloudRain,
  CloudSnow,
  CloudFog,
  AlertTriangle,
  RefreshCw
} from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Weather code descriptions (WMO codes)
const weatherCodeDescriptions: Record<number, string> = {
  0: 'Céu limpo',
  1: 'Principalmente limpo',
  2: 'Parcialmente nublado',
  3: 'Nublado',
  45: 'Neblina',
  48: 'Neblina com geada',
  51: 'Garoa leve',
  53: 'Garoa moderada',
  55: 'Garoa intensa',
  61: 'Chuva leve',
  63: 'Chuva moderada',
  65: 'Chuva forte',
  71: 'Neve leve',
  73: 'Neve moderada',
  75: 'Neve forte',
  80: 'Pancadas leves',
  81: 'Pancadas moderadas',
  82: 'Pancadas fortes',
  95: 'Tempestade',
  96: 'Tempestade com granizo leve',
  99: 'Tempestade com granizo forte',
};

function getWeatherIconByCode(code: number, isDay: boolean = true) {
  const iconClass = "h-10 w-10 mx-auto";
  
  if (code === 0) return isDay ? <Sun className={`${iconClass} text-yellow-500`} /> : <Cloud className={`${iconClass} text-gray-400`} />;
  if (code <= 3) return <Cloud className={`${iconClass} text-gray-400`} />;
  if (code <= 48) return <CloudFog className={`${iconClass} text-gray-400`} />;
  if (code <= 55) return <CloudRain className={`${iconClass} text-blue-400`} />;
  if (code <= 65) return <CloudRain className={`${iconClass} text-blue-500`} />;
  if (code <= 75) return <CloudSnow className={`${iconClass} text-blue-200`} />;
  if (code <= 82) return <CloudRain className={`${iconClass} text-blue-600`} />;
  return <CloudRain className={`${iconClass} text-purple-500`} />;
}

export default function Weather() {
  const [selectedFieldId, setSelectedFieldId] = useState<number | null>(null);

  const { data: fields } = trpc.fields.list.useQuery();
  const { data: weather, isLoading, refetch, isFetching } = trpc.weather.getByField.useQuery(
    { fieldId: selectedFieldId! },
    { enabled: !!selectedFieldId }
  );
  const { data: alerts } = trpc.weather.getAlerts.useQuery(
    undefined,
    { enabled: !!selectedFieldId }
  );

  const selectedField = fields?.find(f => f.id === selectedFieldId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clima</h1>
          <p className="text-muted-foreground">
            Previsão do tempo e alertas climáticos
          </p>
        </div>
        {selectedFieldId && (
          <Button 
            variant="outline" 
            onClick={() => refetch()} 
            disabled={isFetching}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        )}
      </div>

      {/* Field Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Selecione um Campo</CardTitle>
          <CardDescription>
            Escolha o campo para ver a previsão do tempo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={selectedFieldId?.toString() || ""}
            onValueChange={(value) => setSelectedFieldId(parseInt(value))}
          >
            <SelectTrigger className="max-w-md">
              <SelectValue placeholder="Selecione um campo" />
            </SelectTrigger>
            <SelectContent>
              {fields?.map((field) => (
                <SelectItem key={field.id} value={field.id.toString()}>
                  {field.name} {field.city && `- ${field.city}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Weather Content */}
      {selectedFieldId ? (
        <>
          {/* Alerts */}
          {alerts && alerts.length > 0 && (
            <Card className="border-yellow-500/50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-yellow-600">
                  <AlertTriangle className="h-5 w-5" />
                  Alertas Climáticos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {alerts.map((alert) => (
                    <div 
                      key={alert.id} 
                      className={`p-4 rounded-lg ${
                        alert.severity === "critical" ? "bg-destructive/10 border border-destructive/30" :
                        alert.severity === "warning" ? "bg-yellow-50 border border-yellow-200" :
                        "bg-blue-50 border border-blue-200"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-yellow-600" />
                        <div>
                          <p className="font-medium">{alert.title}</p>
                          <p className="text-sm text-muted-foreground">{alert.message}</p>
                          {alert.validFrom && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(alert.validFrom), "dd/MM 'às' HH:mm", { locale: ptBR })}
                              {alert.validUntil && ` - ${format(new Date(alert.validUntil), "dd/MM 'às' HH:mm", { locale: ptBR })}`}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Current Conditions */}
          {weather && weather.current && (
            <Card>
              <CardHeader>
                <CardTitle>Condições Atuais</CardTitle>
                <CardDescription>
                  {selectedField?.name} - {selectedField?.city || "Localização não definida"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="flex items-center gap-4 p-4 rounded-lg bg-muted">
                    <Thermometer className="h-8 w-8 text-orange-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">Temperatura</p>
                      <p className="text-2xl font-bold">
                        {weather.current.temperature?.toFixed(0)}°C
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-4 rounded-lg bg-muted">
                    <Droplets className="h-8 w-8 text-blue-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">Umidade</p>
                      <p className="text-2xl font-bold">
                        {weather.current.humidity}%
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-4 rounded-lg bg-muted">
                    <Wind className="h-8 w-8 text-gray-500" />
                    <div>
                      <p className="text-sm text-muted-foreground">Vento</p>
                      <p className="text-2xl font-bold">
                        {weather.current.windSpeed?.toFixed(0)} km/h
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-4 rounded-lg bg-muted">
                    <CloudRain className="h-8 w-8 text-blue-400" />
                    <div>
                      <p className="text-sm text-muted-foreground">Precipitação</p>
                      <p className="text-2xl font-bold">
                        {weather.current.precipitation?.toFixed(1) || "0"} mm
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-4 p-4 rounded-lg bg-muted/50 flex items-center gap-4">
                  {getWeatherIconByCode(weather.current.weatherCode, weather.current.isDay)}
                  <div>
                    <p className="font-medium">{weatherCodeDescriptions[weather.current.weatherCode] || "Desconhecido"}</p>
                    <p className="text-sm text-muted-foreground">
                      Atualizado agora
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 7-Day Forecast */}
          <Card>
            <CardHeader>
              <CardTitle>Previsão para 7 Dias</CardTitle>
              <CardDescription>
                Condições climáticas esperadas para os próximos dias
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="grid gap-4 md:grid-cols-7">
                  {[...Array(7)].map((_, i) => (
                    <Skeleton key={i} className="h-40" />
                  ))}
                </div>
              ) : weather && weather.daily && weather.daily.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-7">
                  {weather.daily.map((day, index) => (
                    <div 
                      key={index} 
                      className={`p-4 rounded-lg border text-center ${
                        index === 0 ? "bg-primary/5 border-primary/20" : ""
                      }`}
                    >
                      <p className="text-sm font-medium mb-2">
                        {index === 0 
                          ? "Hoje" 
                          : format(new Date(day.date), "EEE", { locale: ptBR })}
                      </p>
                      <p className="text-xs text-muted-foreground mb-3">
                        {format(new Date(day.date), "dd/MM")}
                      </p>
                      {getWeatherIconByCode(day.weatherCode)}
                      <p className="text-xs text-muted-foreground mt-2">
                        {weatherCodeDescriptions[day.weatherCode] || ""}
                      </p>
                      <div className="mt-3">
                        <p className="text-lg font-bold">
                          {day.temperatureMax?.toFixed(0)}°
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {day.temperatureMin?.toFixed(0)}°
                        </p>
                      </div>
                      {day.precipitation > 0 && (
                        <div className="flex items-center justify-center gap-1 mt-2 text-xs text-blue-500">
                          <Droplets className="h-3 w-3" />
                          {day.precipitation.toFixed(1)}mm
                        </div>
                      )}
                      {day.precipitationProbability > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {day.precipitationProbability}% chance
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <Cloud className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="font-medium">Dados climáticos não disponíveis</p>
                  <p className="text-sm text-muted-foreground">
                    Verifique se o campo possui coordenadas definidas
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Agricultural Recommendations */}
          {weather && weather.daily && weather.daily.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recomendações Agrícolas</CardTitle>
                <CardDescription>
                  Sugestões baseadas nas condições climáticas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {getAgriculturalRecommendations(weather.daily, weather.current).map((rec, index) => (
                    <div key={index} className="flex items-start gap-3 p-4 rounded-lg bg-muted">
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${rec.iconBg}`}>
                        {rec.icon}
                      </div>
                      <div>
                        <p className="font-medium">{rec.title}</p>
                        <p className="text-sm text-muted-foreground">{rec.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Cloud className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">Selecione um campo</h3>
            <p className="text-muted-foreground text-center">
              Escolha um campo acima para ver a previsão do tempo
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface DailyWeather {
  date: string;
  temperatureMax: number;
  temperatureMin: number;
  precipitation: number;
  precipitationProbability: number;
  weatherCode: number;
}

interface CurrentWeather {
  temperature: number;
  humidity: number;
  precipitation: number;
  windSpeed: number;
  windDirection: number;
  weatherCode: number;
  isDay: boolean;
}

function getAgriculturalRecommendations(daily: DailyWeather[], current?: CurrentWeather) {
  const recommendations = [];
  
  const todayWeather = daily[0];
  const hasRainComing = daily.slice(0, 3).some(w => w.precipitation > 5);
  const isHot = todayWeather?.temperatureMax > 35;
  const isCold = todayWeather?.temperatureMin < 10;
  const isWindy = current?.windSpeed && current.windSpeed > 30;
  
  if (hasRainComing) {
    recommendations.push({
      icon: <CloudRain className="h-4 w-4 text-blue-500" />,
      iconBg: "bg-blue-100",
      title: "Chuva prevista",
      description: "Considere adiar aplicações de defensivos. Aproveite para verificar sistemas de drenagem."
    });
  }
  
  if (isHot) {
    recommendations.push({
      icon: <Sun className="h-4 w-4 text-orange-500" />,
      iconBg: "bg-orange-100",
      title: "Temperaturas elevadas",
      description: "Priorize irrigações no início da manhã ou final da tarde para reduzir evaporação."
    });
  }
  
  if (isCold) {
    recommendations.push({
      icon: <Thermometer className="h-4 w-4 text-blue-400" />,
      iconBg: "bg-blue-100",
      title: "Temperaturas baixas",
      description: "Monitore culturas sensíveis a geadas. Considere medidas de proteção se necessário."
    });
  }
  
  if (isWindy) {
    recommendations.push({
      icon: <Wind className="h-4 w-4 text-gray-500" />,
      iconBg: "bg-gray-100",
      title: "Ventos fortes",
      description: "Evite aplicações de defensivos para prevenir deriva. Verifique estruturas e coberturas."
    });
  }
  
  if (!hasRainComing && !isHot && !isWindy) {
    recommendations.push({
      icon: <Sun className="h-4 w-4 text-green-500" />,
      iconBg: "bg-green-100",
      title: "Condições favoráveis",
      description: "Bom momento para aplicações de defensivos e fertilizantes foliares."
    });
  }
  
  recommendations.push({
    icon: <Droplets className="h-4 w-4 text-blue-500" />,
    iconBg: "bg-blue-100",
    title: "Monitoramento de umidade",
    description: "Verifique regularmente a umidade do solo para otimizar a irrigação."
  });
  
  return recommendations;
}
