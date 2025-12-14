import { Cloud, CloudRain, CloudSnow, CloudFog, Sun, Wind, Droplets, Thermometer } from "lucide-react";

interface CurrentWeather {
  temperature: number;
  humidity: number;
  precipitation: number;
  windSpeed: number;
  windDirection: number;
  weatherCode: number;
  isDay: boolean;
}

interface WeatherWidgetProps {
  current: CurrentWeather;
  location?: string;
  compact?: boolean;
}

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

function getWeatherIcon(code: number, isDay: boolean = true, size: string = "h-8 w-8") {
  if (code === 0) return isDay ? <Sun className={`${size} text-yellow-500`} /> : <Cloud className={`${size} text-gray-400`} />;
  if (code <= 3) return <Cloud className={`${size} text-gray-400`} />;
  if (code <= 48) return <CloudFog className={`${size} text-gray-400`} />;
  if (code <= 55) return <CloudRain className={`${size} text-blue-400`} />;
  if (code <= 65) return <CloudRain className={`${size} text-blue-500`} />;
  if (code <= 75) return <CloudSnow className={`${size} text-blue-200`} />;
  if (code <= 82) return <CloudRain className={`${size} text-blue-600`} />;
  return <CloudRain className={`${size} text-purple-500`} />;
}

function getWindDirection(degrees: number): string {
  const directions = ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO'];
  const index = Math.round(degrees / 45) % 8;
  return directions[index];
}

export function WeatherWidget({ current, location, compact = false }: WeatherWidgetProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-blue-500/10 to-sky-500/10 rounded-lg border border-blue-200/50">
        {getWeatherIcon(current.weatherCode, current.isDay, "h-10 w-10")}
        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold">{current.temperature.toFixed(0)}°C</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {weatherCodeDescriptions[current.weatherCode] || ""}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Droplets className="h-4 w-4 text-blue-500" />
            <span>{current.humidity}%</span>
          </div>
          <div className="flex items-center gap-1">
            <Wind className="h-4 w-4" />
            <span>{current.windSpeed.toFixed(0)} km/h</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gradient-to-br from-blue-500/10 via-sky-500/5 to-transparent rounded-xl border border-blue-200/50">
      {location && (
        <p className="text-sm text-muted-foreground mb-3">{location}</p>
      )}
      <div className="flex items-center gap-4">
        {getWeatherIcon(current.weatherCode, current.isDay, "h-16 w-16")}
        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold">{current.temperature.toFixed(0)}</span>
            <span className="text-2xl text-muted-foreground">°C</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {weatherCodeDescriptions[current.weatherCode] || "Desconhecido"}
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-4 mt-4">
        <div className="flex items-center gap-2">
          <Droplets className="h-5 w-5 text-blue-500" />
          <div>
            <p className="text-xs text-muted-foreground">Umidade</p>
            <p className="text-sm font-medium">{current.humidity}%</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Wind className="h-5 w-5 text-gray-500" />
          <div>
            <p className="text-xs text-muted-foreground">Vento</p>
            <p className="text-sm font-medium">
              {current.windSpeed.toFixed(0)} km/h {getWindDirection(current.windDirection)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CloudRain className="h-5 w-5 text-blue-400" />
          <div>
            <p className="text-xs text-muted-foreground">Precipitação</p>
            <p className="text-sm font-medium">{current.precipitation.toFixed(1)} mm</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Mini weather badge for field cards
export function WeatherBadge({ temperature, weatherCode, isDay = true }: { 
  temperature: number; 
  weatherCode: number; 
  isDay?: boolean;
}) {
  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-background/80 backdrop-blur-sm rounded-full border text-sm">
      {getWeatherIcon(weatherCode, isDay, "h-4 w-4")}
      <span className="font-medium">{temperature.toFixed(0)}°</span>
    </div>
  );
}
