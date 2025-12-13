/**
 * AI Agronomist Service
 * Serviço de assistente virtual agrônomo
 */

import { ENV } from '../_core/env';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface FieldContext {
  fieldName: string;
  areaHectares: number;
  currentCrop?: string;
  currentNdvi?: number;
  ndviHistory?: number[];
  soilType?: string;
  irrigationType?: string;
  city?: string;
  state?: string;
  weather?: {
    temperature: number;
    humidity: number;
    precipitationNext7Days: number;
  };
  pestRisks?: {
    pestName: string;
    riskLevel: string;
    probability: number;
  }[];
  healthScore?: number;
}

export interface UserContext {
  totalFields: number;
  totalArea: number;
  crops: string[];
}

/**
 * Gera o system prompt com contexto do usuário e campo
 */
function generateSystemPrompt(userContext: UserContext, fieldContext?: FieldContext): string {
  let prompt = `Você é um agrônomo virtual experiente do CampoVivo, especializado em agricultura brasileira.
Você ajuda agricultores e agrônomos a tomar decisões baseadas em dados.

REGRAS:
- Responda SEMPRE em português brasileiro
- Seja conciso mas completo (máximo 3 parágrafos)
- Use dados específicos quando disponíveis
- Sugira ações práticas e aplicáveis
- Se não souber, diga que não sabe
- Use emojis para destacar pontos importantes

CONTEXTO DO USUÁRIO:
- Total de campos: ${userContext.totalFields}
- Área total: ${userContext.totalArea.toFixed(1)} hectares
- Culturas: ${userContext.crops.join(', ') || 'Não informadas'}
`;

  if (fieldContext) {
    prompt += `
CONTEXTO DO CAMPO SELECIONADO:
- Nome: ${fieldContext.fieldName}
- Área: ${fieldContext.areaHectares.toFixed(1)} hectares
- Cultura atual: ${fieldContext.currentCrop || 'Não definida'}
- NDVI atual: ${fieldContext.currentNdvi ? fieldContext.currentNdvi.toFixed(2) : 'N/A'}
- Tipo de solo: ${fieldContext.soilType || 'Não informado'}
- Irrigação: ${fieldContext.irrigationType || 'Nenhuma'}
- Localização: ${fieldContext.city || '?'}, ${fieldContext.state || '?'}
`;

    if (fieldContext.weather) {
      prompt += `
CLIMA ATUAL:
- Temperatura: ${fieldContext.weather.temperature}°C
- Umidade: ${fieldContext.weather.humidity}%
- Precipitação prevista (7 dias): ${fieldContext.weather.precipitationNext7Days}mm
`;
    }

    if (fieldContext.pestRisks && fieldContext.pestRisks.length > 0) {
      prompt += `
ALERTAS DE PRAGAS:
${fieldContext.pestRisks.map(r => `- ${r.pestName}: ${r.riskLevel} (${r.probability}%)`).join('\n')}
`;
    }

    if (fieldContext.healthScore !== undefined) {
      prompt += `
SCORE DE SAÚDE DO CAMPO: ${fieldContext.healthScore}/100
`;
    }
  }

  return prompt;
}

/**
 * Processa mensagem do usuário e retorna resposta do agrônomo IA
 * Usa API gratuita do Groq (ou fallback local)
 */
export async function processAgronomistChat(
  userMessage: string,
  userContext: UserContext,
  fieldContext?: FieldContext,
  conversationHistory: ChatMessage[] = []
): Promise<string> {
  const systemPrompt = generateSystemPrompt(userContext, fieldContext);
  
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-6), // Últimas 6 mensagens para contexto
    { role: 'user', content: userMessage },
  ];

  // Tentar usar Groq API (gratuito)
  const groqApiKey = ENV.groqApiKey || process.env.GROQ_API_KEY;
  
  if (groqApiKey) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.1-70b-versatile',
          messages,
          max_tokens: 500,
          temperature: 0.7,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return data.choices[0]?.message?.content || getFallbackResponse(userMessage, fieldContext);
      }
    } catch (error) {
      console.error('Groq API error:', error);
    }
  }

  // Fallback: respostas pré-programadas
  return getFallbackResponse(userMessage, fieldContext);
}

/**
 * Respostas de fallback quando não há API de IA disponível
 */
