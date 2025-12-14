/**
 * Copernicus Sentinel Hub Integration Service
 * Provides high-quality NDVI imagery from Sentinel-2 satellite
 * Same data source as OneSoil
 */

// Copernicus OAuth credentials
const COPERNICUS_CLIENT_ID = process.env.COPERNICUS_CLIENT_ID || '';
const COPERNICUS_CLIENT_SECRET = process.env.COPERNICUS_CLIENT_SECRET || '';
const TOKEN_URL = 'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token';
const PROCESS_API_URL = 'https://sh.dataspace.copernicus.eu/api/v1/process';

// Token cache
let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Get OAuth token from Copernicus
 */
async function getAccessToken(): Promise<string> {
  // Check if we have a valid cached token
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) {
    return cachedToken.token;
  }

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
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

/**
 * NDVI Color Palettes
 */
export const NDVI_PALETTES = {
  // Palette 1: Classic Green
  classic: {
    name: 'Clássica',
    description: 'Verde tradicional para vegetação',
    colors: [
      { value: 0.0, color: [139, 69, 19] },   // Brown
      { value: 0.2, color: [255, 255, 0] },   // Yellow
      { value: 0.4, color: [144, 238, 144] }, // Light green
      { value: 0.6, color: [34, 139, 34] },   // Forest green
      { value: 0.8, color: [0, 100, 0] },     // Dark green
      { value: 1.0, color: [0, 77, 0] },      // Very dark green
    ],
  },
  // Palette 2: Contrast (OneSoil Style)
  contrast: {
    name: 'Contraste',
    description: 'Alto contraste vermelho-verde (estilo OneSoil)',
    colors: [
      { value: 0.0, color: [255, 0, 0] },     // Red
      { value: 0.2, color: [255, 165, 0] },   // Orange
      { value: 0.4, color: [255, 255, 0] },   // Yellow
      { value: 0.6, color: [144, 238, 144] }, // Light green
      { value: 0.8, color: [50, 205, 50] },   // Lime green
      { value: 1.0, color: [0, 100, 0] },     // Dark green
    ],
  },
  // Palette 3: Viridis (Scientific)
  viridis: {
    name: 'Viridis',
    description: 'Paleta científica para análise',
    colors: [
      { value: 0.0, color: [68, 1, 84] },     // Dark purple
      { value: 0.25, color: [59, 82, 139] },  // Blue
      { value: 0.5, color: [33, 145, 140] },  // Teal
      { value: 0.75, color: [94, 201, 98] },  // Light green
      { value: 1.0, color: [253, 231, 37] },  // Yellow
    ],
  },
  // Palette 4: RdYlGn (Red-Yellow-Green)
  rdylgn: {
    name: 'Vermelho-Amarelo-Verde',
    description: 'Gradiente suave para análise geral',
    colors: [
      { value: 0.0, color: [165, 0, 38] },    // Dark red
      { value: 0.25, color: [244, 109, 67] }, // Orange
      { value: 0.5, color: [255, 255, 191] }, // Light yellow
      { value: 0.75, color: [166, 217, 106] },// Light green
      { value: 1.0, color: [0, 104, 55] },    // Dark green
    ],
  },
  // Palette 5: Pasture (Specific for cattle)
  pasture: {
    name: 'Pastagem',
    description: 'Otimizada para monitoramento de pasto',
    colors: [
      { value: 0.0, color: [139, 90, 43] },   // Brown (bare soil)
      { value: 0.3, color: [210, 180, 140] }, // Tan (very low grass)
      { value: 0.5, color: [154, 205, 50] },  // Yellow-green (grazed)
      { value: 0.7, color: [107, 142, 35] },  // Olive (recovering)
      { value: 0.9, color: [34, 139, 34] },   // Forest green (ready to graze)
    ],
  },
};

export type PaletteKey = keyof typeof NDVI_PALETTES;

/**
 * Generate evalscript for NDVI with custom color palette
 */
function generateEvalscript(paletteKey: PaletteKey = 'contrast'): string {
  const palette = NDVI_PALETTES[paletteKey];
  
  // Generate color interpolation code
  const colorStops = palette.colors.map(c => 
    `[${c.value}, [${c.color.join(', ')}]]`
  ).join(',\n    ');

  return `//VERSION=3
function setup() {
  return {
    input: ["B04", "B08", "SCL", "dataMask"],
    output: { bands: 4 }
  };
}

function evaluatePixel(sample) {
  // Calculate NDVI
  let ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04);
  
  // Handle invalid values
  if (isNaN(ndvi) || !isFinite(ndvi)) {
    return [0, 0, 0, 0]; // Transparent
  }
  
  // Clamp NDVI to 0-1 range
  ndvi = Math.max(0, Math.min(1, (ndvi + 1) / 2)); // Normalize from -1,1 to 0,1
  ndvi = Math.max(0, Math.min(1, ndvi * 2 - 0.2)); // Adjust for vegetation focus
  
  // Color palette stops
  const colorStops = [
    ${colorStops}
  ];
  
  // Interpolate color
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
  
  // Apply cloud mask (SCL values 8, 9, 10 are clouds)
  let alpha = sample.dataMask;
  if (sample.SCL === 8 || sample.SCL === 9 || sample.SCL === 10) {
    alpha = 0; // Make clouds transparent
  }
  
  return [color[0] / 255, color[1] / 255, color[2] / 255, alpha];
}`;
}

