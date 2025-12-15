/**
 * Pest Prediction Service
 * Serviço de previsão de pragas baseado em condições climáticas
 */

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface PestRisk {
  pestType: string;
  pestNamePt: string;
  riskLevel: RiskLevel;
  probability: number;
  predictedDate: Date;
  recommendations: string;
  affectedCrops: string[];
}

export interface WeatherConditions {
  avgTemp: number;
  avgHumidity: number;
  totalPrecipitation: number;
  consecutiveWetDays: number;
}

// Regras de previsão baseadas em pesquisa agronômica brasileira
const PEST_RULES: Record<string, {
  name: string;
  crops: string[];
  conditions: {
    tempMin?: number;
    tempMax?: number;
    humidityMin?: number;
    humidityMax?: number;
    precipitationMin?: number;
    precipitationMax?: number;
    wetDaysMin?: number;
  };
  recommendations: string;
}> = {
  'ferrugem-asiatica': {
    name: 'Ferrugem Asiática',
    crops: ['soja'],
    conditions: {
      tempMin: 15,
      tempMax: 28,
      humidityMin: 80,
      precipitationMin: 20,
      wetDaysMin: 3,
    },
    recommendations: 'Aplicar fungicida preventivo. Monitorar folhas inferiores. Considerar variedades resistentes. Evitar plantios tardios.',
  },
  'lagarta-cartucho': {
    name: 'Lagarta-do-cartucho',
    crops: ['milho', 'sorgo'],
    conditions: {
      tempMin: 20,
      tempMax: 35,
      humidityMin: 60,
      precipitationMax: 50,
    },
    recommendations: 'Monitorar plantas jovens (V2-V8). Aplicar inseticida biológico (Bt). Considerar liberação de Trichogramma. Usar armadilhas de feromônio.',
  },
  'mosca-branca': {
    name: 'Mosca-branca',
    crops: ['algodao', 'soja', 'feijao', 'tomate'],
    conditions: {
      tempMin: 25,
      tempMax: 35,
      humidityMax: 70,
      precipitationMax: 30,
    },
    recommendations: 'Usar armadilhas amarelas adesivas. Aplicar óleo de neem. Evitar inseticidas de amplo espectro. Monitorar face inferior das folhas.',
  },
  'cigarrinha-milho': {
    name: 'Cigarrinha-do-milho',
    crops: ['milho'],
    conditions: {
      tempMin: 22,
      tempMax: 30,
      humidityMin: 70,
    },
    recommendations: 'Eliminar plantas voluntárias. Tratamento de sementes com inseticida. Monitorar bordas do campo. Considerar híbridos tolerantes.',
  },
  'percevejo-marrom': {
    name: 'Percevejo-marrom',
    crops: ['soja'],
    conditions: {
      tempMin: 20,
      tempMax: 32,
      humidityMin: 60,
    },
    recommendations: 'Usar pano de batida para monitoramento. Aplicar inseticida quando atingir nível de controle (2 percevejos/m). Monitorar fase de enchimento de grãos.',
  },
  'broca-cafe': {
    name: 'Broca-do-café',
    crops: ['cafe'],
    conditions: {
      tempMin: 20,
      tempMax: 30,
      humidityMin: 70,
    },
    recommendations: 'Fazer repasse na colheita. Aplicar armadilhas etanólicas. Usar Beauveria bassiana. Manter café limpo após colheita.',
  },
  'bicudo-algodoeiro': {
    name: 'Bicudo-do-algodoeiro',
    crops: ['algodao'],
    conditions: {
      tempMin: 22,
      tempMax: 30,
      humidityMin: 65,
    },
    recommendations: 'Destruir soqueiras após colheita. Usar armadilhas de feromônio. Monitorar botões florais. Aplicar inseticida no momento correto.',
  },
  'acaro-rajado': {
    name: 'Ácaro-rajado',
    crops: ['soja', 'algodao', 'feijao', 'morango'],
    conditions: {
      tempMin: 25,
      tempMax: 38,
      humidityMax: 60,
      precipitationMax: 10,
    },
    recommendations: 'Usar acaricidas específicos. Evitar inseticidas que eliminem inimigos naturais. Irrigar para aumentar umidade. Monitorar face inferior das folhas.',
  },
};

/**
 * Prevê riscos de pragas baseado nas condições climáticas e cultura
 */
