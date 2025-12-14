/**
 * Recorta uma imagem para seguir o contorno de um polígono
 * Retorna uma URL de data:image com a imagem recortada
 */
export async function clipImageToPolygon(
  imageUrl: string,
  polygonCoordinates: [number, number][],
  bounds: { minLng: number; maxLng: number; minLat: number; maxLat: number }
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }
      
      // Usar dimensões maiores para melhor qualidade
      const width = Math.max(img.width, 512);
      const height = Math.max(img.height, 512);
      canvas.width = width;
      canvas.height = height;
      
      // Calcular escala para converter coordenadas geográficas para pixels
      const lngRange = bounds.maxLng - bounds.minLng;
      const latRange = bounds.maxLat - bounds.minLat;
      
      // Converter coordenadas do polígono para pixels
      const pixelCoords = polygonCoordinates.map(([lng, lat]) => ({
        x: ((lng - bounds.minLng) / lngRange) * width,
        y: ((bounds.maxLat - lat) / latRange) * height, // Inverter Y porque canvas tem Y invertido
      }));
      
      // Criar path do polígono
      ctx.beginPath();
      ctx.moveTo(pixelCoords[0].x, pixelCoords[0].y);
      for (let i = 1; i < pixelCoords.length; i++) {
        ctx.lineTo(pixelCoords[i].x, pixelCoords[i].y);
      }
      ctx.closePath();
      
      // Usar o polígono como máscara de recorte
      ctx.clip();
      
      // Desenhar a imagem dentro da máscara
      ctx.drawImage(img, 0, 0, width, height);
      
      // Converter para data URL
      try {
        const dataUrl = canvas.toDataURL("image/png");
        resolve(dataUrl);
      } catch (e) {
        reject(e);
      }
    };
    
    img.onerror = () => {
      reject(new Error("Failed to load image"));
    };
    
    img.src = imageUrl;
  });
}

/**
 * Gera uma imagem de gradiente NDVI recortada pelo polígono
 */
export function generateClippedNdviGradient(
  ndviValue: number,
  polygonCoordinates: [number, number][],
  bounds: { minLng: number; maxLng: number; minLat: number; maxLat: number },
  width: number = 512,
  height: number = 512
): string {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  
  if (!ctx) {
    throw new Error("Could not get canvas context");
  }
  
  canvas.width = width;
  canvas.height = height;
  
  // Calcular escala para converter coordenadas geográficas para pixels
  const lngRange = bounds.maxLng - bounds.minLng;
  const latRange = bounds.maxLat - bounds.minLat;
  
  // Converter coordenadas do polígono para pixels
  const pixelCoords = polygonCoordinates.map(([lng, lat]) => ({
    x: ((lng - bounds.minLng) / lngRange) * width,
    y: ((bounds.maxLat - lat) / latRange) * height,
  }));
  
  // Criar path do polígono
  ctx.beginPath();
  ctx.moveTo(pixelCoords[0].x, pixelCoords[0].y);
  for (let i = 1; i < pixelCoords.length; i++) {
    ctx.lineTo(pixelCoords[i].x, pixelCoords[i].y);
  }
  ctx.closePath();
  
  // Usar o polígono como máscara de recorte
  ctx.clip();
  
  // Criar gradiente baseado no NDVI
  // NDVI: 0.0 = vermelho, 0.5 = amarelo, 1.0 = verde
  const gradient = ctx.createLinearGradient(0, height, 0, 0);
  
  if (ndviValue >= 0.6) {
    // Alto NDVI - verde com variações
    gradient.addColorStop(0, "#15803d"); // Verde escuro
    gradient.addColorStop(0.5, "#22c55e"); // Verde médio
    gradient.addColorStop(1, "#86efac"); // Verde claro
  } else if (ndviValue >= 0.4) {
    // Médio NDVI - amarelo/verde
    gradient.addColorStop(0, "#ca8a04"); // Amarelo escuro
    gradient.addColorStop(0.5, "#eab308"); // Amarelo
    gradient.addColorStop(1, "#22c55e"); // Verde
  } else if (ndviValue >= 0.2) {
    // Baixo NDVI - laranja/amarelo
    gradient.addColorStop(0, "#ea580c"); // Laranja
    gradient.addColorStop(0.5, "#f97316"); // Laranja médio
    gradient.addColorStop(1, "#eab308"); // Amarelo
  } else {
    // Muito baixo NDVI - vermelho
    gradient.addColorStop(0, "#b91c1c"); // Vermelho escuro
    gradient.addColorStop(0.5, "#ef4444"); // Vermelho
    gradient.addColorStop(1, "#f97316"); // Laranja
  }
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  
  return canvas.toDataURL("image/png");
}
