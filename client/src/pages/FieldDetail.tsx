import { trpc } from "@/lib/trpc";
import { useLocation, useParams } from "wouter";
import { 
  ArrowLeft, 
  MoreVertical, 
  Share2, 
  Edit, 
  Trash2,
  Leaf,
  Droplets,
  Sun,
  Wind,
  Calendar,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  StickyNote,
  ChevronRight,
  MapPin,
  BarChart3,
  Bug,
  Cloud,
  Thermometer
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import mapboxgl from "mapbox-gl";
import { MapboxMap, useMapbox } from "@/components/MapboxMap";

type TabType = "overview" | "ndvi" | "weather" | "notes";

export default function FieldDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [showMenu, setShowMenu] = useState(false);
  const [mapInstance, setMapInstance] = useState<mapboxgl.Map | null>(null);
  const { setMap } = useMapbox();

  const { data: field, isLoading } = trpc.fields.getById.useQuery({ id: Number(id) });
  const { data: weather } = trpc.weather.getByField.useQuery(
    { fieldId: Number(id) },
    { enabled: !!field }
  );
  const { data: ndviHistory } = trpc.ndvi.history.useQuery(
    { fieldId: Number(id) },
    { enabled: !!field }
  );
  const { data: notes } = trpc.notes.listByField.useQuery(
    { fieldId: Number(id) },
    { enabled: !!field }
  );

  const deleteMutation = trpc.fields.delete.useMutation();
  const utils = trpc.useUtils();

  const handleMapLoad = useCallback((map: mapboxgl.Map) => {
    setMapInstance(map);
    setMap(map);
  }, [setMap]);

  // Centralizar no campo quando o mapa carregar
  useEffect(() => {
    if (!mapInstance || !field?.boundaries) return;

    try {
      const points = typeof field.boundaries === 'string'
        ? JSON.parse(field.boundaries)
        : field.boundaries;

      if (!points?.length) return;

      // Calcular bounds
      const bounds = new mapboxgl.LngLatBounds();
      points.forEach((p: any) => bounds.extend([p.lng, p.lat]));

      // Adicionar polígono
      const coords = points.map((p: any) => [p.lng, p.lat]);
      if (coords[0][0] !== coords[coords.length - 1][0]) {
        coords.push(coords[0]);
      }

      if (!mapInstance.getSource('field-polygon')) {
        mapInstance.addSource('field-polygon', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: { type: 'Polygon', coordinates: [coords] }
          }
        });

        mapInstance.addLayer({
          id: 'field-fill',
          type: 'fill',
          source: 'field-polygon',
          paint: {
            'fill-color': '#22c55e',
            'fill-opacity': 0.3
          }
        });

        mapInstance.addLayer({
          id: 'field-outline',
          type: 'line',
          source: 'field-polygon',
          paint: {
            'line-color': '#16a34a',
            'line-width': 3
          }
        });
      }

      mapInstance.fitBounds(bounds, { padding: 50, duration: 1000 });
    } catch (e) {
      console.error('Erro ao processar campo:', e);
    }
  }, [mapInstance, field]);

  const handleDelete = async () => {
    if (confirm("Tem certeza que deseja excluir este campo?")) {
      await deleteMutation.mutateAsync({ id: Number(id) });
      utils.fields.list.invalidate();
      setLocation('/fields');
    }
  };

  const ndvi = field?.currentNdvi || 65;
  const getHealthColor = () => {
    if (ndvi >= 60) return { bg: "bg-green-500", text: "text-green-600", light: "bg-green-100" };
    if (ndvi >= 40) return { bg: "bg-yellow-500", text: "text-yellow-600", light: "bg-yellow-100" };
    return { bg: "bg-red-500", text: "text-red-600", light: "bg-red-100" };
  };
  const health = getHealthColor();

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!field) {
    return (
      <div className="min-h-[100dvh] bg-gray-50 flex flex-col items-center justify-center p-4">
        <MapPin className="h-16 w-16 text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Campo não encontrado</h2>
        <button 
          onClick={() => setLocation('/fields')}
          className="text-green-600 font-medium"
        >
          Voltar para campos
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gray-50">
      {/* Header com Mapa */}
      <div className="relative h-64">
        <MapboxMap
          onMapReady={handleMapLoad}
          style="satellite-streets"
          className="absolute inset-0"
        />

        {/* Header Overlay */}
        <div 
          className="absolute top-0 left-0 right-0 z-10"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={() => setLocation('/fields')}
              className="w-10 h-10 bg-black/30 backdrop-blur-md rounded-full flex items-center justify-center"
            >
              <ArrowLeft className="h-5 w-5 text-white" />
            </button>

            <div className="flex gap-2">
              <button className="w-10 h-10 bg-black/30 backdrop-blur-md rounded-full flex items-center justify-center">
                <Share2 className="h-5 w-5 text-white" />
              </button>
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="w-10 h-10 bg-black/30 backdrop-blur-md rounded-full flex items-center justify-center"
              >
                <MoreVertical className="h-5 w-5 text-white" />
              </button>
            </div>
          </div>
        </div>

        {/* Menu */}
        <AnimatePresence>
          {showMenu && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-20 right-4 z-20 bg-white rounded-xl shadow-xl overflow-hidden"
              style={{ marginTop: 'env(safe-area-inset-top)' }}
            >
              <button
                onClick={() => {
                  setShowMenu(false);
                  setLocation(`/fields/${id}/edit`);
                }}
                className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 w-full"
              >
                <Edit className="h-4 w-4" />
                <span>Editar campo</span>
              </button>
              <button
                onClick={() => {
                  setShowMenu(false);
                  handleDelete();
                }}
                className="flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 w-full border-t"
              >
                <Trash2 className="h-4 w-4" />
                <span>Excluir campo</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Gradient Overlay */}
        <div 
          className="absolute bottom-0 left-0 right-0 h-24"
          style={{ background: 'linear-gradient(to top, white 0%, transparent 100%)' }}
        />
      </div>

      {/* Content */}
      <div className="relative -mt-12 z-10 pb-[calc(80px+env(safe-area-inset-bottom))]">
        {/* Field Info Card */}
        <div className="mx-4 bg-white rounded-2xl shadow-lg p-4 mb-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-900">{field.name}</h1>
              <p className="text-gray-500 text-sm mt-1">
                {field.areaHectares ? `${(field.areaHectares / 100).toFixed(1)} hectares` : 'Área não definida'}
                {field.crop && ` • ${field.crop}`}
              </p>
            </div>
            <div className={`${health.light} rounded-xl px-3 py-2 text-center`}>
              <p className={`text-2xl font-bold ${health.text}`}>
                {(ndvi / 100).toFixed(2)}
              </p>
              <p className="text-xs text-gray-500">NDVI</p>
            </div>
          </div>

          {/* Health Bar */}
          <div className="mt-4">
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div 
                className={`h-full ${health.bg} rounded-full transition-all`}
                style={{ width: `${ndvi}%` }}
              />
            </div>
            <div className="flex justify-between mt-1 text-xs text-gray-400">
              <span>Crítico</span>
              <span>Atenção</span>
              <span>Saudável</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-4 mb-4">
          <div className="bg-gray-100 rounded-xl p-1 flex">
            {([
              { id: 'overview', label: 'Visão Geral' },
              { id: 'ndvi', label: 'NDVI' },
              { id: 'weather', label: 'Clima' },
              { id: 'notes', label: 'Notas' },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="px-4">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Quick Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                      <Leaf className="h-4 w-4 text-green-600" />
                    </div>
                    <span className="text-sm text-gray-500">Saúde</span>
                  </div>
                  <p className={`text-lg font-bold ${health.text}`}>
                    {ndvi >= 60 ? 'Excelente' : ndvi >= 40 ? 'Regular' : 'Crítico'}
                  </p>
                </div>

                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Droplets className="h-4 w-4 text-blue-600" />
                    </div>
                    <span className="text-sm text-gray-500">Umidade</span>
                  </div>
                  <p className="text-lg font-bold text-gray-900">
                    {weather?.current?.humidity || '--'}%
                  </p>
                </div>

                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                      <Sun className="h-4 w-4 text-yellow-600" />
                    </div>
                    <span className="text-sm text-gray-500">Temperatura</span>
                  </div>
                  <p className="text-lg font-bold text-gray-900">
                    {weather?.current?.temperature?.toFixed(0) || '--'}°C
                  </p>
                </div>

                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Wind className="h-4 w-4 text-purple-600" />
                    </div>
                    <span className="text-sm text-gray-500">Vento</span>
                  </div>
                  <p className="text-lg font-bold text-gray-900">
                    {weather?.current?.windSpeed?.toFixed(0) || '--'} km/h
                  </p>
                </div>
              </div>

              {/* Alerts */}
              <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  <span className="font-semibold text-yellow-800">Alertas</span>
                </div>
                <p className="text-sm text-yellow-700">
                  {ndvi < 40 
                    ? 'Índice de vegetação baixo. Verificar irrigação e possíveis pragas.'
                    : ndvi < 60
                    ? 'Vegetação com saúde moderada. Monitorar nas próximas semanas.'
                    : 'Campo saudável. Continue o monitoramento regular.'
                  }
                </p>
              </div>

              {/* Quick Actions */}
              <div className="space-y-2">
                <button 
                  onClick={() => setLocation(`/fields/${id}/pro`)}
                  className="w-full bg-white rounded-xl p-4 shadow-sm flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                      <BarChart3 className="h-5 w-5 text-green-600" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-gray-900">Análise Avançada</p>
                      <p className="text-sm text-gray-500">Ver histórico completo</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                </button>

                <button 
                  onClick={() => setActiveTab('notes')}
                  className="w-full bg-white rounded-xl p-4 shadow-sm flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                      <StickyNote className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-gray-900">Notas do Campo</p>
                      <p className="text-sm text-gray-500">{notes?.length || 0} anotações</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                </button>
              </div>
            </div>
          )}

          {activeTab === 'ndvi' && (
            <div className="space-y-4">
              {/* Current NDVI */}
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-3">Índice de Vegetação Atual</h3>
                <div className="flex items-center justify-between">
                  <div className={`w-24 h-24 ${health.light} rounded-2xl flex flex-col items-center justify-center`}>
                    <p className={`text-3xl font-bold ${health.text}`}>
                      {(ndvi / 100).toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500">NDVI</p>
                  </div>
                  <div className="flex-1 ml-4">
                    <div className="flex items-center gap-2 mb-2">
                      {field.ndviTrend && field.ndviTrend > 0 ? (
                        <TrendingUp className="h-5 w-5 text-green-500" />
                      ) : (
                        <TrendingDown className="h-5 w-5 text-red-500" />
                      )}
                      <span className="text-sm text-gray-600">
                        {field.ndviTrend && field.ndviTrend > 0 ? 'Melhorando' : 'Em declínio'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">
                      Última atualização: {field.lastNdviUpdate 
                        ? new Date(field.lastNdviUpdate).toLocaleDateString('pt-BR')
                        : 'Não disponível'
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* NDVI History */}
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-3">Histórico</h3>
                {ndviHistory && ndviHistory.length > 0 ? (
                  <div className="space-y-2">
                    {ndviHistory.slice(0, 5).map((entry: any, i: number) => {
                      // Normalizar o valor NDVI - pode vir como ndvi (0-1) ou value (0-100)
                      const ndviValue = entry.ndvi ?? entry.value;
                      const normalizedNdvi = ndviValue > 1 ? ndviValue / 100 : ndviValue;
                      
                      return (
                        <div 
                          key={i}
                          className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                        >
                          <span className="text-sm text-gray-500">
                            {new Date(entry.date).toLocaleDateString('pt-BR')}
                          </span>
                          <span className="font-semibold text-gray-900">
                            {normalizedNdvi != null && !isNaN(normalizedNdvi) 
                              ? normalizedNdvi.toFixed(2) 
                              : 'N/A'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">Nenhum histórico disponível</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'weather' && (
            <div className="space-y-4">
              {/* Current Weather */}
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-blue-100 text-sm">Agora</p>
                    <p className="text-5xl font-light mt-1">
                      {weather?.current?.temperature?.toFixed(0) || '--'}°
                    </p>
                    <p className="text-blue-100 mt-1">
                      {weather?.current?.precipitation ? `Precipitação: ${weather.current.precipitation}mm` : 'Sem chuva'}
                    </p>
                  </div>
                  <Cloud className="h-16 w-16 text-white/50" />
                </div>
              </div>

              {/* Weather Details */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-gray-500 mb-1">
                    <Droplets className="h-4 w-4" />
                    <span className="text-sm">Umidade</span>
                  </div>
                  <p className="text-xl font-semibold text-gray-900">
                    {weather?.current?.humidity || '--'}%
                  </p>
                </div>

                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-gray-500 mb-1">
                    <Wind className="h-4 w-4" />
                    <span className="text-sm">Vento</span>
                  </div>
                  <p className="text-xl font-semibold text-gray-900">
                    {weather?.current?.windSpeed?.toFixed(0) || '--'} km/h
                  </p>
                </div>

                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-gray-500 mb-1">
                    <Thermometer className="h-4 w-4" />
                    <span className="text-sm">Precipitação</span>
                  </div>
                  <p className="text-xl font-semibold text-gray-900">
                    {weather?.current?.precipitation?.toFixed(1) || '0'} mm
                  </p>
                </div>

                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-gray-500 mb-1">
                    <Cloud className="h-4 w-4" />
                    <span className="text-sm">Dir. Vento</span>
                  </div>
                  <p className="text-xl font-semibold text-gray-900">
                    {weather?.current?.windDirection || '--'}°
                  </p>
                </div>
              </div>

              {/* Forecast */}
              {weather?.daily && weather.daily.length > 0 && (
                <div className="bg-white rounded-xl p-4 shadow-sm">
                  <h3 className="font-semibold text-gray-900 mb-3">Previsão 7 dias</h3>
                  <div className="space-y-2">
                    {weather.daily.slice(0, 5).map((day: any, i: number) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                        <span className="text-sm text-gray-500">
                          {new Date(day.date).toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric' })}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-blue-500">{day.temperatureMin?.toFixed(0)}°</span>
                          <span className="text-sm text-gray-400">/</span>
                          <span className="text-sm text-red-500">{day.temperatureMax?.toFixed(0)}°</span>
                          <Droplets className="h-3 w-3 text-blue-400 ml-2" />
                          <span className="text-xs text-gray-400">{day.precipitationProbability}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="space-y-4">
              <button 
                onClick={() => setLocation('/notes')}
                className="w-full bg-green-500 text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2"
              >
                <StickyNote className="h-5 w-5" />
                Nova Nota
              </button>

              {notes && notes.length > 0 ? (
                <div className="space-y-3">
                  {notes.map((note: any) => (
                    <div 
                      key={note.id}
                      className="bg-white rounded-xl p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold text-gray-900">{note.title}</h4>
                        <span className="text-xs text-gray-400">
                          {new Date(note.createdAt).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2">{note.content}</p>
                      {note.severity && (
                        <span className={`inline-block mt-2 px-2 py-1 rounded text-xs font-medium ${
                          note.severity === 'high' ? 'bg-red-100 text-red-700' :
                          note.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {note.severity === 'high' ? 'Alta' : note.severity === 'medium' ? 'Média' : 'Baixa'}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <StickyNote className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">Nenhuma nota para este campo</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
