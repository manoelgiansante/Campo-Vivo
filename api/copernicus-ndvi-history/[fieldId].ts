import type { VercelRequest, VercelResponse } from '@vercel/node';
import postgres from 'postgres';

// Copernicus OAuth credentials
const COPERNICUS_CLIENT_ID = process.env.COPERNICUS_CLIENT_ID || '';
const COPERNICUS_CLIENT_SECRET = process.env.COPERNICUS_CLIENT_SECRET || '';
const TOKEN_URL = 'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token';
const STATISTICAL_API_URL = 'https://sh.dataspace.copernicus.eu/api/v1/statistics';

// Token cache
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) {
    return cachedToken.token;
  }

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: COPERNICUS_CLIENT_ID,
      client_secret: COPERNICUS_CLIENT_SECRET,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Copernicus Stats] Token error:', response.status, errorText);
    throw new Error(`Failed to get Copernicus token: ${response.status}`);
  }

  const data = await response.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
  };

  return cachedToken.token;
}

// Evalscript para calcular estatísticas NDVI
const STATS_EVALSCRIPT = `//VERSION=3
function setup() {
  return {
    input: [{
      bands: ["B04", "B08", "SCL", "dataMask"],
      units: "DN"
    }],
    output: [
      { id: "ndvi", bands: 1, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1 }
    ]
  };
}

function evaluatePixel(samples) {
  // Calcular NDVI
  let ndvi = (samples.B08 - samples.B04) / (samples.B08 + samples.B04);
  
  // Validar
  if (isNaN(ndvi) || !isFinite(ndvi)) {
    return { ndvi: [0], dataMask: [0] };
  }
  
  // Mascarar pixels inválidos (nuvens, sombras, água)
  // SCL: 3=sombra de nuvem, 8=nuvem média, 9=nuvem alta, 10=cirrus, 6=água
  const scl = samples.SCL;
  if (scl === 3 || scl === 8 || scl === 9 || scl === 10 || scl === 6 || samples.dataMask === 0) {
    return { ndvi: [0], dataMask: [0] };
  }
  
  return {
    ndvi: [ndvi],
    dataMask: [1]
  };
}
`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const { fieldId } = req.query;
    const days = parseInt((req.query.days as string) || '365');
    const id = parseInt(fieldId as string);

    console.log(`[Copernicus Stats] Request for field ${id}, days: ${days}`);

    if (!fieldId) {
      return res.status(400).json({ error: 'Field ID is required' });
    }

    if (!COPERNICUS_CLIENT_ID || !COPERNICUS_CLIENT_SECRET) {
      console.error('[Copernicus Stats] Credentials not configured');
      return res.status(500).json({ error: 'Copernicus credentials not configured' });
    }

    if (!process.env.DATABASE_URL) {
      console.error("[Copernicus Stats] DATABASE_URL not configured");
      return res.status(500).json({ error: "Database not configured" });
    }

    // Connect to PostgreSQL directly
    const sql = postgres(process.env.DATABASE_URL, { 
      connect_timeout: 10,
      idle_timeout: 20,
    });

    // Query field directly
    const result = await sql`SELECT id, boundaries FROM fields WHERE id = ${id} LIMIT 1`;
    const field = result[0];

    if (!field) {
      console.log(`[Copernicus Stats] Field ${id} not found`);
      await sql.end();
      return res.status(404).json({ error: 'Field not found' });
    }

    // Parse boundaries
    let boundaries = field.boundaries as { lat: number; lng: number }[];
    if (typeof boundaries === 'string') {
      boundaries = JSON.parse(boundaries);
    }
    
    if (!boundaries || !Array.isArray(boundaries) || boundaries.length < 3) {
      await sql.end();
      return res.status(400).json({ error: 'Field has no valid boundaries' });
    }

    await sql.end();

    // Get access token
    const token = await getAccessToken();

    // Convert polygon to GeoJSON format
    const coordinates = boundaries.map(p => [p.lng, p.lat]);
    if (coordinates[0][0] !== coordinates[coordinates.length - 1][0] || 
        coordinates[0][1] !== coordinates[coordinates.length - 1][1]) {
      coordinates.push(coordinates[0]);
    }

    // Calcular período
    const endDate = new Date();
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Gerar intervalos de 5 dias para ter dados mais frequentes
    const intervals: { from: string; to: string }[] = [];
    const currentDate = new Date(startDate);
    
    while (currentDate < endDate) {
      const intervalStart = new Date(currentDate);
      currentDate.setDate(currentDate.getDate() + 5); // Intervalos de 5 dias
      const intervalEnd = new Date(Math.min(currentDate.getTime(), endDate.getTime()));
      
      intervals.push({
        from: intervalStart.toISOString(),
        to: intervalEnd.toISOString(),
      });
    }

    console.log(`[Copernicus Stats] Requesting ${intervals.length} intervals from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    const requestBody = {
      input: {
        bounds: {
          geometry: {
            type: 'Polygon',
            coordinates: [coordinates],
          },
        },
        data: [
          {
            type: 'sentinel-2-l2a',
            dataFilter: {
              maxCloudCoverage: 50, // Permitir até 50% de nuvens, filtraremos depois
            },
          },
        ],
      },
      aggregation: {
        timeRange: {
          from: startDate.toISOString(),
          to: endDate.toISOString(),
        },
        aggregationInterval: {
          of: "P5D", // Agregação de 5 dias
        },
        evalscript: STATS_EVALSCRIPT,
        resx: 10,
        resy: 10,
      },
      calculations: {
        ndvi: {
          histograms: {
            default: {
              nBins: 20,
              lowEdge: -0.2,
              highEdge: 1.0,
            },
          },
          statistics: {
            default: {
              percentiles: {
                k: [25, 50, 75],
              },
            },
          },
        },
      },
    };

    const response = await fetch(STATISTICAL_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Copernicus Stats] API error:', response.status, errorText);
      return res.status(response.status).json({ 
        error: 'Failed to get NDVI statistics from Copernicus', 
        details: errorText 
      });
    }

    const data = await response.json();
    console.log(`[Copernicus Stats] Received ${data.data?.length || 0} data points`);

    // Processar resposta - extrair NDVI médio de cada intervalo
    const history = (data.data || [])
      .filter((item: any) => {
        // Filtrar intervalos sem dados válidos
        const stats = item.outputs?.ndvi?.bands?.B0?.stats;
        const sampleCount = stats?.sampleCount || 0;
        const noDataCount = stats?.noDataCount || 0;
        const validRatio = sampleCount > 0 ? (sampleCount - noDataCount) / sampleCount : 0;
        return validRatio > 0.3; // Pelo menos 30% de pixels válidos
      })
      .map((item: any) => {
        const stats = item.outputs?.ndvi?.bands?.B0?.stats;
        const interval = item.interval;
        
        // Usar percentil 75 como valor principal (valores mais altos, como OneSoil)
        // Isso representa a vegetação mais saudável do campo
        const ndviValue = stats?.percentiles?.p75 ?? stats?.mean ?? stats?.percentiles?.p50 ?? 0;
        
        // Estimar cobertura de nuvens baseado em pixels sem dados
        const sampleCount = stats?.sampleCount || 1;
        const noDataCount = stats?.noDataCount || 0;
        const cloudCoverage = Math.round((noDataCount / sampleCount) * 100);
        
        return {
          date: interval?.from || new Date().toISOString(),
          dateTo: interval?.to,
          ndvi: Math.max(-0.2, Math.min(1, ndviValue)), // Clampar entre -0.2 e 1
          ndviMean: stats?.mean,
          ndviMin: stats?.min,
          ndviMax: stats?.max,
          ndviStd: stats?.stDev,
          percentile25: stats?.percentiles?.p25,
          percentile75: stats?.percentiles?.p75,
          cloudCoverage,
          sampleCount,
          validPixels: sampleCount - noDataCount,
        };
      })
      .filter((item: any) => item.ndvi > 0) // Remover valores inválidos
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

    console.log(`[Copernicus Stats] Returning ${history.length} valid data points`);

    // Cache por 1 hora
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).json({
      fieldId: id,
      period: {
        from: startDate.toISOString(),
        to: endDate.toISOString(),
        days,
      },
      dataPoints: history.length,
      history,
    });

  } catch (error) {
    console.error('[Copernicus Stats] Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}
