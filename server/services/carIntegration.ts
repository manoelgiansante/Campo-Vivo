/**
 * CAR Integration Service
 * Integração com Cadastro Ambiental Rural via upload de shapefile/GeoJSON
 */

import { z } from 'zod';

// Schema para dados do CAR
export const CARDataSchema = z.object({
  codigoCar: z.string().min(1, "Código do CAR é obrigatório"),
  cpfCnpj: z.string().optional(),
  nomePropriedade: z.string().optional(),
  municipio: z.string().optional(),
  uf: z.string().length(2).optional(),
  areaTotal: z.number().positive().optional(),
  areaReservaLegal: z.number().optional(),
  areaApp: z.number().optional(), // Área de Preservação Permanente
  areaConstruida: z.number().optional(),
  areaConsolidada: z.number().optional(),
  situacao: z.enum(['ativo', 'pendente', 'cancelado', 'suspenso']).optional(),
  dataInscricao: z.date().optional(),
  dataAtualizacao: z.date().optional(),
  geometria: z.any(), // GeoJSON geometry
});

export type CARData = z.infer<typeof CARDataSchema>;

// Interface para resultado de importação
export interface CARImportResult {
  success: boolean;
  data?: CARData;
  boundaries?: Array<{ lat: number; lng: number }>;
  areas?: {
    total: number;
    reservaLegal: number;
    app: number;
    consolidada: number;
  };
  warnings?: string[];
  error?: string;
}

/**
 * Converte coordenadas de diferentes formatos para o padrão do app
 */
function normalizeCoordinates(coords: any[]): Array<{ lat: number; lng: number }> {
  return coords.map(coord => {
    // [lng, lat] (GeoJSON padrão)
    if (Array.isArray(coord) && coord.length >= 2) {
      return { lng: coord[0], lat: coord[1] };
    }
    // { lng, lat } ou { lon, lat }
    if (typeof coord === 'object') {
      return {
        lng: coord.lng || coord.lon || coord.longitude || 0,
        lat: coord.lat || coord.latitude || 0
      };
    }
    return { lat: 0, lng: 0 };
  });
}

/**
 * Extrai geometria de um GeoJSON Feature ou FeatureCollection
 */
function extractGeometry(geojson: any): any {
  if (geojson.type === 'FeatureCollection' && geojson.features?.length > 0) {
    // Pegar a primeira feature (normalmente a área total)
    return geojson.features[0].geometry;
  }
  if (geojson.type === 'Feature') {
    return geojson.geometry;
  }
  if (geojson.type === 'Polygon' || geojson.type === 'MultiPolygon') {
    return geojson;
  }
  return null;
}

/**
 * Calcula área em hectares a partir de coordenadas
 * Usa fórmula do polígono de Gauss
 */
function calculateAreaHectares(coordinates: Array<{ lat: number; lng: number }>): number {
  if (coordinates.length < 3) return 0;
  
  // Converter para metros usando projeção simples (aproximação para Brasil)
  const toMeters = (lat: number, lng: number, refLat: number, refLng: number) => {
    const latRad = (refLat * Math.PI) / 180;
    const x = (lng - refLng) * (111320 * Math.cos(latRad));
    const y = (lat - refLat) * 110540;
    return { x, y };
  };
  
  const refLat = coordinates[0].lat;
  const refLng = coordinates[0].lng;
  const metersCoords = coordinates.map(c => toMeters(c.lat, c.lng, refLat, refLng));
  
  // Shoelace formula
  let area = 0;
  for (let i = 0; i < metersCoords.length; i++) {
    const j = (i + 1) % metersCoords.length;
    area += metersCoords[i].x * metersCoords[j].y;
    area -= metersCoords[j].x * metersCoords[i].y;
  }
  
  return Math.abs(area / 2) / 10000; // Converter m² para hectares
}

/**
 * Parse de arquivo GeoJSON do CAR
 */
