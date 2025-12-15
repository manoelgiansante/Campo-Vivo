/**
 * Open-Meteo Weather Service
 * API gratuita de clima - https://open-meteo.com
 */

import { z } from 'zod';

const OpenMeteoResponseSchema = z.object({
  hourly: z.object({
    time: z.array(z.string()),
    temperature_2m: z.array(z.number()),
    precipitation: z.array(z.number()),
    relativehumidity_2m: z.array(z.number()),
    windspeed_10m: z.array(z.number()),
  }),
  daily: z.object({
    time: z.array(z.string()),
    temperature_2m_max: z.array(z.number()),
    temperature_2m_min: z.array(z.number()),
    precipitation_sum: z.array(z.number()),
    weathercode: z.array(z.number()),
  }),
});

export type WeatherForecast = z.infer<typeof OpenMeteoResponseSchema>;

/**
 * Busca previsão do tempo do Open-Meteo (gratuito, sem API key)
 */
export async function getWeatherForecast(lat: number, lng: number): Promise<WeatherForecast> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', lat.toString());
  url.searchParams.set('longitude', lng.toString());
  url.searchParams.set('hourly', 'temperature_2m,precipitation,relativehumidity_2m,windspeed_10m');
  url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode');
  url.searchParams.set('timezone', 'America/Sao_Paulo');
  url.searchParams.set('forecast_days', '7');
  
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Open-Meteo error: ${response.status}`);
  }
  
  const data = await response.json();
  return OpenMeteoResponseSchema.parse(data);
}

/**
 * Mapeia weathercode do Open-Meteo para descrição em português
 */
export function getWeatherDescription(code: number): string {
  const descriptions: Record<number, string> = {
    0: 'Céu limpo',
    1: 'Parcialmente nublado',
    2: 'Nublado',
    3: 'Encoberto',
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
  return descriptions[code] || 'Desconhecido';
}

/**
 * Mapeia weathercode para ícone do clima
 */
export function getWeatherIcon(code: number): string {
  if (code === 0) return '01d';
  if (code <= 3) return '02d';
  if (code <= 48) return '50d';
  if (code <= 55) return '09d';
  if (code <= 65) return '10d';
  if (code <= 75) return '13d';
  if (code <= 82) return '09d';
  return '11d';
}

/**
 * Formata previsão para exibição no app
 */
export function formatForecastForApp(forecast: WeatherForecast) {
  const dailyForecasts = forecast.daily.time.map((date, index) => ({
    date,
    temperature: Math.round((forecast.daily.temperature_2m_max[index] + forecast.daily.temperature_2m_min[index]) / 2),
    tempMin: Math.round(forecast.daily.temperature_2m_min[index]),
    tempMax: Math.round(forecast.daily.temperature_2m_max[index]),
    precipitation: Math.round(forecast.daily.precipitation_sum[index]),
    description: getWeatherDescription(forecast.daily.weathercode[index]),
    icon: getWeatherIcon(forecast.daily.weathercode[index]),
    weathercode: forecast.daily.weathercode[index],
  }));

  // Calcular médias
  const currentHourIndex = new Date().getHours();
  const currentTemp = Math.round(forecast.hourly.temperature_2m[currentHourIndex] || forecast.hourly.temperature_2m[0]);
  const currentHumidity = Math.round(forecast.hourly.relativehumidity_2m[currentHourIndex] || forecast.hourly.relativehumidity_2m[0]);
  const currentWind = Math.round(forecast.hourly.windspeed_10m[currentHourIndex] || forecast.hourly.windspeed_10m[0]);

  return {
    current: {
      temperature: currentTemp,
      humidity: currentHumidity,
      windSpeed: currentWind,
      description: getWeatherDescription(forecast.daily.weathercode[0]),
      icon: getWeatherIcon(forecast.daily.weathercode[0]),
    },
    daily: dailyForecasts,
  };
}
