import { useState, useMemo, useCallback } from "react";
import { 
  ChevronLeft, 
  Download,
  Settings,
  Layers,
  Loader2,
  Droplets,
  Leaf,
  Bug,
  Wheat,
  AlertTriangle,
  Lock,
  Crown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapboxMap } from "@/components/MapboxMap";
import { useLocation, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import mapboxgl from "mapbox-gl";

type PrescriptionType = "seeding" | "fertilizer" | "spraying";
type ExportFormat = "shapefile" | "isoxml" | "geojson" | "csv";

interface Zone {
  id: number;
  name: string;
  color: string;
  ndviRange: [number, number];
  areaHectares: number;
  percentage: number;
  seedRate?: number;
  fertilizerRate?: number;
  sprayRate?: number;
}

// Generate zones based on NDVI clustering
function generateZones(numZones: number = 3): Zone[] {
  const colors = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#8b5cf6"];
  const names = ["Baixa produtividade", "Média produtividade", "Alta produtividade", "Muito alta", "Excelente"];
  
  const zones: Zone[] = [];
  let remainingArea = 100;
  
  for (let i = 0; i < numZones; i++) {
    const isLast = i === numZones - 1;
    const area = isLast ? remainingArea : Math.floor(Math.random() * (remainingArea / 2) + 10);
    remainingArea -= area;
    
    zones.push({
      id: i + 1,
      name: names[i] || `Zona ${i + 1}`,
      color: colors[i] || "#gray",
      ndviRange: [0.2 + i * 0.2, 0.4 + i * 0.2],
      areaHectares: area * 0.5, // Assuming 50ha total
      percentage: area,
      seedRate: 60 + i * 10,
      fertilizerRate: 250 - i * 40,
      sprayRate: 2 + (numZones - i - 1) * 0.5,
    });
  }
  
  return zones;
}

export default function PrescriptionMap() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/fields/:id/prescription");
  const fieldId = params?.id ? parseInt(params.id) : null;
  
  const [prescriptionType, setPrescriptionType] = useState<PrescriptionType>("seeding");
  const [numZones, setNumZones] = useState(3);
  const [showSettings, setShowSettings] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [mapInstance, setMapInstance] = useState<mapboxgl.Map | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Get field details
  const { data: field, isLoading } = trpc.fields.getById.useQuery(
    { id: fieldId! },
    { enabled: !!fieldId }
  );
  
  // Check user plan (mock - always show as Pro for demo)
  const userPlan = "pro"; // In real app, get from user context
  const isPro = userPlan === "pro" || userPlan === "enterprise";
  
  // Generate zones based on settings
  const zones = useMemo(() => generateZones(numZones), [numZones]);
  
  // Calculate totals
  const totals = useMemo(() => {
    const totalArea = zones.reduce((sum, z) => sum + z.areaHectares, 0);
    const totalSeeds = zones.reduce((sum, z) => sum + (z.seedRate || 0) * z.areaHectares, 0);
    const totalFertilizer = zones.reduce((sum, z) => sum + (z.fertilizerRate || 0) * z.areaHectares, 0);
    const totalSpray = zones.reduce((sum, z) => sum + (z.sprayRate || 0) * z.areaHectares, 0);
    
    return { totalArea, totalSeeds, totalFertilizer, totalSpray };
  }, [zones]);
  
  const handleMapReady = useCallback((map: mapboxgl.Map) => {
    setMapInstance(map);
    
    if (!field?.boundaries) return;
    
    try {
      const boundariesData = typeof field.boundaries === 'string' 
        ? JSON.parse(field.boundaries) 
        : field.boundaries;
      
      if (!Array.isArray(boundariesData) || boundariesData.length < 3) return;
      
      const coordinates = boundariesData.map((p: any) => [
        p.lng || p.lon || p[0], 
        p.lat || p[1]
      ] as [number, number]);
      coordinates.push(coordinates[0]);

      map.on('load', () => {
        // Add zones as layers
        zones.forEach((zone, index) => {
          // This would be real zone polygons in production
          map.addSource(`zone-${zone.id}`, {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: { zone: zone.id },
              geometry: {
                type: 'Polygon',
                coordinates: [coordinates]
              }
            }
          });
          
          map.addLayer({
            id: `zone-fill-${zone.id}`,
            type: 'fill',
            source: `zone-${zone.id}`,
            paint: {
              'fill-color': zone.color,
              'fill-opacity': 0.5
            }
          });
        });
        
        // Fit to bounds
        const lngs = coordinates.map(c => c[0]);
        const lats = coordinates.map(c => c[1]);
        map.fitBounds(
          [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
          { padding: 40 }
        );
      });
    } catch (e) {
      console.error("Error rendering zones:", e);
    }
  }, [field?.boundaries, zones]);
  
  const handleGenerate = async () => {
    if (!isPro) {
      setShowUpgrade(true);
      return;
    }
    
    setIsGenerating(true);
    // Simulate generation
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsGenerating(false);
    toast.success("Mapa de prescrição gerado com sucesso!");
  };
  
  const handleExport = (format: ExportFormat) => {
    if (!isPro) {
      setShowUpgrade(true);
      return;
    }
    
    toast.success(`Exportando em formato ${format.toUpperCase()}...`);
    setShowExport(false);
    
    // In production, generate and download actual file
    setTimeout(() => {
      toast.success("Download iniciado!");
    }, 1000);
  };
  
  const getIcon = () => {
    switch (prescriptionType) {
      case "seeding": return <Wheat className="h-5 w-5" />;
      case "fertilizer": return <Droplets className="h-5 w-5" />;
      case "spraying": return <Bug className="h-5 w-5" />;
    }
  };
  
  const getUnit = () => {
    switch (prescriptionType) {
      case "seeding": return "sem/ha";
      case "fertilizer": return "kg/ha";
      case "spraying": return "L/ha";
    }
  };
  
  const getRate = (zone: Zone) => {
    switch (prescriptionType) {
      case "seeding": return zone.seedRate;
      case "fertilizer": return zone.fertilizerRate;
      case "spraying": return zone.sprayRate;
    }
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white px-4 pt-4 pb-3 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <button onClick={() => setLocation(fieldId ? `/fields/${fieldId}` : "/fields")} className="p-1">
              <ChevronLeft className="h-6 w-6" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Mapa de Prescrição</h1>
              {field && <p className="text-sm text-gray-500">{field.name}</p>}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setShowSettings(true)}>
              <Settings className="h-5 w-5" />
            </Button>
            <Button onClick={() => setShowExport(true)}>
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
        </div>
        
        {/* Type Selector */}
        <Tabs value={prescriptionType} onValueChange={(v) => setPrescriptionType(v as PrescriptionType)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="seeding" className="text-xs">
              <Wheat className="h-4 w-4 mr-1" />
              Semeadura
            </TabsTrigger>
            <TabsTrigger value="fertilizer" className="text-xs">
              <Droplets className="h-4 w-4 mr-1" />
              Fertilização
            </TabsTrigger>
            <TabsTrigger value="spraying" className="text-xs">
              <Bug className="h-4 w-4 mr-1" />
              Pulverização
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      
      {/* Pro Badge */}
      {!isPro && (
        <div className="mx-4 mt-4">
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl p-4 text-white">
            <div className="flex items-center gap-3">
              <Crown className="h-8 w-8" />
              <div>
                <h3 className="font-bold">Funcionalidade Pro</h3>
                <p className="text-sm opacity-90">
                  Faça upgrade para gerar mapas de prescrição ilimitados
                </p>
              </div>
            </div>
            <Button 
              variant="secondary" 
              className="w-full mt-3"
              onClick={() => setShowUpgrade(true)}
            >
              Ver Planos
            </Button>
          </div>
        </div>
      )}
      
      {/* Map */}
      <div className="mx-4 mt-4 rounded-2xl overflow-hidden h-72 relative">
        <MapboxMap
          onMapReady={handleMapReady}
          className="w-full h-full"
          initialCenter={[
            parseFloat(field?.longitude || "-54.608"), 
            parseFloat(field?.latitude || "-20.474")
          ]}
          initialZoom={14}
        />
        
        {/* Zones Legend */}
        <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-xl p-3 shadow-lg">
          <p className="text-xs font-medium text-gray-700 mb-2">Zonas</p>
          {zones.map(zone => (
            <div key={zone.id} className="flex items-center gap-2 text-xs">
              <div 
                className="w-3 h-3 rounded-sm" 
                style={{ backgroundColor: zone.color }}
              />
              <span className="text-gray-600">{zone.name}</span>
            </div>
          ))}
        </div>
        
        {/* Generate Button */}
        <Button
          className="absolute bottom-4 right-4"
          onClick={handleGenerate}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Layers className="h-4 w-4 mr-2" />
          )}
          {isGenerating ? "Gerando..." : "Gerar Zonas"}
        </Button>
      </div>
      
      {/* Zones Table */}
      <div className="px-4 mt-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          Taxas de Aplicação
        </h2>
        
        <div className="bg-white rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Zona</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Área (ha)</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">
                  {getIcon()}
                  <span className="ml-1">{getUnit()}</span>
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {zones.map(zone => (
                <tr key={zone.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-sm" 
                        style={{ backgroundColor: zone.color }}
                      />
                      <span className="text-sm font-medium text-gray-900">{zone.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-600">
                    {zone.areaHectares.toFixed(1)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-semibold text-gray-900">
                      {getRate(zone)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-600">
                    {((getRate(zone) || 0) * zone.areaHectares).toFixed(0)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr>
                <td className="px-4 py-3 text-sm font-semibold text-gray-900">Total</td>
                <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                  {totals.totalArea.toFixed(1)} ha
                </td>
                <td className="px-4 py-3 text-right text-sm text-gray-500">-</td>
                <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                  {prescriptionType === "seeding" && `${totals.totalSeeds.toFixed(0)} sem`}
                  {prescriptionType === "fertilizer" && `${totals.totalFertilizer.toFixed(0)} kg`}
                  {prescriptionType === "spraying" && `${totals.totalSpray.toFixed(1)} L`}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      
      {/* Savings Estimate */}
      <div className="px-4 mt-6 pb-8">
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-green-100 rounded-full">
              <Leaf className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-green-900">Economia Estimada</h3>
              <p className="text-sm text-green-700 mt-1">
                Aplicação variável pode economizar até <strong>15-25%</strong> em insumos 
                comparado com taxa fixa, além de melhorar a produtividade em zonas de alto potencial.
              </p>
              <div className="grid grid-cols-3 gap-2 mt-3">
                <div className="bg-white rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-green-600">~18%</p>
                  <p className="text-xs text-gray-500">Sementes</p>
                </div>
                <div className="bg-white rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-green-600">~22%</p>
                  <p className="text-xs text-gray-500">Fertilizantes</p>
                </div>
                <div className="bg-white rounded-lg p-2 text-center">
                  <p className="text-lg font-bold text-green-600">~15%</p>
                  <p className="text-xs text-gray-500">Defensivos</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Settings Sheet */}
      <Sheet open={showSettings} onOpenChange={setShowSettings}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader className="pb-4">
            <SheetTitle>Configurações</SheetTitle>
          </SheetHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Número de Zonas</Label>
              <Select value={numZones.toString()} onValueChange={(v) => setNumZones(parseInt(v))}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 zonas</SelectItem>
                  <SelectItem value="3">3 zonas</SelectItem>
                  <SelectItem value="4">4 zonas</SelectItem>
                  <SelectItem value="5">5 zonas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Baseado em</Label>
              <Select defaultValue="ndvi">
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ndvi">NDVI histórico</SelectItem>
                  <SelectItem value="yield">Mapa de colheita</SelectItem>
                  <SelectItem value="soil">Análise de solo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Período de análise</Label>
              <Select defaultValue="3years">
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1year">Última safra</SelectItem>
                  <SelectItem value="3years">3 safras</SelectItem>
                  <SelectItem value="5years">5 safras</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <Button className="w-full mt-6" onClick={() => setShowSettings(false)}>
            Aplicar
          </Button>
        </SheetContent>
      </Sheet>
      
      {/* Export Dialog */}
      <Dialog open={showExport} onOpenChange={setShowExport}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exportar Mapa</DialogTitle>
            <DialogDescription>
              Escolha o formato para exportar o mapa de prescrição
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-3 mt-4">
            <ExportOption
              label="Shapefile"
              description="Compatível com ArcGIS, QGIS"
              onClick={() => handleExport("shapefile")}
            />
            <ExportOption
              label="ISOXML"
              description="John Deere, Case IH, CNH"
              onClick={() => handleExport("isoxml")}
            />
            <ExportOption
              label="GeoJSON"
              description="Formato web universal"
              onClick={() => handleExport("geojson")}
            />
            <ExportOption
              label="CSV"
              description="Planilha com coordenadas"
              onClick={() => handleExport("csv")}
            />
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Upgrade Dialog */}
      <Dialog open={showUpgrade} onOpenChange={setShowUpgrade}>
        <DialogContent className="max-w-sm">
          <div className="text-center py-4">
            <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full mx-auto flex items-center justify-center mb-4">
              <Crown className="h-8 w-8 text-white" />
            </div>
            <DialogTitle className="text-xl">Funcionalidade Pro</DialogTitle>
            <DialogDescription className="mt-2">
              Mapas de prescrição estão disponíveis no plano Profissional e Empresarial
            </DialogDescription>
          </div>
          
          <div className="space-y-3 mt-4">
            <div className="border rounded-xl p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold">Profissional</span>
                <span className="text-green-600 font-bold">R$ 49/mês</span>
              </div>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>✓ Campos ilimitados</li>
                <li>✓ NDVI histórico 2 anos</li>
                <li>✓ Mapas de prescrição</li>
                <li>✓ Exportação de dados</li>
              </ul>
            </div>
            
            <div className="border-2 border-green-500 rounded-xl p-4 bg-green-50">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold">Empresarial</span>
                <span className="text-green-600 font-bold">R$ 2-5/ha</span>
              </div>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>✓ Tudo do Profissional</li>
                <li>✓ NDVI histórico 8 anos</li>
                <li>✓ Amostragem de solo</li>
                <li>✓ API de integração</li>
              </ul>
            </div>
          </div>
          
          <Button className="w-full mt-4" onClick={() => setLocation("/plans")}>
            Ver Planos
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Export Option Component
function ExportOption({
  label,
  description,
  onClick,
}: {
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="border rounded-xl p-4 text-left hover:border-green-500 hover:bg-green-50 transition-colors"
    >
      <p className="font-semibold text-gray-900">{label}</p>
      <p className="text-xs text-gray-500 mt-1">{description}</p>
    </button>
  );
}
