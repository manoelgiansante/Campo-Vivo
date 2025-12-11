import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  MapPin, 
  Plus, 
  Search, 
  MoreVertical, 
  Edit, 
  Trash2, 
  Eye,
  Droplets,
  Leaf,
  ArrowUpDown
} from "lucide-react";
import { useLocation } from "wouter";
import { useState, useMemo } from "react";
import { toast } from "sonner";

export default function Fields() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "area" | "date">("date");
  const [deleteFieldId, setDeleteFieldId] = useState<number | null>(null);

  const { data: fields, isLoading, refetch } = trpc.fields.list.useQuery();
  const deleteMutation = trpc.fields.delete.useMutation({
    onSuccess: () => {
      toast.success("Campo removido com sucesso");
      refetch();
      setDeleteFieldId(null);
    },
    onError: () => {
      toast.error("Erro ao remover campo");
    },
  });

  const filteredAndSortedFields = useMemo(() => {
    if (!fields) return [];
    
    let result = fields.filter(field => 
      field.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      field.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      field.state?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    result.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "area":
          return (b.areaHectares ?? 0) - (a.areaHectares ?? 0);
        case "date":
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return result;
  }, [fields, searchQuery, sortBy]);

  const handleDelete = () => {
    if (deleteFieldId) {
      deleteMutation.mutate({ id: deleteFieldId });
    }
  };

  if (isLoading) {
    return <FieldsSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Meus Campos</h1>
          <p className="text-muted-foreground">
            Gerencie seus campos agrícolas
          </p>
        </div>
        <Button onClick={() => setLocation("/fields/new")} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo Campo
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar campos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <ArrowUpDown className="h-4 w-4" />
              Ordenar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setSortBy("date")}>
              Mais recentes
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortBy("name")}>
              Nome (A-Z)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortBy("area")}>
              Maior área
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Fields Grid */}
      {filteredAndSortedFields.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredAndSortedFields.map((field) => (
            <Card 
              key={field.id} 
              className="field-card cursor-pointer group"
              onClick={() => setLocation(`/fields/${field.id}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{field.name}</CardTitle>
                      <CardDescription>
                        {field.city && field.state 
                          ? `${field.city}, ${field.state}` 
                          : field.city || field.state || "Localização não definida"}
                      </CardDescription>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setLocation(`/fields/${field.id}`); }}>
                        <Eye className="h-4 w-4 mr-2" />
                        Visualizar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setLocation(`/fields/${field.id}/edit`); }}>
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-destructive focus:text-destructive"
                        onClick={(e) => { e.stopPropagation(); setDeleteFieldId(field.id); }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 mb-3">
                  {field.areaHectares && (
                    <Badge variant="secondary" className="gap-1">
                      <MapPin className="h-3 w-3" />
                      {(field.areaHectares / 100).toFixed(1)} ha
                    </Badge>
                  )}
                  {field.irrigationType && field.irrigationType !== "none" && (
                    <Badge variant="secondary" className="gap-1">
                      <Droplets className="h-3 w-3" />
                      {getIrrigationLabel(field.irrigationType)}
                    </Badge>
                  )}
                  {field.soilType && (
                    <Badge variant="outline" className="gap-1">
                      <Leaf className="h-3 w-3" />
                      {field.soilType}
                    </Badge>
                  )}
                </div>
                {field.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {field.description}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <MapPin className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">
              {searchQuery ? "Nenhum campo encontrado" : "Nenhum campo cadastrado"}
            </h3>
            <p className="text-muted-foreground text-center mb-4">
              {searchQuery 
                ? "Tente buscar com outros termos" 
                : "Adicione seu primeiro campo para começar a monitorar suas culturas"}
            </p>
            {!searchQuery && (
              <Button onClick={() => setLocation("/fields/new")}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Campo
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteFieldId !== null} onOpenChange={() => setDeleteFieldId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O campo e todos os dados associados serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FieldsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="flex gap-4">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-24" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div>
                  <Skeleton className="h-5 w-32 mb-1" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-3">
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-5 w-20" />
              </div>
              <Skeleton className="h-4 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function getIrrigationLabel(type: string): string {
  const labels: Record<string, string> = {
    drip: "Gotejamento",
    sprinkler: "Aspersão",
    pivot: "Pivô",
    flood: "Inundação",
  };
  return labels[type] || type;
}
