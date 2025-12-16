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
 * Converte valor NDVI para cor RGB usando a escala padrão
 * NDVI: -1 a 1, normalizado para 0-1
 */
function ndviToColor(ndvi: number): [number, number, number] {
  // Normalizar NDVI de [-0.2, 1.0] para [0, 1]
  const normalized = Math.max(0, Math.min(1, (ndvi + 0.2) / 1.2));
  
  // Escala de cores similar ao OneSoil/Sentinel
  // Vermelho -> Laranja -> Amarelo -> Verde claro -> Verde escuro
  if (normalized < 0.2) {
    // Vermelho a Laranja
    const t = normalized / 0.2;
    return [
      Math.round(180 + t * 75),  // 180 -> 255
      Math.round(t * 140),       // 0 -> 140
      Math.round(30),            // 30
    ];
  } else if (normalized < 0.4) {
    // Laranja a Amarelo
    const t = (normalized - 0.2) / 0.2;
    return [
      Math.round(255 - t * 25),  // 255 -> 230
      Math.round(140 + t * 110), // 140 -> 250
      Math.round(30 + t * 20),   // 30 -> 50
    ];
  } else if (normalized < 0.6) {
    // Amarelo a Verde claro
    const t = (normalized - 0.4) / 0.2;
    return [
      Math.round(230 - t * 80),  // 230 -> 150
      Math.round(250 - t * 30),  // 250 -> 220
      Math.round(50 + t * 30),   // 50 -> 80
    ];
  } else if (normalized < 0.8) {
    // Verde claro a Verde médio
    const t = (normalized - 0.6) / 0.2;
    return [
      Math.round(150 - t * 80),  // 150 -> 70
      Math.round(220 - t * 30),  // 220 -> 190
      Math.round(80 - t * 20),   // 80 -> 60
    ];
  } else {
    // Verde médio a Verde escuro
    const t = (normalized - 0.8) / 0.2;
    return [
      Math.round(70 - t * 40),   // 70 -> 30
      Math.round(190 - t * 50),  // 190 -> 140
      Math.round(60 - t * 20),   // 60 -> 40
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
      const noiseVal1 = noise(x / 50, y / 50, seed) * 0.3;
      const noiseVal2 = noise(x / 25, y / 25, seed + 100) * 0.15;
      const noiseVal3 = noise(x / 100, y / 100, seed + 200) * 0.1;
      
      // Adicionar padrão de "linhas de plantio" (comum em campos agrícolas)
      const rowPattern = Math.sin(y / 8 + x / 40) * 0.05;
      
      // Calcular NDVI do pixel com variação
      let pixelNdvi = baseNdviValue + noiseVal1 + noiseVal2 + noiseVal3 + rowPattern - 0.2;
      
      // Adicionar manchas (áreas com problemas ou variação natural)
      const spotNoise = noise(x / 30, y / 30, seed + 500);
      if (spotNoise > 0.85) {
        pixelNdvi -= 0.15; // Mancha amarela/estresse
      } else if (spotNoise < 0.1) {
        pixelNdvi += 0.08; // Área mais verde
      }
      
      // Garantir que está no range válido
      pixelNdvi = Math.max(0.1, Math.min(0.95, pixelNdvi));
      
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

