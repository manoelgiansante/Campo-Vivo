import { useState, useRef, useEffect, useCallback } from "react";
import { 
  ChevronLeft, 
  ChevronRight,
  Calendar,
  Layers,
  ZoomIn,
  ZoomOut,
  Loader2,
  CloudOff,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useLocation, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";

interface SatelliteImage {
  date: string;
  url: string;
  cloudCoverage: number;
  ndviAverage: number;
  type: "natural" | "ndvi" | "false-color";
}

// Generate mock satellite images
function generateMockImages(count: number): SatelliteImage[] {
  const images: SatelliteImage[] = [];
  const today = new Date();
  
  for (let i = 0; i < count; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - (i * 5)); // Every 5 days (Sentinel-2 revisit)
    
    images.push({
      date: date.toISOString().split('T')[0],
      url: `https://picsum.photos/seed/${date.getTime()}/400/400?grayscale`, // Placeholder
      cloudCoverage: Math.floor(Math.random() * 50),
      ndviAverage: 0.4 + Math.random() * 0.4,
      type: "ndvi",
    });
  }
  
  return images;
}

export default function SatelliteCompare() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/fields/:id/compare");
  const fieldId = params?.id ? parseInt(params.id) : null;
  
  const [leftIndex, setLeftIndex] = useState(0);
  const [rightIndex, setRightIndex] = useState(1);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [hideCloudyDays, setHideCloudyDays] = useState(false);
  const [viewMode, setViewMode] = useState<"slider" | "sideBySide">("slider");
  const [imageType, setImageType] = useState<"ndvi" | "natural">("ndvi");
  const [isLoading, setIsLoading] = useState(true);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  
  // Get field details
  const { data: field } = trpc.fields.getById.useQuery(
    { id: fieldId! },
    { enabled: !!fieldId }
  );
  
  // Generate mock images
  const allImages = generateMockImages(20);
  const images = hideCloudyDays 
    ? allImages.filter(img => img.cloudCoverage < 20)
    : allImages;
  
  // Simulate loading
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);
  
  // Handle slider drag
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percentage = (x / rect.width) * 100;
    setSliderPosition(percentage);
  }, []);
  
  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);
  
  const handleMouseDown = useCallback(() => {
    isDragging.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove, handleMouseUp]);
  
  // Touch events for mobile
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.touches[0].clientX - rect.left, rect.width));
    const percentage = (x / rect.width) * 100;
    setSliderPosition(percentage);
  }, []);
  
  const leftImage = images[leftIndex];
  const rightImage = images[rightIndex];
  
  // NDVI color based on value
  const getNdviGradient = (ndvi: number) => {
    if (ndvi < 0.3) return "from-red-600 to-red-400";
    if (ndvi < 0.5) return "from-yellow-600 to-yellow-400";
    if (ndvi < 0.7) return "from-lime-600 to-lime-400";
    return "from-green-600 to-green-400";
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800/90 backdrop-blur-sm px-4 pt-4 pb-3 sticky top-0 z-20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <button onClick={() => setLocation(fieldId ? `/fields/${fieldId}` : "/fields")} className="p-1">
              <ChevronLeft className="h-6 w-6" />
            </button>
            <div>
              <h1 className="text-lg font-bold">Comparar Imagens</h1>
              {field && <p className="text-sm text-gray-400">{field.name}</p>}
            </div>
          </div>
          
          {/* View Mode Toggle */}
          <div className="flex items-center gap-2 bg-gray-700 rounded-full p-1">
            <button
              onClick={() => setViewMode("slider")}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                viewMode === "slider" ? "bg-green-600" : "hover:bg-gray-600"
              }`}
            >
              Slider
            </button>
            <button
              onClick={() => setViewMode("sideBySide")}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                viewMode === "sideBySide" ? "bg-green-600" : "hover:bg-gray-600"
              }`}
            >
              Lado a lado
            </button>
          </div>
        </div>
        
        {/* Filters */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-gray-400" />
            <select 
              value={imageType}
              onChange={(e) => setImageType(e.target.value as "ndvi" | "natural")}
              className="bg-gray-700 rounded-lg px-3 py-1.5 text-sm border-0"
            >
              <option value="ndvi">NDVI</option>
              <option value="natural">Cor Natural</option>
            </select>
          </div>
          
          <div className="flex items-center gap-2">
            <CloudOff className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-400">Ocultar nublados</span>
            <Switch 
              checked={hideCloudyDays}
              onCheckedChange={setHideCloudyDays}
            />
          </div>
        </div>
      </div>
      
      {/* Comparison View */}
      {viewMode === "slider" ? (
        <div 
          ref={containerRef}
          className="relative w-full aspect-square overflow-hidden touch-none"
          onTouchMove={handleTouchMove}
        >
          {/* Right Image (Background) */}
          <div className="absolute inset-0">
            <div 
              className={`w-full h-full bg-gradient-to-br ${getNdviGradient(rightImage?.ndviAverage || 0.5)}`}
            >
              <div className="absolute bottom-4 right-4 bg-black/60 rounded-lg px-3 py-2">
                <p className="text-xs text-gray-300">{rightImage?.date}</p>
                <p className="font-semibold">NDVI: {rightImage?.ndviAverage.toFixed(2)}</p>
              </div>
            </div>
          </div>
          
          {/* Left Image (Clipped) */}
          <div 
            className="absolute inset-0 overflow-hidden"
            style={{ width: `${sliderPosition}%` }}
          >
            <div 
              className={`h-full bg-gradient-to-br ${getNdviGradient(leftImage?.ndviAverage || 0.5)}`}
              style={{ width: `${100 * (100 / sliderPosition)}%` }}
            >
              <div className="absolute bottom-4 left-4 bg-black/60 rounded-lg px-3 py-2">
                <p className="text-xs text-gray-300">{leftImage?.date}</p>
                <p className="font-semibold">NDVI: {leftImage?.ndviAverage.toFixed(2)}</p>
              </div>
            </div>
          </div>
          
          {/* Slider Handle */}
          <div
            ref={sliderRef}
            className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize z-10"
            style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}
            onMouseDown={handleMouseDown}
            onTouchStart={() => {}}
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center">
              <div className="flex items-center gap-0.5">
                <ChevronLeft className="h-4 w-4 text-gray-600" />
                <ChevronRight className="h-4 w-4 text-gray-600" />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-1">
          {/* Left Image */}
          <div className="aspect-square relative">
            <div 
              className={`w-full h-full bg-gradient-to-br ${getNdviGradient(leftImage?.ndviAverage || 0.5)}`}
            >
              <div className="absolute bottom-2 left-2 bg-black/60 rounded-lg px-2 py-1">
                <p className="text-xs text-gray-300">{leftImage?.date}</p>
                <p className="text-sm font-semibold">NDVI: {leftImage?.ndviAverage.toFixed(2)}</p>
              </div>
            </div>
          </div>
          
          {/* Right Image */}
          <div className="aspect-square relative">
            <div 
              className={`w-full h-full bg-gradient-to-br ${getNdviGradient(rightImage?.ndviAverage || 0.5)}`}
            >
              <div className="absolute bottom-2 right-2 bg-black/60 rounded-lg px-2 py-1">
                <p className="text-xs text-gray-300">{rightImage?.date}</p>
                <p className="text-sm font-semibold">NDVI: {rightImage?.ndviAverage.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Date Selectors */}
      <div className="px-4 py-6 space-y-4">
        {/* Left Date */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Data 1 (esquerda)</span>
            <span className="text-sm font-medium">{leftImage?.date}</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
            {images.map((img, index) => (
              <DateThumbnail
                key={index}
                date={img.date}
                ndvi={img.ndviAverage}
                cloudCoverage={img.cloudCoverage}
                selected={leftIndex === index}
                onClick={() => setLeftIndex(index)}
              />
            ))}
          </div>
        </div>
        
        {/* Right Date */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Data 2 (direita)</span>
            <span className="text-sm font-medium">{rightImage?.date}</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
            {images.map((img, index) => (
              <DateThumbnail
                key={index}
                date={img.date}
                ndvi={img.ndviAverage}
                cloudCoverage={img.cloudCoverage}
                selected={rightIndex === index}
                onClick={() => setRightIndex(index)}
              />
            ))}
          </div>
        </div>
      </div>
      
      {/* NDVI Difference */}
      {leftImage && rightImage && (
        <div className="px-4 pb-6">
          <div className="bg-gray-800 rounded-2xl p-4">
            <h3 className="font-semibold mb-3">Análise de Mudança</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-400">
                  {leftImage.ndviAverage.toFixed(2)}
                </p>
                <p className="text-xs text-gray-400">NDVI Anterior</p>
              </div>
              <div className="text-center">
                <p className={`text-2xl font-bold ${
                  rightImage.ndviAverage > leftImage.ndviAverage 
                    ? "text-green-400" 
                    : "text-red-400"
                }`}>
                  {rightImage.ndviAverage > leftImage.ndviAverage ? "+" : ""}
                  {((rightImage.ndviAverage - leftImage.ndviAverage) * 100).toFixed(1)}%
                </p>
                <p className="text-xs text-gray-400">Variação</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-400">
                  {rightImage.ndviAverage.toFixed(2)}
                </p>
                <p className="text-xs text-gray-400">NDVI Atual</p>
              </div>
            </div>
            
            {/* Interpretation */}
            <div className="mt-4 p-3 bg-gray-700/50 rounded-xl">
              <p className="text-sm text-gray-300">
                {rightImage.ndviAverage > leftImage.ndviAverage ? (
                  <>
                    <span className="text-green-400">↑ Melhoria</span> na vegetação 
                    detectada. A saúde das plantas aumentou em{" "}
                    {((rightImage.ndviAverage - leftImage.ndviAverage) * 100).toFixed(1)}%.
                  </>
                ) : rightImage.ndviAverage < leftImage.ndviAverage ? (
                  <>
                    <span className="text-red-400">↓ Redução</span> na vegetação 
                    detectada. Verifique possíveis problemas como estresse hídrico 
                    ou pragas.
                  </>
                ) : (
                  <>
                    <span className="text-yellow-400">→ Estável</span>. 
                    Nenhuma mudança significativa detectada.
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Date Thumbnail Component
function DateThumbnail({
  date,
  ndvi,
  cloudCoverage,
  selected,
  onClick,
}: {
  date: string;
  ndvi: number;
  cloudCoverage: number;
  selected: boolean;
  onClick: () => void;
}) {
  const getNdviColor = (value: number) => {
    if (value < 0.3) return "bg-red-500";
    if (value < 0.5) return "bg-yellow-500";
    if (value < 0.7) return "bg-lime-500";
    return "bg-green-500";
  };
  
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 w-20 rounded-xl overflow-hidden transition-all ${
        selected ? "ring-2 ring-green-500" : "opacity-70 hover:opacity-100"
      }`}
    >
      <div className={`h-14 ${getNdviColor(ndvi)} relative`}>
        {cloudCoverage > 20 && (
          <div className="absolute inset-0 bg-gray-500/50 flex items-center justify-center">
            <CloudOff className="h-5 w-5 text-white" />
          </div>
        )}
      </div>
      <div className="bg-gray-700 p-1.5 text-center">
        <p className="text-xs text-gray-300">
          {new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
        </p>
        <p className="text-xs font-medium">{ndvi.toFixed(2)}</p>
      </div>
    </button>
  );
}