/**
 * Get NDVI image for a polygon
 */
export async function getNdviImage(
  polygon: { lat: number; lng: number }[],
  options: {
    dateFrom?: string;
    dateTo?: string;
    palette?: PaletteKey;
    width?: number;
    height?: number;
  } = {}
): Promise<Buffer> {
  const {
    dateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    dateTo = new Date().toISOString().split('T')[0],
    palette = 'contrast',
    width = 512,
    height = 512,
  } = options;

  const token = await getAccessToken();

  // Convert polygon to GeoJSON format
  const coordinates = polygon.map(p => [p.lng, p.lat]);
  // Close the polygon
  if (coordinates.length > 0 && 
      (coordinates[0][0] !== coordinates[coordinates.length - 1][0] || 
       coordinates[0][1] !== coordinates[coordinates.length - 1][1])) {
    coordinates.push(coordinates[0]);
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
          format: {
            type: 'image/png',
          },
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
    throw new Error(`Copernicus API error: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Get available dates with satellite imagery for a polygon
 */
export async function getAvailableDates(
  polygon: { lat: number; lng: number }[],
  options: {
    dateFrom?: string;
    dateTo?: string;
  } = {}
): Promise<{ date: string; cloudCoverage: number }[]> {
  const {
    dateFrom = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    dateTo = new Date().toISOString().split('T')[0],
  } = options;

  const token = await getAccessToken();

  // Convert polygon to bbox
  const lngs = polygon.map(p => p.lng);
  const lats = polygon.map(p => p.lat);
  const bbox = [
    Math.min(...lngs),
    Math.min(...lats),
    Math.max(...lngs),
    Math.max(...lats),
  ];

  const catalogUrl = 'https://sh.dataspace.copernicus.eu/api/v1/catalog/1.0.0/search';
  
  const response = await fetch(catalogUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      bbox,
      datetime: `${dateFrom}T00:00:00Z/${dateTo}T23:59:59Z`,
      collections: ['sentinel-2-l2a'],
      limit: 100,
    }),
  });

  if (!response.ok) {
    throw new Error(`Catalog API error: ${response.status}`);
  }

  const data = await response.json();
  
  return data.features.map((f: any) => ({
    date: f.properties.datetime.split('T')[0],
    cloudCoverage: f.properties['eo:cloud_cover'] || 0,
  })).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * Calculate NDVI statistics for a polygon
 */
export async function getNdviStats(
  polygon: { lat: number; lng: number }[],
  options: {
    dateFrom?: string;
    dateTo?: string;
  } = {}
): Promise<{ mean: number; min: number; max: number; date: string }> {
  const {
    dateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    dateTo = new Date().toISOString().split('T')[0],
  } = options;

  const token = await getAccessToken();

  // Convert polygon to GeoJSON format
  const coordinates = polygon.map(p => [p.lng, p.lat]);
  if (coordinates.length > 0 && 
      (coordinates[0][0] !== coordinates[coordinates.length - 1][0] || 
       coordinates[0][1] !== coordinates[coordinates.length - 1][1])) {
    coordinates.push(coordinates[0]);
  }

  const statsUrl = 'https://sh.dataspace.copernicus.eu/api/v1/statistics';
  
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
        },
      ],
    },
    aggregation: {
      timeRange: {
        from: `${dateFrom}T00:00:00Z`,
        to: `${dateTo}T23:59:59Z`,
      },
      aggregationInterval: {
        of: 'P1D',
      },
      evalscript: `//VERSION=3
function setup() {
  return {
    input: ["B04", "B08", "dataMask"],
    output: [{ id: "ndvi", bands: 1 }]
  };
}
function evaluatePixel(sample) {
  let ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04);
  return [ndvi];
}`,
    },
  };

  const response = await fetch(statsUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`Statistics API error: ${response.status}`);
  }

  const data = await response.json();
  
  // Get the most recent stats
  const latestStats = data.data?.[0]?.outputs?.ndvi?.bands?.B0?.stats;
  
  return {
    mean: latestStats?.mean || 0,
    min: latestStats?.min || 0,
    max: latestStats?.max || 0,
    date: data.data?.[0]?.interval?.from?.split('T')[0] || dateTo,
  };
}

export default {
  getNdviImage,
  getAvailableDates,
  getNdviStats,
  NDVI_PALETTES,
};
