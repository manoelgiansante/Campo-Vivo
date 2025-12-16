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
      console.log(`[clipImageToPolygon] Image loaded: ${img.width}x${img.height}`);
      
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }
      
      // Usar dimensões maiores para melhor qualidade (mínimo 256px)
      const targetSize = 256;
      const aspectRatio = img.width / img.height;
      let width: number, height: number;
      
      if (aspectRatio >= 1) {
        width = Math.max(img.width * 8, targetSize); // Aumentar resolução 8x
        height = width / aspectRatio;
      } else {
        height = Math.max(img.height * 8, targetSize);
        width = height * aspectRatio;
      }
      
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
      
      // Desenhar a imagem dentro da máscara com interpolação de alta qualidade
      ctx.imageSmoothingEnabled = false; // Desabilitar smoothing para ver os pixels reais
      ctx.drawImage(img, 0, 0, width, height);
      
      // Converter para data URL
      try {
        const dataUrl = canvas.toDataURL("image/png");
        console.log(`[clipImageToPolygon] Generated clipped image: ${width}x${height}`);
        resolve(dataUrl);
      } catch (e) {
        console.error("[clipImageToPolygon] Failed to generate dataURL:", e);
        reject(e);
      }
    };
    
    img.onerror = (e) => {
      console.error("[clipImageToPolygon] Failed to load image:", e);
      reject(new Error("Failed to load image"));
    };
    
    img.src = imageUrl;
  });
}

/**
 * Converte valor NDVI para cor RGB usando a escala do OneSoil
 * Cores vibrantes: Vermelho -> Laranja -> Amarelo -> Verde lima -> Verde
 */
function ndviToColor(ndvi: number): [number, number, number] {
  // OneSoil usa escala de 0 a 1 para NDVI
  // Valores típicos de vegetação saudável: 0.6-0.9
  const n = Math.max(0, Math.min(1, ndvi));
  
  // Escala de cores do OneSoil (baseada na imagem de referência)
  // Marrom/Vermelho (baixo) -> Amarelo -> Verde lima -> Verde (alto)
  
  if (n < 0.2) {
    // Marrom/Vermelho escuro (solo exposto, sem vegetação)
    const t = n / 0.2;
    return [
      Math.round(139 + t * 61),   // 139 -> 200 (marrom -> laranja escuro)
      Math.round(90 + t * 50),    // 90 -> 140
      Math.round(43),             // marrom
    ];
  } else if (n < 0.35) {
    // Laranja a Amarelo
    const t = (n - 0.2) / 0.15;
    return [
      Math.round(200 + t * 55),   // 200 -> 255
      Math.round(140 + t * 95),   // 140 -> 235
      Math.round(43 + t * 17),    // 43 -> 60
    ];
  } else if (n < 0.5) {
    // Amarelo a Verde-amarelado (chartreuse)
    const t = (n - 0.35) / 0.15;
    return [
      Math.round(255 - t * 55),   // 255 -> 200
      Math.round(235 + t * 20),   // 235 -> 255
      Math.round(60 + t * 20),    // 60 -> 80
    ];
  } else if (n < 0.65) {
    // Verde-amarelado a Verde lima brilhante
    const t = (n - 0.5) / 0.15;
    return [
      Math.round(200 - t * 80),   // 200 -> 120
      Math.round(255 - t * 15),   // 255 -> 240
      Math.round(80 - t * 20),    // 80 -> 60
    ];
  } else if (n < 0.8) {
    // Verde lima a Verde médio
    const t = (n - 0.65) / 0.15;
    return [
      Math.round(120 - t * 50),   // 120 -> 70
      Math.round(240 - t * 40),   // 240 -> 200
      Math.round(60 + t * 10),    // 60 -> 70
    ];
  } else {
    // Verde médio a Verde escuro
    const t = (n - 0.8) / 0.2;
    return [
      Math.round(70 - t * 35),    // 70 -> 35
      Math.round(200 - t * 60),   // 200 -> 140
      Math.round(70 - t * 25),    // 70 -> 45
    ];
  }
}