export function parseCarGeoJson(content: string): CARImportResult {
  try {
    const geojson = JSON.parse(content);
    const geometry = extractGeometry(geojson);
    
    if (!geometry) {
      return { success: false, error: 'Geometria não encontrada no arquivo' };
    }
    
    // Extrair propriedades se disponíveis
    const properties = geojson.features?.[0]?.properties || geojson.properties || {};
    
    let boundaries: Array<{ lat: number; lng: number }> = [];
    
    if (geometry.type === 'Polygon') {
      boundaries = normalizeCoordinates(geometry.coordinates[0]);
    } else if (geometry.type === 'MultiPolygon') {
      // Pegar o maior polígono
      let maxArea = 0;
      geometry.coordinates.forEach((polygon: any) => {
        const coords = normalizeCoordinates(polygon[0]);
        const area = calculateAreaHectares(coords);
        if (area > maxArea) {
          maxArea = area;
          boundaries = coords;
        }
      });
    }
    
    if (boundaries.length < 3) {
      return { success: false, error: 'Polígono inválido (menos de 3 pontos)' };
    }
    
    const areaTotal = calculateAreaHectares(boundaries);
    
    const data: CARData = {
      codigoCar: properties.cod_imovel || properties.COD_IMOVEL || properties.codigo_car || 'N/A',
      cpfCnpj: properties.cpf_cnpj || properties.CPF_CNPJ,
      nomePropriedade: properties.nom_imovel || properties.NOM_IMOVEL || properties.nome,
      municipio: properties.nom_municip || properties.NOM_MUNICIP || properties.municipio,
      uf: properties.cod_estado || properties.COD_ESTADO || properties.uf,
      areaTotal: properties.num_area || properties.NUM_AREA || areaTotal,
      areaReservaLegal: properties.area_reserva_legal || properties.AREA_RL,
      areaApp: properties.area_app || properties.AREA_APP,
      situacao: properties.ind_status || 'ativo',
      geometria: geometry,
    };
    
    const warnings: string[] = [];
    
    if (!data.codigoCar || data.codigoCar === 'N/A') {
      warnings.push('Código do CAR não encontrado no arquivo');
    }
    
    if (Math.abs(areaTotal - (data.areaTotal || 0)) > 1) {
      warnings.push(`Área calculada (${areaTotal.toFixed(2)} ha) difere da informada (${data.areaTotal?.toFixed(2)} ha)`);
    }
    
    return {
      success: true,
      data,
      boundaries,
      areas: {
        total: areaTotal,
        reservaLegal: data.areaReservaLegal || 0,
        app: data.areaApp || 0,
        consolidada: data.areaConsolidada || 0,
      },
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    return { 
      success: false, 
      error: `Erro ao processar arquivo: ${error instanceof Error ? error.message : 'Formato inválido'}` 
    };
  }
}

/**
 * Parse de arquivo Shapefile (via conversão para GeoJSON)
 * Nota: Shapefiles precisam ser convertidos para GeoJSON no frontend antes de enviar
 */
export function parseShapefile(geojsonContent: string): CARImportResult {
  return parseCarGeoJson(geojsonContent);
}

/**
 * Valida código do CAR no formato brasileiro
 * Formato: UF-MUNICÍPIO-CODIGO (ex: MT-5107909-XXXXXXXXXXXXXXXX)
 */
export function validateCarCode(code: string): boolean {
  // Formato simplificado: deve ter pelo menos UF e alguns dígitos
  const carRegex = /^[A-Z]{2}[-_]?\d{7}[-_]?[A-Z0-9]{16,}$/i;
  return carRegex.test(code.replace(/\s/g, ''));
}

/**
 * Busca informações do CAR no SICAR (se API disponível)
 * Nota: O SICAR não tem API pública oficial, isso é um placeholder
 */
export async function fetchCarFromSicar(codigoCar: string): Promise<CARImportResult> {
  // Placeholder - SICAR não tem API pública
  // Em produção, poderia usar web scraping ou API parceira
  return {
    success: false,
    error: 'Busca automática no SICAR não disponível. Por favor, faça upload do arquivo GeoJSON ou Shapefile exportado do SICAR.'
  };
}

/**
 * Extrai áreas específicas do CAR (Reserva Legal, APP, etc.)
 */
export function extractCarAreas(geojson: any): {
  total?: Array<{ lat: number; lng: number }>;
  reservaLegal?: Array<{ lat: number; lng: number }>;
  app?: Array<{ lat: number; lng: number }>;
  consolidada?: Array<{ lat: number; lng: number }>;
} {
  const result: any = {};
  
  if (geojson.type !== 'FeatureCollection') {
    return result;
  }
  
  for (const feature of geojson.features) {
    const props = feature.properties || {};
    const tipo = (props.tipo || props.TIPO || props.des_condic || '').toLowerCase();
    
    let key: string | null = null;
    
    if (tipo.includes('area_imovel') || tipo.includes('perimetro')) {
      key = 'total';
    } else if (tipo.includes('reserva_legal') || tipo.includes('rl')) {
      key = 'reservaLegal';
    } else if (tipo.includes('app') || tipo.includes('preservacao')) {
      key = 'app';
    } else if (tipo.includes('consolidada') || tipo.includes('uso')) {
      key = 'consolidada';
    }
    
    if (key && feature.geometry) {
      const coords = feature.geometry.type === 'Polygon'
        ? feature.geometry.coordinates[0]
        : feature.geometry.type === 'MultiPolygon'
          ? feature.geometry.coordinates[0][0]
          : [];
      
      result[key] = normalizeCoordinates(coords);
    }
  }
  
  return result;
}

export default {
  parseCarGeoJson,
  parseShapefile,
  validateCarCode,
  fetchCarFromSicar,
  extractCarAreas,
  CARDataSchema,
};
