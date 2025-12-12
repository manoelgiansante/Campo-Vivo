import { useState, useCallback } from "react";
import { Upload, FileText, MapPin, X, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface ImportedField {
  name: string;
  coordinates: [number, number][];
  area?: number;
  properties?: Record<string, any>;
}

interface FieldImportDialogProps {
  onImport: (fields: ImportedField[]) => void;
  trigger?: React.ReactNode;
}

export function FieldImportDialog({ onImport, trigger }: FieldImportDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedFields, setParsedFields] = useState<ImportedField[]>([]);
  const [error, setError] = useState<string | null>(null);

  const parseKML = (content: string): ImportedField[] => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, "text/xml");
    const fields: ImportedField[] = [];

    // Handle parse errors
    const parserError = doc.querySelector("parsererror");
    if (parserError) {
      throw new Error("Arquivo KML inválido");
    }

    // Find all Placemarks
    const placemarks = doc.querySelectorAll("Placemark");
    
    placemarks.forEach((placemark, index) => {
      const name = placemark.querySelector("name")?.textContent || `Campo ${index + 1}`;
      
      // Try to find coordinates in different formats
      const polygon = placemark.querySelector("Polygon");
      const lineString = placemark.querySelector("LineString");
      let coordsElement = polygon?.querySelector("coordinates") || lineString?.querySelector("coordinates");
      
      if (!coordsElement) {
        // Try outerBoundaryIs > LinearRing > coordinates
        coordsElement = placemark.querySelector("outerBoundaryIs LinearRing coordinates");
      }
      
      if (coordsElement?.textContent) {
        const coordsText = coordsElement.textContent.trim();
        const coordinates: [number, number][] = coordsText
          .split(/\s+/)
          .map(coord => {
            const [lng, lat] = coord.split(",").map(Number);
            return [lng, lat] as [number, number];
          })
          .filter(([lng, lat]) => !isNaN(lng) && !isNaN(lat));

        if (coordinates.length >= 3) {
          // Get properties from ExtendedData
          const properties: Record<string, any> = {};
          const extendedData = placemark.querySelectorAll("ExtendedData SimpleData");
          extendedData.forEach((data) => {
            const key = data.getAttribute("name");
            if (key) {
              properties[key] = data.textContent;
            }
          });

          fields.push({
            name,
            coordinates,
            properties,
          });
        }
      }
    });

    return fields;
  };

  const parseGeoJSON = (content: string): ImportedField[] => {
    const geojson = JSON.parse(content);
    const fields: ImportedField[] = [];

    const processFeature = (feature: any, index: number) => {
      if (!feature.geometry) return;

      let coordinates: [number, number][] = [];
      const geomType = feature.geometry.type;

      if (geomType === "Polygon") {
        coordinates = feature.geometry.coordinates[0]; // outer ring
      } else if (geomType === "MultiPolygon") {
        // Take first polygon
        coordinates = feature.geometry.coordinates[0][0];
      } else if (geomType === "LineString") {
        coordinates = feature.geometry.coordinates;
      }

      if (coordinates.length >= 3) {
        fields.push({
          name: feature.properties?.name || feature.properties?.Name || `Campo ${index + 1}`,
          coordinates,
          area: feature.properties?.area,
          properties: feature.properties,
        });
      }
    };

    if (geojson.type === "FeatureCollection") {
      geojson.features.forEach((feature: any, index: number) => {
        processFeature(feature, index);
      });
    } else if (geojson.type === "Feature") {
      processFeature(geojson, 0);
    }

    return fields;
  };

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);
    setFileName(file.name);
    setParsedFields([]);

    try {
      const content = await file.text();
      const extension = file.name.split(".").pop()?.toLowerCase();

      let fields: ImportedField[] = [];

      if (extension === "kml" || extension === "kmz") {
        if (extension === "kmz") {
          // KMZ is a zipped KML - would need JSZip library
          throw new Error("Arquivos KMZ não são suportados ainda. Por favor, extraia o KML.");
        }
        fields = parseKML(content);
      } else if (extension === "geojson" || extension === "json") {
        fields = parseGeoJSON(content);
      } else if (extension === "shp") {
        throw new Error("Arquivos Shapefile (.shp) precisam ser convertidos para GeoJSON ou KML primeiro.");
      } else {
        throw new Error(`Formato não suportado: ${extension}`);
      }

      if (fields.length === 0) {
        throw new Error("Nenhum campo encontrado no arquivo");
      }

      setParsedFields(fields);
      toast.success(`${fields.length} campo(s) encontrado(s)!`);
    } catch (err: any) {
      console.error("Erro ao processar arquivo:", err);
      setError(err.message || "Erro ao processar arquivo");
      toast.error(err.message || "Erro ao processar arquivo");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleImport = () => {
    if (parsedFields.length === 0) return;
    
    onImport(parsedFields);
    setIsOpen(false);
    setFileName(null);
    setParsedFields([]);
    setError(null);
    toast.success(`${parsedFields.length} campo(s) importado(s)!`);
  };

  const handleClose = () => {
    setIsOpen(false);
    setFileName(null);
    setParsedFields([]);
    setError(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Upload className="w-4 h-4 mr-2" />
            Importar
          </Button>
        )}
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Importar Campos
          </DialogTitle>
          <DialogDescription>
            Importe campos de arquivos KML ou GeoJSON
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* File Upload Area */}
          <div className="space-y-2">
            <Label htmlFor="file-upload">Arquivo</Label>
            <div className="relative">
              <Input
                id="file-upload"
                type="file"
                accept=".kml,.kmz,.geojson,.json"
                onChange={handleFileSelect}
                className="cursor-pointer"
                disabled={isLoading}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Formatos suportados: KML, GeoJSON
            </p>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <span className="text-sm text-blue-700">Processando arquivo...</span>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span className="text-sm text-red-700">{error}</span>
            </div>
          )}

          {/* Success State - Preview Fields */}
          {parsedFields.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm text-green-700">
                  {parsedFields.length} campo(s) encontrado(s)
                </span>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-2">
                {parsedFields.map((field, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg"
                  >
                    <MapPin className="w-4 h-4 text-green-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{field.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {field.coordinates.length} pontos
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={handleClose}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleImport}
              disabled={parsedFields.length === 0 || isLoading}
              className="flex-1"
            >
              <Upload className="w-4 h-4 mr-2" />
              Importar {parsedFields.length > 0 && `(${parsedFields.length})`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
