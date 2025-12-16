import { ENV } from "../_core/env";

interface SentinelHubToken {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface NDVIDataPoint {
  date: string; // ISO format
  ndvi: number;
  min: number;
  max: number;
  mean: number;
  stDev: number;
  sampleCount: number;
}

export interface FieldGeometry {
  type: "Polygon";
  coordinates: number[][][];
}

// Cache do token de autenticação
let tokenCache: { token: string; expiresAt: number } | null = null;

/**
 * Obter token de acesso do Sentinel Hub
 */
async function getAccessToken(): Promise<string> {
  // Verificar se o token em cache ainda é válido
  if (tokenCache && tokenCache.expiresAt > Date.now()) {
    return tokenCache.token;
  }

  const clientId = ENV.COPERNICUS_CLIENT_ID;
  const clientSecret = ENV.COPERNICUS_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Credenciais do Copernicus não configuradas");
  }

  const tokenUrl = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token";
  
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erro ao obter token do Sentinel Hub: ${error}`);
  }

  const data: SentinelHubToken = await response.json();

  // Armazenar token em cache (expira 5 minutos antes do tempo real)
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 300) * 1000,
  };

  return data.access_token;
}

/**
 * Buscar série temporal de NDVI para um campo
 * @param geometry Geometria do campo (polígono em coordenadas geográficas WGS84)
 * @param startDate Data inicial (formato ISO)
 * @param endDate Data final (formato ISO)
 * @param aggregationInterval Intervalo de agregação (ex: "P10D" para 10 dias, "P1M" para 1 mês)
 * @returns Array de pontos de dados NDVI
 */
export async function getNDVITimeSeries(
  geometry: FieldGeometry,
  startDate: string,
  endDate: string,
  aggregationInterval: string = "P10D"
): Promise<NDVIDataPoint[]> {
  const token = await getAccessToken();

  // Evalscript para calcular NDVI médio, excluindo nuvens e pixels sem dados
  const evalscript = `
//VERSION=3
function setup() {
  return {
    input: [{
      bands: ["B04", "B08", "SCL", "dataMask"]
    }],
    mosaicking: "ORBIT",
    output: [
      {
        id: "ndvi",
        bands: 1,
        sampleType: "FLOAT32"
      },
      {
        id: "dataMask",
        bands: 1
      }
    ]
  }
}

function evaluatePixel(samples) {
  let validNDVI = [];
  
  for (let i = 0; i < samples.length; i++) {
    // Excluir nuvens (SCL 8, 9, 10) e pixels sem dados
    if (samples[i].dataMask == 1 && 
        samples[i].SCL != 6 &&  // Água
        samples[i].SCL != 8 &&  // Nuvens médias
        samples[i].SCL != 9 &&  // Nuvens altas
        samples[i].SCL != 10 && // Nuvens finas
        samples[i].B04 + samples[i].B08 != 0) {
      
      const ndvi = (samples[i].B08 - samples[i].B04) / (samples[i].B08 + samples[i].B04);
      validNDVI.push(ndvi);
    }
  }
  
  if (validNDVI.length === 0) {
    return {
      ndvi: [0],
      dataMask: [0]
    };
  }
  
  // Calcular média dos valores válidos
  const mean = validNDVI.reduce((a, b) => a + b, 0) / validNDVI.length;
  
  return {
    ndvi: [mean],
    dataMask: [1]
  };
}
`;

  const statsRequest = {
    input: {
      bounds: {
        geometry: geometry,
        properties: {
          crs: "http://www.opengis.net/def/crs/OGC/1.3/CRS84", // WGS84
        },
      },
      data: [
        {
          type: "sentinel-2-l2a",
          dataFilter: {
            mosaickingOrder: "leastCC", // Menor cobertura de nuvens
          },
        },
      ],
    },
    aggregation: {
      timeRange: {
        from: startDate,
        to: endDate,
      },
      aggregationInterval: {
        of: aggregationInterval,
      },
      evalscript: evalscript,
      resx: 10,
      resy: 10,
    },
    calculations: {
      default: {},
    },
  };

  const url = "https://sh.dataspace.copernicus.eu/api/v1/statistics";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(statsRequest),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erro ao buscar dados NDVI do Sentinel Hub: ${error}`);
  }

  const result = await response.json();

  // Processar resposta
  const dataPoints: NDVIDataPoint[] = [];

  if (result.data && Array.isArray(result.data)) {
    for (const item of result.data) {
      if (item.outputs?.ndvi?.bands?.B0?.stats) {
        const stats = item.outputs.ndvi.bands.B0.stats;
        
        // Pular intervalos sem dados válidos
        if (stats.sampleCount === 0 || stats.noDataCount > stats.sampleCount * 0.8) {
          continue;
        }

        dataPoints.push({
          date: item.interval.from,
          ndvi: Number(stats.mean.toFixed(3)),
          min: Number(stats.min.toFixed(3)),
          max: Number(stats.max.toFixed(3)),
          mean: Number(stats.mean.toFixed(3)),
          stDev: Number(stats.stDev.toFixed(3)),
          sampleCount: stats.sampleCount,
        });
      }
    }
  }

  return dataPoints;
}

/**
 * Converter coordenadas de um campo para o formato GeoJSON
 */
export function fieldCoordinatesToGeoJSON(coordinates: string): FieldGeometry {
  try {
    const parsed = JSON.parse(coordinates);
    
    // Se já estiver no formato correto (GeoJSON)
    if (parsed.type === "Polygon" && Array.isArray(parsed.coordinates)) {
      return parsed;
    }

    // Se for um array de objetos {lat, lng} (formato do banco)
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].lat !== undefined) {
      // Converter {lat, lng} para [lng, lat] (formato GeoJSON)
      const geoJsonCoords = parsed.map((point: any) => [point.lng, point.lat]);
      return {
        type: "Polygon",
        coordinates: [geoJsonCoords],
      };
    }

    // Se for um array de arrays [lng, lat] ou [lat, lng]
    if (Array.isArray(parsed) && parsed.length > 0 && Array.isArray(parsed[0])) {
      return {
        type: "Polygon",
        coordinates: [parsed],
      };
    }

    throw new Error("Formato de coordenadas inválido: " + JSON.stringify(parsed).substring(0, 100));
  } catch (error) {
    throw new Error(`Erro ao converter coordenadas: ${error}`);
  }
}
