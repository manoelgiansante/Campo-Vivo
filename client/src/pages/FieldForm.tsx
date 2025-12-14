import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, MapPin, Save, Loader2 } from "lucide-react";
import { useLocation, useParams } from "wouter";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { MapView } from "@/components/Map";

type FieldFormData = {
  name: string;
  description: string;
  areaHectares: string;
  latitude: string;
  longitude: string;
  address: string;
  city: string;
  state: string;
  country: string;
  soilType: string;
  irrigationType: "none" | "drip" | "sprinkler" | "pivot" | "flood";
};

const initialFormData: FieldFormData = {
  name: "",
  description: "",
  areaHectares: "",
  latitude: "",
  longitude: "",
  address: "",
  city: "",
  state: "",
  country: "Brasil",
  soilType: "",
  irrigationType: "none",
};

export default function FieldForm() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id?: string }>();
  const isEditing = params.id && params.id !== "new";
  const fieldId = isEditing ? parseInt(params.id!) : null;

  const [formData, setFormData] = useState<FieldFormData>(initialFormData);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);

  const { data: existingField, isLoading: isLoadingField } = trpc.fields.getById.useQuery(
    { id: fieldId! },
    { enabled: !!fieldId }
  );

  const createMutation = trpc.fields.create.useMutation({
    onSuccess: (data) => {
      toast.success("Campo criado com sucesso!");
      setLocation(`/fields/${data.id}`);
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao criar campo");
    },
  });

  const updateMutation = trpc.fields.update.useMutation({
    onSuccess: () => {
      toast.success("Campo atualizado com sucesso!");
      setLocation(`/fields/${fieldId}`);
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao atualizar campo");
    },
  });

  useEffect(() => {
    if (existingField) {
      setFormData({
        name: existingField.name,
        description: existingField.description || "",
        areaHectares: existingField.areaHectares ? (existingField.areaHectares / 100).toString() : "",
        latitude: existingField.latitude || "",
        longitude: existingField.longitude || "",
        address: existingField.address || "",
        city: existingField.city || "",
        state: existingField.state || "",
        country: existingField.country || "Brasil",
        soilType: existingField.soilType || "",
        irrigationType: existingField.irrigationType || "none",
      });
      if (existingField.latitude && existingField.longitude) {
        setMapCenter({
          lat: parseFloat(existingField.latitude),
          lng: parseFloat(existingField.longitude),
        });
      }
    }
  }, [existingField]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error("Nome do campo é obrigatório");
      return;
    }

    const data = {
      name: formData.name.trim(),
      description: formData.description.trim() || undefined,
      areaHectares: formData.areaHectares ? Math.round(parseFloat(formData.areaHectares) * 100) : undefined,
      latitude: formData.latitude || undefined,
      longitude: formData.longitude || undefined,
      address: formData.address.trim() || undefined,
      city: formData.city.trim() || undefined,
      state: formData.state.trim() || undefined,
      country: formData.country.trim() || undefined,
      soilType: formData.soilType.trim() || undefined,
      irrigationType: formData.irrigationType,
    };

    if (isEditing && fieldId) {
      updateMutation.mutate({ id: fieldId, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleMapClick = (lat: number, lng: number) => {
    setFormData(prev => ({
      ...prev,
      latitude: lat.toFixed(6),
      longitude: lng.toFixed(6),
    }));
    setMapCenter({ lat, lng });
  };

  const handleMapReady = (map: google.maps.Map) => {
    // Set default center to Brazil if no coordinates
    if (!mapCenter) {
      map.setCenter({ lat: -15.7801, lng: -47.9292 });
      map.setZoom(4);
    }

    // Add click listener to set coordinates
    map.addListener("click", (e: google.maps.MapMouseEvent) => {
      if (e.latLng) {
        handleMapClick(e.latLng.lat(), e.latLng.lng());
      }
    });
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  if (isEditing && isLoadingField) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/fields")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isEditing ? "Editar Campo" : "Novo Campo"}
          </h1>
          <p className="text-muted-foreground">
            {isEditing ? "Atualize as informações do campo" : "Cadastre um novo campo agrícola"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Informações Básicas</CardTitle>
              <CardDescription>Dados principais do campo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Campo *</Label>
                <Input
                  id="name"
                  placeholder="Ex: Fazenda São João - Talhão 1"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  placeholder="Descreva características do campo..."
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="areaHectares">Área (hectares)</Label>
                  <Input
                    id="areaHectares"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Ex: 50.5"
                    value={formData.areaHectares}
                    onChange={(e) => setFormData(prev => ({ ...prev, areaHectares: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="soilType">Tipo de Solo</Label>
                  <Input
                    id="soilType"
                    placeholder="Ex: Latossolo Vermelho"
                    value={formData.soilType}
                    onChange={(e) => setFormData(prev => ({ ...prev, soilType: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="irrigationType">Sistema de Irrigação</Label>
                <Select
                  value={formData.irrigationType}
                  onValueChange={(value: FieldFormData["irrigationType"]) => 
                    setFormData(prev => ({ ...prev, irrigationType: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo de irrigação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem irrigação (Sequeiro)</SelectItem>
                    <SelectItem value="drip">Gotejamento</SelectItem>
                    <SelectItem value="sprinkler">Aspersão</SelectItem>
                    <SelectItem value="pivot">Pivô Central</SelectItem>
                    <SelectItem value="flood">Inundação</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Location */}
          <Card>
            <CardHeader>
              <CardTitle>Localização</CardTitle>
              <CardDescription>Endereço e coordenadas do campo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="address">Endereço</Label>
                <Input
                  id="address"
                  placeholder="Ex: Rodovia BR-060, Km 45"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">Cidade</Label>
                  <Input
                    id="city"
                    placeholder="Ex: Rio Verde"
                    value={formData.city}
                    onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="state">Estado</Label>
                  <Input
                    id="state"
                    placeholder="Ex: Goiás"
                    value={formData.state}
                    onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="latitude">Latitude</Label>
                  <Input
                    id="latitude"
                    placeholder="Ex: -17.7927"
                    value={formData.latitude}
                    onChange={(e) => setFormData(prev => ({ ...prev, latitude: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="longitude">Longitude</Label>
                  <Input
                    id="longitude"
                    placeholder="Ex: -50.9192"
                    value={formData.longitude}
                    onChange={(e) => setFormData(prev => ({ ...prev, longitude: e.target.value }))}
                  />
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                Clique no mapa abaixo para definir as coordenadas
              </p>
            </CardContent>
          </Card>

          {/* Map */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Mapa do Campo
              </CardTitle>
              <CardDescription>
                Clique no mapa para definir a localização do campo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] rounded-lg overflow-hidden border">
                <MapView
                  onMapReady={handleMapReady}
                  initialCenter={mapCenter || { lat: -15.7801, lng: -47.9292 }}
                  initialZoom={mapCenter ? 15 : 4}
                  className="h-full w-full"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-4 mt-6">
          <Button type="button" variant="outline" onClick={() => setLocation("/fields")}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting} className="gap-2">
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isEditing ? "Salvar Alterações" : "Criar Campo"}
          </Button>
        </div>
      </form>
    </div>
  );
}