export function predictPestRisks(
  crop: string,
  weather: WeatherConditions
): PestRisk[] {
  const risks: PestRisk[] = [];
  const normalizedCrop = crop.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  for (const [pestId, rule] of Object.entries(PEST_RULES)) {
    // Verificar se a praga afeta a cultura
    const matchesCrop = rule.crops.some(c => 
      normalizedCrop.includes(c) || c.includes(normalizedCrop)
    );
    
    if (!matchesCrop) continue;
    
    // Calcular probabilidade baseada nas condições
    let probability = 0;
    let matchedConditions = 0;
    let totalConditions = 0;
    const cond = rule.conditions;
    
    // Temperatura
    if (cond.tempMin !== undefined || cond.tempMax !== undefined) {
      totalConditions++;
      const tempInRange = 
        (cond.tempMin === undefined || weather.avgTemp >= cond.tempMin) &&
        (cond.tempMax === undefined || weather.avgTemp <= cond.tempMax);
      if (tempInRange) matchedConditions++;
    }
    
    // Umidade
    if (cond.humidityMin !== undefined || cond.humidityMax !== undefined) {
      totalConditions++;
      const humidityInRange =
        (cond.humidityMin === undefined || weather.avgHumidity >= cond.humidityMin) &&
        (cond.humidityMax === undefined || weather.avgHumidity <= cond.humidityMax);
      if (humidityInRange) matchedConditions++;
    }
    
    // Precipitação
    if (cond.precipitationMin !== undefined || cond.precipitationMax !== undefined) {
      totalConditions++;
      const precipInRange =
        (cond.precipitationMin === undefined || weather.totalPrecipitation >= cond.precipitationMin) &&
        (cond.precipitationMax === undefined || weather.totalPrecipitation <= cond.precipitationMax);
      if (precipInRange) matchedConditions++;
    }
    
    // Dias consecutivos de chuva
    if (cond.wetDaysMin !== undefined) {
      totalConditions++;
      if (weather.consecutiveWetDays >= cond.wetDaysMin) matchedConditions++;
    }
    
    // Calcular probabilidade
    probability = totalConditions > 0 
      ? Math.round((matchedConditions / totalConditions) * 100) 
      : 0;
    
    // Só alertar se probabilidade > 40%
    if (probability >= 40) {
      const riskLevel: RiskLevel = 
        probability >= 80 ? 'critical' :
        probability >= 60 ? 'high' :
        probability >= 40 ? 'medium' : 'low';
      
      // Prever data de ocorrência (7-14 dias dependendo do risco)
      const daysToOccurrence = riskLevel === 'critical' ? 5 :
                               riskLevel === 'high' ? 7 :
                               riskLevel === 'medium' ? 10 : 14;
      
      risks.push({
        pestType: pestId,
        pestNamePt: rule.name,
        riskLevel,
        probability,
        predictedDate: new Date(Date.now() + daysToOccurrence * 24 * 60 * 60 * 1000),
        recommendations: rule.recommendations,
        affectedCrops: rule.crops,
      });
    }
  }
  
  return risks.sort((a, b) => b.probability - a.probability);
}

/**
 * Calcula condições climáticas a partir dos dados do Open-Meteo
 */
export function calculateWeatherConditions(
  dailyTemps: number[],
  dailyHumidity: number[],
  dailyPrecipitation: number[]
): WeatherConditions {
  const avgTemp = dailyTemps.reduce((a, b) => a + b, 0) / dailyTemps.length;
  const avgHumidity = dailyHumidity.reduce((a, b) => a + b, 0) / dailyHumidity.length;
  const totalPrecipitation = dailyPrecipitation.reduce((a, b) => a + b, 0);
  
  // Contar dias consecutivos de chuva
  let consecutiveWetDays = 0;
  let currentStreak = 0;
  for (const precip of dailyPrecipitation) {
    if (precip > 1) { // >1mm é considerado dia de chuva
      currentStreak++;
      consecutiveWetDays = Math.max(consecutiveWetDays, currentStreak);
    } else {
      currentStreak = 0;
    }
  }
  
  return {
    avgTemp: Math.round(avgTemp * 10) / 10,
    avgHumidity: Math.round(avgHumidity),
    totalPrecipitation: Math.round(totalPrecipitation * 10) / 10,
    consecutiveWetDays,
  };
}
