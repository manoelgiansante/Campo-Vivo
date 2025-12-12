import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { 
  Folder, 
  ChevronDown, 
  Search, 
  Plus,
  MoreVertical,
  Leaf,
  Satellite,
  Wheat,
  Upload
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { FieldImportDialog } from "@/components/FieldImportDialog";
import { toast } from "sonner";

type MapLayer = "satellite" | "crop" | "vegetation";

interface ImportedField {
  name: string;
  coordinates: [number, number][];
  area?: number;
  properties?: Record<string, any>;
}

export default function FieldsList() {
  const [, setLocation] = useLocation();
  const [showLayerSheet, setShowLayerSheet] = useState(false);
  const [mapLayer, setMapLayer] = useState<MapLayer>("vegetation");

  const { data: fields, isLoading, refetch } = trpc.fields.list.useQuery();
  const createFieldMutation = trpc.fields.create.useMutation({
    onSuccess: () => refetch(),
  });

  // Handle import from KML/GeoJSON
  const handleImportFields = async (importedFields: ImportedField[]) => {
    let successCount = 0;
    let errorCount = 0;

    for (const field of importedFields) {
      try {
        // Calculate center point
        const lats = field.coordinates.map(c => c[1]);
        const lngs = field.coordinates.map(c => c[0]);
        const centerLat = lats.reduce((a, b) => a + b, 0) / lats.length;
        const centerLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;

        // Calculate approximate area in hectares
        const areaHectares = field.area || calculatePolygonArea(field.coordinates);

        await createFieldMutation.mutateAsync({
          name: field.name,
          centerLat: centerLat.toString(),
          centerLng: centerLng.toString(),
          areaHectares: areaHectares.toString(),
          polygonCoordinates: field.coordinates.map(c => ({ lat: c[1], lng: c[0] })),
        });
        successCount++;
      } catch (err) {
        console.error(`Erro ao importar ${field.name}:`, err);
        errorCount++;
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount} campo(s) importado(s) com sucesso!`);
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} campo(s) falharam ao importar`);
    }
  };

  // Calculate polygon area in hectares using Shoelace formula
  const calculatePolygonArea = (coordinates: [number, number][]): number => {
    if (coordinates.length < 3) return 0;
    
    let area = 0;
    const n = coordinates.length;
    
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += coordinates[i][0] * coordinates[j][1];
      area -= coordinates[j][0] * coordinates[i][1];
    }
    
    area = Math.abs(area) / 2;
    // Convert from degrees² to hectares (approximate)
    // 1 degree ≈ 111km at equator, so 1 degree² ≈ 12321 km² = 1232100 ha
    const hectares = area * 12321 * 100;
    return Math.round(hectares * 10) / 10;
  };

  // Calculate total area
  const totalArea = fields?.reduce((sum, f) => sum + (f.areaHectares || 0), 0) || 0;

  if (isLoading) {
    return <FieldsListSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      {/* Header */}
      <div className="bg-gray-100 sticky top-0 z-10 px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Campos</h1>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 text-green-600 text-sm font-medium">
                  <Folder className="h-4 w-4" />
                  <span>Todos os campos</span>
                  <ChevronDown className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem>Todos os campos</DropdownMenuItem>
                <DropdownMenuItem>Criar grupo...</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-10 w-10">
              <Search className="h-5 w-5" />
            </Button>
            <FieldImportDialog
              onImport={handleImportFields}
              trigger={
                <Button variant="ghost" size="icon" className="h-10 w-10">
                  <Upload className="h-5 w-5" />
                </Button>
              }
            />
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-10 w-10"
              onClick={() => setLocation("/fields/new")}
            >
              <Plus className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-10 w-10">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Fields List */}
      <div className="px-4">
        {/* Group Header */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
          <span className="font-medium text-gray-700">Sem grupos</span>
          <span>{(totalArea / 100).toFixed(1)} ha</span>
        </div>

        {/* Fields */}
        {fields && fields.length > 0 ? (
          <div className="space-y-2">
            {fields.map((field) => (
              <FieldCard
                key={field.id}
                field={field}
                onClick={() => setLocation(`/fields/${field.id}`)}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-8 text-center">
            <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Leaf className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">No fields yet</h3>
            <p className="text-gray-500 text-sm mb-4">
              Add your first field to start monitoring
            </p>
            <Button 
              onClick={() => setLocation("/fields/new")}
              className="bg-green-600 hover:bg-green-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add field
            </Button>
          </div>
        )}
      </div>

      {/* Vegetation Button */}
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40">
        <Button
          onClick={() => setShowLayerSheet(true)}
          className="bg-gray-800/90 text-white hover:bg-gray-700 rounded-full px-6 h-10 gap-2 shadow-lg"
        >
          <Leaf className="h-4 w-4" />
          <span>Vegetation</span>
        </Button>
      </div>

      {/* Layer Selection Sheet */}
      <Sheet open={showLayerSheet} onOpenChange={setShowLayerSheet}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader>
            <SheetTitle>Camada do mapa</SheetTitle>
          </SheetHeader>
          <div className="py-6">
            <div className="flex gap-4 justify-center">
              <LayerButton
                icon={<Satellite className="h-6 w-6" />}
                label="Imagem de satélite"
                active={mapLayer === "satellite"}
                onClick={() => setMapLayer("satellite")}
                color="green"
              />
              <LayerButton
                icon={<Wheat className="h-6 w-6" />}
                label="Cultivo"
                active={mapLayer === "crop"}
                onClick={() => setMapLayer("crop")}
                color="blue"
              />
              <LayerButton
                icon={<Leaf className="h-6 w-6" />}
                label="Vegetação"
                active={mapLayer === "vegetation"}
                onClick={() => setMapLayer("vegetation")}
                color="green"
              />
            </div>

            {mapLayer === "vegetation" && (
              <div className="mt-6 space-y-2">
                <NdviOption label="NDVI Básico" active={true} onClick={() => {}} />
                <NdviOption label="NDVI Contrastado" active={false} onClick={() => {}} />
                <NdviOption label="NDVI Médio" active={false} onClick={() => {}} />
                <NdviOption label="NDVI Heterogeneidade" active={false} onClick={() => {}} />
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function FieldCard({ field, onClick }: { field: any; onClick: () => void }) {
  // Generate a simple NDVI value for display (in real app, this would come from satellite data)
  const ndviValue = field.ndviValue || 0.74;
  const ndviPercent = Math.min(100, Math.max(0, ndviValue * 100));

  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-2xl p-3 flex items-center gap-3 text-left hover:bg-gray-50 transition-colors"
    >
      {/* Field Thumbnail */}
      <div className="h-14 w-14 rounded-lg bg-gray-200 flex items-center justify-center overflow-hidden shrink-0">
        {field.boundaries ? (
          <FieldThumbnail boundaries={field.boundaries} />
        ) : (
          <Leaf className="h-6 w-6 text-green-600" />
        )}
      </div>

      {/* Field Info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-gray-900 truncate">{field.name}</h3>
        <p className="text-sm text-gray-500">
          {field.areaHectares ? (field.areaHectares / 100).toFixed(1) : '?'} ha
        </p>
      </div>

      {/* NDVI Indicator */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-16 h-2 rounded-full overflow-hidden bg-gray-200">
          <div 
            className="h-full rounded-full"
            style={{
              width: `${ndviPercent}%`,
              background: `linear-gradient(to right, #EF4444, #EAB308 50%, #22C55E)`,
            }}
          />
          <div 
            className="relative -mt-2"
            style={{ marginLeft: `${ndviPercent}%`, transform: 'translateX(-50%)' }}
          >
            <div className="w-0.5 h-3 bg-gray-800" />
          </div>
        </div>
        <span className="text-sm font-medium text-gray-700 w-10 text-right">
          {ndviValue.toFixed(2).replace('.', ',')}
        </span>
      </div>
    </button>
  );
}

function FieldThumbnail({ boundaries }: { boundaries: any }) {
  // Simple SVG representation of field shape
  try {
    const coords = typeof boundaries === 'string' ? JSON.parse(boundaries) : boundaries;
    if (!Array.isArray(coords) || coords.length < 3) {
      return <Leaf className="h-6 w-6 text-green-600" />;
    }

    // Normalize coordinates to fit in viewBox
    const lats = coords.map((c: any) => c.lat);
    const lngs = coords.map((c: any) => c.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    
    const padding = 2;
    const width = 50;
    const height = 50;
    
    const points = coords.map((c: any) => {
      const x = padding + ((c.lng - minLng) / (maxLng - minLng || 1)) * (width - padding * 2);
      const y = padding + ((maxLat - c.lat) / (maxLat - minLat || 1)) * (height - padding * 2);
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
        <polygon
          points={points}
          fill="#22C55E"
          stroke="#166534"
          strokeWidth="1"
        />
      </svg>
    );
  } catch {
    return <Leaf className="h-6 w-6 text-green-600" />;
  }
}

function LayerButton({ 
  icon, 
  label, 
  active, 
  onClick, 
  color 
}: { 
  icon: React.ReactNode; 
  label: string; 
  active: boolean; 
  onClick: () => void;
  color: "green" | "blue";
}) {
  const bgColor = color === "green" ? "bg-green-500" : "bg-blue-400";
  
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all ${
        active ? "ring-2 ring-gray-400 ring-offset-2" : ""
      }`}
    >
      <div className={`h-16 w-16 rounded-xl ${bgColor} flex items-center justify-center text-white`}>
        {icon}
      </div>
      <span className="text-xs text-center">{label}</span>
    </button>
  );
}

function NdviOption({ 
  label, 
  active, 
  onClick 
}: { 
  label: string; 
  active: boolean; 
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 rounded-xl transition-colors ${
        active ? "bg-gray-100 font-medium" : "hover:bg-gray-50"
      }`}
    >
      {label}
    </button>
  );
}

function FieldsListSkeleton() {
  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      <div className="px-4 pt-4">
        <Skeleton className="h-8 w-24 mb-2" />
        <Skeleton className="h-5 w-32 mb-4" />
        <Skeleton className="h-5 w-24 mb-3" />
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-3 flex items-center gap-3">
              <Skeleton className="h-14 w-14 rounded-lg" />
              <div className="flex-1">
                <Skeleton className="h-5 w-32 mb-1" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
