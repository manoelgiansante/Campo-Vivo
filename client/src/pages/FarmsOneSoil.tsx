import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Folder, 
  Plus, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  MapPin,
  ChevronRight,
  Loader2,
  Building2
} from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const FARM_COLORS = [
  "#22C55E", "#3B82F6", "#F59E0B", "#EF4444", "#8B5CF6", 
  "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#6366F1"
];

export default function FarmsOneSoil() {
  const [, setLocation] = useLocation();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingFarm, setEditingFarm] = useState<any>(null);
  const [newFarm, setNewFarm] = useState({
    name: "",
    description: "",
    city: "",
    state: "",
    color: "#22C55E",
  });

  // Fetch farms and fields
  const { data: farms, isLoading, refetch } = trpc.farms.list.useQuery();
  const { data: allFields } = trpc.fields.list.useQuery();

  // Mutations
  const createFarm = trpc.farms.create.useMutation({
    onSuccess: () => {
      toast.success("Fazenda criada com sucesso!");
      setShowCreateDialog(false);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error("Erro ao criar fazenda: " + error.message);
    },
  });

  const updateFarm = trpc.farms.update.useMutation({
    onSuccess: () => {
      toast.success("Fazenda atualizada!");
      setEditingFarm(null);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error("Erro ao atualizar: " + error.message);
    },
  });

  const deleteFarm = trpc.farms.delete.useMutation({
    onSuccess: () => {
      toast.success("Fazenda removida!");
      refetch();
    },
    onError: (error) => {
      toast.error("Erro ao remover: " + error.message);
    },
  });

  const resetForm = () => {
    setNewFarm({
      name: "",
      description: "",
      city: "",
      state: "",
      color: "#22C55E",
    });
  };

  const handleCreate = () => {
    if (!newFarm.name.trim()) {
      toast.error("Nome da fazenda é obrigatório");
      return;
    }
    createFarm.mutate(newFarm);
  };

  const handleUpdate = () => {
    if (!editingFarm || !newFarm.name.trim()) return;
    updateFarm.mutate({
      id: editingFarm.id,
      ...newFarm,
    });
  };

  const handleEdit = (farm: any) => {
    setEditingFarm(farm);
    setNewFarm({
      name: farm.name,
      description: farm.description || "",
      city: farm.city || "",
      state: farm.state || "",
      color: farm.color || "#22C55E",
    });
  };

  const handleDelete = (farmId: number) => {
    if (confirm("Tem certeza que deseja remover esta fazenda? Os campos não serão deletados.")) {
      deleteFarm.mutate({ id: farmId });
    }
  };

  // Count fields per farm
  const getFieldCount = (farmId: number) => {
    return allFields?.filter(f => f.farmId === farmId).length || 0;
  };

  // Get total area per farm
  const getTotalArea = (farmId: number) => {
    const farmFields = allFields?.filter(f => f.farmId === farmId) || [];
    const total = farmFields.reduce((sum, f) => sum + (f.areaHectares || 0), 0);
    return (total / 100).toFixed(1);
  };

  // Fields without farm
  const unassignedFields = allFields?.filter(f => !f.farmId) || [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-24">
      {/* Header */}
      <div className="bg-white px-4 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Fazendas</h1>
            <p className="text-sm text-gray-500">Organize seus campos em grupos</p>
          </div>
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-green-600 hover:bg-green-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nova Fazenda
          </Button>
        </div>
      </div>

      {/* Farms List */}
      <div className="p-4 space-y-3">
        {farms?.map((farm) => (
          <div
            key={farm.id}
            className="bg-white rounded-xl shadow-sm overflow-hidden"
          >
            <div className="p-4">
              <div className="flex items-start justify-between">
                <div 
                  className="flex items-center gap-3 flex-1 cursor-pointer"
                  onClick={() => setLocation(`/farms/${farm.id}`)}
                >
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${farm.color}20` }}
                  >
                    <Building2 className="h-6 w-6" style={{ color: farm.color || "#22C55E" }} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{farm.name}</h3>
                    {farm.city && (
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {farm.city}{farm.state ? `, ${farm.state}` : ""}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleEdit(farm)}>
                      <Edit2 className="h-4 w-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => handleDelete(farm.id)}
                      className="text-red-600"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remover
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Stats */}
              <div className="flex gap-4 mt-3 pt-3 border-t">
                <div className="text-center">
                  <div className="text-lg font-bold text-gray-900">{getFieldCount(farm.id)}</div>
                  <div className="text-xs text-gray-500">Campos</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-gray-900">{getTotalArea(farm.id)} ha</div>
                  <div className="text-xs text-gray-500">Área Total</div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Unassigned Fields Section */}
        {unassignedFields.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
                  <Folder className="h-6 w-6 text-gray-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">Sem Fazenda</h3>
                  <p className="text-sm text-gray-500">
                    {unassignedFields.length} campo{unassignedFields.length !== 1 ? 's' : ''} não atribuído{unassignedFields.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {(!farms || farms.length === 0) && unassignedFields.length === 0 && (
          <div className="text-center py-12">
            <Building2 className="h-16 w-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma fazenda</h3>
            <p className="text-gray-500 mb-4">Crie fazendas para organizar seus campos</p>
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="bg-green-600 hover:bg-green-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Criar primeira fazenda
            </Button>
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog 
        open={showCreateDialog || !!editingFarm} 
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateDialog(false);
            setEditingFarm(null);
            resetForm();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingFarm ? "Editar Fazenda" : "Nova Fazenda"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input
                placeholder="Ex: Fazenda Santa Maria"
                value={newFarm.name}
                onChange={(e) => setNewFarm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div>
              <Label>Descrição</Label>
              <Input
                placeholder="Descrição opcional"
                value={newFarm.description}
                onChange={(e) => setNewFarm(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Cidade</Label>
                <Input
                  placeholder="Ex: Maracaju"
                  value={newFarm.city}
                  onChange={(e) => setNewFarm(prev => ({ ...prev, city: e.target.value }))}
                />
              </div>
              <div>
                <Label>Estado</Label>
                <Input
                  placeholder="Ex: MS"
                  value={newFarm.state}
                  onChange={(e) => setNewFarm(prev => ({ ...prev, state: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label>Cor</Label>
              <div className="flex gap-2 mt-2">
                {FARM_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewFarm(prev => ({ ...prev, color }))}
                    className={`w-8 h-8 rounded-full transition-transform ${
                      newFarm.color === color ? "ring-2 ring-offset-2 ring-gray-400 scale-110" : ""
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false);
                setEditingFarm(null);
                resetForm();
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={editingFarm ? handleUpdate : handleCreate}
              className="bg-green-600 hover:bg-green-700"
              disabled={createFarm.isPending || updateFarm.isPending}
            >
              {(createFarm.isPending || updateFarm.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingFarm ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
