/**
 * Hook para gerenciar overlay de NDVI no mapa Mapbox
 */

import { useCallback, useRef } from 'react';
import mapboxgl from 'mapbox-gl';

interface NdviOverlayOptions {
  opacity?: number;
  coordinates: [[number, number], [number, number], [number, number], [number, number]]; // [topLeft, topRight, bottomRight, bottomLeft]
}

export function useNdviOverlay() {
  const activeLayersRef = useRef<Set<string>>(new Set());
  
  /**
   * Adiciona uma imagem NDVI como overlay no mapa
   */
  const addNdviImageOverlay = useCallback((
    map: mapboxgl.Map,
    layerId: string,
    imageUrl: string,
    options: NdviOverlayOptions
  ) => {
    const { opacity = 0.7, coordinates } = options;
    const sourceId = `${layerId}-source`;
    
    // Remover layer existente se houver
    removeNdviOverlay(map, layerId);
    
    // Adicionar source de imagem
    map.addSource(sourceId, {
      type: 'image',
      url: imageUrl,
      coordinates: coordinates,
    });
    
    // Adicionar layer de imagem
    map.addLayer({
      id: layerId,
      type: 'raster',
      source: sourceId,
      paint: {
        'raster-opacity': opacity,
        'raster-fade-duration': 0,
      },
    });
    
    activeLayersRef.current.add(layerId);
  }, []);
  
  /**
   * Adiciona NDVI como tiles XYZ (para imagens maiores)
   */
  const addNdviTileOverlay = useCallback((
    map: mapboxgl.Map,
    layerId: string,
    tileUrl: string,
    options: { opacity?: number; bounds?: [number, number, number, number] } = {}
  ) => {
    const { opacity = 0.7, bounds } = options;
    const sourceId = `${layerId}-source`;
    
    // Remover layer existente se houver
    removeNdviOverlay(map, layerId);
    
    // Adicionar source de tiles
    const sourceConfig: mapboxgl.RasterSourceSpecification = {
      type: 'raster',
      tiles: [tileUrl],
      tileSize: 256,
    };
    
    if (bounds) {
      sourceConfig.bounds = bounds;
    }
    
    map.addSource(sourceId, sourceConfig);
    
    // Adicionar layer de tiles
    map.addLayer({
      id: layerId,
      type: 'raster',
      source: sourceId,
      paint: {
        'raster-opacity': opacity,
        'raster-fade-duration': 300,
      },
    });
    
    activeLayersRef.current.add(layerId);
  }, []);
  
  /**
   * Remove um overlay de NDVI
   */
  const removeNdviOverlay = useCallback((map: mapboxgl.Map, layerId: string) => {
    const sourceId = `${layerId}-source`;
    
    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }
    
    if (map.getSource(sourceId)) {
      map.removeSource(sourceId);
    }
    
    activeLayersRef.current.delete(layerId);
  }, []);
  
  /**
   * Atualiza a opacidade de um overlay existente
   */
  const setOverlayOpacity = useCallback((map: mapboxgl.Map, layerId: string, opacity: number) => {
    if (map.getLayer(layerId)) {
      map.setPaintProperty(layerId, 'raster-opacity', opacity);
    }
  }, []);
  
  /**
   * Remove todos os overlays de NDVI
   */
  const removeAllOverlays = useCallback((map: mapboxgl.Map) => {
    activeLayersRef.current.forEach((layerId) => {
      removeNdviOverlay(map, layerId);
    });
    activeLayersRef.current.clear();
  }, [removeNdviOverlay]);
  
  /**
   * Calcula as coordenadas de bounds a partir de um polígono
   */
  const calculateBoundsFromPolygon = useCallback((
    coordinates: Array<{ lat: number; lng: number } | [number, number]>
  ): [[number, number], [number, number], [number, number], [number, number]] => {
    let minLng = Infinity, maxLng = -Infinity;
    let minLat = Infinity, maxLat = -Infinity;
    
    coordinates.forEach((coord) => {
      const lng = Array.isArray(coord) ? coord[0] : coord.lng;
      const lat = Array.isArray(coord) ? coord[1] : coord.lat;
      
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    });
    
    // Retornar [topLeft, topRight, bottomRight, bottomLeft]
    return [
      [minLng, maxLat], // top-left
      [maxLng, maxLat], // top-right
      [maxLng, minLat], // bottom-right
      [minLng, minLat], // bottom-left
    ];
  }, []);
  
  /**
   * Gera URL de imagem NDVI colorida a partir de dados NDVI
   * (Quando não temos a imagem do satélite, geramos uma representação visual)
   */
  const generateNdviGradientOverlay = useCallback((
    map: mapboxgl.Map,
    layerId: string,
    ndviValue: number,
    bounds: [[number, number], [number, number], [number, number], [number, number]]
  ) => {
    // Determinar cor baseada no NDVI
    const color = getNdviColor(ndviValue);
    
    // Criar um canvas com gradiente
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      // Criar gradiente radial para simular variação
      const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 180);
      gradient.addColorStop(0, color);
      gradient.addColorStop(0.7, color);
      gradient.addColorStop(1, adjustColorBrightness(color, -20));
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 256, 256);
      
      // Adicionar ruído para parecer mais natural
      addNoiseToCanvas(ctx, 256, 256, 0.1);
    }
    
    const dataUrl = canvas.toDataURL('image/png');
    
    addNdviImageOverlay(map, layerId, dataUrl, {
      opacity: 0.6,
      coordinates: bounds,
    });
  }, [addNdviImageOverlay]);
  
  return {
    addNdviImageOverlay,
    addNdviTileOverlay,
    removeNdviOverlay,
    setOverlayOpacity,
    removeAllOverlays,
    calculateBoundsFromPolygon,
    generateNdviGradientOverlay,
  };
}

/**
 * Retorna cor baseada no valor NDVI - Estilo OneSoil
 * Gradiente: Vermelho (estresse) → Amarelo (moderado) → Verde (saudável)
 */
function getNdviColor(ndvi: number): string {
  // OneSoil style palette
  if (ndvi < 0) return '#A52A2A'; // Marrom (solo exposto/água)
  if (ndvi < 0.1) return '#D32F2F'; // Vermelho escuro (vegetação morta)
  if (ndvi < 0.2) return '#E53935'; // Vermelho (estresse severo)
  if (ndvi < 0.3) return '#FF5722'; // Laranja-vermelho (estresse)
  if (ndvi < 0.4) return '#FF9800'; // Laranja (vegetação fraca)
  if (ndvi < 0.5) return '#FFC107'; // Amarelo (vegetação moderada)
  if (ndvi < 0.6) return '#CDDC39'; // Amarelo-verde (vegetação boa)
  if (ndvi < 0.7) return '#8BC34A'; // Verde claro (vegetação saudável)
  if (ndvi < 0.8) return '#4CAF50'; // Verde (vegetação muito saudável)
  return '#2E7D32'; // Verde escuro (vegetação densa)
}

/**
 * Ajusta brilho de uma cor hex
 */
function adjustColorBrightness(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  
  return '#' + (
    0x1000000 +
    (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
    (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
    (B < 255 ? (B < 1 ? 0 : B) : 255)
  ).toString(16).slice(1);
}

/**
 * Adiciona ruído sutil ao canvas para parecer mais natural
 */
function addNoiseToCanvas(ctx: CanvasRenderingContext2D, width: number, height: number, intensity: number) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * intensity * 255;
    data[i] = Math.max(0, Math.min(255, data[i] + noise));     // R
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise)); // G
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise)); // B
  }
  
  ctx.putImageData(imageData, 0, 0);
}

export default useNdviOverlay;
