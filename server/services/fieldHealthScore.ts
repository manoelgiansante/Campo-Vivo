/**
 * Field Health Score Service
 * Calcula score de saúde do campo de 0-100
 */

import type { PestRisk } from './pestPrediction';
import type { WeatherForecast } from './openMeteo';

export interface HealthScoreFactors {
  ndviScore: number;      // 0-30 pontos
  ndviTrend: number;      // 0-15 pontos
  weatherScore: number;   // 0-20 pontos
  pestRiskScore: number;  // 0-20 pontos
  phenologyScore: number; // 0-15 pontos
}

export interface HealthScoreResult {
  score: number;
  factors: HealthScoreFactors;
  interpretation: string;
  status: 'excellent' | 'good' | 'moderate' | 'poor' | 'critical';
  recommendations: string[];
}

/**
 * Calcula o score de saúde do campo (0-100)
 */
export function calculateFieldHealthScore(
  currentNdvi: number | null,
  ndviHistory: number[],
  weather: WeatherForecast | null,
  pestRisks: PestRisk[],
  plantingDate?: Date | null,
  crop?: string | null
): HealthScoreResult {
  const recommendations: string[] = [];

  // 1. NDVI Score (30 pontos)
  // NDVI > 0.7 = 30 pontos, < 0.2 = 0 pontos
  let ndviScore = 15; // Default se não tem dados
  if (currentNdvi !== null) {
    ndviScore = Math.min(30, Math.max(0, (currentNdvi - 0.2) / 0.5 * 30));
    
    if (currentNdvi < 0.4) {
      recommendations.push('NDVI baixo detectado. Verificar estresse hídrico ou nutricional.');
    }
  } else {
    recommendations.push('Sincronize dados de satélite para monitoramento de NDVI.');
  }
  
  // 2. NDVI Trend (15 pontos)
  let ndviTrend = 7.5; // Neutro
  if (ndviHistory.length >= 3) {
    const recent = ndviHistory.slice(-3);
    const trend = recent[2] - recent[0];
    if (trend > 0.05) {
      ndviTrend = 15; // Subindo
    } else if (trend < -0.05) {
      ndviTrend = 0; // Caindo
      recommendations.push('NDVI em queda. Investigar possíveis causas (pragas, doenças, déficit hídrico).');
    }
  }
  
  // 3. Weather Score (20 pontos)
  let weatherScore = 15; // Default se não tem dados
  if (weather) {
    weatherScore = 20;
    const temp = weather.hourly.temperature_2m[0];
    const precip7d = weather.daily.precipitation_sum.reduce((a, b) => a + b, 0);
    
    // Temperatura extrema
    if (temp < 10 || temp > 38) {
      weatherScore -= 10;
      if (temp < 10) recommendations.push('Alerta: Temperatura baixa pode afetar desenvolvimento.');
      if (temp > 38) recommendations.push('Alerta: Estresse térmico. Considerar irrigação adicional.');
    } else if (temp < 15 || temp > 35) {
      weatherScore -= 5;
    }
    
    // Precipitação
    if (precip7d > 200) {
      weatherScore -= 10;
      recommendations.push('Excesso de chuva previsto. Monitorar doenças fúngicas.');
    } else if (precip7d < 5) {
      weatherScore -= 8;
      recommendations.push('Baixa precipitação. Avaliar necessidade de irrigação.');
    } else if (precip7d > 150 || precip7d < 15) {
      weatherScore -= 5;
    }
    
    weatherScore = Math.max(0, weatherScore);
  }
  
  // 4. Pest Risk Score (20 pontos)
  let pestRiskScore = 20;
  for (const risk of pestRisks) {
    if (risk.riskLevel === 'critical') {
      pestRiskScore -= 15;
      recommendations.push(`⚠️ Risco crítico de ${risk.pestNamePt}. ${risk.recommendations}`);
    } else if (risk.riskLevel === 'high') {
      pestRiskScore -= 10;
      recommendations.push(`Risco alto de ${risk.pestNamePt}. Monitorar e preparar controle.`);
    } else if (risk.riskLevel === 'medium') {
      pestRiskScore -= 5;
    }
  }
  pestRiskScore = Math.max(0, pestRiskScore);
  
  // 5. Phenology Score (15 pontos)
  let phenologyScore = 15;
  if (plantingDate && currentNdvi !== null) {
    const daysFromPlanting = Math.floor((Date.now() - plantingDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // NDVI esperado baseado no estágio (simplificado)
    // Até 30 dias: 0.2-0.4
    // 30-60 dias: 0.4-0.6
    // 60-90 dias: 0.6-0.8
    // 90+ dias: 0.7-0.9 (depende da cultura)
    let expectedNdviMin = 0.2;
    let expectedNdviMax = 0.4;
    
    if (daysFromPlanting > 90) {
      expectedNdviMin = 0.6;
      expectedNdviMax = 0.9;
    } else if (daysFromPlanting > 60) {
      expectedNdviMin = 0.5;
      expectedNdviMax = 0.8;
    } else if (daysFromPlanting > 30) {
      expectedNdviMin = 0.35;
      expectedNdviMax = 0.6;
    }
    
    if (currentNdvi < expectedNdviMin - 0.15) {
      phenologyScore = 5;
      recommendations.push('Desenvolvimento abaixo do esperado para o estágio fenológico.');
    } else if (currentNdvi < expectedNdviMin - 0.05) {
      phenologyScore = 10;
    }
  }
  
  const totalScore = Math.round(ndviScore + ndviTrend + weatherScore + pestRiskScore + phenologyScore);
  
  // Interpretação e status
  let interpretation: string;
  let status: 'excellent' | 'good' | 'moderate' | 'poor' | 'critical';
  
  if (totalScore >= 80) {
    interpretation = 'Excelente - Campo em ótimas condições';
    status = 'excellent';
  } else if (totalScore >= 60) {
    interpretation = 'Bom - Pequenas atenções necessárias';
    status = 'good';
  } else if (totalScore >= 40) {
    interpretation = 'Regular - Requer monitoramento frequente';
    status = 'moderate';
  } else if (totalScore >= 20) {
    interpretation = 'Ruim - Intervenção recomendada';
    status = 'poor';
  } else {
    interpretation = 'Crítico - Ação imediata necessária';
    status = 'critical';
  }
  
  return {
    score: totalScore,
    factors: { ndviScore, ndviTrend, weatherScore, pestRiskScore, phenologyScore },
    interpretation,
    status,
    recommendations: recommendations.slice(0, 5), // Máximo 5 recomendações
  };
}

/**
 * Retorna cor baseada no score
 */
export function getScoreColor(score: number): string {
  if (score >= 80) return '#22C55E'; // Verde
  if (score >= 60) return '#84CC16'; // Verde-amarelo
  if (score >= 40) return '#EAB308'; // Amarelo
  if (score >= 20) return '#F97316'; // Laranja
  return '#EF4444'; // Vermelho
}

/**
 * Retorna emoji baseado no status
 */
export function getStatusEmoji(status: string): string {
  const emojis: Record<string, string> = {
    excellent: '🌟',
    good: '✅',
    moderate: '⚠️',
    poor: '🔶',
    critical: '🚨',
  };
  return emojis[status] || '❓';
}
