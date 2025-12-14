import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Upload, 
  FileJson, 
  MapPin, 
  CheckCircle, 
  AlertTriangle, 
  Loader2,
  Trees,
  Droplets,
  Building,
  Leaf
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CARImportResult {
  success: boolean;
  data?: {
    codigoCar: string;
    nomePropriedade?: string;
    municipio?: string;
    uf?: string;
    areaTotal?: number;
    areaReservaLegal?: number;
    areaApp?: number;
  };
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

interface CARUploadProps {
  onImport: (result: CARImportResult) => void;
  className?: string;
}

export function CARUpload({ onImport, className }: CARUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<CARImportResult | null>(null);
  const [carCode, setCarCode] = useState('');

  const processFile = useCallback(async (file: File) => {
    setIsProcessing(true);
    setResult(null);

    try {
      const content = await file.text();
      let geojson: any;

      // Tentar parse como JSON
      try {
        geojson = JSON.parse(content);
      } catch {
        setResult({ success: false, error: 'Arquivo não é um GeoJSON válido' });
        setIsProcessing(false);
        return;
      }

      // Processar GeoJSON
      const importResult = parseCarGeoJson(geojson);
      setResult(importResult);

      if (importResult.success) {
        onImport(importResult);
      }
    } catch (error) {
      setResult({ 
        success: false, 
        error: `Erro ao processar arquivo: ${error instanceof Error ? error.message : 'Desconhecido'}` 
      });
    }

    setIsProcessing(false);
  }, [onImport]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.json') || file.name.endsWith('.geojson'))) {
      processFile(file);
    } else {
      setResult({ success: false, error: 'Por favor, envie um arquivo .json ou .geojson' });
    }
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

  const handleManualCode = useCallback(() => {
    if (!carCode.trim()) return;
    
    setResult({
      success: true,
      data: {
        codigoCar: carCode,
      },
      warnings: ['Código inserido manualmente. Faça upload do shapefile para importar limites.']
    });
  }, [carCode]);

  return (
    <Card className={cn("border-dashed", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trees className="h-5 w-5 text-green-600" />
          Importar do CAR
        </CardTitle>
        <CardDescription>
          Importe os dados do Cadastro Ambiental Rural para seu campo
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Drop Zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={cn(
            "border-2 border-dashed rounded-xl p-8 text-center transition-colors",
            isDragging ? "border-green-500 bg-green-50" : "border-gray-200 hover:border-gray-300",
            isProcessing && "opacity-50 pointer-events-none"
          )}
        >
          {isProcessing ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-10 w-10 text-green-600 animate-spin" />
              <p className="text-sm text-gray-500">Processando arquivo...</p>
            </div>
          ) : (
            <>
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                <Upload className="h-8 w-8 text-green-600" />
              </div>
              <p className="text-gray-700 font-medium mb-1">
                Arraste o arquivo aqui
              </p>
              <p className="text-sm text-gray-500 mb-4">
                ou clique para selecionar
              </p>
              <input
                type="file"
                accept=".json,.geojson"
                onChange={handleFileSelect}
                className="hidden"
                id="car-file-input"
              />
              <label htmlFor="car-file-input">
                <Button variant="outline" size="sm" asChild>
                  <span className="cursor-pointer">
                    <FileJson className="h-4 w-4 mr-2" />
                    Selecionar arquivo
                  </span>
                </Button>
              </label>
              <p className="text-xs text-gray-400 mt-3">
                Aceita arquivos .json ou .geojson exportados do SICAR
              </p>
            </>
          )}
        </div>

        {/* Manual Code Input */}
        <div className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="car-code" className="text-xs text-gray-500">
              Ou insira o código do CAR manualmente
            </Label>
            <Input
              id="car-code"
              placeholder="MT-5107909-XXXXXXXX..."
              value={carCode}
              onChange={(e) => setCarCode(e.target.value)}
              className="mt-1"
            />
          </div>
          <Button 
            variant="outline" 
            className="mt-6"
            onClick={handleManualCode}
            disabled={!carCode.trim()}
          >
            Validar
          </Button>
        </div>

        {/* Result */}
        {result && (
          <div className="mt-4">
            {result.success ? (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription>
                  <div className="space-y-3">
                    <p className="font-medium text-green-800">
                      CAR importado com sucesso!
                    </p>
                    
                    {result.data && (
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-gray-500">Código:</span>
                          <p className="font-mono text-xs">{result.data.codigoCar}</p>
                        </div>
                        {result.data.nomePropriedade && (
                          <div>
                            <span className="text-gray-500">Propriedade:</span>
                            <p>{result.data.nomePropriedade}</p>
                          </div>
                        )}
                        {result.data.municipio && (
                          <div>
                            <span className="text-gray-500">Município:</span>
                            <p>{result.data.municipio} - {result.data.uf}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {result.areas && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge variant="outline" className="bg-white">
                          <MapPin className="h-3 w-3 mr-1" />
                          {result.areas.total.toFixed(1)} ha total
                        </Badge>
                        {result.areas.reservaLegal > 0 && (
                          <Badge variant="outline" className="bg-green-100 text-green-800">
                            <Leaf className="h-3 w-3 mr-1" />
                            {result.areas.reservaLegal.toFixed(1)} ha RL
                          </Badge>
                        )}
                        {result.areas.app > 0 && (
                          <Badge variant="outline" className="bg-blue-100 text-blue-800">
                            <Droplets className="h-3 w-3 mr-1" />
                            {result.areas.app.toFixed(1)} ha APP
                          </Badge>
                        )}
                      </div>
                    )}

                    {result.boundaries && (
                      <p className="text-xs text-green-600">
                        ✓ {result.boundaries.length} pontos do perímetro importados
                      </p>
                    )}

                    {result.warnings && result.warnings.length > 0 && (
                      <div className="mt-2 text-xs text-amber-700">
                        {result.warnings.map((w, i) => (
                          <p key={i} className="flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {w}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="bg-red-50 border-red-200">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  {result.error}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Help Text */}
        <div className="text-xs text-gray-500 space-y-1 pt-2 border-t">
          <p><strong>Como exportar do SICAR:</strong></p>
          <ol className="list-decimal list-inside space-y-0.5 ml-2">
            <li>Acesse <a href="https://www.car.gov.br/publico/imoveis/index" target="_blank" rel="noopener" className="text-green-600 underline">car.gov.br</a></li>
            <li>Busque seu imóvel pelo código do CAR</li>
            <li>Clique em "Baixar" e selecione formato GeoJSON</li>
            <li>Faça upload do arquivo aqui</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}

// Parser de GeoJSON do CAR (versão frontend)
function parseCarGeoJson(geojson: any): CARImportResult {
  try {
    const geometry = extractGeometry(geojson);
    
    if (!geometry) {
      return { success: false, error: 'Geometria não encontrada no arquivo' };
    }
    
    const properties = geojson.features?.[0]?.properties || geojson.properties || {};
    
    let boundaries: Array<{ lat: number; lng: number }> = [];
    
    if (geometry.type === 'Polygon') {
      boundaries = normalizeCoordinates(geometry.coordinates[0]);
    } else if (geometry.type === 'MultiPolygon') {
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
    
    return {
      success: true,
      data: {
        codigoCar: properties.cod_imovel || properties.COD_IMOVEL || properties.codigo_car || 'N/A',
        nomePropriedade: properties.nom_imovel || properties.NOM_IMOVEL || properties.nome,
        municipio: properties.nom_municip || properties.NOM_MUNICIP || properties.municipio,
        uf: properties.cod_estado || properties.COD_ESTADO || properties.uf,
        areaTotal: properties.num_area || properties.NUM_AREA || areaTotal,
        areaReservaLegal: properties.area_reserva_legal || properties.AREA_RL,
        areaApp: properties.area_app || properties.AREA_APP,
      },
      boundaries,
      areas: {
        total: areaTotal,
        reservaLegal: properties.area_reserva_legal || properties.AREA_RL || 0,
        app: properties.area_app || properties.AREA_APP || 0,
        consolidada: properties.area_consolidada || 0,
      },
    };
  } catch (error) {
    return { 
      success: false, 
      error: `Erro ao processar: ${error instanceof Error ? error.message : 'Formato inválido'}` 
    };
  }
}

function extractGeometry(geojson: any): any {
  if (geojson.type === 'FeatureCollection' && geojson.features?.length > 0) {
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

function normalizeCoordinates(coords: any[]): Array<{ lat: number; lng: number }> {
  return coords.map(coord => {
    if (Array.isArray(coord) && coord.length >= 2) {
      return { lng: coord[0], lat: coord[1] };
    }
    if (typeof coord === 'object') {
      return {
        lng: coord.lng || coord.lon || coord.longitude || 0,
        lat: coord.lat || coord.latitude || 0
      };
    }
    return { lat: 0, lng: 0 };
  });
}

function calculateAreaHectares(coordinates: Array<{ lat: number; lng: number }>): number {
  if (coordinates.length < 3) return 0;
  
  const toMeters = (lat: number, lng: number, refLat: number, refLng: number) => {
    const latRad = (refLat * Math.PI) / 180;
    const x = (lng - refLng) * (111320 * Math.cos(latRad));
    const y = (lat - refLat) * 110540;
    return { x, y };
  };
  
  const refLat = coordinates[0].lat;
  const refLng = coordinates[0].lng;
  const metersCoords = coordinates.map(c => toMeters(c.lat, c.lng, refLat, refLng));
  
  let area = 0;
  for (let i = 0; i < metersCoords.length; i++) {
    const j = (i + 1) % metersCoords.length;
    area += metersCoords[i].x * metersCoords[j].y;
    area -= metersCoords[j].x * metersCoords[i].y;
  }
  
  return Math.abs(area / 2) / 10000;
}

export default CARUpload;