/**
 * Gera uma imagem NDVI pixelada simulada, recortada pelo polígono
 * Similar ao visual do OneSoil com variação espacial
 */
export function generateClippedNdviGradient(
  baseNdviValue: number,
  polygonCoordinates: [number, number][],
  bounds: { minLng: number; maxLng: number; minLat: number; maxLat: number },
  width: number = 256,
  height: number = 256
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
  
  // Criar path do polígono para verificar se ponto está dentro
  const path = new Path2D();
  path.moveTo(pixelCoords[0].x, pixelCoords[0].y);
  for (let i = 1; i < pixelCoords.length; i++) {
    path.lineTo(pixelCoords[i].x, pixelCoords[i].y);
  }
  path.closePath();
  
  // Tamanho do pixel NDVI (simula resolução do Sentinel-2)
  const pixelSize = Math.max(4, Math.min(12, Math.floor(width / 40)));
  
  // Gerar seed para ruído determinístico baseado nas coordenadas
  const seed = Math.abs(bounds.minLng * 1000 + bounds.minLat * 1000) % 10000;
  
  // Função de ruído simples (Perlin-like simplificado)
  const noise = (x: number, y: number, s: number): number => {
    const n = Math.sin(x * 12.9898 + y * 78.233 + s) * 43758.5453;
    return n - Math.floor(n);
  };
  
  // Gerar mapa NDVI pixel a pixel
  const imageData = ctx.createImageData(width, height);
  
  for (let y = 0; y < height; y += pixelSize) {
    for (let x = 0; x < width; x += pixelSize) {
      // Verificar se o centro do pixel está dentro do polígono
      const centerX = x + pixelSize / 2;
      const centerY = y + pixelSize / 2;
      
      if (!ctx.isPointInPath(path, centerX, centerY)) {
        continue; // Pular pixels fora do polígono
      }
      
      // Gerar variação espacial do NDVI
      // Usar múltiplas frequências de ruído para parecer mais natural
      const noiseVal1 = noise(x / 50, y / 50, seed) * 0.15;
      const noiseVal2 = noise(x / 25, y / 25, seed + 100) * 0.08;
      const noiseVal3 = noise(x / 100, y / 100, seed + 200) * 0.05;
      
      // Adicionar padrão de "linhas de plantio" sutil (pivô/sulcos)
      const rowPattern = Math.sin(y / 12 + x / 60) * 0.03;
      
      // Calcular NDVI do pixel com variação centrada no valor base
      // Base alto (0.65-0.75) = vegetação saudável = verde lima
      let pixelNdvi = baseNdviValue + (noiseVal1 - 0.075) + (noiseVal2 - 0.04) + noiseVal3 + rowPattern;
      
      // Adicionar manchas amarelas (áreas com estresse ou variação natural)
      const spotNoise = noise(x / 40, y / 40, seed + 500);
      if (spotNoise > 0.88) {
        pixelNdvi -= 0.18; // Mancha amarela (estresse)
      } else if (spotNoise > 0.75) {
        pixelNdvi -= 0.08; // Área levemente menos verde
      } else if (spotNoise < 0.08) {
        pixelNdvi += 0.05; // Área mais verde
      }
      
      // Garantir que está no range válido (0.35 - 0.85 para vegetação típica)
      pixelNdvi = Math.max(0.3, Math.min(0.85, pixelNdvi));
      
      // Converter NDVI para cor
      const [r, g, b] = ndviToColor(pixelNdvi);
      
      // Preencher o bloco de pixels
      for (let py = 0; py < pixelSize && y + py < height; py++) {
        for (let px = 0; px < pixelSize && x + px < width; px++) {
          const idx = ((y + py) * width + (x + px)) * 4;
          
          // Verificar novamente se está dentro do polígono
          if (ctx.isPointInPath(path, x + px, y + py)) {
            imageData.data[idx] = r;
            imageData.data[idx + 1] = g;
            imageData.data[idx + 2] = b;
            imageData.data[idx + 3] = 255;
          }
        }
      }
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
  
  return canvas.toDataURL("image/png");
}

