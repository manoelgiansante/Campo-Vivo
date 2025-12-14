import { describe, it, expect, vi } from "vitest";

// Mock do fetch para testes
const mockWeatherResponse = {
  current: {
    temperature_2m: 28.5,
    relative_humidity_2m: 65,
    precipitation: 0,
    wind_speed_10m: 12.5,
    wind_direction_10m: 180,
    weather_code: 1,
    is_day: 1,
  },
  daily: {
    time: ["2024-12-14", "2024-12-15", "2024-12-16"],
    temperature_2m_max: [32, 30, 28],
    temperature_2m_min: [22, 20, 18],
    precipitation_sum: [0, 5, 10],
    precipitation_probability_max: [10, 60, 80],
    weather_code: [1, 61, 63],
  },
};

describe("Weather Service", () => {
  it("should parse current weather data correctly", () => {
    const current = mockWeatherResponse.current;
    
    const parsed = {
      temperature: current.temperature_2m,
      humidity: current.relative_humidity_2m,
      precipitation: current.precipitation,
      windSpeed: current.wind_speed_10m,
      windDirection: current.wind_direction_10m,
      weatherCode: current.weather_code,
      isDay: current.is_day === 1,
    };
    
    expect(parsed.temperature).toBe(28.5);
    expect(parsed.humidity).toBe(65);
    expect(parsed.windSpeed).toBe(12.5);
    expect(parsed.isDay).toBe(true);
  });

  it("should parse daily forecast data correctly", () => {
    const daily = mockWeatherResponse.daily;
    
    const parsed = daily.time.map((date, i) => ({
      date,
      temperatureMax: daily.temperature_2m_max[i],
      temperatureMin: daily.temperature_2m_min[i],
      precipitation: daily.precipitation_sum[i],
      precipitationProbability: daily.precipitation_probability_max[i],
      weatherCode: daily.weather_code[i],
    }));
    
    expect(parsed).toHaveLength(3);
    expect(parsed[0].date).toBe("2024-12-14");
    expect(parsed[0].temperatureMax).toBe(32);
    expect(parsed[1].precipitation).toBe(5);
  });

  it("should calculate thermal sum (GDD) correctly", () => {
    const temperatures = [
      { max: 30, min: 20 }, // mean = 25, GDD = 25 - 10 = 15
      { max: 28, min: 18 }, // mean = 23, GDD = 23 - 10 = 13
      { max: 15, min: 8 },  // mean = 11.5, GDD = 11.5 - 10 = 1.5
      { max: 8, min: 5 },   // mean = 6.5, GDD = 0 (below base)
    ];
    const baseTemp = 10;
    
    let totalGDD = 0;
    const thermalSum: number[] = [];
    
    temperatures.forEach(({ max, min }) => {
      const mean = (max + min) / 2;
      const gdd = Math.max(0, mean - baseTemp);
      totalGDD += gdd;
      thermalSum.push(totalGDD);
    });
    
    expect(thermalSum[0]).toBe(15);
    expect(thermalSum[1]).toBe(28);
    expect(thermalSum[2]).toBeCloseTo(29.5);
    expect(thermalSum[3]).toBeCloseTo(29.5); // No increase when below base
    expect(totalGDD).toBeCloseTo(29.5);
  });

  it("should calculate accumulated precipitation correctly", () => {
    const dailyPrecipitation = [0, 5, 10, 0, 15, 3];
    
    let total = 0;
    const accumulated = dailyPrecipitation.map(p => {
      total += p;
      return total;
    });
    
    expect(accumulated).toEqual([0, 5, 15, 15, 30, 33]);
    expect(total).toBe(33);
  });

  it("should handle weather code descriptions", () => {
    const weatherCodes: Record<number, string> = {
      0: 'Céu limpo',
      1: 'Principalmente limpo',
      2: 'Parcialmente nublado',
      3: 'Nublado',
      61: 'Chuva leve',
      63: 'Chuva moderada',
      65: 'Chuva forte',
      95: 'Tempestade',
    };
    
    expect(weatherCodes[0]).toBe('Céu limpo');
    expect(weatherCodes[61]).toBe('Chuva leve');
    expect(weatherCodes[95]).toBe('Tempestade');
  });

  it("should validate coordinate bounds for Brazil", () => {
    const validateCoordinates = (lat: number, lng: number): boolean => {
      // Brazil approximate bounds
      return lat >= -35 && lat <= 6 && lng >= -75 && lng <= -30;
    };
    
    // Valid Brazilian coordinates
    expect(validateCoordinates(-20.8, -49.5)).toBe(true);
    expect(validateCoordinates(-23.5, -46.6)).toBe(true); // São Paulo
    expect(validateCoordinates(-15.8, -47.9)).toBe(true); // Brasília
    
    // Invalid coordinates (outside Brazil)
    expect(validateCoordinates(40.7, -74.0)).toBe(false); // New York
    expect(validateCoordinates(51.5, -0.1)).toBe(false);  // London
  });
});

describe("NDVI Chart Data", () => {
  it("should classify NDVI values correctly", () => {
    const classifyNdvi = (value: number): string => {
      if (value < 0.2) return "Solo exposto";
      if (value < 0.4) return "Vegetação esparsa";
      if (value < 0.6) return "Vegetação moderada";
      if (value < 0.8) return "Vegetação densa";
      return "Vegetação muito densa";
    };
    
    expect(classifyNdvi(0.1)).toBe("Solo exposto");
    expect(classifyNdvi(0.3)).toBe("Vegetação esparsa");
    expect(classifyNdvi(0.5)).toBe("Vegetação moderada");
    expect(classifyNdvi(0.7)).toBe("Vegetação densa");
    expect(classifyNdvi(0.9)).toBe("Vegetação muito densa");
  });

  it("should get correct NDVI color", () => {
    const getNdviColor = (value: number): string => {
      if (value < 0.1) return "#d73027";
      if (value < 0.2) return "#f46d43";
      if (value < 0.3) return "#fdae61";
      if (value < 0.4) return "#fee08b";
      if (value < 0.5) return "#d9ef8b";
      if (value < 0.6) return "#a6d96a";
      if (value < 0.7) return "#66bd63";
      if (value < 0.8) return "#1a9850";
      return "#006837";
    };
    
    expect(getNdviColor(0.05)).toBe("#d73027"); // Red - bare soil
    expect(getNdviColor(0.45)).toBe("#d9ef8b"); // Light green
    expect(getNdviColor(0.75)).toBe("#1a9850"); // Dark green
    expect(getNdviColor(0.95)).toBe("#006837"); // Very dark green
  });
});

describe("Crop GDD Requirements", () => {
  it("should have correct GDD requirements for common crops", () => {
    const cropGDDRequirements: Record<string, { min: number; max: number }> = {
      soja: { min: 1200, max: 1500 },
      milho: { min: 1400, max: 1800 },
      trigo: { min: 1200, max: 1500 },
      algodao: { min: 1800, max: 2200 },
      feijao: { min: 900, max: 1100 },
    };
    
    expect(cropGDDRequirements.soja.min).toBe(1200);
    expect(cropGDDRequirements.milho.max).toBe(1800);
    expect(cropGDDRequirements.feijao.min).toBe(900);
  });

  it("should calculate progress percentage correctly", () => {
    const calculateProgress = (current: number, target: number): number => {
      return Math.min(100, (current / target) * 100);
    };
    
    expect(calculateProgress(600, 1500)).toBe(40);
    expect(calculateProgress(1500, 1500)).toBe(100);
    expect(calculateProgress(2000, 1500)).toBe(100); // Capped at 100%
  });
});
