// Open-Meteo Weather Service - Free API, no key required
// Provides current weather, forecast, and historical data

export interface CurrentWeather {
  temperature: number;
  humidity: number;
  precipitation: number;
  windSpeed: number;
  windDirection: number;
  weatherCode: number;
  isDay: boolean;
}

export interface DailyWeather {
  date: string;
  temperatureMax: number;
  temperatureMin: number;
  precipitation: number;
  precipitationProbability: number;
  weatherCode: number;
}

export interface HistoricalData {
  dates: string[];
  precipitation: number[];
  temperatureMax: number[];
  temperatureMin: number[];
  temperatureMean: number[];
}

export interface WeatherData {
  current: CurrentWeather;
  daily: DailyWeather[];
  historical?: HistoricalData;
}

// Weather code descriptions (WMO codes)
export const weatherCodeDescriptions: Record<number, string> = {
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

// Get weather icon based on code
export function getWeatherIcon(code: number, isDay: boolean = true): string {
  if (code === 0) return isDay ? '☀️' : '🌙';
  if (code <= 3) return isDay ? '⛅' : '☁️';
  if (code <= 48) return '🌫️';
  if (code <= 55) return '🌧️';
  if (code <= 65) return '🌧️';
  if (code <= 75) return '❄️';
  if (code <= 82) return '🌦️';
  return '⛈️';
}

// Fetch current weather and 7-day forecast
export async function getCurrentWeather(lat: number, lng: number): Promise<WeatherData> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', lat.toString());
  url.searchParams.set('longitude', lng.toString());
  url.searchParams.set('current', 'temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,is_day');
  url.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max');
  url.searchParams.set('timezone', 'America/Sao_Paulo');
  url.searchParams.set('forecast_days', '7');

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Weather API error: ${response.status}`);
  }

  const data = await response.json();

  return {
    current: {
      temperature: data.current.temperature_2m,
      humidity: data.current.relative_humidity_2m,
      precipitation: data.current.precipitation,
      windSpeed: data.current.wind_speed_10m,
      windDirection: data.current.wind_direction_10m,
      weatherCode: data.current.weather_code,
      isDay: data.current.is_day === 1,
    },
    daily: data.daily.time.map((date: string, i: number) => ({
      date,
      temperatureMax: data.daily.temperature_2m_max[i],
      temperatureMin: data.daily.temperature_2m_min[i],
      precipitation: data.daily.precipitation_sum[i],
      precipitationProbability: data.daily.precipitation_probability_max[i],
      weatherCode: data.daily.weather_code[i],
    })),
  };
}

// Fetch historical weather data for a date range
export async function getHistoricalWeather(
  lat: number,
  lng: number,
  startDate: string,
  endDate: string
): Promise<HistoricalData> {
  const url = new URL('https://archive-api.open-meteo.com/v1/archive');
  url.searchParams.set('latitude', lat.toString());
  url.searchParams.set('longitude', lng.toString());
  url.searchParams.set('start_date', startDate);
  url.searchParams.set('end_date', endDate);
  url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum');
  url.searchParams.set('timezone', 'America/Sao_Paulo');

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Historical weather API error: ${response.status}`);
  }

  const data = await response.json();

  return {
    dates: data.daily.time,
    precipitation: data.daily.precipitation_sum,
    temperatureMax: data.daily.temperature_2m_max,
    temperatureMin: data.daily.temperature_2m_min,
    temperatureMean: data.daily.temperature_2m_mean,
  };
}

// Calculate accumulated precipitation for a period
export function calculateAccumulatedPrecipitation(precipitation: number[]): number[] {
  const accumulated: number[] = [];
  let total = 0;
  for (const p of precipitation) {
    total += p || 0;
    accumulated.push(Math.round(total * 10) / 10);
  }
  return accumulated;
}

// Calculate thermal sum (GDD - Growing Degree Days)
// Base temperature for most crops is 10°C
export function calculateThermalSum(
  temperatureMax: number[],
  temperatureMin: number[],
  baseTemp: number = 10
): number[] {
  const thermalSum: number[] = [];
  let total = 0;
  for (let i = 0; i < temperatureMax.length; i++) {
    const avgTemp = (temperatureMax[i] + temperatureMin[i]) / 2;
    const gdd = Math.max(0, avgTemp - baseTemp);
    total += gdd;
    thermalSum.push(Math.round(total));
  }
  return thermalSum;
}

// Get wind direction as text
export function getWindDirection(degrees: number): string {
  const directions = ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO'];
  const index = Math.round(degrees / 45) % 8;
  return directions[index];
}
