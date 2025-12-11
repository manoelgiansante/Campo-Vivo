import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  ArrowLeft, 
  Plus, 
  MapPin, 
  Loader2,
  Building2,
  Leaf,
  MoreVertical,
  FileText
} from "lucide-react";
import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

// NDVI color scale
const getNdviColor = (value: number): string => {
  if (value < 0.2) return "#d73027";
  if (value < 0.4) return "#fc8d59";
  if (value < 0.5) return "#fee08b";
  if (value < 0.6) return "#d9ef8b";
  if (value < 0.7) return "#91cf60";
  if (value < 0.8) return "#1a9850";
  return "#006837";
};

export default function FarmDetailOneSoil() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const farmId = parseInt(params.id || "0");
  
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedFieldId, setSelectedFieldId] = useState<string>("");

  // Fetch farm and fields
  const { data: farm, isLoading: loadingFarm } = trpc.farms.getById.useQuery(
    { id: farmId },
    { enabled: farmId > 0 }
  );
  const { data: farmFields, isLoading: loadingFields, refetch } = trpc.farms.getFields.useQuery(
    { id: farmId },
    { enabled: farmId > 0 }
  );
  const { data: allFields } = trpc.fields.list.useQuery();

  // Get NDVI for fields
  const fieldIds = farmFields?.map(f => f.id) || [];
  const { data: ndviData } = trpc.ndvi.getLatestBatch.useQuery(
    { fieldIds },
    { enabled: fieldIds.length > 0 }
  );

  // Mutation to assign field
  const assignField = trpc.farms.assignField.useMutation({
    onSuccess: () => {
      toast.success("Campo adicionado à fazenda!");
      setShowAssignDialog(false);
      setSelectedFieldId("");
      refetch();
    },
    onError: (error) => {
      toast.error("Erro: " + error.message);
    },
  });

  // Generate report mutation
  const generateReport = trpc.reports.generateFarmReport.useMutation({
    onSuccess: (data) => {
      // Open HTML report in new window
      const newWindow = window.open();
      if (newWindow) {
        newWindow.document.write(data.htmlContent);
        newWindow.document.close();
      }
      toast.success("Relatório gerado!");
    },
    onError: (error) => {
      toast.error("Erro ao gerar relatório: " + error.message);
    },
  });

  // Unassigned fields
  const unassignedFields = allFields?.filter(f => !f.farmId) || [];

  const handleAssign = () => {
    if (!selectedFieldId) return;
    assignField.mutate({
      fieldId: parseInt(selectedFieldId),
      farmId,
    });
  };

  const handleRemoveFromFarm = (fieldId: number) => {
    assignField.mutate({
      fieldId,
      farmId: null,
    });
  };

  // Calculate totals
  const totalArea = farmFields?.reduce((sum, f) => sum + (f.areaHectares || 0), 0) || 0;
  const avgNdvi = fieldIds.length > 0 && ndviData
    ? fieldIds.reduce((sum, id) => sum + (ndviData[id]?.ndviAverage || 0), 0) / fieldIds.length / 1000
    : 0;

  if (loadingFarm || loadingFields) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    );
  }

  if (!farm) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-500">Fazenda não encontrada</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-24">
      {/* Header */}
      <div className="bg-white px-4 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/farms")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${farm.color}20` }}
          >
            <Building2 className="h-5 w-5" style={{ color: farm.color || "#22C55E" }} />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900">{farm.name}</h1>
            {farm.city && (
              <p className="text-sm text-gray-500 flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {farm.city}{farm.state ? `, ${farm.state}` : ""}
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => generateReport.mutate({ farmId })}
            disabled={generateReport.isPending}
          >
            {generateReport.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 p-4">
        <div className="bg-white rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{farmFields?.length || 0}</div>
          <div className="text-xs text-gray-500">Campos</div>
        </div>
        <div className="bg-white rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{(totalArea / 100).toFixed(1)}</div>
          <div className="text-xs text-gray-500">Hectares</div>
        </div>
        <div className="bg-white rounded-xl p-4 text-center">
          <div 
            className="text-2xl font-bold"
            style={{ color: getNdviColor(avgNdvi) }}
          >
            {avgNdvi.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500">NDVI Médio</div>
        </div>
      </div>

      {/* Fields List */}
      <div className="px-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Campos</h2>
          <Button
            size="sm"
            onClick={() => setShowAssignDialog(true)}
            className="bg-green-600 hover:bg-green-700"
            disabled={unassignedFields.length === 0}
          >
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        </div>

        <div className="space-y-3">
          {farmFields?.map((field) => {
            const ndvi = ndviData?.[field.id]?.ndviAverage;
            const ndviValue = ndvi ? ndvi / 1000 : 0;
            
            return (
              <div
                key={field.id}
                className="bg-white rounded-xl p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div 
                    className="flex-1 cursor-pointer"
                    onClick={() => setLocation(`/fields/${field.id}`)}
                  >
                    <h3 className="font-medium text-gray-900">{field.name}</h3>
                    <p className="text-sm text-gray-500">
                      {field.areaHectares ? (field.areaHectares / 100).toFixed(1) : "-"} ha
                    </p>
                  </div>
                  
                  {/* NDVI */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: getNdviColor(ndviValue) }}
                      />
                      <span className="text-sm font-medium">{ndviValue.toFixed(2)}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveFromFarm(field.id)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      Remover
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}

          {(!farmFields || farmFields.length === 0) && (
            <div className="text-center py-8 bg-white rounded-xl">
              <Leaf className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">Nenhum campo nesta fazenda</p>
              {unassignedFields.length > 0 && (
                <Button
                  size="sm"
                  onClick={() => setShowAssignDialog(true)}
                  className="mt-3 bg-green-600 hover:bg-green-700"
                >
                  Adicionar campo
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Assign Field Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Campo à Fazenda</DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            <Select value={selectedFieldId} onValueChange={setSelectedFieldId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um campo" />
              </SelectTrigger>
              <SelectContent>
                {unassignedFields.map((field) => (
                  <SelectItem key={field.id} value={field.id.toString()}>
                    {field.name} - {field.areaHectares ? (field.areaHectares / 100).toFixed(1) : "-"} ha
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {unassignedFields.length === 0 && (
              <p className="text-sm text-gray-500 mt-2">
                Todos os campos já estão atribuídos a fazendas.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleAssign}
              disabled={!selectedFieldId || assignField.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {assignField.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
