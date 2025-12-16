import type { VercelRequest, VercelResponse } from '@vercel/node';
import postgres from 'postgres';

// Copernicus OAuth credentials
const COPERNICUS_CLIENT_ID = process.env.COPERNICUS_CLIENT_ID || '';
const COPERNICUS_CLIENT_SECRET = process.env.COPERNICUS_CLIENT_SECRET || '';
const TOKEN_URL = 'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token';
const PROCESS_API_URL = 'https://sh.dataspace.copernicus.eu/api/v1/process';

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
    console.error('[Copernicus] Token error:', response.status, errorText);
    throw new Error(`Failed to get Copernicus token: ${response.status}`);
  }

  const data = await response.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
  };

  return cachedToken.token;
}

// NDVI Color Palettes - Cores EXATAS do OneSoil (extraídas da imagem)
// A cor dominante é verde-amarelado vibrante (#9FDF5F a #A8E063)
const PALETTES: Record<string, { value: number; color: number[] }[]> = {
  classic: [
    { value: 0.0, color: [165, 100, 55] },    // Marrom (solo)
    { value: 0.20, color: [190, 150, 70] },   // Marrom claro/bege
    { value: 0.35, color: [230, 210, 90] },   // Amarelo suave
    { value: 0.45, color: [200, 230, 100] },  // Amarelo-verde claro
    { value: 0.55, color: [160, 225, 95] },   // Verde amarelado (#A0E15F)
    { value: 0.65, color: [140, 215, 85] },   // Verde lima vibrante (#8CD755)
    { value: 0.75, color: [115, 200, 75] },   // Verde médio (#73C84B)
    { value: 0.85, color: [85, 175, 65] },    // Verde (#55AF41)
    { value: 1.0, color: [60, 150, 55] },     // Verde escuro
  ],
  contrast: [
    { value: 0.0, color: [165, 100, 55] },
    { value: 0.20, color: [190, 150, 70] },
    { value: 0.35, color: [230, 210, 90] },
    { value: 0.45, color: [200, 230, 100] },
    { value: 0.55, color: [160, 225, 95] },   // Verde amarelado dominante
    { value: 0.65, color: [140, 215, 85] },
    { value: 0.75, color: [115, 200, 75] },
    { value: 0.85, color: [85, 175, 65] },
    { value: 1.0, color: [60, 150, 55] },
  ],
  viridis: [
    { value: 0.0, color: [68, 1, 84] },
    { value: 0.25, color: [59, 82, 139] },
    { value: 0.5, color: [33, 145, 140] },
    { value: 0.75, color: [94, 201, 98] },
    { value: 1.0, color: [253, 231, 37] },
  ],
  onesoil: [
    // Paleta baseada EXATAMENTE nas cores visíveis no OneSoil
    { value: 0.0, color: [165, 100, 55] },    // Marrom (solo exposto)
    { value: 0.20, color: [185, 145, 65] },   // Marrom claro
    { value: 0.30, color: [210, 185, 80] },   // Bege/amarelo escuro
    { value: 0.40, color: [235, 220, 95] },   // Amarelo
    { value: 0.50, color: [195, 235, 100] },  // Amarelo-verde
    { value: 0.58, color: [165, 225, 95] },   // Verde amarelado claro (#A5E15F) 
    { value: 0.66, color: [145, 218, 88] },   // Verde lima (#91DA58) - COR DOMINANTE OneSoil
    { value: 0.74, color: [120, 205, 78] },   // Verde lima médio (#78CD4E)
    { value: 0.82, color: [95, 185, 68] },    // Verde (#5FB944)
    { value: 0.90, color: [75, 165, 58] },    // Verde médio
    { value: 1.0, color: [55, 140, 50] },     // Verde escuro
  ],
  pasture: [
    { value: 0.0, color: [165, 100, 55] },
    { value: 0.3, color: [200, 170, 90] },
    { value: 0.5, color: [165, 225, 95] },
    { value: 0.7, color: [120, 200, 75] },
    { value: 0.9, color: [75, 160, 55] },
  ],
};

