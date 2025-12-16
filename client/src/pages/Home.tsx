import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { MapboxMap, useMapbox } from "@/components/MapboxMap";
import { Button } from "@/components/ui/button";
import { 
  Plus, 
  Navigation2, 
  Layers, 
  ChevronUp,
  Leaf,
  CloudSun,
  Bell,
  ChevronRight,
  MapPin
} from "lucide-react";
import { useState, useCallback, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import mapboxgl from "mapbox-gl";
import { motion, AnimatePresence } from "framer-motion";

type MapStyle = "satellite" | "streets" | "satellite-streets";

interface Field {
  id: number;
  name: string;
  areaHectares?: number | null;
  currentNdvi?: number | null;
  boundaries?: string | object | null;
}

export default function Home() {
  const [, setLocation] = useLocation();
  const { user, isGuest } = useAuth({ autoCreateGuest: true });
  const [mapStyle, setMapStyle] = useState<MapStyle>("satellite-streets");
  const [showStylePicker, setShowStylePicker] = useState(false);
  const [showFieldsPanel, setShowFieldsPanel] = useState(false);
  const [mapInstance, setMapInstance] = useState<mapboxgl.Map | null>(null);
  const { setMap, getUserLocation } = useMapbox();
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  const { data: fields } = trpc.fields.list.useQuery();

  // Adicionar marcadores dos campos
  useEffect(() => {
    if (!mapInstance || !fields) return;

    // Limpar marcadores anteriores
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    fields.forEach((field) => {
      if (!field.boundaries) return;
      
      try {
        const points = typeof field.boundaries === 'string' 
          ? JSON.parse(field.boundaries) 
          : field.boundaries;
        
        if (!points?.length) return;

        // Calcular centro
        const center = points.reduce(
          (acc: { lat: number; lng: number }, p: any) => ({
            lat: acc.lat + p.lat / points.length,
            lng: acc.lng + p.lng / points.length,
          }),
          { lat: 0, lng: 0 }
        );

        // Criar marcador customizado
        const el = document.createElement('div');
        el.className = 'field-marker';
        el.innerHTML = `
          <div class="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
            <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
        `;

        el.onclick = () => setLocation(`/fields/${field.id}`);

        const marker = new mapboxgl.Marker(el)
          .setLngLat([center.lng, center.lat])
          .addTo(mapInstance);

        markersRef.current.push(marker);

        // Adicionar polígono
        const sourceId = `field-polygon-${field.id}`;
        const layerId = `field-layer-${field.id}`;
        const outlineId = `field-outline-${field.id}`;

        if (!mapInstance.getSource(sourceId)) {
          const coords = points.map((p: any) => [p.lng, p.lat]);
          if (coords[0][0] !== coords[coords.length - 1][0]) {
            coords.push(coords[0]);
          }

          mapInstance.addSource(sourceId, {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: { name: field.name },
              geometry: { type: 'Polygon', coordinates: [coords] }
            }
          });

          mapInstance.addLayer({
            id: layerId,
            type: 'fill',
            source: sourceId,
            paint: {
              'fill-color': '#22c55e',
              'fill-opacity': 0.2
            }
          });

          mapInstance.addLayer({
            id: outlineId,
            type: 'line',
            source: sourceId,
            paint: {
              'line-color': '#16a34a',
              'line-width': 2
            }
          });
        }
      } catch (e) {
        console.error('Erro ao processar campo:', e);
      }
    });

    return () => {
      markersRef.current.forEach(m => m.remove());
    };
  }, [mapInstance, fields, setLocation]);

  const handleMapLoad = useCallback((map: mapboxgl.Map) => {
    setMapInstance(map);
    setMap(map);
  }, [setMap]);

  const centerOnUser = async () => {
    const location = await getUserLocation();
    if (location && mapInstance) {
      mapInstance.flyTo({
        center: location,
        zoom: 15,
        duration: 1500
      });
    }
  };

  const getMapStyleUrl = (): MapStyle => {
    return mapStyle;
  };



  return (
    <div className="h-[100dvh] relative bg-black">
      {/* Mapa Full Screen */}
      <MapboxMap
        onMapReady={handleMapLoad}
        style={getMapStyleUrl()}
        className="absolute inset-0"
      />

      {/* Header Overlay */}
      <div className="absolute top-0 left-0 right-0 z-10 pointer-events-none">
        <div 
          className="px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-3"
          style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 100%)' }}
        >
          <div className="flex items-center justify-between pointer-events-auto">
            <div>
              <h1 className="text-white font-bold text-xl drop-shadow-lg">
                Olá, {user?.name?.split(' ')[0] || 'Produtor'} 👋
              </h1>
              <p className="text-white/80 text-sm">
                {fields?.length || 0} campos monitorados
              </p>
            </div>
            
            <button 
              onClick={() => setLocation('/profile')}
              className="relative w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center"
            >
              <Bell className="h-5 w-5 text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Controles do Mapa */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-2">
        <button
          onClick={centerOnUser}
          className="w-11 h-11 bg-white rounded-xl shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        >
          <Navigation2 className="h-5 w-5 text-gray-700" />
        </button>
        
        <button
          onClick={() => setShowStylePicker(!showStylePicker)}
          className="w-11 h-11 bg-white rounded-xl shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        >
          <Layers className="h-5 w-5 text-gray-700" />
        </button>
      </div>

      {/* Style Picker */}
      <AnimatePresence>
        {showStylePicker && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute right-16 top-1/2 -translate-y-1/2 z-10 bg-white rounded-xl shadow-xl overflow-hidden"
          >
            {(['satellite-streets', 'streets', 'satellite'] as const).map((style) => (
              <button
                key={style}
                onClick={() => {
                  setMapStyle(style);
                  setShowStylePicker(false);
                }}
                className={`w-full px-4 py-3 text-left text-sm font-medium transition-colors ${
                  mapStyle === style ? 'bg-green-50 text-green-700' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {style === 'satellite-streets' && '🛰️ Satélite'}
                {style === 'streets' && '🗺️ Mapa'}
                {style === 'satellite' && '🌍 Híbrido'}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Panel */}
      <div className="absolute bottom-0 left-0 right-0 z-10">
        {/* Quick Actions */}
        <div className="px-4 pb-3 flex gap-2">
          <button
            onClick={() => setLocation('/fields/new')}
            className="flex-1 bg-green-500 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-transform"
          >
            <Plus className="h-5 w-5" />
            Novo Campo
          </button>
          <button
            onClick={() => setLocation('/map')}
            className="w-14 h-14 bg-white rounded-xl shadow-lg flex items-center justify-center"
          >
            <CloudSun className="h-6 w-6 text-blue-500" />
          </button>
        </div>

        {/* Fields Preview Panel */}
        <div 
          className="bg-white rounded-t-3xl shadow-2xl"
          style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}
        >
          <button
            onClick={() => setShowFieldsPanel(!showFieldsPanel)}
            className="w-full py-3 flex items-center justify-center"
          >
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </button>

          <div className="px-4 pb-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-gray-900">Meus Campos</h2>
              <button 
                onClick={() => setLocation('/fields')}
                className="text-green-600 text-sm font-medium flex items-center"
              >
                Ver todos
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Fields List Preview */}
            <div className="space-y-2">
              {fields?.slice(0, 3).map((field) => (
                <button
                  key={field.id}
                  onClick={() => setLocation(`/fields/${field.id}`)}
                  className="w-full bg-gray-50 rounded-xl p-3 flex items-center gap-3 active:bg-gray-100 transition-colors"
                >
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <Leaf className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-semibold text-gray-900">{field.name}</p>
                    <p className="text-sm text-gray-500">
                      {field.areaHectares ? `${field.areaHectares} ha` : 'Área não definida'}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-green-600">
                      {field.currentNdvi ? (field.currentNdvi / 100).toFixed(2) : '0.65'}
                    </div>
                    <p className="text-xs text-gray-500">NDVI</p>
                  </div>
                </button>
              ))}

              {(!fields || fields.length === 0) && (
                <div className="text-center py-8">
                  <MapPin className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">Nenhum campo cadastrado</p>
                  <Button 
                    onClick={() => setLocation('/fields/new')}
                    className="mt-3"
                    size="sm"
                  >
                    Cadastrar primeiro campo
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
