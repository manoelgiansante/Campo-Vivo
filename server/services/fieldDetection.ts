/**
 * Serviço de Detecção Automática de Campos
 * 
 * Usa múltiplas fontes para detectar campos agrícolas:
 * 1. OneSoil API (campos detectados por ML)
 * 2. OpenStreetMap (dados de uso de terra)
 * 3. CAR (Cadastro Ambiental Rural) - futuro
 */

interface DetectedField {
  id: string;
  name?: string;
  coordinates: [number, number][];
  center: [number, number];
  areaHectares: number;
  source: 'onesoil' | 'osm' | 'car';
  crop?: string;
  ndvi?: number;
}

interface BoundingBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

/**
 * Calcula a área de um polígono em hectares usando a fórmula de Shoelace
 */
function calculatePolygonArea(coordinates: [number, number][]): number {
  if (coordinates.length < 3) return 0;
  
  // Converter para metros usando projeção simples
  const centerLat = coordinates.reduce((sum, c) => sum + c[1], 0) / coordinates.length;
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLng = 111320 * Math.cos(centerLat * Math.PI / 180);
  
  // Converter coordenadas para metros
  const coordsInMeters = coordinates.map(c => [
    c[0] * metersPerDegreeLng,
    c[1] * metersPerDegreeLat
  ]);
  
  // Fórmula de Shoelace
  let area = 0;
  for (let i = 0; i < coordsInMeters.length; i++) {
    const j = (i + 1) % coordsInMeters.length;
    area += coordsInMeters[i][0] * coordsInMeters[j][1];
    area -= coordsInMeters[j][0] * coordsInMeters[i][1];
  }
  
  // Converter para hectares (1 hectare = 10,000 m²)
  return Math.abs(area) / 2 / 10000;
}

/**
 * Calcula o centro de um polígono
 */
function calculateCenter(coordinates: [number, number][]): [number, number] {
  const sumLng = coordinates.reduce((sum, c) => sum + c[0], 0);
  const sumLat = coordinates.reduce((sum, c) => sum + c[1], 0);
  return [sumLng / coordinates.length, sumLat / coordinates.length];
}

/**
 * Busca campos usando a API pública do OneSoil
 * A API é gratuita e retorna campos detectados por machine learning
 */
async function detectFieldsFromOneSoil(bbox: BoundingBox): Promise<DetectedField[]> {
  try {
    // OneSoil Public API - retorna campos agrícolas detectados por satélite
    // Documentação: https://onesoil.ai/api-docs
    const url = `https://onesoil.ai/api/v2/fields?bbox=${bbox.minLng},${bbox.minLat},${bbox.maxLng},${bbox.maxLat}`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      console.log('OneSoil API not available, falling back to OSM');
      return [];
    }
    
    const data = await response.json();
    
    if (!data.features || !Array.isArray(data.features)) {
      return [];
    }
    
    return data.features.map((feature: any, index: number) => {
      const coordinates = feature.geometry?.coordinates?.[0] || [];
      return {
        id: `onesoil_${feature.id || index}`,
        name: feature.properties?.name,
        coordinates: coordinates.map((c: number[]) => [c[0], c[1]] as [number, number]),
        center: calculateCenter(coordinates),
        areaHectares: feature.properties?.area_ha || calculatePolygonArea(coordinates),
        source: 'onesoil' as const,
        crop: feature.properties?.crop,
        ndvi: feature.properties?.ndvi,
      };
    });
  } catch (error) {
    console.error('Error fetching from OneSoil:', error);
    return [];
  }
}

/**
 * Busca campos usando OpenStreetMap Overpass API
 * Busca por landuse=farmland, landuse=farm, landuse=meadow
 */
