/**
 * Rotas Avançadas - CampoVivo 2.0
 * Novas funcionalidades de IA, previsão de pragas e score de saúde
 */

import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { getWeatherForecast, WeatherForecast } from "./openMeteo";
import { predictPestRisks, WeatherConditions } from "./pestPrediction";
import { calculateFieldHealthScore } from "./fieldHealthScore";
import { processAgronomistChat, ChatMessage, FieldContext, UserContext } from "./aiAgronomist";

// Helper: get field center coordinates
function getFieldCenter(field: { boundaries?: string | unknown }): { lat: number; lon: number } {
  let lat = -23.5505;
  let lon = -46.6333;
  
  if (field.boundaries) {
    try {
      const coords = typeof field.boundaries === 'string' 
        ? JSON.parse(field.boundaries) 
        : field.boundaries;
      if (Array.isArray(coords) && coords.length > 0) {
        const sumLat = coords.reduce((sum: number, c: { lat?: number; 1?: number }) => sum + (c.lat || c[1] || 0), 0);
        const sumLon = coords.reduce((sum: number, c: { lng?: number; lon?: number; 0?: number }) => sum + (c.lng || c.lon || c[0] || 0), 0);
        lat = sumLat / coords.length;
        lon = sumLon / coords.length;
      }
    } catch (e) {
      console.error("Error parsing boundaries:", e);
    }
  }
  
  return { lat, lon };
}

// Helper: get weather stats from forecast for pest prediction
function getWeatherStats(forecast: WeatherForecast): WeatherConditions {
  const temps = forecast.daily.temperature_2m_max.slice(0, 7).map((max, i) => 
    (max + forecast.daily.temperature_2m_min[i]) / 2
  );
  const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
  
  const avgHumidity = forecast.hourly.relativehumidity_2m[0] || 70;
  
  const precipSums = forecast.daily.precipitation_sum.slice(0, 7);
  const totalPrecipitation = precipSums.reduce((a, b) => a + b, 0);
  
  let consecutiveWetDays = 0;
  for (const precip of precipSums) {
    if (precip > 1) consecutiveWetDays++;
    else break;
  }
  
  return { avgTemp, avgHumidity, totalPrecipitation, consecutiveWetDays };
}

