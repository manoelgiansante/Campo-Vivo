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
 * Converte valor NDVI para cor RGB usando a escala EXATA do OneSoil
 * Baseado na imagem de referência: verde lima claro vibrante é dominante
 */
function ndviToColor(ndvi: number): [number, number, number] {
  const n = Math.max(0, Math.min(1, ndvi));
  
  // Cores do OneSoil (extraídas da imagem de referência):
  // - Verde lima claro/amarelado (#B8E87C ou similar) é a cor DOMINANTE
  // - Verde mais escuro apenas nas bordas
  // - Amarelo para valores médio-baixos
  
  if (n < 0.25) {
    // Marrom/Laranja (solo, vegetação morta)
    const t = n / 0.25;
    return [
      Math.round(180 + t * 40),   // 180 -> 220
      Math.round(120 + t * 60),   // 120 -> 180
      Math.round(60 + t * 10),    // 60 -> 70
    ];
  } else if (n < 0.40) {
    // Amarelo
    const t = (n - 0.25) / 0.15;
    return [
      Math.round(220 + t * 35),   // 220 -> 255
      Math.round(180 + t * 55),   // 180 -> 235
      Math.round(70 + t * 10),    // 70 -> 80
    ];
  } else if (n < 0.55) {
    // Amarelo para Verde-amarelado claro
    const t = (n - 0.40) / 0.15;
    return [
      Math.round(255 - t * 55),   // 255 -> 200
      Math.round(235 + t * 15),   // 235 -> 250
      Math.round(80 + t * 40),    // 80 -> 120
    ];
  } else if (n < 0.70) {
    // Verde lima CLARO (cor dominante do OneSoil!) - #B8E87C
    // Esta é a faixa mais importante - vegetação saudável normal
    const t = (n - 0.55) / 0.15;
    return [
      Math.round(200 - t * 16),   // 200 -> 184 (B8 = 184)
      Math.round(250 - t * 18),   // 250 -> 232 (E8 = 232)
      Math.round(120 + t * 4),    // 120 -> 124 (7C = 124)
    ];
  } else if (n < 0.82) {
    // Verde lima médio - um pouco mais verde
    const t = (n - 0.70) / 0.12;
    return [
      Math.round(184 - t * 64),   // 184 -> 120
      Math.round(232 - t * 12),   // 232 -> 220
      Math.round(124 - t * 24),   // 124 -> 100
    ];
  } else {
    // Verde mais escuro (bordas, áreas muito saudáveis)
    const t = (n - 0.82) / 0.18;
    return [
      Math.round(120 - t * 50),   // 120 -> 70
      Math.round(220 - t * 50),   // 220 -> 170
      Math.round(100 - t * 20),   // 100 -> 80
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

