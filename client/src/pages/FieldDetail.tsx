import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  ArrowLeft, 
  MapPin, 
  Edit, 
  Trash2, 
  Leaf, 
  Cloud, 
  FileText,
  Droplets,
  Calendar,
  BarChart3,
  Plus,
  Loader2
} from "lucide-react";
import { useLocation, useParams } from "wouter";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { MapView } from "@/components/Map";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function FieldDetail() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const fieldId = parseInt(params.id);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);

  const { data: field, isLoading } = trpc.fields.getById.useQuery({ id: fieldId });
  const { data: crops } = trpc.crops.listByField.useQuery({ fieldId }, { enabled: !!field });
  const { data: notes } = trpc.notes.listByField.useQuery({ fieldId }, { enabled: !!field });
  const { data: ndviData } = trpc.ndvi.getByField.useQuery({ fieldId, limit: 5 }, { enabled: !!field });
  const { data: weather } = trpc.weather.getByField.useQuery({ fieldId }, { enabled: !!field });

  const deleteMutation = trpc.fields.delete.useMutation({
    onSuccess: () => {
      toast.success("Campo removido com sucesso");
      setLocation("/fields");
    },
    onError: () => {
      toast.error("Erro ao remover campo");
    },
  });

  const handleMapReady = (map: google.maps.Map) => {
    mapRef.current = map;
    
    if (field?.latitude && field?.longitude) {
      const position = {
        lat: parseFloat(field.latitude),
        lng: parseFloat(field.longitude),
      };
      map.setCenter(position);
      map.setZoom(15);
      
      new google.maps.marker.AdvancedMarkerElement({
        map,
        position,
        title: field.name,
      });
    }
  };

  if (isLoading) {
    return <FieldDetailSkeleton />;
  }

  if (!field) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Campo não encontrado</h2>
        <p className="text-muted-foreground mb-4">O campo solicitado não existe ou foi removido.</p>
        <Button onClick={() => setLocation("/fields")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para Campos
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/fields")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <MapPin className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{field.name}</h1>
                <p className="text-muted-foreground">
                  {field.city && field.state 
                    ? `${field.city}, ${field.state}` 
                    : field.address || "Localização não definida"}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2 ml-16 sm:ml-0">
          <Button variant="outline" onClick={() => setLocation(`/fields/${fieldId}/edit`)}>
            <Edit className="h-4 w-4 mr-2" />
            Editar
          </Button>
          <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
            <Trash2 className="h-4 w-4 mr-2" />
            Excluir
          </Button>
        </div>
      </div>

      {/* Field Info Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Área</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {field.areaHectares ? `${(field.areaHectares / 100).toFixed(1)} ha` : "-"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Irrigação</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              <Droplets className="h-5 w-5 text-blue-500" />
              {getIrrigationLabel(field.irrigationType)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tipo de Solo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{field.soilType || "-"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cultivos Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              <Leaf className="h-5 w-5 text-primary" />
              {crops?.filter(c => c.status === "growing").length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="map" className="space-y-4">
        <TabsList>
          <TabsTrigger value="map" className="gap-2">
            <MapPin className="h-4 w-4" />
            Mapa
          </TabsTrigger>
          <TabsTrigger value="crops" className="gap-2">
            <Leaf className="h-4 w-4" />
            Cultivos
          </TabsTrigger>
          <TabsTrigger value="weather" className="gap-2">
            <Cloud className="h-4 w-4" />
            Clima
          </TabsTrigger>
          <TabsTrigger value="ndvi" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            NDVI
          </TabsTrigger>
          <TabsTrigger value="notes" className="gap-2">
            <FileText className="h-4 w-4" />
            Notas
          </TabsTrigger>
        </TabsList>

        {/* Map Tab */}
        <TabsContent value="map">
          <Card>
            <CardHeader>
              <CardTitle>Localização do Campo</CardTitle>
              <CardDescription>
                {field.latitude && field.longitude 
                  ? `Coordenadas: ${field.latitude}, ${field.longitude}`
                  : "Coordenadas não definidas"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[500px] rounded-lg overflow-hidden border">
                <MapView
                  onMapReady={handleMapReady}
                  initialCenter={
                    field.latitude && field.longitude
                      ? { lat: parseFloat(field.latitude), lng: parseFloat(field.longitude) }
                      : { lat: -15.7801, lng: -47.9292 }
                  }
                  initialZoom={field.latitude ? 15 : 4}
                  className="h-full w-full"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Crops Tab */}
        <TabsContent value="crops">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Cultivos</CardTitle>
                <CardDescription>Histórico de plantios neste campo</CardDescription>
              </div>
              <Button onClick={() => setLocation(`/crops/new?fieldId=${fieldId}`)} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Novo Cultivo
              </Button>
            </CardHeader>
            <CardContent>
              {crops && crops.length > 0 ? (
                <div className="space-y-3">
                  {crops.map((crop) => (
                    <div key={crop.id} className="flex items-center justify-between p-4 rounded-lg border">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Leaf className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{crop.cropType}</p>
                          <p className="text-sm text-muted-foreground">
                            {crop.variety && `${crop.variety} • `}
                            {crop.season || "Safra não definida"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {crop.plantingDate && (
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">Plantio</p>
                            <p className="text-sm font-medium">
                              {format(new Date(crop.plantingDate), "dd/MM/yyyy")}
                            </p>
                          </div>
                        )}
                        <Badge variant={getCropStatusVariant(crop.status)}>
                          {getCropStatusLabel(crop.status)}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8">
                  <Leaf className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="font-medium">Nenhum cultivo registrado</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Adicione o primeiro cultivo deste campo
                  </p>
                  <Button onClick={() => setLocation(`/crops/new?fieldId=${fieldId}`)} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Cultivo
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Weather Tab */}
        <TabsContent value="weather">
          <Card>
            <CardHeader>
              <CardTitle>Previsão do Tempo</CardTitle>
              <CardDescription>Condições climáticas para os próximos dias</CardDescription>
            </CardHeader>
            <CardContent>
              {weather && weather.daily && weather.daily.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-5">
                  {weather.daily.slice(0, 5).map((day, index) => (
                    <div key={index} className="p-4 rounded-lg border text-center">
                      <p className="text-sm font-medium mb-2">
                        {format(new Date(day.date), "EEE, dd/MM", { locale: ptBR })}
                      </p>
                      <Cloud className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                      <p className="text-lg font-bold">
                        {day.temperatureMax?.toFixed(0)}°
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {day.temperatureMin?.toFixed(0)}°
                      </p>
                      {day.precipitation > 0 && (
                        <p className="text-xs text-blue-500 mt-1">
                          {day.precipitation.toFixed(1)}mm
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8">
                  <Cloud className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="font-medium">Dados climáticos não disponíveis</p>
                  <p className="text-sm text-muted-foreground">
                    Configure as coordenadas do campo para obter previsões
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* NDVI Tab */}
        <TabsContent value="ndvi">
          <Card>
            <CardHeader>
              <CardTitle>Índice de Vegetação (NDVI)</CardTitle>
              <CardDescription>Monitoramento da saúde das plantas via satélite</CardDescription>
            </CardHeader>
            <CardContent>
              {ndviData && ndviData.length > 0 ? (
                <div className="space-y-4">
                  {ndviData.map((data) => (
                    <div key={data.id} className="flex items-center justify-between p-4 rounded-lg border">
                      <div className="flex items-center gap-4">
                        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                          data.healthStatus === "excellent" ? "bg-green-100" :
                          data.healthStatus === "good" ? "bg-green-50" :
                          data.healthStatus === "moderate" ? "bg-yellow-50" :
                          data.healthStatus === "poor" ? "bg-orange-50" :
                          "bg-red-50"
                        }`}>
                          <BarChart3 className={`h-5 w-5 ${
                            data.healthStatus === "excellent" ? "text-green-600" :
                            data.healthStatus === "good" ? "text-green-500" :
                            data.healthStatus === "moderate" ? "text-yellow-600" :
                            data.healthStatus === "poor" ? "text-orange-500" :
                            "text-red-500"
                          }`} />
                        </div>
                        <div>
                          <p className="font-medium">
                            NDVI: {data.ndviAverage ? (data.ndviAverage / 1000).toFixed(2) : "-"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(data.captureDate), "dd/MM/yyyy")}
                          </p>
                        </div>
                      </div>
                      <Badge variant={getNdviStatusVariant(data.healthStatus)}>
                        {getNdviStatusLabel(data.healthStatus)}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8">
                  <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="font-medium">Dados NDVI não disponíveis</p>
                  <p className="text-sm text-muted-foreground">
                    Os dados de satélite serão atualizados automaticamente
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Notas de Campo</CardTitle>
                <CardDescription>Observações e registros de vistorias</CardDescription>
              </div>
              <Button onClick={() => setLocation(`/notes/new?fieldId=${fieldId}`)} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Nova Nota
              </Button>
            </CardHeader>
            <CardContent>
              {notes && notes.length > 0 ? (
                <div className="space-y-3">
                  {notes.map((note) => (
                    <div key={note.id} className="p-4 rounded-lg border">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium">{note.title || "Sem título"}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(note.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                        <Badge variant={getNoteTypeVariant(note.noteType)}>
                          {getNoteTypeLabel(note.noteType)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{note.content}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="font-medium">Nenhuma nota registrada</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Registre observações durante suas vistorias
                  </p>
                  <Button onClick={() => setLocation(`/notes/new?fieldId=${fieldId}`)} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Nota
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O campo "{field.name}" e todos os dados associados serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteMutation.mutate({ id: fieldId })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FieldDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10" />
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-16" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Skeleton className="h-10 w-96" />
      <Card>
        <CardContent className="p-0">
          <Skeleton className="h-[500px] w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

function getIrrigationLabel(type: string | null): string {
  const labels: Record<string, string> = {
    none: "Sequeiro",
    drip: "Gotejamento",
    sprinkler: "Aspersão",
    pivot: "Pivô Central",
    flood: "Inundação",
  };
  return labels[type || "none"] || "Não definido";
}

function getCropStatusVariant(status: string | null): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "growing": return "default";
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

function getNdviStatusVariant(status: string | null): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "excellent":
    case "good": return "default";
    case "moderate": return "secondary";
    case "poor":
    case "critical": return "destructive";
    default: return "outline";
  }
}

function getNdviStatusLabel(status: string | null): string {
  const labels: Record<string, string> = {
    excellent: "Excelente",
    good: "Bom",
    moderate: "Moderado",
    poor: "Ruim",
    critical: "Crítico",
  };
  return labels[status || ""] || "Desconhecido";
}

function getNoteTypeVariant(type: string | null): "default" | "secondary" | "destructive" | "outline" {
  switch (type) {
    case "problem": return "destructive";
    case "task": return "default";
    case "harvest": return "secondary";
    default: return "outline";
  }
}

function getNoteTypeLabel(type: string | null): string {
  const labels: Record<string, string> = {
    observation: "Observação",
    problem: "Problema",
    task: "Tarefa",
    harvest: "Colheita",
    application: "Aplicação",
  };
  return labels[type || "observation"] || type || "Observação";
}