function generateEvalscript(paletteKey: string = 'contrast'): string {
  const palette = PALETTES[paletteKey] || PALETTES.contrast;
  const colorStops = palette.map(c => `[${c.value}, [${c.color.join(', ')}]]`).join(',\n    ');

  return `//VERSION=3
function setup() {
  return {
    input: ["B04", "B08", "SCL", "dataMask"],
    output: { bands: 4 }
  };
}

function evaluatePixel(sample) {
  let ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04);
  
  if (isNaN(ndvi) || !isFinite(ndvi)) {
    return [0, 0, 0, 0];
  }
  
  ndvi = Math.max(0, Math.min(1, (ndvi + 0.2) / 1.0));
  
  const colorStops = [
    ${colorStops}
  ];
  
  let color = colorStops[0][1];
  for (let i = 0; i < colorStops.length - 1; i++) {
    if (ndvi >= colorStops[i][0] && ndvi <= colorStops[i + 1][0]) {
      const t = (ndvi - colorStops[i][0]) / (colorStops[i + 1][0] - colorStops[i][0]);
      color = [
        colorStops[i][1][0] + t * (colorStops[i + 1][1][0] - colorStops[i][1][0]),
        colorStops[i][1][1] + t * (colorStops[i + 1][1][1] - colorStops[i][1][1]),
        colorStops[i][1][2] + t * (colorStops[i + 1][1][2] - colorStops[i][1][2])
      ];
      break;
    }
  }
  
  let alpha = sample.dataMask;
  if (sample.SCL === 8 || sample.SCL === 9 || sample.SCL === 10) {
    alpha = 0;
  }
  
  return [color[0] / 255, color[1] / 255, color[2] / 255, alpha];
}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const { fieldId } = req.query;
    const palette = (req.query.palette as string) || 'contrast';
    const dateFrom = (req.query.dateFrom as string) || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const dateTo = (req.query.dateTo as string) || new Date().toISOString().split('T')[0];
    const id = parseInt(fieldId as string);

    console.log(`[Copernicus] Request for field ${id}, palette: ${palette}`);

    if (!fieldId) {
      return res.status(400).json({ error: 'Field ID is required' });
    }

    if (!COPERNICUS_CLIENT_ID || !COPERNICUS_CLIENT_SECRET) {
      console.error('[Copernicus] Credentials not configured');
      return res.status(500).json({ error: 'Copernicus credentials not configured' });
    }

    if (!process.env.DATABASE_URL) {
      console.error("[Copernicus] DATABASE_URL not configured");
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
      console.log(`[Copernicus] Field ${id} not found`);
      await sql.end();
      return res.status(404).json({ error: 'Field not found' });
    }

    // Parse boundaries (may be stored as JSON string)
    let boundaries = field.boundaries as { lat: number; lng: number }[];
    if (typeof boundaries === 'string') {
      boundaries = JSON.parse(boundaries);
    }
    
    if (!boundaries || !Array.isArray(boundaries) || boundaries.length < 3) {
      console.log(`[Copernicus] Field ${id} has no valid boundaries`);
      await sql.end();
      return res.status(400).json({ error: 'Field has no valid boundaries' });
    }

    await sql.end();
    console.log(`[Copernicus] Field ${id} has ${boundaries.length} points`);

    // Get access token
    const token = await getAccessToken();
    console.log(`[Copernicus] Token obtained successfully`);

    // Convert polygon to GeoJSON format
    const coordinates = boundaries.map(p => [p.lng, p.lat]);
    if (coordinates[0][0] !== coordinates[coordinates.length - 1][0] || 
        coordinates[0][1] !== coordinates[coordinates.length - 1][1]) {
      coordinates.push(coordinates[0]);
    }

    // Calculate image size based on polygon bounds
    const lngs = boundaries.map(p => p.lng);
    const lats = boundaries.map(p => p.lat);
    const lngRange = Math.max(...lngs) - Math.min(...lngs);
    const latRange = Math.max(...lats) - Math.min(...lats);
    const aspectRatio = lngRange / latRange;
    
    let width = 512;
    let height = 512;
    if (aspectRatio > 1) {
      height = Math.round(512 / aspectRatio);
    } else {
      width = Math.round(512 * aspectRatio);
    }

    console.log(`[Copernicus] Image size: ${width}x${height}`);

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
              timeRange: {
                from: `${dateFrom}T00:00:00Z`,
                to: `${dateTo}T23:59:59Z`,
              },
              maxCloudCoverage: 30,
            },
            processing: {
              harmonizeValues: true,
            },
          },
        ],
      },
      output: {
        width,
        height,
        responses: [
          {
            identifier: 'default',
            format: { type: 'image/png' },
          },
        ],
      },
      evalscript: generateEvalscript(palette),
    };

    console.log(`[Copernicus] Sending request to API...`);

    const response = await fetch(PROCESS_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'image/png',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Copernicus] API error:', response.status, errorText);
      return res.status(response.status).json({ error: 'Failed to get NDVI image from Copernicus', details: errorText });
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log(`[Copernicus] Image received: ${buffer.length} bytes`);

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.send(buffer);

  } catch (error) {
    console.error('[Copernicus] Error:', error);
    return res.status(500).json({ error: 'Internal server error', details: String(error) });
  }
}
