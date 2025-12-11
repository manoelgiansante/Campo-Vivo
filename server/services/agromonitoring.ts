/**
 * Serviço de integração com Agromonitoring API
 * https://agromonitoring.com/api
 * 
 * Plano Free: 10 polígonos, 1.000 ha, 60 chamadas/min
 */

import { ENV } from "../_core/env";
import type { Field } from "../../drizzle/schema";
import * as db from "../db";

const AGRO_BASE_URL = "https://api.agromonitoring.com/agro/1.0";

// Tipos
export interface AgroPolygon {
  id: string;
  name: string;
  center: [number, number];
  area: number; // hectares
  user_id: string;
  created_at: number;
}

export interface AgroNdviStats {
  dt: number; // Unix timestamp
  source: string;
  dc: number; // Data coverage (0-100)
  cl: number; // Cloud coverage (0-100)
  data: {
    std: number;
    p75: number;
    min: number;
    max: number;
    median: number;
    p25: number;
    num: number;
    mean: number;
  };
}

export interface AgroSatelliteImage {
  dt: number;
  type: string;
  dc: number;
  cl: number;
  sun: {
    elevation: number;
    azimuth: number;
  };
  image: {
    truecolor: string;
    falsecolor: string;
    ndvi: string;
    evi: string;
  };
  tile: {
    truecolor: string;
    falsecolor: string;
    ndvi: string;
    evi: string;
  };
  stats: {
    ndvi: string;
    evi: string;
  };
  data: {
    truecolor: string;
    falsecolor: string;
    ndvi: string;
    evi: string;
  };
}

/**
 * Obtém a API key do Agromonitoring
 */
function getApiKey(): string {
  const apiKey = ENV.agromonitoringApiKey || process.env.AGROMONITORING_API_KEY;
  if (!apiKey) {
    throw new Error("AGROMONITORING_API_KEY não configurada");
  }
  return apiKey;
}

/**
 * Verifica se a API do Agromonitoring está configurada
 */
export function isAgromonitoringConfigured(): boolean {
  return !!(ENV.agromonitoringApiKey || process.env.AGROMONITORING_API_KEY);
}

/**
 * Cria um polígono (campo) no Agromonitoring
 */
