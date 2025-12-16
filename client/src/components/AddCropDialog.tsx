import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Leaf, Calendar, Wheat } from "lucide-react";

// Lista de culturas comuns no Brasil
const CROP_TYPES = [
  { value: "soja", label: "Soja", icon: "🌱" },
  { value: "milho", label: "Milho", icon: "🌽" },
  { value: "trigo", label: "Trigo", icon: "🌾" },
  { value: "algodao", label: "Algodão", icon: "☁️" },
  { value: "cafe", label: "Café", icon: "☕" },
  { value: "cana", label: "Cana-de-açúcar", icon: "🎋" },
  { value: "arroz", label: "Arroz", icon: "🍚" },
  { value: "feijao", label: "Feijão", icon: "🫘" },
  { value: "sorgo", label: "Sorgo", icon: "🌾" },
  { value: "girassol", label: "Girassol", icon: "🌻" },
  { value: "amendoim", label: "Amendoim", icon: "🥜" },
  { value: "batata", label: "Batata", icon: "🥔" },
  { value: "mandioca", label: "Mandioca", icon: "🌿" },
  { value: "tomate", label: "Tomate", icon: "🍅" },
  { value: "laranja", label: "Laranja", icon: "🍊" },
  { value: "pastagem", label: "Pastagem", icon: "🌿" },
  { value: "outro", label: "Outro", icon: "🌱" },
];

const CROP_STATUS = [
  { value: "planned", label: "Planejado" },
  { value: "planted", label: "Plantado" },
  { value: "growing", label: "Em crescimento" },
  { value: "harvested", label: "Colhido" },
];

interface AddCropDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fieldId: number;
  fieldName: string;
  onSuccess?: () => void;
}

export function AddCropDialog({ 
  open, 
  onOpenChange, 
  fieldId, 
  fieldName,
  onSuccess 
}: AddCropDialogProps) {
  const [cropType, setCropType] = useState("");
  const [variety, setVariety] = useState("");
  const [plantingDate, setPlantingDate] = useState("");
  const [expectedHarvestDate, setExpectedHarvestDate] = useState("");
  const [status, setStatus] = useState("planted");
  
  const utils = trpc.useUtils();
  
  const createCrop = trpc.crops.create.useMutation({
    onSuccess: () => {
      toast.success("Cultura adicionada com sucesso!");
      utils.crops.listByField.invalidate({ fieldId });
      onOpenChange(false);
      resetForm();
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao adicionar cultura");
    },
  });
  
  const resetForm = () => {
    setCropType("");
    setVariety("");
    setPlantingDate("");
    setExpectedHarvestDate("");
    setStatus("planted");
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!cropType) {
      toast.error("Selecione uma cultura");
      return;
    }
    
    createCrop.mutate({
      fieldId,
      cropType,
      variety: variety || undefined,
      plantingDate: plantingDate || undefined,
      expectedHarvestDate: expectedHarvestDate || undefined,
      status: status as any,
      season: `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`,
    });
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Leaf className="h-5 w-5 text-green-500" />
            Adicionar Cultura
          </DialogTitle>
          <DialogDescription>
            Adicione uma cultura ao campo <strong>{fieldName}</strong>
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tipo de Cultura */}
          <div className="space-y-2">
            <Label htmlFor="cropType">Cultura *</Label>
            <Select value={cropType} onValueChange={setCropType}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a cultura" />
              </SelectTrigger>
              <SelectContent>
                {CROP_TYPES.map((crop) => (
                  <SelectItem key={crop.value} value={crop.value}>
                    <span className="flex items-center gap-2">
                      <span>{crop.icon}</span>
                      <span>{crop.label}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Variedade */}
          <div className="space-y-2">
            <Label htmlFor="variety">Variedade / Cultivar</Label>
            <Input
              id="variety"
              placeholder="Ex: TMG 2383, P98Y12, etc."
              value={variety}
              onChange={(e) => setVariety(e.target.value)}
            />
          </div>
          
          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CROP_STATUS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Datas */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="plantingDate">Data de Plantio</Label>
              <Input
                id="plantingDate"
                type="date"
                value={plantingDate}
                onChange={(e) => setPlantingDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expectedHarvestDate">Previsão de Colheita</Label>
              <Input
                id="expectedHarvestDate"
                type="date"
                value={expectedHarvestDate}
                onChange={(e) => setExpectedHarvestDate(e.target.value)}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={createCrop.isPending}
              className="bg-green-500 hover:bg-green-600"
            >
              {createCrop.isPending ? "Salvando..." : "Adicionar Cultura"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