function getFallbackResponse(message: string, context?: FieldContext): string {
  const lowerMessage = message.toLowerCase();

  // NDVI
  if (lowerMessage.includes('ndvi') || lowerMessage.includes('vegetação') || lowerMessage.includes('saúde')) {
    if (context?.currentNdvi) {
      const ndvi = context.currentNdvi;
      if (ndvi >= 0.7) {
        return `🌿 O NDVI do campo ${context.fieldName} está excelente (${ndvi.toFixed(2)})! Isso indica vegetação saudável e densa. Continue com o manejo atual e monitore regularmente.`;
      } else if (ndvi >= 0.5) {
        return `📊 O NDVI do campo ${context.fieldName} está em ${ndvi.toFixed(2)}, que é razoável. Verifique se há áreas específicas com problemas e avalie a necessidade de adubação de cobertura.`;
      } else {
        return `⚠️ O NDVI do campo ${context.fieldName} está baixo (${ndvi.toFixed(2)}). Isso pode indicar estresse hídrico, nutricional ou problemas fitossanitários. Recomendo uma vistoria de campo para identificar a causa.`;
      }
    }
    return '📡 Para análise de NDVI, sincronize os dados de satélite do seu campo primeiro. O NDVI é atualizado a cada 3-5 dias dependendo da cobertura de nuvens.';
  }

  // Irrigação
  if (lowerMessage.includes('irrigar') || lowerMessage.includes('irrigação') || lowerMessage.includes('água')) {
    if (context?.weather) {
      const precip = context.weather.precipitationNext7Days;
      if (precip > 50) {
        return `💧 Com ${precip}mm de chuva previstos para os próximos 7 dias, provavelmente não será necessário irrigar. Monitore a umidade do solo para confirmar.`;
      } else if (precip > 20) {
        return `🌧️ Previsão de ${precip}mm para os próximos dias. Dependendo do estágio da cultura e tipo de solo, pode ser necessário irrigação complementar.`;
      } else {
        return `☀️ Baixa precipitação prevista (${precip}mm). Recomendo planejar irrigação, especialmente se a cultura estiver em estágio crítico de desenvolvimento.`;
      }
    }
    return '💧 Para recomendações de irrigação, preciso dos dados climáticos do seu campo. A necessidade hídrica varia conforme a cultura, estágio e condições do solo.';
  }

  // Plantio
  if (lowerMessage.includes('plantar') || lowerMessage.includes('plantio') || lowerMessage.includes('semeadura')) {
    return `🌱 Para recomendações de plantio, considere:\n\n1. **Época**: Verifique a janela ideal para sua região\n2. **Solo**: Análise de solo atualizada é essencial\n3. **Sementes**: Use sementes certificadas de variedades adaptadas\n4. **Clima**: Aguarde condições favoráveis de umidade\n\nQual cultura você pretende plantar?`;
  }

  // Pragas
  if (lowerMessage.includes('praga') || lowerMessage.includes('doença') || lowerMessage.includes('inseto')) {
    if (context?.pestRisks && context.pestRisks.length > 0) {
      const topRisk = context.pestRisks[0];
      return `🐛 Baseado nas condições climáticas, há risco de ${topRisk.pestName} (${topRisk.probability}%). Recomendo:\n\n1. Intensificar o monitoramento\n2. Preparar defensivos para aplicação se necessário\n3. Considerar controle biológico preventivo`;
    }
    return '🔍 Para previsão de pragas, preciso conhecer a cultura plantada e as condições climáticas. O monitoramento regular é a melhor prevenção!';
  }

  // Fertilização
  if (lowerMessage.includes('adubo') || lowerMessage.includes('fertiliz') || lowerMessage.includes('nutriente')) {
    return `🧪 Para recomendações de adubação:\n\n1. **Análise de solo** é fundamental - quando foi a última?\n2. **Estágio da cultura** - momento certo de aplicação\n3. **Histórico** - o que foi aplicado anteriormente?\n\nCom essas informações, posso recomendar um plano de adubação específico.`;
  }

  // Colheita
  if (lowerMessage.includes('colheit') || lowerMessage.includes('colher')) {
    return `🌾 Para determinar o ponto de colheita ideal:\n\n1. Monitore a umidade dos grãos\n2. Observe a maturação fisiológica\n3. Verifique a previsão do tempo\n4. Prepare a logística de escoamento\n\nQual cultura você vai colher?`;
  }

  // Resposta genérica
  return `👋 Olá! Sou seu agrônomo virtual do CampoVivo. Posso ajudar com:\n\n• 📊 Análise de NDVI e saúde do campo\n• 💧 Recomendações de irrigação\n• 🌱 Orientações de plantio\n• 🐛 Previsão e controle de pragas\n• 🧪 Adubação e nutrição\n• 🌾 Ponto de colheita\n\nComo posso ajudar você hoje?`;
}
