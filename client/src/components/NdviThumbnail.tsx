import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface NdviThumbnailProps {
  ndviValue: number;
  fieldCoordinates?: [number, number][];
  size?: number;
  selected?: boolean;
  date?: string;
  className?: string;
}

/**
 * Retorna cor baseada no valor de NDVI
 */
function getNdviColor(ndvi: number): string {
  if (ndvi < 0) return '#8B4513';    // Marrom (água/solo)
  if (ndvi < 0.1) return '#D2691E';  // Marrom claro
  if (ndvi < 0.2) return '#CD853F';  // Peru
  if (ndvi < 0.3) return '#DAA520';  // Goldenrod
  if (ndvi < 0.4) return '#FFD700';  // Amarelo
  if (ndvi < 0.5) return '#ADFF2F';  // Verde-amarelo
  if (ndvi < 0.6) return '#7CFC00';  // Verde claro
  if (ndvi < 0.7) return '#32CD32';  // Verde lima
  if (ndvi < 0.8) return '#228B22';  // Verde floresta
  return '#006400';                   // Verde escuro
}

/**
 * Retorna label descritivo do NDVI
 */
function getNdviLabel(ndvi: number): string {
  if (ndvi < 0.2) return 'Crítico';
  if (ndvi < 0.4) return 'Baixo';
  if (ndvi < 0.6) return 'Moderado';
  if (ndvi < 0.8) return 'Bom';
  return 'Excelente';
}

export function NdviThumbnail({ 
  ndviValue, 
  fieldCoordinates, 
  size = 60,
  selected = false,
  date,
  className
}: NdviThumbnailProps) {
  // Calcular path SVG do polígono
  const { pathD, viewBox } = useMemo(() => {
    if (!fieldCoordinates || fieldCoordinates.length < 3) {
      // Se não tem coordenadas, desenha um retângulo arredondado
      return {
        pathD: `M 10,10 L ${size-10},10 L ${size-10},${size-10} L 10,${size-10} Z`,
        viewBox: `0 0 ${size} ${size}`
      };
    }
    
    const lngs = fieldCoordinates.map(c => c[0]);
    const lats = fieldCoordinates.map(c => c[1]);
    const minX = Math.min(...lngs);
    const maxX = Math.max(...lngs);
    const minY = Math.min(...lats);
    const maxY = Math.max(...lats);
    
    const padding = 6;
    const availableSize = size - padding * 2;
    const scaleX = availableSize / (maxX - minX || 1);
    const scaleY = availableSize / (maxY - minY || 1);
    const scale = Math.min(scaleX, scaleY);
    
    const offsetX = (size - (maxX - minX) * scale) / 2;
    const offsetY = (size - (maxY - minY) * scale) / 2;
    
    const points = fieldCoordinates.map(([lng, lat]) => {
      const x = (lng - minX) * scale + offsetX;
      const y = (maxY - lat) * scale + offsetY; // Inverter Y
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    
    return {
      pathD: `M ${points.join(' L ')} Z`,
      viewBox: `0 0 ${size} ${size}`
    };
  }, [fieldCoordinates, size]);
  
  const fillColor = getNdviColor(ndviValue);
  const label = getNdviLabel(ndviValue);
  
  return (
    <div 
      className={cn(
        "relative rounded-lg overflow-hidden bg-gray-100 cursor-pointer transition-all",
        selected ? "ring-2 ring-green-500 ring-offset-2" : "hover:ring-2 hover:ring-gray-300",
        className
      )}
      style={{ width: size, height: size }}
      title={`NDVI: ${ndviValue.toFixed(2)} - ${label}${date ? ` (${date})` : ''}`}
    >
      <svg 
        width={size} 
        height={size} 
        viewBox={viewBox}
        className="absolute inset-0"
      >
        {/* Background */}
        <rect width={size} height={size} fill="#f3f4f6" />
        
        {/* Campo com cor NDVI */}
        <path
          d={pathD}
          fill={fillColor}
          stroke="#374151"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
      
      {/* NDVI Value Badge */}
      <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1 rounded">
        {ndviValue.toFixed(2)}
      </div>
      
      {/* Date Badge */}
      {date && (
        <div className="absolute top-1 left-1 bg-black/60 text-white text-[8px] px-1 rounded">
          {date}
        </div>
      )}
    </div>
  );
}

/**
 * Timeline de thumbnails NDVI
 */
interface NdviTimelineProps {
  history: Array<{
    date: string;
    value: number;
  }>;
  fieldCoordinates?: [number, number][];
  selectedDate?: string;
  onSelectDate?: (date: string) => void;
}

export function NdviTimeline({ 
  history, 
  fieldCoordinates,
  selectedDate,
  onSelectDate 
}: NdviTimelineProps) {
  if (!history || history.length === 0) {
    return (
      <div className="text-center text-gray-500 py-4">
        Nenhum histórico de NDVI disponível
      </div>
    );
  }
  
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300">
      {history.map((item, i) => (
        <div 
          key={i}
          className="flex flex-col items-center gap-1 flex-shrink-0"
          onClick={() => onSelectDate?.(item.date)}
        >
          <NdviThumbnail
            ndviValue={item.value}
            fieldCoordinates={fieldCoordinates}
            size={56}
            selected={selectedDate === item.date}
            date={new Date(item.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
          />
        </div>
      ))}
    </div>
  );
}

export default NdviThumbnail;