async function detectFieldsFromOSM(bbox: BoundingBox): Promise<DetectedField[]> {
  try {
    const overpassQuery = `
      [out:json][timeout:25];
      (
        way["landuse"="farmland"](${bbox.minLat},${bbox.minLng},${bbox.maxLat},${bbox.maxLng});
        way["landuse"="farm"](${bbox.minLat},${bbox.minLng},${bbox.maxLat},${bbox.maxLng});
        way["landuse"="meadow"](${bbox.minLat},${bbox.minLng},${bbox.maxLat},${bbox.maxLng});
        way["landuse"="grass"](${bbox.minLat},${bbox.minLng},${bbox.maxLat},${bbox.maxLng});
        relation["landuse"="farmland"](${bbox.minLat},${bbox.minLng},${bbox.maxLat},${bbox.maxLng});
      );
      out body;
      >;
      out skel qt;
    `;
    
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: `data=${encodeURIComponent(overpassQuery)}`,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    
    if (!response.ok) {
      console.error('OSM Overpass API error:', response.status);
      return [];
    }
    
    const data = await response.json();
    
    // Criar mapa de nodes para lookup rápido
    const nodes = new Map<number, { lat: number; lon: number }>();
    for (const element of data.elements) {
      if (element.type === 'node') {
        nodes.set(element.id, { lat: element.lat, lon: element.lon });
      }
    }
    
    // Processar ways
    const fields: DetectedField[] = [];
    for (const element of data.elements) {
      if (element.type === 'way' && element.nodes) {
        const coordinates: [number, number][] = [];
        
        for (const nodeId of element.nodes) {
          const node = nodes.get(nodeId);
          if (node) {
            coordinates.push([node.lon, node.lat]);
          }
        }
        
        if (coordinates.length >= 3) {
          const area = calculatePolygonArea(coordinates);
          
          // Filtrar campos muito pequenos (< 0.5 ha) ou muito grandes (> 500 ha)
          if (area >= 0.5 && area <= 500) {
            fields.push({
              id: `osm_${element.id}`,
              name: element.tags?.name,
              coordinates,
              center: calculateCenter(coordinates),
              areaHectares: area,
              source: 'osm',
              crop: element.tags?.crop,
            });
          }
        }
      }
    }
    
    return fields;
  } catch (error) {
    console.error('Error fetching from OSM:', error);
    return [];
  }
}

/**
 * Detecta campos agrícolas em uma área usando múltiplas fontes
 */
export async function detectFieldsInArea(
  center: [number, number],
  radiusKm: number = 5
): Promise<DetectedField[]> {
  // Calcular bounding box
  const kmToDegLat = 1 / 111;
  const kmToDegLng = 1 / (111 * Math.cos(center[1] * Math.PI / 180));
  
  const bbox: BoundingBox = {
    minLng: center[0] - radiusKm * kmToDegLng,
    maxLng: center[0] + radiusKm * kmToDegLng,
    minLat: center[1] - radiusKm * kmToDegLat,
    maxLat: center[1] + radiusKm * kmToDegLat,
  };
  
  // Tentar OneSoil primeiro (melhor qualidade)
  let fields = await detectFieldsFromOneSoil(bbox);
  
  // Se não encontrou no OneSoil, usar OSM
  if (fields.length === 0) {
    fields = await detectFieldsFromOSM(bbox);
  }
  
  // Ordenar por proximidade do centro
  fields.sort((a, b) => {
    const distA = Math.sqrt(
      Math.pow(a.center[0] - center[0], 2) + Math.pow(a.center[1] - center[1], 2)
    );
    const distB = Math.sqrt(
      Math.pow(b.center[0] - center[0], 2) + Math.pow(b.center[1] - center[1], 2)
    );
    return distA - distB;
  });
  
  // Limitar a 50 campos
  return fields.slice(0, 50);
}

/**
 * Detecta campos em um ponto específico (clique no mapa)
 */
export async function detectFieldAtPoint(
  point: [number, number]
): Promise<DetectedField | null> {
  const fields = await detectFieldsInArea(point, 0.5);
  
  // Encontrar o campo que contém o ponto
  for (const field of fields) {
    if (isPointInPolygon(point, field.coordinates)) {
      return field;
    }
  }
  
  // Se não encontrou campo contendo o ponto, retornar o mais próximo
  return fields[0] || null;
}

/**
 * Verifica se um ponto está dentro de um polígono (ray casting)
 */
function isPointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  let inside = false;
  const x = point[0];
  const y = point[1];
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];
    
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  
  return inside;
}

export type { DetectedField, BoundingBox };