export async function createPolygon(
  name: string,
  coordinates: [number, number][]
): Promise<AgroPolygon> {
  const apiKey = getApiKey();
  
  // Garantir que o polígono está fechado (primeiro ponto = último)
  const closedCoords = [...coordinates];
  if (
    closedCoords[0][0] !== closedCoords[closedCoords.length - 1][0] ||
    closedCoords[0][1] !== closedCoords[closedCoords.length - 1][1]
  ) {
    closedCoords.push(closedCoords[0]);
  }

  const response = await fetch(`${AGRO_BASE_URL}/polygons?appid=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      geo_json: {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [closedCoords],
        },
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Agromonitoring createPolygon error:", error);
    throw new Error(`Erro ao criar polígono: ${response.status}`);
  }

  return response.json();
}

/**
 * Lista todos os polígonos do usuário
 */
export async function listPolygons(): Promise<AgroPolygon[]> {
  const apiKey = getApiKey();
  
  const response = await fetch(`${AGRO_BASE_URL}/polygons?appid=${apiKey}`);

  if (!response.ok) {
    throw new Error(`Erro ao listar polígonos: ${response.status}`);
  }

  return response.json();
}

/**
 * Obtém um polígono específico
 */
export async function getPolygon(polygonId: string): Promise<AgroPolygon> {
  const apiKey = getApiKey();
  
  const response = await fetch(
    `${AGRO_BASE_URL}/polygons/${polygonId}?appid=${apiKey}`
  );

  if (!response.ok) {
    throw new Error(`Erro ao buscar polígono: ${response.status}`);
  }

  return response.json();
}

/**
 * Deleta um polígono
 */
export async function deletePolygon(polygonId: string): Promise<void> {
  const apiKey = getApiKey();
  
  const response = await fetch(
    `${AGRO_BASE_URL}/polygons/${polygonId}?appid=${apiKey}`,
    { method: "DELETE" }
  );

  if (!response.ok) {
    throw new Error(`Erro ao deletar polígono: ${response.status}`);
  }
}

/**
 * Busca imagens de satélite disponíveis para um polígono
 */
export async function searchSatelliteImages(
  polygonId: string,
  startDate: Date,
  endDate: Date
): Promise<AgroSatelliteImage[]> {
  const apiKey = getApiKey();
  
  const start = Math.floor(startDate.getTime() / 1000);
  const end = Math.floor(endDate.getTime() / 1000);

  const response = await fetch(
    `${AGRO_BASE_URL}/image/search?polyid=${polygonId}&start=${start}&end=${end}&appid=${apiKey}`
  );

  if (!response.ok) {
    throw new Error(`Erro ao buscar imagens: ${response.status}`);
  }

  return response.json();
}

/**
 * Busca histórico de NDVI para um polígono
 */
export async function getNdviHistory(
  polygonId: string,
  startDate?: Date,
  endDate?: Date
): Promise<AgroNdviStats[]> {
  const apiKey = getApiKey();
  
  let url = `${AGRO_BASE_URL}/ndvi/history?polyid=${polygonId}&appid=${apiKey}`;
  
  if (startDate) {
    url += `&start=${Math.floor(startDate.getTime() / 1000)}`;
  }
  if (endDate) {
    url += `&end=${Math.floor(endDate.getTime() / 1000)}`;
  }

  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.text();
    console.error("Agromonitoring NDVI history error:", error);
    throw new Error(`Erro ao buscar histórico NDVI: ${response.status}`);
  }

  return response.json();
}

/**
 * Busca estatísticas NDVI atuais para um polígono
 */
export async function getCurrentNdvi(polygonId: string): Promise<AgroNdviStats | null> {
  const apiKey = getApiKey();
  
  const response = await fetch(
    `${AGRO_BASE_URL}/ndvi?polyid=${polygonId}&appid=${apiKey}`
  );

  if (!response.ok) {
    if (response.status === 404) {
      return null; // Sem dados disponíveis ainda
    }
    throw new Error(`Erro ao buscar NDVI atual: ${response.status}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data[0] : data;
}

/**
 * Busca dados de solo para um polígono
 */
export async function getSoilData(polygonId: string): Promise<any> {
  const apiKey = getApiKey();
  
  const response = await fetch(
    `${AGRO_BASE_URL}/soil?polyid=${polygonId}&appid=${apiKey}`
  );

  if (!response.ok) {
    throw new Error(`Erro ao buscar dados de solo: ${response.status}`);
  }

  return response.json();
}

/**
 * Busca previsão do tempo para uma localização
 */
export async function getWeatherForecast(lat: number, lon: number): Promise<any> {
  const apiKey = getApiKey();
  
  const response = await fetch(
    `${AGRO_BASE_URL}/weather/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}`
  );

  if (!response.ok) {
    throw new Error(`Erro ao buscar previsão: ${response.status}`);
  }

  return response.json();
}

/**
 * Converte boundaries do campo para coordenadas do Agromonitoring
 * Agromonitoring espera [longitude, latitude], não [latitude, longitude]
 */
export function convertBoundariesToCoordinates(
  boundaries: any
): [number, number][] {
  let points: Array<{ lat?: number; lng?: number; lon?: number } | [number, number]>;

  if (typeof boundaries === "string") {
    points = JSON.parse(boundaries);
  } else {
    points = boundaries;
  }

  if (!Array.isArray(points) || points.length < 3) {
    throw new Error("Boundaries inválidos: mínimo 3 pontos necessários");
  }

  // Converter para formato [lng, lat] que o Agromonitoring espera
  return points.map((p) => {
    if (Array.isArray(p)) {
      return [p[0], p[1]] as [number, number];
    }
    const lng = p.lng ?? p.lon ?? 0;
    const lat = p.lat ?? 0;
    return [lng, lat] as [number, number];
  });
}

/**
 * Calcula o centro de um polígono
 */
export function calculatePolygonCenter(
  coordinates: [number, number][]
): [number, number] {
  const lngs = coordinates.map((c) => c[0]);
  const lats = coordinates.map((c) => c[1]);
  
  return [
    (Math.min(...lngs) + Math.max(...lngs)) / 2,
    (Math.min(...lats) + Math.max(...lats)) / 2,
  ];
}

/**
 * Sincroniza NDVI de um campo específico
 * 1. Cria polígono no Agromonitoring se não existir
 * 2. Busca dados NDVI mais recentes
 * 3. Salva no banco de dados
 */
export async function syncFieldNdvi(field: Field): Promise<boolean> {
  if (!isAgromonitoringConfigured()) {
    throw new Error("Agromonitoring API não configurada");
  }

  // Verifica se o campo tem boundaries
  if (!field.boundaries) {
    console.warn(`Campo ${field.id} não tem polígono definido`);
    return false;
  }

  try {
    let polygonId = field.agroPolygonId;

    // Se não tem polygon id, cria um novo no Agromonitoring
    if (!polygonId) {
      const coordinates = convertBoundariesToCoordinates(field.boundaries);
      const polygon = await createPolygon(field.name, coordinates);
      polygonId = polygon.id;
      
      // Salva o polygon id no campo
      await db.updateFieldAgroPolygonId(field.id, polygonId);
      
      console.log(`Polígono ${polygonId} criado para campo ${field.id}`);
    }

    // Busca NDVI atual
    const ndviData = await getCurrentNdvi(polygonId);
    
    if (ndviData && ndviData.data) {
      // Converte NDVI para inteiro (0-100)
      const ndviValue = Math.round(ndviData.data.mean * 100);
      const ndviMin = Math.round(ndviData.data.min * 100);
      const ndviMax = Math.round(ndviData.data.max * 100);
      const cloudCoverage = Math.round(ndviData.cl);
      
      // Atualiza NDVI atual do campo
      await db.updateFieldNdvi(field.id, ndviValue, polygonId);

      // Salva no histórico
      await db.createNdviHistory({
        fieldId: field.id,
        userId: field.userId,
        ndviValue,
        ndviMin,
        ndviMax,
        cloudCoverage,
        satellite: ndviData.source || "Sentinel-2",
        acquisitionDate: new Date(ndviData.dt * 1000),
      });

      console.log(`NDVI ${ndviValue / 100} sincronizado para campo ${field.id}`);
      return true;
    } else {
      console.warn(`Sem dados NDVI disponíveis para campo ${field.id}`);
      // Mesmo sem dados, atualiza a data de sincronização
      await db.updateFieldNdvi(field.id, field.currentNdvi || 0, polygonId);
      return true;
    }
  } catch (error) {
    console.error(`Erro ao sincronizar NDVI do campo ${field.id}:`, error);
    throw error;
  }
}

/**
 * Sincroniza NDVI de todos os campos fornecidos
 */
export async function syncAllFieldsNdvi(
  fields: Field[]
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const field of fields) {
    try {
      const result = await syncFieldNdvi(field);
      if (result) {
        success++;
      } else {
        failed++;
      }
    } catch (error) {
      console.error(`Erro ao sincronizar campo ${field.id}:`, error);
      failed++;
    }
    
    // Delay para não exceder rate limit (60 req/min)
    await new Promise((resolve) => setTimeout(resolve, 1100));
  }

  return { success, failed };
}

/**
 * Busca histórico de NDVI de um campo nos últimos N dias
 */
export async function getFieldNdviHistory(
  field: Field,
  days: number = 30
): Promise<AgroNdviStats[]> {
  if (!field.agroPolygonId) {
    throw new Error("Campo não tem polígono no Agromonitoring");
  }

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return getNdviHistory(field.agroPolygonId, startDate, endDate);
}
