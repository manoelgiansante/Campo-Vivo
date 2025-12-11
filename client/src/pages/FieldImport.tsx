import { useState, useCallback, useRef } from "react";
import { 
  ChevronLeft, 
  Upload,
  FileUp,
  MapPin,
  Check,
  X,
  AlertTriangle,
  Loader2,
  FileText,
  Map,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { MapboxMap } from "@/components/MapboxMap";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import mapboxgl from "mapbox-gl";

interface ImportedField {
  id: string;
  name: string;
  areaHectares: number;
  coordinates: [number, number][];
  isValid: boolean;
  error?: string;
}

type FileType = "shapefile" | "kml" | "geojson" | "gpx";

export default function FieldImport() {
  const [, setLocation] = useLocation();
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<FileType | null>(null);
  const [importedFields, setImportedFields] = useState<ImportedField[]>([]);
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [targetFarm, setTargetFarm] = useState<string>("");
  const [mapInstance, setMapInstance] = useState<mapboxgl.Map | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Get farms for assignment
  const { data: farms } = trpc.farms.list.useQuery();
  
  // Create field mutation
  const createField = trpc.fields.create.useMutation();
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Detect file type
    const ext = file.name.split('.').pop()?.toLowerCase();
    let type: FileType | null = null;
    
    if (ext === 'shp' || ext === 'zip') type = 'shapefile';
    else if (ext === 'kml' || ext === 'kmz') type = 'kml';
    else if (ext === 'geojson' || ext === 'json') type = 'geojson';
    else if (ext === 'gpx') type = 'gpx';
    
    if (!type) {
      toast.error("Formato de arquivo não suportado");
      return;
    }
    
    setSelectedFile(file);
    setFileType(type);
  };
  
  const processFile = async () => {
    if (!selectedFile) return;
    
    setIsProcessing(true);
    setProcessingProgress(0);
    
    try {
      // Simulate file processing
      // In production, use shpjs, togeojson, etc.
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(r => setTimeout(r, 200));
        setProcessingProgress(i);
      }
      
      // Mock imported fields
      const mockFields: ImportedField[] = [
        {
          id: "1",
          name: "Talhão Norte",
          areaHectares: 45.3,
          coordinates: [[-54.6, -20.5], [-54.5, -20.5], [-54.5, -20.4], [-54.6, -20.4]],
          isValid: true,
        },
        {
          id: "2",
          name: "Talhão Sul",
          areaHectares: 32.8,
          coordinates: [[-54.7, -20.6], [-54.6, -20.6], [-54.6, -20.5], [-54.7, -20.5]],
          isValid: true,
        },
        {
          id: "3",
          name: "Área Irregular",
          areaHectares: 15.2,
          coordinates: [[-54.5, -20.55], [-54.45, -20.55]],
          isValid: false,
          error: "Polígono com menos de 3 vértices",
        },
        {
          id: "4",
          name: "Talhão Leste",
          areaHectares: 28.6,
          coordinates: [[-54.55, -20.45], [-54.5, -20.45], [-54.5, -20.4], [-54.55, -20.4]],
          isValid: true,
        },
      ];
      
      setImportedFields(mockFields);
      setSelectedFields(new Set(mockFields.filter(f => f.isValid).map(f => f.id)));
      setShowPreview(true);
      
    } catch (error) {
      toast.error("Erro ao processar arquivo");
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleMapReady = useCallback((map: mapboxgl.Map) => {
    setMapInstance(map);
    
    map.on('load', () => {
      // Add all imported fields to map
      importedFields.forEach(field => {
        if (!field.isValid) return;
        
        const coordinates = field.coordinates.map(c => c as [number, number]);
        coordinates.push(coordinates[0]); // Close polygon
        
        map.addSource(`field-${field.id}`, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: { name: field.name },
            geometry: {
              type: 'Polygon',
              coordinates: [coordinates]
            }
          }
        });
        
        map.addLayer({
          id: `field-fill-${field.id}`,
          type: 'fill',
          source: `field-${field.id}`,
          paint: {
            'fill-color': selectedFields.has(field.id) ? '#22c55e' : '#9ca3af',
            'fill-opacity': 0.5
          }
        });
        
        map.addLayer({
          id: `field-outline-${field.id}`,
          type: 'line',
          source: `field-${field.id}`,
          paint: {
            'line-color': selectedFields.has(field.id) ? '#16a34a' : '#6b7280',
            'line-width': 2
          }
        });
      });
      
      // Fit to all fields
      const allCoords = importedFields
        .filter(f => f.isValid)
        .flatMap(f => f.coordinates);
      
      if (allCoords.length > 0) {
        const lngs = allCoords.map(c => c[0]);
        const lats = allCoords.map(c => c[1]);
        map.fitBounds(
          [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
          { padding: 40 }
        );
      }
    });
  }, [importedFields, selectedFields]);
  
  const toggleField = (id: string) => {
    const newSelected = new Set(selectedFields);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedFields(newSelected);
  };
  
  const handleImport = async () => {
    const fieldsToImport = importedFields.filter(f => selectedFields.has(f.id) && f.isValid);
    
    if (fieldsToImport.length === 0) {
      toast.error("Selecione pelo menos um talhão para importar");
      return;
    }
    
    setIsProcessing(true);
    
    try {
      for (const field of fieldsToImport) {
        await createField.mutateAsync({
          name: field.name,
          areaHectares: Math.round(field.areaHectares * 100), // Store as hectares * 100
          boundaries: JSON.stringify(field.coordinates.map(c => ({ lng: c[0], lat: c[1] }))),
          latitude: field.coordinates[0][1].toString(),
          longitude: field.coordinates[0][0].toString(),
        });
      }
      
      toast.success(`${fieldsToImport.length} talhões importados com sucesso!`);
      setLocation("/fields");
      
    } catch (error) {
      toast.error("Erro ao importar talhões");
    } finally {
      setIsProcessing(false);
    }
  };
  
  const totalArea = importedFields
    .filter(f => selectedFields.has(f.id) && f.isValid)
    .reduce((sum, f) => sum + f.areaHectares, 0);
  
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white px-4 pt-4 pb-3 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => setLocation("/fields")} className="p-1">
            <ChevronLeft className="h-6 w-6" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Importar Talhões</h1>
            <p className="text-sm text-gray-500">Upload de arquivos SHP, KML, GeoJSON</p>
          </div>
        </div>
      </div>
      
      {!showPreview ? (
        // File Upload Section
        <div className="px-4 mt-6">
          {/* Drop Zone */}
          <div 
            className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center bg-white"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".shp,.zip,.kml,.kmz,.geojson,.json,.gpx"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            {selectedFile ? (
              <div className="space-y-3">
                <div className="w-16 h-16 bg-green-100 rounded-full mx-auto flex items-center justify-center">
                  <FileText className="h-8 w-8 text-green-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{selectedFile.name}</p>
                  <p className="text-sm text-gray-500">
                    {(selectedFile.size / 1024).toFixed(1)} KB • {fileType?.toUpperCase()}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={(e) => {
                  e.stopPropagation();
                  setSelectedFile(null);
                  setFileType(null);
                }}>
                  <X className="h-4 w-4 mr-1" />
                  Remover
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="w-16 h-16 bg-gray-100 rounded-full mx-auto flex items-center justify-center">
                  <Upload className="h-8 w-8 text-gray-400" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Clique para selecionar</p>
                  <p className="text-sm text-gray-500">ou arraste um arquivo aqui</p>
                </div>
              </div>
            )}
          </div>
          
          {/* Supported Formats */}
          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Formatos suportados:</h3>
            <div className="grid grid-cols-2 gap-3">
              <FormatCard
                icon={<Map className="h-5 w-5" />}
                title="Shapefile (.shp, .zip)"
                description="ArcGIS, QGIS"
              />
              <FormatCard
                icon={<MapPin className="h-5 w-5" />}
                title="KML (.kml, .kmz)"
                description="Google Earth"
              />
              <FormatCard
                icon={<FileText className="h-5 w-5" />}
                title="GeoJSON (.geojson)"
                description="Formato web"
              />
              <FormatCard
                icon={<Map className="h-5 w-5" />}
                title="GPX (.gpx)"
                description="GPS tracks"
              />
            </div>
          </div>
          
          {/* Process Button */}
          {selectedFile && (
            <Button
              className="w-full mt-6"
              onClick={processFile}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processando... {processingProgress}%
                </>
              ) : (
                <>
                  <FileUp className="h-4 w-4 mr-2" />
                  Processar Arquivo
                </>
              )}
            </Button>
          )}
          
          {isProcessing && (
            <Progress value={processingProgress} className="mt-4" />
          )}
        </div>
      ) : (
        // Preview Section
        <div className="pb-24">
          {/* Map Preview */}
          <div className="h-64">
            <MapboxMap
              onMapReady={handleMapReady}
              className="w-full h-full"
              initialCenter={[-54.6, -20.5]}
              initialZoom={11}
            />
          </div>
          
          {/* Summary */}
          <div className="px-4 mt-4">
            <div className="bg-white rounded-xl p-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {importedFields.filter(f => f.isValid).length}
                  </p>
                  <p className="text-sm text-gray-500">Talhões válidos</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{selectedFields.size}</p>
                  <p className="text-sm text-gray-500">Selecionados</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">{totalArea.toFixed(1)} ha</p>
                  <p className="text-sm text-gray-500">Área total</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Farm Assignment */}
          <div className="px-4 mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Atribuir à fazenda (opcional)
            </label>
            <Select value={targetFarm} onValueChange={setTargetFarm}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma fazenda" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Nenhuma</SelectItem>
                {farms?.map(farm => (
                  <SelectItem key={farm.id} value={farm.id.toString()}>
                    {farm.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Fields List */}
          <div className="px-4 mt-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Talhões encontrados
            </h3>
            <div className="space-y-2">
              {importedFields.map(field => (
                <div
                  key={field.id}
                  className={`bg-white rounded-xl p-4 border-2 transition-colors ${
                    field.isValid 
                      ? selectedFields.has(field.id) 
                        ? "border-green-500" 
                        : "border-transparent"
                      : "border-red-200 bg-red-50"
                  }`}
                  onClick={() => field.isValid && toggleField(field.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {field.isValid ? (
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                          selectedFields.has(field.id) 
                            ? "bg-green-500 text-white" 
                            : "bg-gray-200"
                        }`}>
                          {selectedFields.has(field.id) && <Check className="h-4 w-4" />}
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center">
                          <X className="h-4 w-4" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-gray-900">{field.name}</p>
                        {field.isValid ? (
                          <p className="text-sm text-gray-500">{field.areaHectares.toFixed(1)} ha</p>
                        ) : (
                          <p className="text-sm text-red-600">{field.error}</p>
                        )}
                      </div>
                    </div>
                    
                    {!field.isValid && (
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Actions */}
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4">
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => {
                  setShowPreview(false);
                  setImportedFields([]);
                  setSelectedFile(null);
                }}
              >
                Cancelar
              </Button>
              <Button 
                className="flex-1"
                onClick={handleImport}
                disabled={selectedFields.size === 0 || isProcessing}
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Importar {selectedFields.size} talhões
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Format Card Component
function FormatCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-white rounded-xl p-3 border border-gray-100">
      <div className="flex items-center gap-2 text-gray-700">
        {icon}
        <div>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
      </div>
    </div>
  );
}
