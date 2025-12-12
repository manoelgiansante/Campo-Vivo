import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Leaf, 
  Plus, 
  Calendar,
  Loader2,
  Search,
  RotateCcw,
  Lightbulb,
  ArrowRight
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type CropFormData = {
  fieldId: number | null;
  cropType: string;
  variety: string;
  plantingDate: string;
  expectedHarvestDate: string;
  status: "planned" | "planted" | "growing" | "harvested" | "failed";
  areaHectares: string;
  expectedYield: string;
  notes: string;
  season: string;
};

const initialFormData: CropFormData = {
  fieldId: null,
  cropType: "",
  variety: "",
  plantingDate: "",
  expectedHarvestDate: "",
  status: "planned",
  areaHectares: "",
  expectedYield: "",
  notes: "",
  season: "",
};

const CROP_TYPES = [
  "Soja", "Milho", "Trigo", "Algodão", "Café", "Cana-de-açúcar",
  "Feijão", "Arroz", "Sorgo", "Girassol", "Amendoim", "Mandioca",
  "Aveia", "Cevada", "Centeio", "Milheto", "Canola", "Outro"
];

export default function Crops() {
  const [showNewCropDialog, setShowNewCropDialog] = useState(false);
  const [formData, setFormData] = useState<CropFormData>(initialFormData);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFieldForRotation, setSelectedFieldForRotation] = useState<number | null>(null);

  const { data: crops, isLoading, refetch } = trpc.crops.list.useQuery();
  const { data: fields } = trpc.fields.list.useQuery();
  // Rotation suggestions - using simulated data for now
  const rotationSuggestions = selectedFieldForRotation ? [
    { crop: "Milho", reason: "Boa rotação após soja" },
    { crop: "Feijão", reason: "Fixação de nitrogênio" },
  ] : [];
  
  const createMutation = trpc.crops.create.useMutation({
    onSuccess: () => {
      toast.success("Cultivo criado com sucesso!");
      setShowNewCropDialog(false);
      setFormData(initialFormData);
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao criar cultivo");
    },
  });

  const filteredCrops = useMemo(() => {
    if (!crops) return [];
    if (!searchQuery) return crops;
    
    return crops.filter((crop: any) => 
      crop.cropType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      crop.variety?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [crops, searchQuery]);

  const activeCrops = filteredCrops.filter((c: any) => c.status === "growing" || c.status === "planted");
  const plannedCrops = filteredCrops.filter((c: any) => c.status === "planned");
  const harvestedCrops = filteredCrops.filter((c: any) => c.status === "harvested" || c.status === "failed");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.cropType.trim()) {
      toast.error("Tipo de cultivo é obrigatório");
      return;
    }
    if (!formData.fieldId) {
      toast.error("Selecione um campo");
      return;
    }

    createMutation.mutate({
      fieldId: formData.fieldId,
      cropType: formData.cropType.trim(),
      variety: formData.variety.trim() || undefined,
      plantingDate: formData.plantingDate ? new Date(formData.plantingDate) : undefined,
      expectedHarvestDate: formData.expectedHarvestDate ? new Date(formData.expectedHarvestDate) : undefined,
    });
  };

  const getCurrentSeason = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    // Brazilian agricultural calendar: July-June
    if (month >= 6) {
      return `${year}/${year + 1}`;
    }
    return `${year - 1}/${year}`;
  };

  if (isLoading) {
    return <CropsSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cultivos</h1>
          <p className="text-muted-foreground">
            {activeCrops.length} ativos • {plannedCrops.length} planejados • {harvestedCrops.length} finalizados
          </p>
        </div>
        <Button onClick={() => {
          setFormData(prev => ({ ...prev, season: getCurrentSeason() }));
          setShowNewCropDialog(true);
        }} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Cultivo
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar cultivos..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active" className="gap-2">
            <Leaf className="h-4 w-4" />
            Ativos ({activeCrops.length})
          </TabsTrigger>
          <TabsTrigger value="planned" className="gap-2">
            <Calendar className="h-4 w-4" />
            Planejados ({plannedCrops.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Histórico ({harvestedCrops.length})
          </TabsTrigger>
          <TabsTrigger value="rotation" className="gap-2">
            <Lightbulb className="h-4 w-4" />
            Rotação
          </TabsTrigger>
        </TabsList>

        {/* Active Crops */}
        <TabsContent value="active">
          {activeCrops.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activeCrops.map((crop: any) => (
                <CropCard key={crop.id} crop={crop} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Leaf}
              title="Nenhum cultivo ativo"
              description="Adicione um novo cultivo ou atualize o status de um cultivo planejado"
              action={
                <Button onClick={() => setShowNewCropDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Cultivo
                </Button>
              }
            />
          )}
        </TabsContent>

        {/* Planned Crops */}
        <TabsContent value="planned">
          {plannedCrops.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {plannedCrops.map((crop: any) => (
                <CropCard key={crop.id} crop={crop} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Calendar}
              title="Nenhum cultivo planejado"
              description="Planeje seus próximos cultivos para a temporada"
              action={
                <Button onClick={() => setShowNewCropDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Planejar Cultivo
                </Button>
              }
            />
          )}
        </TabsContent>

        {/* History */}
        <TabsContent value="history">
          {harvestedCrops.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {harvestedCrops.map((crop: any) => (
                <CropCard key={crop.id} crop={crop} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={RotateCcw}
              title="Nenhum histórico"
              description="O histórico de cultivos colhidos aparecerá aqui"
            />
          )}
        </TabsContent>

        {/* Rotation */}
        <TabsContent value="rotation">
          <Card>
            <CardHeader>
              <CardTitle>Sugestões de Rotação de Cultivos</CardTitle>
              <CardDescription>
                Selecione um campo para ver sugestões baseadas no histórico de plantios
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="max-w-md">
                <Label>Campo</Label>
                <Select
                  value={selectedFieldForRotation?.toString() || ""}
                  onValueChange={(value) => setSelectedFieldForRotation(parseInt(value))}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Selecione um campo" />
                  </SelectTrigger>
                  <SelectContent>
                    {fields?.map((field) => (
                      <SelectItem key={field.id} value={field.id.toString()}>
                        {field.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedFieldForRotation && rotationSuggestions && rotationSuggestions.length > 0 && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-3">Cultivos sugeridos para próxima safra:</h4>
                    <div className="grid gap-3 md:grid-cols-3">
                      {rotationSuggestions.map((suggestion: any, index: number) => (
                        <Card key={index} className="cursor-pointer hover:border-primary transition-colors"
                          onClick={() => {
                            setFormData(prev => ({
                              ...prev,
                              fieldId: selectedFieldForRotation,
                              cropType: suggestion.crop,
                              season: getCurrentSeason(),
                            }));
                            setShowNewCropDialog(true);
                          }}
                        >
                          <CardContent className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Leaf className="h-5 w-5 text-primary" />
                              </div>
                              <span className="font-medium">{suggestion.crop}</span>
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    As sugestões são baseadas em práticas comuns de rotação de cultivos no Brasil.
                    Considere também as condições do solo e clima da sua região.
                  </p>
                </div>
              )}

              {!selectedFieldForRotation && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Lightbulb className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    Selecione um campo para ver sugestões de rotação
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* New Crop Dialog */}
      <Dialog open={showNewCropDialog} onOpenChange={setShowNewCropDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Cultivo</DialogTitle>
            <DialogDescription>
              Registre um novo cultivo para acompanhar seu desenvolvimento
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
              <div className="space-y-2">
                <Label>Campo *</Label>
                <Select
                  value={formData.fieldId?.toString() || ""}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, fieldId: parseInt(value) }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o campo" />
                  </SelectTrigger>
                  <SelectContent>
                    {fields?.map((field) => (
                      <SelectItem key={field.id} value={field.id.toString()}>
                        {field.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de Cultivo *</Label>
                  <Select
                    value={formData.cropType}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, cropType: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {CROP_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="variety">Variedade</Label>
                  <Input
                    id="variety"
                    placeholder="Ex: TMG 2381"
                    value={formData.variety}
                    onChange={(e) => setFormData(prev => ({ ...prev, variety: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="season">Safra</Label>
                  <Input
                    id="season"
                    placeholder="Ex: 2024/2025"
                    value={formData.season}
                    onChange={(e) => setFormData(prev => ({ ...prev, season: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: CropFormData["status"]) => 
                      setFormData(prev => ({ ...prev, status: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planned">Planejado</SelectItem>
                      <SelectItem value="planted">Plantado</SelectItem>
                      <SelectItem value="growing">Em Crescimento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="plantingDate">Data de Plantio</Label>
                  <Input
                    id="plantingDate"
                    type="date"
                    value={formData.plantingDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, plantingDate: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expectedHarvestDate">Previsão de Colheita</Label>
                  <Input
                    id="expectedHarvestDate"
                    type="date"
                    value={formData.expectedHarvestDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, expectedHarvestDate: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="areaHectares">Área (ha)</Label>
                  <Input
                    id="areaHectares"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Ex: 50"
                    value={formData.areaHectares}
                    onChange={(e) => setFormData(prev => ({ ...prev, areaHectares: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expectedYield">Produtividade Esperada (kg/ha)</Label>
                  <Input
                    id="expectedYield"
                    type="number"
                    min="0"
                    placeholder="Ex: 3500"
                    value={formData.expectedYield}
                    onChange={(e) => setFormData(prev => ({ ...prev, expectedYield: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  placeholder="Informações adicionais sobre o cultivo..."
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowNewCropDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Criar Cultivo
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CropCard({ crop }: { crop: any }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Leaf className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{crop.cropType}</CardTitle>
              <CardDescription>
                {crop.variety || "Variedade não especificada"}
              </CardDescription>
            </div>
          </div>
          <Badge variant={getCropStatusVariant(crop.status)}>
            {getCropStatusLabel(crop.status)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          {crop.season && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Safra</span>
              <span className="font-medium">{crop.season}</span>
            </div>
          )}
          {crop.plantingDate && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Plantio</span>
              <span className="font-medium">
                {format(new Date(crop.plantingDate), "dd/MM/yyyy")}
              </span>
            </div>
          )}
          {crop.areaHectares && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Área</span>
              <span className="font-medium">{(crop.areaHectares / 100).toFixed(1)} ha</span>
            </div>
          )}
          {crop.expectedYield && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Produtividade esperada</span>
              <span className="font-medium">{crop.expectedYield} kg/ha</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ 
  icon: Icon, 
  title, 
  description, 
  action 
}: { 
  icon: React.ElementType; 
  title: string; 
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Icon className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-1">{title}</h3>
        <p className="text-muted-foreground text-center mb-4">{description}</p>
        {action}
      </CardContent>
    </Card>
  );
}

function CropsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <Skeleton className="h-8 w-24 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-10 w-96" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div>
                  <Skeleton className="h-5 w-24 mb-1" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function getCropStatusVariant(status: string | null): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "growing": return "default";
    case "planted": return "default";
    case "harvested": return "secondary";
    case "failed": return "destructive";
    default: return "outline";
  }
}

function getCropStatusLabel(status: string | null): string {
  const labels: Record<string, string> = {
    planned: "Planejado",
    planted: "Plantado",
    growing: "Em Crescimento",
    harvested: "Colhido",
    failed: "Perdido",
  };
  return labels[status || "planned"] || status || "Desconhecido";
}
