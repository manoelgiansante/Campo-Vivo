/**
 * NdviImageTimeline - Timeline com thumbnails reais de imagens NDVI
 * 
 * Este componente exibe uma timeline horizontal de imagens NDVI
 * vindas da API Agromonitoring, similar ao OneSoil.
 */

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Cloud, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NdviImageTimelineProps {
  fieldId: number;
  onSelectImage?: (imageUrl: string, date: Date) => void;
  className?: string;
}

/**
 * Retorna cor do texto baseada no valor de NDVI
 */
function getNdviTextColor(ndvi: number): string {
  if (ndvi >= 0.6) return 'text-green-600';
  if (ndvi >= 0.4) return 'text-yellow-600';
  if (ndvi >= 0.2) return 'text-orange-600';
  return 'text-red-600';
}

export function NdviImageTimeline({ 
  fieldId, 
  onSelectImage,
  className 
}: NdviImageTimelineProps) {
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  
  // Buscar histórico de NDVI com thumbnails
  const { data: timeline, isLoading } = (trpc as any).ndvi?.history?.useQuery(
    { fieldId, days: 60 },
    { enabled: !!fieldId }
  ) || { data: null, isLoading: false };

  const handleSelect = (index: number, item: any) => {
    setSelectedIndex(index);
    if (onSelectImage && item.thumbnailUrl) {
      onSelectImage(item.thumbnailUrl, new Date(item.date));
    }
  };

  if (isLoading) {
    return (
      <div className={cn("flex gap-3 overflow-x-auto py-2", className)}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div 
            key={i} 
            className="flex-shrink-0 w-24 h-28 bg-gray-200 animate-pulse rounded-xl"
          />
        ))}
      </div>
    );
  }

  if (!timeline || timeline.length === 0) {
    return (
      <div className={cn("text-gray-500 text-sm py-4 text-center", className)}>
        <Cloud className="w-8 h-8 mx-auto mb-2 text-gray-300" />
        <p>Nenhuma imagem de satélite disponível</p>
      </div>
    );
  }

  return (
    <div className={cn("flex gap-2 overflow-x-auto py-2 -mx-4 px-4", className)}>
      {timeline.map((item: any, index: number) => {
        const isSelected = selectedIndex === index;
        const isCloudy = item.cloudCoverage > 50;
        const dateObj = new Date(item.date);
        const ndviValue = item.ndvi || 0;
        
        return (
          <button
            key={index}
            onClick={() => handleSelect(index, item)}
            className={cn(
              "flex-shrink-0 w-24 rounded-xl overflow-hidden transition-all border-2",
              isSelected 
                ? "border-green-500 ring-2 ring-green-500/30" 
                : "border-transparent hover:border-gray-300",
              isCloudy && "opacity-70"
            )}
          >
            {/* Thumbnail Image */}
            <div className="relative h-16 bg-gray-100">
              {item.thumbnailUrl ? (
                <img
                  src={item.thumbnailUrl}
                  alt={`NDVI ${format(dateObj, "dd/MM")}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    // Fallback to colored square on error
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                // Fallback colored square based on NDVI
                <div 
                  className="w-full h-full flex items-center justify-center"
                  style={{
                    backgroundColor: ndviValue >= 0.6 ? '#22C55E' :
                                     ndviValue >= 0.4 ? '#EAB308' :
                                     ndviValue >= 0.2 ? '#F97316' : '#EF4444',
                    opacity: 0.8
                  }}
                >
                  <span className="text-white text-xs font-bold">
                    {ndviValue.toFixed(2)}
                  </span>
                </div>
              )}
              
              {/* Cloud indicator */}
              {isCloudy && (
                <div className="absolute inset-0 bg-gray-400/60 flex items-center justify-center">
                  <Cloud className="w-6 h-6 text-white" />
                </div>
              )}
            </div>
            
            {/* Info */}
            <div className="p-2 bg-white text-center">
              <p className="text-xs text-gray-500">
                {format(dateObj, "dd 'de' MMM", { locale: ptBR })}
              </p>
              {ndviValue > 0 && (
                <p className={cn("text-sm font-semibold", getNdviTextColor(ndviValue))}>
                  {ndviValue.toFixed(2).replace('.', ',')}
                </p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Mini timeline para uso em cards compactos
 */
interface NdviMiniTimelineProps {
  fieldId: number;
  maxItems?: number;
}

export function NdviMiniTimeline({ fieldId, maxItems = 5 }: NdviMiniTimelineProps) {
  const { data: timeline, isLoading } = (trpc as any).ndvi?.history?.useQuery(
    { fieldId, days: 30 },
    { enabled: !!fieldId }
  ) || { data: null, isLoading: false };

  if (isLoading) {
    return (
      <div className="flex gap-1">
        {[1, 2, 3].map((i) => (
          <div key={i} className="w-8 h-8 bg-gray-200 animate-pulse rounded" />
        ))}
      </div>
    );
  }

  if (!timeline || timeline.length === 0) {
    return null;
  }

  return (
    <div className="flex gap-1">
      {timeline.slice(0, maxItems).map((item: any, index: number) => {
        const ndvi = item.ndvi || 0;
        return (
          <div
            key={index}
            className="w-8 h-8 rounded flex items-center justify-center text-white text-[10px] font-bold"
            style={{
              backgroundColor: ndvi >= 0.6 ? '#22C55E' :
                               ndvi >= 0.4 ? '#EAB308' :
                               ndvi >= 0.2 ? '#F97316' : '#EF4444'
            }}
            title={`${new Date(item.date).toLocaleDateString('pt-BR')}: ${ndvi.toFixed(2)}`}
          >
            {item.thumbnailUrl ? (
              <img 
                src={item.thumbnailUrl} 
                alt="" 
                className="w-full h-full object-cover rounded"
              />
            ) : (
              ndvi.toFixed(1)
            )}
          </div>
        );
      })}
    </div>
  );
}

export default NdviImageTimeline;
