/**
 * Serviço de integração com a API Agromonitoring
 * Documentação: https://agromonitoring.com/api/
 */

import { ENV } from "../_core/env";

const AGRO_BASE_URL = "https://api.agromonitoring.com/agro/1.0";

export interface AgroPolygon {
  id: string;
  name: string;
  center: [number, number];
  area: number;
  user_id: string;
  created_at: number;
  geo_json: {
    type: string;
    properties: Record<string, unknown>;
    geometry: {
      type: string;
      coordinates: number[][][];
    };
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

export interface AgroNdviStats {
  dt: number;
  source: string;
  dc: number;
  cl: number;
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

/**
 * Obtém a API key do Agromonitoring
 */
function getApiKey(): string {
  const apiKey = ENV.agromonitoringApiKey || process.env.AGROMONITORING_API_KEY;
  if (!apiKey) {
    console.error("[Agromonitoring] API key não configurada");
    throw new Error("AGROMONITORING_API_KEY não configurada");
  }
  console.log("[Agromonitoring] Usando API key:", apiKey.substring(0, 8) + "...");
  return apiKey;
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
 * Cria um novo polígono
 */
export async function createPolygon(
  name: string,
  coordinates: Array<{ lat: number; lng: number }>
): Promise<AgroPolygon> {
  const apiKey = getApiKey();
  
  // Converter para formato GeoJSON
  const geoJsonCoords = coordinates.map(c => [c.lng, c.lat]);
  // Fechar o polígono se necessário
  if (geoJsonCoords[0][0] !== geoJsonCoords[geoJsonCoords.length - 1][0] ||
      geoJsonCoords[0][1] !== geoJsonCoords[geoJsonCoords.length - 1][1]) {
    geoJsonCoords.push(geoJsonCoords[0]);
  }
  
  const body = {
    name,
    geo_json: {
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [geoJsonCoords],
      },
    },
  };
  
  const response = await fetch(`${AGRO_BASE_URL}/polygons?appid=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erro ao criar polígono: ${response.status} - ${error}`);
  }
  
  return response.json();
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
    throw new Error(`Erro ao buscar histórico NDVI: ${response.status}`);
  }

  return response.json();
}

/**
 * Busca a melhor imagem NDVI disponível para um polígono
 */
export async function getBestNdviImage(
  polygonId: string,
  maxCloudCoverage: number = 50
): Promise<AgroSatelliteImage | null> {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 60 * 24 * 60 * 60 * 1000); // 60 dias
  
  const images = await searchSatelliteImages(polygonId, startDate, endDate);
  
  if (images.length === 0) return null;
  
  // Filtrar por cobertura de nuvens e ordenar
  const sortedImages = images
    .filter(img => img.cl < maxCloudCoverage)
    .sort((a, b) => {
      const cloudDiff = a.cl - b.cl;
      if (Math.abs(cloudDiff) > 15) return cloudDiff;
      return b.dt - a.dt;
    });
  
  // Se não há imagens com menos nuvens, pegar a melhor disponível
  if (sortedImages.length === 0) {
    return images.sort((a, b) => a.cl - b.cl)[0];
  }
  
  return sortedImages[0];
}

/**
 * Faz proxy de uma imagem NDVI (para evitar CORS)
 */
export async function proxyNdviImage(imageUrl: string): Promise<Buffer> {
  const httpsUrl = imageUrl.replace("http://", "https://");
  const response = await fetch(httpsUrl);
  
  if (!response.ok) {
    throw new Error(`Erro ao buscar imagem: ${response.status}`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