// ==================== PEST PREDICTION ROUTES ====================
export const pestsRouter = router({
  predict: protectedProcedure
    .input(z.object({ 
      fieldId: z.number(),
      cropType: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const field = await db.getFieldById(input.fieldId);
      if (!field || field.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Campo não encontrado" });
      }
      
      const { lat, lon } = getFieldCenter(field);
      
      try {
        const forecast = await getWeatherForecast(lat, lon);
        const weatherConditions = getWeatherStats(forecast);
        
        const crops = await db.getCropsByFieldId(input.fieldId);
        const activeCrop = crops.find((c) => c.status === 'growing' || c.status === 'planted');
        const cropType = input.cropType || activeCrop?.cropType || 'soja';
        
        const pestRisks = predictPestRisks(cropType, weatherConditions);
        
        return {
          fieldId: input.fieldId,
          cropType,
          conditions: {
            avgTemperature: Math.round(weatherConditions.avgTemp),
            avgHumidity: Math.round(weatherConditions.avgHumidity),
            totalPrecipitation: Math.round(weatherConditions.totalPrecipitation),
          },
          risks: pestRisks,
          generatedAt: new Date().toISOString(),
        };
      } catch (error) {
        console.error("Pest prediction error:", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Erro ao prever pragas" });
      }
    }),
    
  getPestInfo: publicProcedure
    .input(z.object({ pestName: z.string() }))
    .query(({ input }) => {
      const pestDatabase: Record<string, { scientificName: string; affectedCrops: string[]; symptoms: string; management: string; economicImpact: string }> = {
        "Ferrugem Asiática": {
          scientificName: "Phakopsora pachyrhizi",
          affectedCrops: ["soja"],
          symptoms: "Lesões amareladas na parte inferior das folhas",
          management: "Aplicação preventiva de fungicidas",
          economicImpact: "Perdas de 30% a 75%",
        },
        "Lagarta-do-cartucho": {
          scientificName: "Spodoptera frugiperda",
          affectedCrops: ["milho", "soja"],
          symptoms: "Folhas raspadas, furos irregulares",
          management: "Controle biológico e inseticidas seletivos",
          economicImpact: "Perdas de 20% a 40%",
        },
      };
      
      return pestDatabase[input.pestName] || {
        scientificName: "Desconhecido",
        affectedCrops: [],
        symptoms: "Informações não disponíveis",
        management: "Consulte um agrônomo",
        economicImpact: "Não determinado",
      };
    }),
});

// ==================== FIELD HEALTH SCORE ROUTES ====================
export const healthRouter = router({
  getFieldScore: protectedProcedure
    .input(z.object({ fieldId: z.number() }))
    .query(async ({ ctx, input }) => {
      const field = await db.getFieldById(input.fieldId);
      if (!field || field.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Campo não encontrado" });
      }
      
      const { lat, lon } = getFieldCenter(field);
      
      try {
        const forecast = await getWeatherForecast(lat, lon);
        const weatherConditions = getWeatherStats(forecast);
        
        const crops = await db.getCropsByFieldId(input.fieldId);
        const activeCrop = crops.find((c) => c.status === 'growing' || c.status === 'planted');
        const cropType = activeCrop?.cropType || 'soja';
        
        const ndviHistory = [0.65, 0.68, 0.71, 0.69, 0.72];
        const currentNdvi = ndviHistory[ndviHistory.length - 1];
        
        const pestRisks = predictPestRisks(cropType, weatherConditions);
        
        // calculateFieldHealthScore(currentNdvi, ndviHistory, weather, pestRisks, plantingDate?, crop?)
        const healthScore = calculateFieldHealthScore(
          currentNdvi,
          ndviHistory,
          forecast,
          pestRisks,
          activeCrop?.plantingDate ? new Date(activeCrop.plantingDate) : null,
          cropType
        );
        
        return {
          fieldId: input.fieldId,
          fieldName: field.name,
          ...healthScore,
          generatedAt: new Date().toISOString(),
        };
      } catch (error) {
        console.error("Health score error:", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Erro ao calcular score" });
      }
    }),
    
  getAllFieldsHealth: protectedProcedure.query(async ({ ctx }) => {
    const fields = await db.getFieldsByUserId(ctx.user.id);
    return fields.map((field) => ({
      fieldId: field.id,
      fieldName: field.name,
      areaHectares: field.areaHectares,
      healthScore: 70 + Math.floor(Math.random() * 25),
      status: 'Bom',
    }));
  }),
});

// ==================== AI AGRONOMIST CHAT ROUTES ====================
export const agronomistRouter = router({
  chat: protectedProcedure
    .input(z.object({
      message: z.string().min(1).max(1000),
      fieldId: z.number().optional(),
      conversationHistory: z.array(z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const fields = await db.getFieldsByUserId(ctx.user.id);
      const totalArea = fields.reduce((sum: number, f) => sum + (f.areaHectares || 0), 0);
      
      const cropsArrays = await Promise.all(
        fields.slice(0, 10).map((f) => db.getCropsByFieldId(f.id))
      );
      const allCrops = cropsArrays.flat();
      const uniqueCrops = Array.from(new Set(allCrops.map((c) => c.cropType)));
      
      const userContext: UserContext = {
        totalFields: fields.length,
        totalArea: totalArea / 100,
        crops: uniqueCrops,
      };
      
      let fieldContext: FieldContext | undefined;
      
      if (input.fieldId) {
        const field = await db.getFieldById(input.fieldId);
        if (field && field.userId === ctx.user.id) {
          const { lat, lon } = getFieldCenter(field);
          
          let weather: { temperature: number; humidity: number; precipitationNext7Days: number } | undefined;
          try {
            const forecast = await getWeatherForecast(lat, lon);
            const conditions = getWeatherStats(forecast);
            weather = {
              temperature: conditions.avgTemp,
              humidity: conditions.avgHumidity,
              precipitationNext7Days: conditions.totalPrecipitation,
            };
          } catch (e) {}
          
          const fieldCrops = await db.getCropsByFieldId(input.fieldId);
          const activeCrop = fieldCrops.find((c) => c.status === 'growing' || c.status === 'planted');
          const farm = field.farmId ? await db.getFarmById(field.farmId) : null;
          
          fieldContext = {
            fieldName: field.name,
            areaHectares: (field.areaHectares || 0) / 100,
            currentCrop: activeCrop?.cropType,
            currentNdvi: 0.72,
            city: farm?.city || undefined,
            state: farm?.state || undefined,
            weather,
          };
        }
      }
      
      const response = await processAgronomistChat(
        input.message,
        userContext,
        fieldContext,
        (input.conversationHistory || []) as ChatMessage[]
      );
      
      return { response, timestamp: new Date().toISOString() };
    }),
    
  getSuggestions: protectedProcedure
    .input(z.object({ fieldId: z.number().optional() }))
    .query(async ({ input }) => {
      const baseSuggestions = [
        "Como está a saúde dos meus campos?",
        "Qual a previsão de pragas?",
        "Quando devo irrigar?",
        "Recomendações de adubação",
      ];
      
      if (input.fieldId) {
        return [
          "Analise o NDVI deste campo",
          "Quais pragas podem afetar?",
          "Devo aplicar defensivo?",
          ...baseSuggestions.slice(0, 2),
        ];
      }
      
      return baseSuggestions;
    }),
});

export const advancedRoutes = {
  pests: pestsRouter,
  health: healthRouter,
  agronomist: agronomistRouter,
};
