import type { VercelRequest, VercelResponse } from '@vercel/node';
import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { eq } from 'drizzle-orm';
import { fields } from '../../drizzle/schema';

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
    throw new Error(`Failed to get Copernicus token: ${response.status}`);
  }

  const data = await response.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
  };

  return cachedToken.token;
}

// NDVI Color Palettes
const PALETTES: Record<string, { value: number; color: number[] }[]> = {
  classic: [
    { value: 0.0, color: [139, 69, 19] },
    { value: 0.2, color: [255, 255, 0] },
    { value: 0.4, color: [144, 238, 144] },
    { value: 0.6, color: [34, 139, 34] },
    { value: 0.8, color: [0, 100, 0] },
    { value: 1.0, color: [0, 77, 0] },
  ],
  contrast: [
    { value: 0.0, color: [255, 0, 0] },
    { value: 0.2, color: [255, 165, 0] },
    { value: 0.4, color: [255, 255, 0] },
    { value: 0.6, color: [144, 238, 144] },
    { value: 0.8, color: [50, 205, 50] },
    { value: 1.0, color: [0, 100, 0] },
  ],
  viridis: [
    { value: 0.0, color: [68, 1, 84] },
    { value: 0.25, color: [59, 82, 139] },
    { value: 0.5, color: [33, 145, 140] },
    { value: 0.75, color: [94, 201, 98] },
    { value: 1.0, color: [253, 231, 37] },
  ],
  rdylgn: [
    { value: 0.0, color: [165, 0, 38] },
    { value: 0.25, color: [244, 109, 67] },
    { value: 0.5, color: [255, 255, 191] },
    { value: 0.75, color: [166, 217, 106] },
    { value: 1.0, color: [0, 104, 55] },
  ],
  pasture: [
    { value: 0.0, color: [139, 90, 43] },
    { value: 0.3, color: [210, 180, 140] },
    { value: 0.5, color: [154, 205, 50] },
    { value: 0.7, color: [107, 142, 35] },
    { value: 0.9, color: [34, 139, 34] },
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
  
  // Normalize NDVI from -1,1 to 0,1 and adjust for vegetation
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
  
  // Cloud mask (SCL 8, 9, 10 are clouds)
  let alpha = sample.dataMask;
  if (sample.SCL === 8 || sample.SCL === 9 || sample.SCL === 10) {
    alpha = 0;
  }
  
  return [color[0] / 255, color[1] / 255, color[2] / 255, alpha];
}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { fieldId } = req.query;
    const palette = (req.query.palette as string) || 'contrast';
    const dateFrom = (req.query.dateFrom as string) || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const dateTo = (req.query.dateTo as string) || new Date().toISOString().split('T')[0];

    if (!fieldId) {
      return res.status(400).json({ error: 'Field ID is required' });
    }

    // Check if Copernicus credentials are configured
    if (!COPERNICUS_CLIENT_ID || !COPERNICUS_CLIENT_SECRET) {
      return res.status(500).json({ error: 'Copernicus credentials not configured' });
    }

    // Connect to database
    const connection = await mysql.createConnection(process.env.DATABASE_URL!);
    const db = drizzle(connection);

    // Get field from database
    const [field] = await db.select().from(fields).where(eq(fields.id, Number(fieldId)));

    if (!field) {
      await connection.end();
      return res.status(404).json({ error: 'Field not found' });
    }

    const boundaries = field.boundaries as { lat: number; lng: number }[];
    if (!boundaries || boundaries.length < 3) {
      await connection.end();
      return res.status(400).json({ error: 'Field has no valid boundaries' });
    }

    await connection.end();

    // Get access token
    const token = await getAccessToken();

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
      console.error('Copernicus API error:', errorText);
      return res.status(response.status).json({ error: 'Failed to get NDVI image from Copernicus' });
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.send(buffer);

  } catch (error) {
    console.error('Error in copernicus-ndvi handler:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
