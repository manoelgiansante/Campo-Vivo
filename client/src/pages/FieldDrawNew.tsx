import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { MapboxMap, useMapbox } from "@/components/MapboxMap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  X, 
  Hand, 
  Pencil, 
  Search,
  Navigation,
  Undo2,
  Square,
  Check,
  Locate,
  Crown
} from "lucide-react";
import { useState, useCallback, useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import mapboxgl from "mapbox-gl";
import * as turf from "@turf/turf";

type DrawMode = "select" | "draw";

export default function FieldDrawNew() {
  const params = useParams<{ id?: string }>();
  const editId = params.id ? parseInt(params.id) : null;
  const isEditMode = editId !== null;

  const [, setLocation] = useLocation();
  const { user, isGuest } = useAuth();
  const [mode, setMode] = useState<DrawMode>("draw");
  const [points, setPoints] = useState<[number, number][]>([]); // [lng, lat]
  const [area, setArea] = useState<number>(0);
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [showLimitDialog, setShowLimitDialog] = useState(false);
  const [fieldName, setFieldName] = useState("");
  const [mapInstance, setMapInstance] = useState<mapboxgl.Map | null>(null);
  const { setMap, getUserLocation, watchUserLocation, clearWatchLocation } = useMapbox();
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const initialCenterRef = useRef<[number, number] | null>(null);
  const hasInitializedLocationRef = useRef(false);

  // Check field limit
  const { data: fieldLimit } = trpc.auth.checkFieldLimit.useQuery(undefined, {
    enabled: !!user && !isEditMode,
  });

  // Fetch existing field data if editing
  const { data: existingField } = trpc.fields.getById.useQuery(
    { id: editId! },
    { enabled: isEditMode }
  );

  // Load existing boundaries for edit mode
  useEffect(() => {
    if (isEditMode && existingField && !isLoaded) {
      setFieldName(existingField.name);
      if (existingField.boundaries) {
        try {
          const boundaries = typeof existingField.boundaries === 'string'
            ? JSON.parse(existingField.boundaries)
            : existingField.boundaries;
          if (Array.isArray(boundaries) && boundaries.length > 0) {
            const loadedPoints: [number, number][] = boundaries.map((p: any) => [p.lng, p.lat]);
            setPoints(loadedPoints);
            setMode("select");
            setIsLoaded(true);

            // Center map on field
            if (mapInstance && loadedPoints.length > 0) {
              const avgLng = loadedPoints.reduce((sum, p) => sum + p[0], 0) / loadedPoints.length;
              const avgLat = loadedPoints.reduce((sum, p) => sum + p[1], 0) / loadedPoints.length;
              initialCenterRef.current = [avgLng, avgLat];
              mapInstance.flyTo({
                center: [avgLng, avgLat],
                zoom: 16,
                duration: 1500,
              });
            }
          }
        } catch (e) {
          console.error('Error parsing boundaries:', e);
        }
      }
    }
  }, [isEditMode, existingField, isLoaded, mapInstance]);

  // Watch user location
  useEffect(() => {
    if (!mapInstance) return;

    // Start watching location
    watchIdRef.current = watchUserLocation(
      (coords) => {
        setUserLocation(coords);
        updateUserMarker(coords);
      },
      (error) => {
        console.log("Location watch error:", error.message);
      }
    );

    return () => {
      if (watchIdRef.current !== null) {
        clearWatchLocation(watchIdRef.current);
      }
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
      }
    };
  }, [mapInstance, watchUserLocation, clearWatchLocation]);

  // Update user marker on map
  const updateUserMarker = useCallback((coords: [number, number]) => {
    if (!mapInstance) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.setLngLat(coords);
    } else {
      // Create pulsing blue dot marker
      const el = document.createElement("div");
      el.className = "user-location-marker";
      el.innerHTML = `
        <div class="relative">
          <div class="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-75" style="width: 24px; height: 24px;"></div>
          <div class="relative bg-blue-500 rounded-full border-3 border-white shadow-lg" style="width: 16px; height: 16px;"></div>
        </div>
      `;
      el.style.cssText = "width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;";

      userMarkerRef.current = new mapboxgl.Marker({ element: el })
        .setLngLat(coords)
        .addTo(mapInstance);
    }
  }, [mapInstance]);

  const createField = trpc.fields.create.useMutation({
    onSuccess: (data) => {
      toast.success("Campo criado com sucesso!");
      setLocation(`/fields/${data.id}`);
    },
    onError: () => {
      toast.error("Erro ao criar campo");
    },
  });

  const updateField = trpc.fields.update.useMutation({
    onSuccess: () => {
      toast.success("Campo atualizado com sucesso!");
      setLocation(`/fields/${editId}`);
    },
    onError: () => {
      toast.error("Erro ao atualizar campo");
    },
  });

  // Calculate area when points change
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

  // Update polygon and lines on map
  useEffect(() => {
    if (!mapInstance) return;

    // Clear existing markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // Remove existing layers
    ["draw-polygon", "draw-polygon-outline", "draw-line"].forEach(id => {
      if (mapInstance.getLayer(id)) mapInstance.removeLayer(id);
    });
    ["draw-polygon", "draw-line"].forEach(id => {
      if (mapInstance.getSource(id)) mapInstance.removeSource(id);
    });

    if (points.length > 0) {
      // Add markers for each point
      points.forEach((point, index) => {
        const el = document.createElement("div");
        el.className = `w-6 h-6 rounded-full border-3 shadow-lg cursor-move flex items-center justify-center text-xs font-bold ${
          index === 0 ? "bg-green-500 border-white text-white" : "bg-white border-green-500 text-green-600"
        }`;
        el.textContent = String(index + 1);
        
        const marker = new mapboxgl.Marker({ 
          element: el, 
          draggable: mode === "select" 
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

      // Draw line between points (even with just 2 points)
      if (points.length >= 2) {
        const lineCoords = points.length >= 3 ? [...points, points[0]] : points;
        
        mapInstance.addSource("draw-line", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: {
              type: "LineString",
              coordinates: lineCoords,
            },
          },
        });

        mapInstance.addLayer({
          id: "draw-line",
          type: "line",
          source: "draw-line",
          paint: {
            "line-color": "#22C55E",
            "line-width": 3,
            "line-dasharray": points.length < 3 ? [2, 2] : [1, 0],
          },
        });
      }

      // Draw polygon fill only if we have at least 3 points
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
            "fill-opacity": 0.3,
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

  const handleMapReady = useCallback((map: mapboxgl.Map) => {
    setMap(map);
    setMapInstance(map);

    // Salvar centro inicial
    const currentCenter = map.getCenter();
    initialCenterRef.current = [currentCenter.lng, currentCenter.lat];

    // Se não estiver editando e ainda não buscou localização, tentar obter localização do usuário
    if (!isEditMode && !hasInitializedLocationRef.current) {
      hasInitializedLocationRef.current = true;
      getUserLocation()
        .then(([lng, lat]) => {
          initialCenterRef.current = [lng, lat];
          map.flyTo({
            center: [lng, lat],
            zoom: 17,
            duration: 2000,
          });
          setUserLocation([lng, lat]);
          updateUserMarker([lng, lat]);
        })
        .catch((error) => {
          console.log("Não foi possível obter localização:", error.message);
          // Manter centro padrão (Brasil)
        });
    }

  }, [setMap, getUserLocation, isEditMode, updateUserMarker]);

  // Separar o listener de clique para reagir às mudanças de modo
  useEffect(() => {
    if (!mapInstance) return;

    const handleClick = (e: mapboxgl.MapMouseEvent) => {
      if (mode === "draw") {
        setPoints(prev => [...prev, [e.lngLat.lng, e.lngLat.lat]]);
      }
    };

    mapInstance.on("click", handleClick);
    return () => {
      mapInstance.off("click", handleClick);
    };
  }, [mapInstance, mode]);

  const handleUndo = () => {
    setPoints(prev => prev.slice(0, -1));
  };

  const handleFinish = () => {
    if (points.length < 3) {
      toast.error("Desenhe pelo menos 3 pontos para criar um campo");
      return;
    }

    // Check field limit before allowing creation (only for new fields)
    if (!isEditMode && fieldLimit && !fieldLimit.canCreateMore) {
      setShowLimitDialog(true);
      return;
    }

    setShowNameDialog(true);
  };

  const handleCreateField = () => {
    if (!fieldName.trim()) {
      toast.error("Digite um nome para o campo");
      return;
    }

    // Calculate center point
    const lngSum = points.reduce((sum, p) => sum + p[0], 0);
    const latSum = points.reduce((sum, p) => sum + p[1], 0);
    const centerLng = lngSum / points.length;
    const centerLat = latSum / points.length;

    // Convert to lat/lng format for storage
    const boundariesForStorage = points.map(p => ({ lat: p[1], lng: p[0] }));

    if (isEditMode && editId) {
      updateField.mutate({
        id: editId,
        name: fieldName,
        areaHectares: Math.round(area * 100), // Store as integer (hectares * 100)
        latitude: centerLat.toString(),
        longitude: centerLng.toString(),
        boundaries: JSON.stringify(boundariesForStorage),
      });
    } else {
      createField.mutate({
        name: fieldName,
        areaHectares: Math.round(area * 100), // Store as integer (hectares * 100)
        latitude: centerLat.toString(),
        longitude: centerLng.toString(),
        boundaries: JSON.stringify(boundariesForStorage),
      });
    }
  };

  const handleLocateMe = async () => {
    if (!mapInstance) return;
    
    toast.loading("Obtendo localização...", { id: "location" });
    
    try {
      const [lng, lat] = await getUserLocation();
      setUserLocation([lng, lat]);
      updateUserMarker([lng, lat]);
      mapInstance.flyTo({
        center: [lng, lat],
        zoom: 17,
        duration: 1500,
      });
      toast.success("Localização encontrada!", { id: "location" });
    } catch (error: any) {
      toast.error(error.message || "Não foi possível obter sua localização", { id: "location" });
    }
  };

  return (
    <div className="relative h-screen w-full">
      {/* Mapbox Map */}
      <MapboxMap
        onMapReady={handleMapReady}
        style="satellite"
        initialZoom={5}
        initialCenter={[-47.9292, -15.7801]}
        className="absolute inset-0"
      />

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
            onClick={(e) => {
              e.stopPropagation();
              setMode("select");
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors ${
              mode === "select" ? "bg-gray-700 text-white" : "text-gray-400"
            }`}
          >
            <Hand className="h-4 w-4" />
            <span className="text-sm">Mover</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMode("draw");
            }}
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

      {/* Left Side - Control Buttons */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 pointer-events-auto z-10">
        <Button
          variant="secondary"
          size="icon"
          className="bg-gray-800/90 text-white hover:bg-gray-700 rounded-lg h-10 w-10"
        >
          <Square className="h-5 w-5" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="bg-gray-800/90 text-white hover:bg-gray-700 rounded-lg h-10 w-10"
          onClick={handleLocateMe}
        >
          <Navigation className="h-5 w-5" />
        </Button>
      </div>

      {/* Bottom Controls */}
      <div 
        className="absolute bottom-0 left-0 right-0 p-4 pointer-events-none z-10 bg-gradient-to-t from-black/50 to-transparent"
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
      >
        {/* Area info and point count */}
        {points.length > 0 && (
          <div className="flex items-center justify-between mb-3 pointer-events-none">
            <span className="bg-black/70 text-white px-3 py-1.5 rounded-full text-sm font-medium">
              {points.length} {points.length === 1 ? 'ponto' : 'pontos'}
            </span>
            {area > 0 && (
              <span className="bg-green-600 text-white px-3 py-1.5 rounded-full text-sm font-medium">
                {area.toFixed(2)} ha
              </span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          {/* Undo Button */}
          <Button
            variant="secondary"
            className="pointer-events-auto bg-white/90 text-gray-800 hover:bg-white rounded-full px-4 h-12 gap-2 shadow-lg"
            onClick={handleUndo}
            disabled={points.length === 0}
          >
            <Undo2 className="h-5 w-5" />
            <span>Desfazer</span>
          </Button>

          {/* Location Button */}
          <Button
            variant="secondary"
            size="icon"
            className="pointer-events-auto bg-blue-500 text-white hover:bg-blue-600 rounded-full h-12 w-12 shadow-lg"
            onClick={handleLocateMe}
          >
            <Locate className="h-5 w-5" />
          </Button>
        </div>

        {/* Finish Button - Always visible and prominent */}
        <Button
          className={`pointer-events-auto w-full mt-3 text-white rounded-2xl h-16 text-lg font-bold shadow-xl transition-all ${
            points.length >= 3 
              ? 'bg-green-500 hover:bg-green-600 active:scale-[0.98]' 
              : 'bg-gray-400 cursor-not-allowed'
          }`}
          onClick={handleFinish}
          disabled={points.length < 3}
        >
          <Check className="h-6 w-6 mr-2" />
          {isEditMode ? 'Salvar Alterações' : 'Confirmar Área'}
          {area > 0 && (
            <span className="ml-2 opacity-90">
              ({area.toFixed(1)} ha)
            </span>
          )}
        </Button>
        
        {points.length > 0 && points.length < 3 && (
          <p className="text-center text-white/80 text-sm mt-2">
            Adicione mais {3 - points.length} {3 - points.length === 1 ? 'ponto' : 'pontos'} para criar a área
          </p>
        )}
      </div>

      {/* Name Dialog */}
      <Dialog open={showNameDialog} onOpenChange={setShowNameDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isEditMode ? 'Editar Campo' : 'Nome do Campo'}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={fieldName}
              onChange={(e) => setFieldName(e.target.value)}
              placeholder="Ex: Pasto 1, Talhão Norte..."
              autoFocus
            />
            <p className="text-sm text-gray-500 mt-2">
              Área: {area.toFixed(1)} hectares
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowNameDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreateField}
              disabled={createField.isPending || updateField.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {createField.isPending || updateField.isPending 
                ? (isEditMode ? "Salvando..." : "Criando...") 
                : (isEditMode ? "Salvar Alterações" : "Criar Campo")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Field Limit Dialog */}
      <Dialog open={showLimitDialog} onOpenChange={setShowLimitDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-500" />
              Limite de Campos Atingido
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {fieldLimit?.needsAccount ? (
              <>
                <p className="text-gray-600 mb-4">
                  Visitantes podem criar apenas <strong>1 campo</strong>. 
                  Crie uma conta gratuita para ter até <strong>5 campos</strong>!
                </p>
                <div className="bg-green-50 rounded-lg p-4 mb-4">
                  <h4 className="font-semibold text-green-800 mb-2">Conta Gratuita</h4>
                  <ul className="text-sm text-green-700 space-y-1">
                    <li>✓ Até 5 campos</li>
                    <li>✓ Análise NDVI em tempo real</li>
                    <li>✓ Previsão do tempo 7 dias</li>
                  </ul>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setShowLimitDialog(false)}>
                    Cancelar
                  </Button>
                  <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => setLocation('/auth')}>
                    Criar Conta Grátis
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-gray-600 mb-4">
                  Você atingiu o limite de <strong>{fieldLimit?.maxFields} campos</strong> do plano gratuito.
                  Faça upgrade para o plano Pro e tenha campos ilimitados!
                </p>
                <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg p-4 mb-4 text-white">
                  <h4 className="font-semibold mb-2">Plano Pro</h4>
                  <ul className="text-sm space-y-1">
                    <li>✓ Campos ilimitados</li>
                    <li>✓ Relatórios avançados</li>
                    <li>✓ Suporte prioritário</li>
                  </ul>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setShowLimitDialog(false)}>
                    Voltar
                  </Button>
                  <Button className="flex-1 bg-amber-500 hover:bg-amber-600" onClick={() => toast.info("Em breve!")}>
                    Ver Planos
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
