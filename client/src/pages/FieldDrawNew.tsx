import { trpc } from "@/lib/trpc";
import { MapboxMap, useMapbox } from "@/components/MapboxMap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { 
  X, 
  Hand, 
  Pencil, 
  Search,
  Navigation,
  Undo2,
  Loader2,
  Check
} from "lucide-react";
import { useState, useCallback, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import mapboxgl from "mapbox-gl";
import * as turf from "@turf/turf";

type DrawMode = "select" | "draw";

interface SuggestedField {
  id: string;
  area: number;
  coordinates: [number, number][];
  center: [number, number];
}

// Obter posição salva do mapa ou usar padrão
const getSavedMapPosition = () => {
  try {
    const saved = localStorage.getItem('campovivo_map_position');
    if (saved) {
      const pos = JSON.parse(saved);
      return { center: [pos.lng, pos.lat] as [number, number], zoom: pos.zoom || 15 };
    }
  } catch (e) {
    console.error('Erro ao carregar posição do mapa:', e);
  }
  return null;
};

export default function FieldDrawNew() {
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<DrawMode>("select");
  const modeRef = useRef<DrawMode>("select");
  const [points, setPoints] = useState<[number, number][]>([]);
  const [area, setArea] = useState<number>(0);
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [fieldName, setFieldName] = useState("");
  const [mapInstance, setMapInstance] = useState<mapboxgl.Map | null>(null);
  const { setMap, getUserLocation } = useMapbox();
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const labelMarkersRef = useRef<mapboxgl.Marker[]>([]);
  
  // Estado para campos sugeridos e selecionados
  const [suggestedFields, setSuggestedFields] = useState<SuggestedField[]>([]);
  const [selectedFieldIds, setSelectedFieldIds] = useState<Set<string>>(new Set());
  const [isLoadingFields, setIsLoadingFields] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Sincronizar ref com state
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const createField = trpc.fields.create.useMutation({
    onMutate: () => {
      setIsSaving(true);
      toast.loading("Salvando campo...", { id: "save-field" });
    },
    onSuccess: (data) => {
      toast.success("Campo criado com sucesso! 🌾", { 
        id: "save-field",
        description: "O campo foi salvo e aparecerá no mapa.",
        duration: 3000,
      });
      setIsSaving(false);
      setShowNameDialog(false);
      setFieldName("");
      // Limpar estados
      setPoints([]);
      setSelectedFieldIds(new Set());
      setSuggestedFields([]);
      // Voltar para o mapa principal sem redirecionar para uma cidade
      setTimeout(() => {
        setLocation("/map");
      }, 1500);
    },
    onError: (error) => {
      setIsSaving(false);
      toast.error("Erro ao criar campo", { 
        id: "save-field",
        description: error.message || "Tente novamente",
      });
    },
  });

  // Gerar campos sugeridos baseados na localização atual do mapa
  const generateSuggestedFields = useCallback((map: mapboxgl.Map) => {
    const center = map.getCenter();
    const zoom = map.getZoom();
    
    // Só gera campos se o zoom for suficiente
    if (zoom < 12) {
      setSuggestedFields([]);
      return;
    }

    setIsLoadingFields(true);
    
    // Simular carregamento de campos do satélite
    // Em produção, isso viria de uma API como OneSoil
    setTimeout(() => {
      const baseLng = center.lng;
      const baseLat = center.lat;
      
      // Gerar campos aleatórios ao redor do centro
      const fields: SuggestedField[] = [];
      const gridSize = 0.008; // ~800m
      
      for (let i = -2; i <= 2; i++) {
        for (let j = -2; j <= 2; j++) {
          // Pular alguns para criar padrão irregular
          if (Math.random() > 0.7) continue;
          
          const offsetLng = i * gridSize + (Math.random() - 0.5) * 0.003;
          const offsetLat = j * gridSize + (Math.random() - 0.5) * 0.003;
          
          // Criar polígono irregular
          const size = 0.002 + Math.random() * 0.004;
          const numPoints = 4 + Math.floor(Math.random() * 3);
          const coords: [number, number][] = [];
          
          for (let p = 0; p < numPoints; p++) {
            const angle = (p / numPoints) * Math.PI * 2;
            const r = size * (0.8 + Math.random() * 0.4);
            coords.push([
              baseLng + offsetLng + Math.cos(angle) * r,
              baseLat + offsetLat + Math.sin(angle) * r
            ]);
          }
          
          // Calcular área
          const polygon = turf.polygon([[...coords, coords[0]]]);
          const areaHa = turf.area(polygon) / 10000;
          
          if (areaHa > 1 && areaHa < 100) {
            const centroid = turf.centroid(polygon);
            fields.push({
              id: `field-${i}-${j}`,
              area: Math.round(areaHa * 10) / 10,
              coordinates: coords,
              center: centroid.geometry.coordinates as [number, number]
            });
          }
        }
      }
      
      setSuggestedFields(fields);
      // Pré-selecionar todos os campos quando em modo select
      if (modeRef.current === "select") {
        setSelectedFieldIds(new Set(fields.map(f => f.id)));
      }
      setIsLoadingFields(false);
    }, 1000);
  }, []);

  // Renderizar campos sugeridos no mapa
  useEffect(() => {
    if (!mapInstance) return;

    // Limpar markers de labels anteriores
    labelMarkersRef.current.forEach(m => m.remove());
    labelMarkersRef.current = [];

    // Remover layers existentes
    suggestedFields.forEach(field => {
      if (mapInstance.getLayer(`suggested-${field.id}`)) {
        mapInstance.removeLayer(`suggested-${field.id}`);
      }
      if (mapInstance.getLayer(`suggested-${field.id}-outline`)) {
        mapInstance.removeLayer(`suggested-${field.id}-outline`);
      }
      if (mapInstance.getSource(`suggested-${field.id}`)) {
        mapInstance.removeSource(`suggested-${field.id}`);
      }
    });

    // Adicionar novos layers
    suggestedFields.forEach(field => {
      const isSelected = selectedFieldIds.has(field.id);
      const coords = [...field.coordinates, field.coordinates[0]] as [number, number][];
      const sourceId = `suggested-${field.id}`;

      mapInstance.addSource(sourceId, {
        type: "geojson",
        data: {
          type: "Feature",
          properties: { id: field.id, area: field.area },
          geometry: {
            type: "Polygon",
            coordinates: [coords]
          }
        }
      });

      // Fill layer
      mapInstance.addLayer({
        id: sourceId,
        type: "fill",
        source: sourceId,
        paint: {
          "fill-color": isSelected ? "#22c55e" : "#9ca3af",
          "fill-opacity": isSelected ? 0.6 : 0.4
        }
      });

      // Outline
      mapInstance.addLayer({
        id: `${sourceId}-outline`,
        type: "line",
        source: sourceId,
        paint: {
          "line-color": "#ffffff",
          "line-width": 2
        }
      });

      // Label marker
      const el = document.createElement("div");
      el.innerHTML = `
        <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-lg cursor-pointer transition-all ${
          isSelected 
            ? 'bg-green-500 text-white' 
            : 'bg-white/90 text-gray-800 hover:bg-white'
        }">
          ${isSelected ? '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>' : '<span class="text-sm">+</span>'}
          <span class="font-medium text-sm">${field.area} ha</span>
        </div>
      `;
      el.onclick = (e) => {
        e.stopPropagation();
        if (mode === "select") {
          toggleFieldSelection(field.id);
        }
      };

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat(field.center)
        .addTo(mapInstance);
      
      labelMarkersRef.current.push(marker);
    });
  }, [mapInstance, suggestedFields, selectedFieldIds, mode]);

  // Toggle seleção de campo
  const toggleFieldSelection = (fieldId: string) => {
    setSelectedFieldIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fieldId)) {
        newSet.delete(fieldId);
      } else {
        newSet.add(fieldId);
      }
      return newSet;
    });
  };

  // Calcular área total selecionada
  const totalSelectedArea = suggestedFields
    .filter(f => selectedFieldIds.has(f.id))
    .reduce((sum, f) => sum + f.area, 0);

  // Calculate area when points change (modo draw)
  useEffect(() => {
    if (points.length >= 3) {
      try {
        const closedPoints = [...points, points[0]];
        const polygon = turf.polygon([closedPoints]);
        const areaM2 = turf.area(polygon);
        const areaHa = areaM2 / 10000;
        setArea(areaHa);
      } catch (e) {
        setArea(0);
      }
    } else {
      setArea(0);
    }
  }, [points]);

  // Update polygon on map (modo draw)
  useEffect(() => {
    if (!mapInstance || mode !== "draw") return;

    // Clear existing markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // Remove existing polygon
    if (mapInstance.getLayer("draw-polygon")) {
      mapInstance.removeLayer("draw-polygon");
    }
    if (mapInstance.getLayer("draw-polygon-outline")) {
      mapInstance.removeLayer("draw-polygon-outline");
    }
    if (mapInstance.getSource("draw-polygon")) {
      mapInstance.removeSource("draw-polygon");
    }

    if (points.length > 0) {
      // Add markers for each point
      points.forEach((point, index) => {
        const el = document.createElement("div");
        el.className = "w-5 h-5 bg-white rounded-full border-2 border-green-500 shadow-md cursor-move";
        
        const marker = new mapboxgl.Marker({ 
          element: el, 
          draggable: true 
        })
          .setLngLat(point)
          .addTo(mapInstance);

        marker.on("dragend", () => {
          const lngLat = marker.getLngLat();
          setPoints(prev => {
            const newPoints = [...prev];
            newPoints[index] = [lngLat.lng, lngLat.lat];
            return newPoints;
          });
        });

        markersRef.current.push(marker);
      });

      // Draw polygon if we have at least 3 points
      if (points.length >= 3) {
        const closedPoints = [...points, points[0]];
        
        mapInstance.addSource("draw-polygon", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "Polygon",
              coordinates: [closedPoints],
            },
          },
        });

        mapInstance.addLayer({
          id: "draw-polygon",
          type: "fill",
          source: "draw-polygon",
          paint: {
            "fill-color": "#22C55E",
            "fill-opacity": 0.4,
          },
        });

        mapInstance.addLayer({
          id: "draw-polygon-outline",
          type: "line",
          source: "draw-polygon",
          paint: {
            "line-color": "#FFFFFF",
            "line-width": 2,
          },
        });
      }
    }
  }, [points, mode, mapInstance]);

  // Limpar quando mudar de modo
  useEffect(() => {
    if (mode === "draw") {
      // Limpar seleção de campos sugeridos
      setSelectedFieldIds(new Set());
    } else if (mode === "select") {
      // Limpar pontos desenhados
      setPoints([]);
      // Pré-selecionar todos os campos
      setSelectedFieldIds(new Set(suggestedFields.map(f => f.id)));
    }
  }, [mode, suggestedFields]);

  const handleMapReady = useCallback((map: mapboxgl.Map) => {
    setMap(map);
    setMapInstance(map);

    // Tentar usar posição salva primeiro
    const savedPos = getSavedMapPosition();
    if (savedPos) {
      map.setCenter(savedPos.center);
      map.setZoom(savedPos.zoom);
      // Carregar campos sugeridos após posicionar
      setTimeout(() => generateSuggestedFields(map), 500);
    } else {
      // Tentar geolocalização
      getUserLocation()
        .then(([lng, lat]) => {
          map.flyTo({
            center: [lng, lat],
            zoom: 16,
            duration: 2000,
          });
          setTimeout(() => generateSuggestedFields(map), 2500);
        })
        .catch(() => {
          map.setCenter([-54.6, -20.47]);
          map.setZoom(14);
          setTimeout(() => generateSuggestedFields(map), 500);
        });
    }

    // Recarregar campos quando mover o mapa
    map.on("moveend", () => {
      if (modeRef.current === "select") {
        generateSuggestedFields(map);
      }
    });

    // Click listener para desenhar - usar click event do mapa
    const handleMapClick = (e: mapboxgl.MapMouseEvent) => {
      console.log("[FieldDrawNew] Map clicked, mode:", modeRef.current);
      if (modeRef.current === "draw") {
        console.log("[FieldDrawNew] Adding point:", e.lngLat.lng, e.lngLat.lat);
        setPoints(prev => [...prev, [e.lngLat.lng, e.lngLat.lat]]);
      }
    };
    
    map.on("click", handleMapClick);
    
    // Cleanup
    return () => {
      map.off("click", handleMapClick);
    };
  }, [setMap, getUserLocation, generateSuggestedFields]);

  const handleUndo = () => {
    if (mode === "draw") {
      setPoints(prev => prev.slice(0, -1));
    }
  };

  const handleFinish = () => {
    if (mode === "select") {
      if (selectedFieldIds.size === 0) {
        toast.error("Selecione pelo menos um campo");
        return;
      }
      // Para modo select, salvar cada campo selecionado
      // Por enquanto, abrir dialog para nome (poderia ser múltiplos dialogs)
      setShowNameDialog(true);
    } else {
      if (points.length < 3) {
        toast.error("Desenhe pelo menos 3 pontos para criar um campo");
        return;
      }
      setShowNameDialog(true);
    }
  };

  const handleCreateField = () => {
    if (!fieldName.trim()) {
      toast.error("Digite um nome para o campo");
      return;
    }

    if (mode === "select") {
      // Criar campos a partir da seleção
      const selectedFields = suggestedFields.filter(f => selectedFieldIds.has(f.id));
      
      // Criar cada campo selecionado
      selectedFields.forEach((field, index) => {
        const boundariesForStorage = field.coordinates.map(p => ({ lat: p[1], lng: p[0] }));
        const name = selectedFields.length > 1 
          ? `${fieldName} ${index + 1}` 
          : fieldName;
        
        createField.mutate({
          name,
          areaHectares: Math.round(field.area * 100),
          latitude: field.center[1].toString(),
          longitude: field.center[0].toString(),
          boundaries: JSON.stringify(boundariesForStorage),
        });
      });
    } else {
      // Criar campo desenhado manualmente
      const lngSum = points.reduce((sum, p) => sum + p[0], 0);
      const latSum = points.reduce((sum, p) => sum + p[1], 0);
      const centerLng = lngSum / points.length;
      const centerLat = latSum / points.length;

      const boundariesForStorage = points.map(p => ({ lat: p[1], lng: p[0] }));

      createField.mutate({
        name: fieldName,
        areaHectares: Math.round(area * 100),
        latitude: centerLat.toString(),
        longitude: centerLng.toString(),
        boundaries: JSON.stringify(boundariesForStorage),
      });
    }
  };

  const handleLocateMe = async () => {
    if (!mapInstance) return;
    try {
      const [lng, lat] = await getUserLocation();
      mapInstance.flyTo({
        center: [lng, lat],
        zoom: 16,
        duration: 1500,
      });
    } catch (error) {
      toast.error("Não foi possível obter sua localização");
    }
  };

  const canFinish = mode === "select" 
    ? selectedFieldIds.size > 0 
    : points.length >= 3;

  const currentArea = mode === "select" ? totalSelectedArea : area;

  return (
    <div className="relative h-screen w-full">
      {/* Mapbox Map */}
      <MapboxMap
        onMapReady={handleMapReady}
        style="satellite"
        initialZoom={14}
        initialCenter={[-54.6, -20.47]}
        className="absolute inset-0"
      />

      {/* Loading indicator */}
      {isLoadingFields && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20">
          <div className="bg-black/70 text-white px-4 py-2 rounded-full flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Carregando limites dos campos...</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between pointer-events-none z-10">
        {/* Close Button */}
        <Button
          variant="secondary"
          size="icon"
          className="pointer-events-auto bg-white hover:bg-gray-100 rounded-full h-10 w-10 shadow-md"
          onClick={() => setLocation("/fields")}
        >
          <X className="h-5 w-5" />
        </Button>

        {/* Mode Toggle */}
        <div className="pointer-events-auto bg-gray-800/90 rounded-full p-1 flex">
          <button
            onClick={() => setMode("select")}
            className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors ${
              mode === "select" ? "bg-gray-700 text-white" : "text-gray-400"
            }`}
          >
            <Hand className="h-4 w-4" />
            <span className="text-sm">Selecionar</span>
          </button>
          <button
            onClick={() => setMode("draw")}
            className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors ${
              mode === "draw" ? "bg-gray-700 text-white" : "text-gray-400"
            }`}
          >
            <Pencil className="h-4 w-4" />
            <span className="text-sm">Desenhar</span>
          </button>
        </div>

        {/* Search Button */}
        <Button
          variant="secondary"
          size="icon"
          className="pointer-events-auto bg-gray-800/90 text-white hover:bg-gray-700 rounded-full h-10 w-10"
        >
          <Search className="h-5 w-5" />
        </Button>
      </div>

      {/* Instructions */}
      {mode === "select" && suggestedFields.length > 0 && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <div className="bg-black/70 text-white px-4 py-2 rounded-full text-sm">
            Toque nos campos para selecionar/desmarcar
          </div>
        </div>
      )}

      {mode === "draw" && points.length === 0 && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <div className="bg-black/70 text-white px-4 py-2 rounded-full text-sm">
            Toque no mapa para desenhar os limites
          </div>
        </div>
      )}

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-4 pointer-events-none z-10">
        {/* Selection info */}
        {mode === "select" && selectedFieldIds.size > 0 && (
          <div className="mb-2 pointer-events-none">
            <span className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium">
              {selectedFieldIds.size} campo{selectedFieldIds.size > 1 ? 's' : ''} selecionado{selectedFieldIds.size > 1 ? 's' : ''}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between">
          {/* Undo Button */}
          <Button
            variant="secondary"
            className="pointer-events-auto bg-gray-800/90 text-white hover:bg-gray-700 rounded-full px-4 h-10 gap-2"
            onClick={handleUndo}
            disabled={mode === "draw" ? points.length === 0 : false}
          >
            <Undo2 className="h-4 w-4" />
            <span>Desfazer</span>
          </Button>

          {/* Location Button */}
          <Button
            variant="secondary"
            size="icon"
            className="pointer-events-auto bg-gray-800/90 text-white hover:bg-gray-700 rounded-full h-10 w-10"
            onClick={handleLocateMe}
          >
            <Navigation className="h-5 w-5" />
          </Button>
        </div>

        {/* Finish Button */}
        <Button
          className="pointer-events-auto w-full mt-3 bg-green-600 hover:bg-green-700 text-white rounded-xl h-14 text-base font-semibold"
          onClick={handleFinish}
          disabled={!canFinish}
        >
          {mode === "select" ? "Salvar campos selecionados" : "Finalizar limite do campo"}
          {currentArea > 0 && (
            <span className="ml-2 font-normal">
              {currentArea.toFixed(1)} ha
            </span>
          )}
        </Button>
      </div>

      {/* Name Dialog */}
      <Dialog open={showNameDialog} onOpenChange={setShowNameDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nome do Campo</DialogTitle>
            <DialogDescription>
              {mode === "select" && selectedFieldIds.size > 1 
                ? `Serão criados ${selectedFieldIds.size} campos com este nome base`
                : "Digite um nome para identificar este campo"
              }
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={fieldName}
              onChange={(e) => setFieldName(e.target.value)}
              placeholder="Ex: Pasto 1, Talhão Norte..."
              autoFocus
            />
            <p className="text-sm text-gray-500 mt-2">
              Área total: {currentArea.toFixed(1)} hectares
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowNameDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreateField}
              disabled={createField.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {createField.isPending ? "Criando..." : "Criar Campo"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
