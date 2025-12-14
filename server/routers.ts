import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { TRPCError } from "@trpc/server";
import { ENV } from "./_core/env";
import { storagePut } from "./storage";
import * as agromonitoring from "./services/agromonitoring";
import { pestsRouter, healthRouter, agronomistRouter } from "./services/advancedRoutes";

// Helper function to generate mock weather forecast
function generateMockForecast() {
  const forecast = [];
  const today = new Date();
  for (let i = 0; i < 5; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    forecast.push({
      date: date.toISOString().split('T')[0],
      temperature: 22 + Math.floor(Math.random() * 10),
      tempMin: 18 + Math.floor(Math.random() * 5),
      tempMax: 28 + Math.floor(Math.random() * 8),
      humidity: 60 + Math.floor(Math.random() * 30),
      precipitation: Math.random() > 0.7 ? Math.floor(Math.random() * 30) : 0,
      windSpeed: 5 + Math.floor(Math.random() * 20),
      description: ['Ensolarado', 'Parcialmente nublado', 'Nublado', 'Chuva leve'][Math.floor(Math.random() * 4)],
      icon: ['01d', '02d', '03d', '10d'][Math.floor(Math.random() * 4)],
    });
  }
  return forecast;
}

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ==================== USER PROFILE ====================
  user: router({
    getProfile: protectedProcedure.query(async ({ ctx }) => {
      return ctx.user;
    }),
    updateProfile: protectedProcedure
      .input(z.object({
        name: z.string().optional(),
        phone: z.string().optional(),
        company: z.string().optional(),
        userType: z.enum(["farmer", "agronomist", "consultant"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.updateUserProfile(ctx.user.id, input);
        return { success: true };
      }),
    
    // ==================== USER PREFERENCES ====================
    getPreferences: protectedProcedure.query(async ({ ctx }) => {
      const prefs = await db.getUserPreferences(ctx.user.id);
      return prefs || {};
    }),
    
    saveMapPosition: protectedProcedure
      .input(z.object({
        center: z.tuple([z.number(), z.number()]),
        zoom: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        await db.updateUserPreferences(ctx.user.id, {
          mapPosition: {
            center: input.center,
            zoom: input.zoom,
            updatedAt: new Date().toISOString(),
          },
        });
        return { success: true };
      }),
    
    getMapPosition: protectedProcedure.query(async ({ ctx }) => {
      const prefs = await db.getUserPreferences(ctx.user.id);
      return prefs?.mapPosition || null;
    }),
  }),

  // ==================== FARMS (Fazendas/Grupos) ====================
  farms: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getFarmsByUserId(ctx.user.id);
    }),
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const farm = await db.getFarmById(input.id);
        if (!farm || farm.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Fazenda não encontrada" });
        }
        return farm;
      }),
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        country: z.string().optional(),
        color: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await db.createFarm({
          ...input,
          userId: ctx.user.id,
        });
        return { id, success: true };
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        country: z.string().optional(),
        color: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const farm = await db.getFarmById(input.id);
        if (!farm || farm.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Fazenda não encontrada" });
        }
        const { id, ...data } = input;
        await db.updateFarm(id, data);
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const farm = await db.getFarmById(input.id);
        if (!farm || farm.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Fazenda não encontrada" });
        }
        await db.deleteFarm(input.id);
        return { success: true };
      }),
    getFields: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const farm = await db.getFarmById(input.id);
        if (!farm || farm.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Fazenda não encontrada" });
        }
        return await db.getFieldsByFarmId(input.id);
      }),
    assignField: protectedProcedure
      .input(z.object({ fieldId: z.number(), farmId: z.number().nullable() }))
      .mutation(async ({ ctx, input }) => {
        const field = await db.getFieldById(input.fieldId);
        if (!field || field.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Campo não encontrado" });
        }
        if (input.farmId) {
          const farm = await db.getFarmById(input.farmId);
          if (!farm || farm.userId !== ctx.user.id) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Fazenda não encontrada" });
          }
        }
        await db.assignFieldToFarm(input.fieldId, input.farmId);
        return { success: true };
      }),
  }),

  // ==================== FIELDS ====================
  fields: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      try {
        return await db.getFieldsByUserId(ctx.user.id);
      } catch (error) {
        console.error("[fields.list] Error:", error);
        return []; // Return empty list on error
      }
    }),
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const field = await db.getFieldById(input.id);
        if (!field || field.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Campo não encontrado" });
        }
        return field;
      }),
    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        areaHectares: z.number().optional(),
        latitude: z.string().optional(),
        longitude: z.string().optional(),
        boundaries: z.any().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        country: z.string().optional(),
        soilType: z.string().optional(),
        irrigationType: z.enum(["none", "drip", "sprinkler", "pivot", "flood"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          const id = await db.createField({
            ...input,
            userId: ctx.user.id,
          });
          
          // Sincronizar NDVI automaticamente se houver boundaries
          if (input.boundaries && agromonitoring.isAgromonitoringConfigured()) {
            const field = await db.getFieldById(id);
            if (field) {
              try {
                await agromonitoring.syncFieldNdvi(field);
                console.log(`[fields.create] NDVI sincronizado para campo ${id}`);
              } catch (e) {
                console.error(`[fields.create] Erro ao sincronizar NDVI inicial:`, e);
                // Não falha a criação do campo se NDVI falhar
              }
            }
          }
          
          return { id, success: true };
        } catch (error) {
          console.error("[fields.create] Error:", error);
          throw new TRPCError({ 
            code: "INTERNAL_SERVER_ERROR", 
            message: "Erro ao criar campo. Verifique a conexão com o banco de dados." 
          });
        }
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        areaHectares: z.number().optional(),
        latitude: z.string().optional(),
        longitude: z.string().optional(),
        boundaries: z.any().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        country: z.string().optional(),
        soilType: z.string().optional(),
        irrigationType: z.enum(["none", "drip", "sprinkler", "pivot", "flood"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const field = await db.getFieldById(input.id);
        if (!field || field.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Campo não encontrado" });
        }
        const { id, ...data } = input;
        await db.updateField(id, data);
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const field = await db.getFieldById(input.id);
        if (!field || field.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Campo não encontrado" });
        }
        await db.deleteField(input.id);
        return { success: true };
      }),
    // Detectar campos em uma área (usando OneSoil/OSM)
    detectInArea: protectedProcedure
      .input(z.object({
        centerLng: z.number(),
        centerLat: z.number(),
        radiusKm: z.number().optional().default(5),
      }))
      .query(async ({ input }) => {
        const { detectFieldsInArea } = await import("./services/fieldDetection");
        const fields = await detectFieldsInArea(
          [input.centerLng, input.centerLat],
          input.radiusKm
        );
        return fields;
      }),
    // Detectar campo em um ponto específico (clique no mapa)
    detectAtPoint: protectedProcedure
      .input(z.object({
        lng: z.number(),
        lat: z.number(),
      }))
      .query(async ({ input }) => {
        const { detectFieldAtPoint } = await import("./services/fieldDetection");
        const field = await detectFieldAtPoint([input.lng, input.lat]);
        return field;
      }),
  }),

  // ==================== CROPS ====================
  crops: router({
    listByField: protectedProcedure
      .input(z.object({ fieldId: z.number() }))
      .query(async ({ ctx, input }) => {
        const field = await db.getFieldById(input.fieldId);
        if (!field || field.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Campo não encontrado" });
        }
        return await db.getCropsByFieldId(input.fieldId);
      }),
    listAll: protectedProcedure.query(async ({ ctx }) => {
      return await db.getCropsByUserId(ctx.user.id);
    }),
    create: protectedProcedure
      .input(z.object({
        fieldId: z.number(),
        cropType: z.string().min(1),
        variety: z.string().optional(),
        plantingDate: z.date().optional(),
        expectedHarvestDate: z.date().optional(),
        status: z.enum(["planned", "planted", "growing", "harvested", "failed"]).optional(),
        areaHectares: z.number().optional(),
        expectedYield: z.number().optional(),
        notes: z.string().optional(),
        season: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const field = await db.getFieldById(input.fieldId);
        if (!field || field.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Campo não encontrado" });
        }
        const id = await db.createCrop({
          ...input,
          userId: ctx.user.id,
        });
        return { id, success: true };
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        cropType: z.string().optional(),
        variety: z.string().optional(),
        plantingDate: z.date().optional(),
        expectedHarvestDate: z.date().optional(),
        actualHarvestDate: z.date().optional(),
        status: z.enum(["planned", "planted", "growing", "harvested", "failed"]).optional(),
        areaHectares: z.number().optional(),
        expectedYield: z.number().optional(),
        actualYield: z.number().optional(),
        notes: z.string().optional(),
        season: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const crop = await db.getCropById(input.id);
        if (!crop || crop.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Cultivo não encontrado" });
        }
        const { id, ...data } = input;
        await db.updateCrop(id, data);
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const crop = await db.getCropById(input.id);
        if (!crop || crop.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Cultivo não encontrado" });
        }
        await db.deleteCrop(input.id);
        return { success: true };
      }),
  }),

  // ==================== MAPS / GEOCODING ====================
  maps: router({
    geocode: protectedProcedure
      .input(z.object({ query: z.string().min(1) }))
      .mutation(async ({ input }) => {
        const mapboxToken = ENV.mapboxToken;
        
        if (!mapboxToken) {
          // Return mock results if no token
          return {
            results: [
              { id: "1", place_name: `${input.query} - Brasil`, center: [-54.6, -20.47] as [number, number] },
              { id: "2", place_name: `${input.query}, Mato Grosso do Sul`, center: [-54.8, -20.5] as [number, number] },
            ]
          };
        }

        try {
          const response = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(input.query)}.json?access_token=${mapboxToken}&country=br&language=pt&limit=5`
          );
          
          if (!response.ok) {
            throw new Error(`Mapbox API error: ${response.status}`);
          }
          
          const data = await response.json();
          
          return {
            results: data.features.map((f: any) => ({
              id: f.id,
              place_name: f.place_name,
              center: f.center as [number, number],
            }))
          };
        } catch (error) {
          console.error("Geocoding error:", error);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Erro ao buscar localização" });
        }
      }),
    reverseGeocode: protectedProcedure
      .input(z.object({ lat: z.number(), lng: z.number() }))
      .mutation(async ({ input }) => {
        const mapboxToken = ENV.mapboxToken;
        
        if (!mapboxToken) {
          return { address: "Localização aproximada" };
        }

        try {
          const response = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${input.lng},${input.lat}.json?access_token=${mapboxToken}&language=pt&limit=1`
          );
          
          if (!response.ok) {
            throw new Error(`Mapbox API error: ${response.status}`);
          }
          
          const data = await response.json();
          
          return {
            address: data.features[0]?.place_name || "Localização desconhecida"
          };
        } catch (error) {
          console.error("Reverse geocoding error:", error);
          return { address: "Erro ao buscar endereço" };
        }
      }),
  }),

  // ==================== FIELD NOTES ====================
  notes: router({
    listByField: protectedProcedure
      .input(z.object({ fieldId: z.number() }))
      .query(async ({ ctx, input }) => {
        const field = await db.getFieldById(input.fieldId);
        if (!field || field.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Campo não encontrado" });
        }
        return await db.getFieldNotesByFieldId(input.fieldId);
      }),
    listAll: protectedProcedure.query(async ({ ctx }) => {
      return await db.getFieldNotesByUserId(ctx.user.id);
    }),
    create: protectedProcedure
      .input(z.object({
        fieldId: z.number(),
        title: z.string().optional(),
        content: z.string().min(1),
        noteType: z.enum(["observation", "problem", "task", "harvest", "application"]).optional(),
        latitude: z.string().optional(),
        longitude: z.string().optional(),
        photos: z.array(z.string()).optional(),
        severity: z.enum(["low", "medium", "high", "critical"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const field = await db.getFieldById(input.fieldId);
        if (!field || field.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Campo não encontrado" });
        }
        const id = await db.createFieldNote({
          ...input,
          userId: ctx.user.id,
        });
        return { id, success: true };
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        content: z.string().optional(),
        noteType: z.enum(["observation", "problem", "task", "harvest", "application"]).optional(),
        latitude: z.string().optional(),
        longitude: z.string().optional(),
        photos: z.array(z.string()).optional(),
        severity: z.enum(["low", "medium", "high", "critical"]).optional(),
        isResolved: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const note = await db.getFieldNoteById(input.id);
        if (!note || note.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Anotação não encontrada" });
        }
        const { id, ...data } = input;
        await db.updateFieldNote(id, data);
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const note = await db.getFieldNoteById(input.id);
        if (!note || note.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Anotação não encontrada" });
        }
        await db.deleteFieldNote(input.id);
        return { success: true };
      }),
  }),

  // ==================== WEATHER ====================
  weather: router({
    // Get current weather using Open-Meteo (FREE API)
    getCurrent: protectedProcedure
      .input(z.object({ fieldId: z.number() }))
      .query(async ({ ctx, input }) => {
        const field = await db.getFieldById(input.fieldId);
        if (!field || field.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Campo não encontrado" });
        }
        
        // Get field center coordinates from boundaries
        let lat = -23.5505;
        let lon = -46.6333;
        
        if (field.boundaries) {
          try {
            const coords = typeof field.boundaries === 'string' 
              ? JSON.parse(field.boundaries) 
              : field.boundaries;
            if (Array.isArray(coords) && coords.length > 0) {
              const sumLat = coords.reduce((sum: number, c: any) => sum + (c.lat || c[1] || 0), 0);
              const sumLon = coords.reduce((sum: number, c: any) => sum + (c.lng || c.lon || c[0] || 0), 0);
              lat = sumLat / coords.length;
              lon = sumLon / coords.length;
            }
          } catch (e) {
            console.error("Error parsing boundaries:", e);
          }
        }
        
        try {
          // Open-Meteo API is FREE and doesn't require API key
          const response = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,cloud_cover&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code&timezone=America/Sao_Paulo&forecast_days=7`
          );
          
          if (!response.ok) {
            throw new Error(`Open-Meteo API error: ${response.status}`);
          }
          
          const data = await response.json();
          
          // Weather code to description
          const getWeatherDescription = (code: number): { text: string, icon: string } => {
            if (code === 0) return { text: 'Céu limpo', icon: 'sun' };
            if (code <= 3) return { text: 'Parcialmente nublado', icon: 'cloud-sun' };
            if (code <= 49) return { text: 'Nublado', icon: 'cloud' };
            if (code <= 69) return { text: 'Chuva', icon: 'cloud-rain' };
            if (code <= 79) return { text: 'Neve', icon: 'snowflake' };
            if (code <= 99) return { text: 'Tempestade', icon: 'cloud-lightning' };
            return { text: 'Variável', icon: 'cloud' };
          };
          
          const currentWeather = getWeatherDescription(data.current.weather_code);
          
          return {
            current: {
              temp: Math.round(data.current.temperature_2m),
              humidity: data.current.relative_humidity_2m,
              windSpeed: Math.round(data.current.wind_speed_10m),
              precipitation: data.current.precipitation,
              cloudCover: data.current.cloud_cover,
              description: currentWeather.text,
              icon: currentWeather.icon,
            },
            daily: data.daily.time.slice(0, 7).map((date: string, i: number) => ({
              date,
              tempMax: Math.round(data.daily.temperature_2m_max[i]),
              tempMin: Math.round(data.daily.temperature_2m_min[i]),
              precipitation: data.daily.precipitation_sum[i],
              ...getWeatherDescription(data.daily.weather_code[i]),
            })),
          };
        } catch (error) {
          console.error("Weather API error:", error);
          // Return mock data on error
          return {
            current: {
              temp: 25,
              humidity: 65,
              windSpeed: 12,
              precipitation: 0,
              cloudCover: 30,
              description: 'Parcialmente nublado',
              icon: 'cloud-sun',
            },
            daily: [],
          };
        }
      }),
    getByField: protectedProcedure
      .input(z.object({ fieldId: z.number(), days: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        const field = await db.getFieldById(input.fieldId);
        if (!field || field.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Campo não encontrado" });
        }
        return await db.getWeatherByFieldId(input.fieldId, input.days ?? 5);
      }),
    getAlerts: protectedProcedure.query(async ({ ctx }) => {
      return await db.getWeatherAlertsByUserId(ctx.user.id);
    }),
    dismissAlert: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.dismissWeatherAlert(input.id);
        return { success: true };
      }),
    // Fetch weather from external API and save to database
    fetchForecast: protectedProcedure
      .input(z.object({ fieldId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const field = await db.getFieldById(input.fieldId);
        if (!field || field.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Campo não encontrado" });
        }
        
        // Get field center coordinates from boundaries
        let lat = -23.5505; // Default São Paulo
        let lon = -46.6333;
        
        if (field.boundaries) {
          try {
            const coords = typeof field.boundaries === 'string' 
              ? JSON.parse(field.boundaries) 
              : field.boundaries;
            if (Array.isArray(coords) && coords.length > 0) {
              // Calculate centroid
              const sumLat = coords.reduce((sum: number, c: any) => sum + (c.lat || c[1] || 0), 0);
              const sumLon = coords.reduce((sum: number, c: any) => sum + (c.lng || c.lon || c[0] || 0), 0);
              lat = sumLat / coords.length;
              lon = sumLon / coords.length;
            }
          } catch (e) {
            console.error("Error parsing boundaries:", e);
          }
        }
        
        const apiKey = ENV.openWeatherApiKey;
        if (!apiKey) {
          // Return mock data if no API key configured
          return { 
            success: true, 
            message: "Previsão atualizada (modo demo)",
            forecast: generateMockForecast()
          };
        }
        
        try {
          // Fetch 5-day forecast from OpenWeatherMap
          const response = await fetch(
            `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=pt_br`
          );
          
          if (!response.ok) {
            throw new Error(`OpenWeatherMap API error: ${response.status}`);
          }
          
          const data = await response.json();
          
          // Process and save weather data
          const forecasts = data.list.slice(0, 8).map((item: any) => ({
            fieldId: input.fieldId,
            date: new Date(item.dt * 1000).toISOString().split('T')[0],
            temperature: Math.round(item.main.temp),
            tempMin: Math.round(item.main.temp_min),
            tempMax: Math.round(item.main.temp_max),
            humidity: item.main.humidity,
            precipitation: item.rain?.["3h"] || 0,
            windSpeed: Math.round(item.wind.speed * 3.6), // m/s to km/h
            description: item.weather[0].description,
            icon: item.weather[0].icon,
          }));
          
          // Save to database (implementation depends on db schema)
          // await db.saveWeatherForecast(input.fieldId, forecasts);
          
          // Check for weather alerts
          const alerts = [];
          for (const forecast of forecasts) {
            if (forecast.tempMax > 35) {
              alerts.push({ type: 'heat', message: `Alerta de calor: ${forecast.tempMax}°C`, severity: 'high' });
            }
            if (forecast.tempMin < 5) {
              alerts.push({ type: 'frost', message: `Risco de geada: ${forecast.tempMin}°C`, severity: 'critical' });
            }
            if (forecast.precipitation > 50) {
              alerts.push({ type: 'rain', message: `Chuva intensa: ${forecast.precipitation}mm`, severity: 'medium' });
            }
          }
          
          return { 
            success: true, 
            message: "Previsão atualizada",
            forecast: forecasts,
            alerts
          };
        } catch (error) {
          console.error("Weather API error:", error);
          return { 
            success: false, 
            message: "Erro ao buscar previsão",
            forecast: generateMockForecast()
          };
        }
      }),
  }),

  // ==================== NDVI ====================
  ndvi: router({
    getByField: protectedProcedure
      .input(z.object({ fieldId: z.number(), limit: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        const field = await db.getFieldById(input.fieldId);
        if (!field || field.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Campo não encontrado" });
        }
        return await db.getNdviByFieldId(input.fieldId, input.limit ?? 10);
      }),
    getLatest: protectedProcedure
      .input(z.object({ fieldId: z.number() }))
      .query(async ({ ctx, input }) => {
        const field = await db.getFieldById(input.fieldId);
        if (!field || field.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Campo não encontrado" });
        }
        return await db.getLatestNdviByFieldId(input.fieldId);
      }),
    // Batch query para buscar NDVI de múltiplos campos de uma vez
    getLatestBatch: protectedProcedure
      .input(z.object({ fieldIds: z.array(z.number()) }))
      .query(async ({ ctx, input }) => {
        const results: Record<number, { ndviAverage: number | null; captureDate: Date | null }> = {};
        
        // Verificar que todos os campos pertencem ao usuário
        const userFields = await db.getFieldsByUserId(ctx.user.id);
        const userFieldIds = new Set(userFields.map(f => f.id));
        
        for (const fieldId of input.fieldIds) {
          if (!userFieldIds.has(fieldId)) continue;
          
          const ndvi = await db.getLatestNdviByFieldId(fieldId);
          results[fieldId] = {
            ndviAverage: ndvi?.ndviAverage ?? null,
            captureDate: ndvi?.captureDate ?? null,
          };
        }
        
        return results;
      }),
    // Buscar NDVI real do Sentinel Hub
    fetchFromSatellite: protectedProcedure
      .input(z.object({ fieldId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const field = await db.getFieldById(input.fieldId);
        if (!field || field.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Campo não encontrado" });
        }
        
        const clientId = ENV.sentinelHubClientId;
        const clientSecret = ENV.sentinelHubClientSecret;
        
        // Se não tiver credenciais, gera dados simulados mas realistas
        if (!clientId || !clientSecret) {
          // Gerar NDVI simulado baseado na estação do ano
          const month = new Date().getMonth();
          let baseNdvi = 0.5;
          
          // Verão (alta vegetação): 0.6-0.85
          // Inverno (baixa vegetação): 0.3-0.5
          if (month >= 10 || month <= 2) { // Nov-Fev (verão no Brasil)
            baseNdvi = 0.65 + Math.random() * 0.2;
          } else if (month >= 5 && month <= 8) { // Jun-Set (inverno)
            baseNdvi = 0.35 + Math.random() * 0.15;
          } else { // Transição
            baseNdvi = 0.5 + Math.random() * 0.15;
          }
          
          const ndviData = {
            fieldId: input.fieldId,
            ndviAverage: parseFloat(baseNdvi.toFixed(2)),
            ndviMin: parseFloat((baseNdvi - 0.1 - Math.random() * 0.1).toFixed(2)),
            ndviMax: parseFloat((baseNdvi + 0.1 + Math.random() * 0.1).toFixed(2)),
            cloudCoverage: Math.floor(Math.random() * 30),
            captureDate: new Date(),
          };
          
          // Salvar no banco
          await db.createNdviData(ndviData);
          
          return {
            success: true,
            message: "NDVI atualizado (modo simulado)",
            data: ndviData
          };
        }
        
        try {
          // 1. Obter token OAuth do Sentinel Hub
          const tokenResponse = await fetch("https://services.sentinel-hub.com/oauth/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`
          });
          
          if (!tokenResponse.ok) {
            throw new Error("Erro ao autenticar com Sentinel Hub");
          }
          
          const tokenData = await tokenResponse.json();
          const accessToken = tokenData.access_token;
          
          // 2. Preparar coordenadas do campo
          let bbox: [number, number, number, number] = [-54.7, -20.5, -54.5, -20.4]; // Default
          
          if (field.boundaries) {
            const coords = typeof field.boundaries === 'string' 
              ? JSON.parse(field.boundaries) 
              : field.boundaries;
            if (Array.isArray(coords) && coords.length > 0) {
              const lngs = coords.map((c: any) => c.lng || c.lon || c[0]);
              const lats = coords.map((c: any) => c.lat || c[1]);
              bbox = [
                Math.min(...lngs),
                Math.min(...lats),
                Math.max(...lngs),
                Math.max(...lats)
              ];
            }
          }
          
          // 3. Buscar NDVI estatísticas
          const today = new Date();
          const fromDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 dias atrás
          
          const statsRequest = {
            input: {
              bounds: { bbox, properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/4326" } },
              data: [{
                type: "sentinel-2-l2a",
                dataFilter: {
                  timeRange: {
                    from: fromDate.toISOString(),
                    to: today.toISOString()
                  },
                  maxCloudCoverage: 30
                }
              }]
            },
            aggregation: {
              timeRange: { from: fromDate.toISOString(), to: today.toISOString() },
              aggregationInterval: { of: "P1D" },
              evalscript: `
                //VERSION=3
                function setup() {
                  return { input: ["B04", "B08"], output: { bands: 1, sampleType: "FLOAT32" } };
                }
                function evaluatePixel(sample) {
                  let ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04);
                  return [ndvi];
                }
              `,
              resx: 10,
              resy: 10
            },
            calculations: { default: { statistics: { default: { percentiles: { k: [25, 50, 75] } } } } }
          };
          
          const statsResponse = await fetch("https://services.sentinel-hub.com/api/v1/statistics", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${accessToken}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(statsRequest)
          });
          
          if (!statsResponse.ok) {
            const errorText = await statsResponse.text();
            console.error("Sentinel Hub Stats Error:", errorText);
            throw new Error("Erro ao buscar estatísticas NDVI");
          }
          
          const statsData = await statsResponse.json();
          
          // 4. Processar resultados
          const latestStats = statsData.data?.[0]?.outputs?.default?.bands?.B0?.stats;
          
          const ndviData = {
            fieldId: input.fieldId,
            ndviAverage: latestStats?.mean ?? 0.5,
            ndviMin: latestStats?.min ?? 0.3,
            ndviMax: latestStats?.max ?? 0.8,
            cloudCoverage: 0,
            captureDate: new Date(statsData.data?.[0]?.interval?.from || new Date()),
          };
          
          // 5. Salvar no banco
          await db.createNdviData(ndviData);
          
          return {
            success: true,
            message: "NDVI atualizado via satélite",
            data: ndviData
          };
        } catch (error) {
          console.error("Sentinel Hub error:", error);
          throw new TRPCError({ 
            code: "INTERNAL_SERVER_ERROR", 
            message: "Erro ao buscar dados de satélite" 
          });
        }
      }),
    // === AGROMONITORING INTEGRATION ===
    // Sincronizar NDVI via Agromonitoring API (gratuito)
    syncFromAgromonitoring: protectedProcedure
      .input(z.object({ fieldId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const field = await db.getFieldById(input.fieldId);
        if (!field || field.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Campo não encontrado" });
        }
        
        if (!ENV.agromonitoringApiKey) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "API Agromonitoring não configurada" });
        }
        
        try {
          const result = await agromonitoring.syncFieldNdvi(field);
          if (result) {
            const updatedField = await db.getFieldById(input.fieldId);
            return { 
              success: true, 
              ndvi: updatedField?.currentNdvi ? updatedField.currentNdvi / 100 : null,
              lastSync: updatedField?.lastNdviSync
            };
          }
          return { success: false, message: "Campo precisa ter polígono definido (boundaries)" };
        } catch (error) {
          console.error("Erro ao sincronizar NDVI Agromonitoring:", error);
          throw new TRPCError({ 
            code: "INTERNAL_SERVER_ERROR", 
            message: error instanceof Error ? error.message : "Erro ao sincronizar NDVI" 
          });
        }
      }),
    // Sincronizar todos os campos do usuário via Agromonitoring
    syncAllFromAgromonitoring: protectedProcedure
      .mutation(async ({ ctx }) => {
        if (!ENV.agromonitoringApiKey) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "API Agromonitoring não configurada" });
        }
        
        const fields = await db.getFieldsByUserId(ctx.user.id);
        const results = await agromonitoring.syncAllFieldsNdvi(fields);
        
        return { 
          success: results.success > 0 || results.failed === 0,
          synced: results.success,
          failed: results.failed,
          total: fields.length
        };
      }),
    // Buscar histórico de NDVI real (do banco após sincronização)
    getRealHistory: protectedProcedure
      .input(z.object({ 
        fieldId: z.number(),
        days: z.number().optional().default(30)
      }))
      .query(async ({ ctx, input }) => {
        const field = await db.getFieldById(input.fieldId);
        if (!field || field.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Campo não encontrado" });
        }
        
        const history = await db.getNdviHistoryByFieldId(input.fieldId, input.days);
        return history.map(h => ({
          date: h.acquisitionDate,
          ndvi: h.ndviValue / 100,
          min: h.ndviMin ? h.ndviMin / 100 : null,
          max: h.ndviMax ? h.ndviMax / 100 : null,
          cloudCoverage: h.cloudCoverage,
          satellite: h.satellite,
          imageUrl: h.imageUrl
        }));
      }),
    // Buscar NDVI atual (campo já sincronizado)
    getCurrentReal: protectedProcedure
      .input(z.object({ fieldId: z.number() }))
      .query(async ({ ctx, input }) => {
        const field = await db.getFieldById(input.fieldId);
        if (!field || field.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Campo não encontrado" });
        }
        
        return {
          ndvi: field.currentNdvi ? field.currentNdvi / 100 : null,
          lastSync: field.lastNdviSync,
          agroPolygonId: field.agroPolygonId
        };
      }),
    // Status da integração
    getIntegrationStatus: protectedProcedure
      .query(async () => {
        const { getSchedulerStatus } = await import("./services/ndviScheduler");
        const schedulerStatus = getSchedulerStatus();
        
        return {
          agromonitoring: !!ENV.agromonitoringApiKey,
          sentinelHub: !!(ENV.sentinelHubClientId && ENV.sentinelHubClientSecret),
          recommended: ENV.agromonitoringApiKey ? "agromonitoring" : "simulation",
          scheduler: schedulerStatus,
        };
      }),
    // Status detalhado do scheduler
    getSchedulerStatus: protectedProcedure
      .query(async () => {
        const { getSchedulerStatus } = await import("./services/ndviScheduler");
        return getSchedulerStatus();
      }),
    // Forçar sincronização imediata (admin)
    forceSyncAll: protectedProcedure
      .mutation(async ({ ctx }) => {
        // Verifica se é admin (opcional, pode remover se quiser permitir para todos)
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores podem forçar sincronização" });
        }
        const { forceSyncNow } = await import("./services/ndviScheduler");
        const result = await forceSyncNow();
        return result;
      }),
    // Buscar imagens de satélite com URLs das tiles NDVI
    getSatelliteImages: protectedProcedure
      .input(z.object({ 
        fieldId: z.number(),
        days: z.number().optional().default(30)
      }))
      .query(async ({ ctx, input }) => {
        const field = await db.getFieldById(input.fieldId);
        if (!field || field.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Campo não encontrado" });
        }
        
        if (!field.agroPolygonId || !ENV.agromonitoringApiKey) {
          return { images: [], configured: false };
        }
        
        try {
          const endDate = new Date();
          const startDate = new Date(endDate.getTime() - input.days * 24 * 60 * 60 * 1000);
          
          const images = await agromonitoring.searchSatelliteImages(
            field.agroPolygonId,
            startDate,
            endDate
          );
          
          return {
            images: images.map(img => ({
              date: new Date(img.dt * 1000),
              cloudCoverage: img.cl,
              dataCoverage: img.dc,
              ndviTileUrl: img.tile?.ndvi || null,
              ndviImageUrl: img.image?.ndvi || null,
              truecolorTileUrl: img.tile?.truecolor || null,
              truecolorImageUrl: img.image?.truecolor || null,
              ndviStatsUrl: img.stats?.ndvi || null,
            })),
            configured: true
          };
        } catch (error) {
          console.error("Erro ao buscar imagens:", error);
          return { images: [], configured: true, error: "Erro ao buscar imagens" };
        }
      }),
    // Buscar a imagem NDVI mais recente para exibir no mapa (OneSoil style)
    getLatestNdviImage: protectedProcedure
      .input(z.object({ fieldId: z.number() }))
      .query(async ({ ctx, input }) => {
        const field = await db.getFieldById(input.fieldId);
        if (!field || field.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Campo não encontrado" });
        }
        
        if (!field.agroPolygonId || !ENV.agromonitoringApiKey) {
          return { 
            configured: false, 
            imageUrl: null, 
            tileUrl: null,
            message: "Agromonitoring não configurado"
          };
        }
        
        try {
          const endDate = new Date();
          const startDate = new Date(endDate.getTime() - 60 * 24 * 60 * 60 * 1000); // 60 dias
          
          const images = await agromonitoring.searchSatelliteImages(
            field.agroPolygonId,
            startDate,
            endDate
          );
          
          console.log(`[NDVI] Campo ${field.id}: ${images.length} imagens encontradas`);
          
          // CORREÇÃO: Aceitar até 50% de nuvens e ordenar melhor
          const sortedImages = images
            .filter(img => img.cl < 50) // Aumentado de 30 para 50
            .sort((a, b) => {
              // Priorizar menos nuvens, depois mais recente
              const cloudDiff = a.cl - b.cl;
              if (Math.abs(cloudDiff) > 15) return cloudDiff;
              return b.dt - a.dt;
            });
          
          console.log(`[NDVI] Campo ${field.id}: ${sortedImages.length} imagens após filtro`);
          
          if (sortedImages.length === 0) {
            // Se não há imagens com <50% nuvens, pegar a melhor disponível
            const bestAvailable = images.sort((a, b) => a.cl - b.cl)[0];
            if (bestAvailable) {
              console.log(`[NDVI] Usando imagem com ${bestAvailable.cl}% nuvens`);
              return {
                configured: true,
                imageUrl: bestAvailable.image?.ndvi || null,
                tileUrl: bestAvailable.tile?.ndvi || null,
                truecolorUrl: bestAvailable.image?.truecolor || null,
                date: new Date(bestAvailable.dt * 1000),
                cloudCoverage: bestAvailable.cl,
                dataCoverage: bestAvailable.dc,
                warning: `Imagem com ${bestAvailable.cl}% de nuvens`
              };
            }
            
            return {
              configured: true,
              imageUrl: null,
              tileUrl: null,
              message: "Nenhuma imagem disponível nos últimos 60 dias"
            };
          }
          
          const latestImage = sortedImages[0];
          console.log(`[NDVI] Imagem selecionada: ${latestImage.cl}% nuvens, data: ${new Date(latestImage.dt * 1000)}`);
          
          return {
            configured: true,
            imageUrl: latestImage.image?.ndvi || null,
            tileUrl: latestImage.tile?.ndvi || null,
            truecolorUrl: latestImage.image?.truecolor || null,
            date: new Date(latestImage.dt * 1000),
            cloudCoverage: latestImage.cl,
            dataCoverage: latestImage.dc,
          };
        } catch (error) {
          console.error("Erro ao buscar imagem NDVI:", error);
          return { 
            configured: true, 
            imageUrl: null, 
            tileUrl: null,
            error: "Erro ao buscar imagem" 
          };
        }
      }),
    // Histórico para timeline com thumbnails
    history: protectedProcedure
      .input(z.object({ 
        fieldId: z.number(),
        days: z.number().optional().default(60)
      }))
      .query(async ({ ctx, input }) => {
        const field = await db.getFieldById(input.fieldId);
        if (!field || field.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Campo não encontrado" });
        }
        
        // Buscar do banco local
        const history = await db.getNdviHistoryByFieldId(input.fieldId, input.days);
        
        // Se tem Agromonitoring configurado, enriquecer com URLs de imagem
        if (field.agroPolygonId && ENV.agromonitoringApiKey) {
          try {
            const endDate = new Date();
            const startDate = new Date(endDate.getTime() - input.days * 24 * 60 * 60 * 1000);
            
            const images = await agromonitoring.searchSatelliteImages(
              field.agroPolygonId,
              startDate,
              endDate
            );
            
            // Mapear imagens por data
            const imagesByDate = new Map<string, typeof images[0]>();
            images.forEach(img => {
              const dateKey = new Date(img.dt * 1000).toISOString().split('T')[0];
              imagesByDate.set(dateKey, img);
            });
            
            return history.map(h => {
              const dateKey = h.acquisitionDate?.toISOString().split('T')[0] || '';
              const img = imagesByDate.get(dateKey);
              return {
                date: h.acquisitionDate,
                ndvi: h.ndviValue / 100,
                min: h.ndviMin ? h.ndviMin / 100 : null,
                max: h.ndviMax ? h.ndviMax / 100 : null,
                cloudCoverage: h.cloudCoverage,
                thumbnailUrl: img?.image?.ndvi || null,
                tileUrl: img?.tile?.ndvi || null,
              };
            });
          } catch (error) {
            console.error("Erro ao buscar imagens para timeline:", error);
          }
        }
        
        return history.map(h => ({
          date: h.acquisitionDate,
          ndvi: h.ndviValue / 100,
          min: h.ndviMin ? h.ndviMin / 100 : null,
          max: h.ndviMax ? h.ndviMax / 100 : null,
          cloudCoverage: h.cloudCoverage,
          thumbnailUrl: null,
          tileUrl: null,
        }));
      }),
  }),

  // ==================== CROP ROTATION ====================
  rotation: router({
    getByField: protectedProcedure
      .input(z.object({ fieldId: z.number() }))
      .query(async ({ ctx, input }) => {
        const field = await db.getFieldById(input.fieldId);
        if (!field || field.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Campo não encontrado" });
        }
        return await db.getCropRotationByFieldId(input.fieldId);
      }),
    create: protectedProcedure
      .input(z.object({
        fieldId: z.number(),
        season: z.string().min(1),
        plannedCrop: z.string().min(1),
        previousCrop: z.string().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const field = await db.getFieldById(input.fieldId);
        if (!field || field.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Campo não encontrado" });
        }
        const id = await db.createCropRotationPlan({
          ...input,
          userId: ctx.user.id,
        });
        return { id, success: true };
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        plannedCrop: z.string().optional(),
        previousCrop: z.string().optional(),
        isConfirmed: z.boolean().optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const plan = await db.getCropRotationPlanById(input.id);
        if (!plan || plan.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Plano de rotação não encontrado" });
        }
        const { id, ...data } = input;
        await db.updateCropRotationPlan(id, data);
        return { success: true };
      }),
    getSuggestions: protectedProcedure
      .input(z.object({ fieldId: z.number() }))
      .query(async ({ ctx, input }) => {
        const field = await db.getFieldById(input.fieldId);
        if (!field || field.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Campo não encontrado" });
        }
        // Get crop history and suggest rotation
        const history = await db.getCropsByFieldId(input.fieldId);
        const lastCrop = history[0]?.cropType;
        
        // Simple rotation suggestions based on last crop
        const suggestions: Record<string, string[]> = {
          "soja": ["milho", "trigo", "sorgo"],
          "milho": ["soja", "feijão", "girassol"],
          "trigo": ["soja", "milho", "aveia"],
          "feijão": ["milho", "soja", "trigo"],
          "algodão": ["soja", "milho", "sorgo"],
          "default": ["soja", "milho", "trigo", "feijão"],
        };
        
        return {
          lastCrop,
          suggestions: suggestions[lastCrop?.toLowerCase() ?? "default"] ?? suggestions["default"],
        };
      }),
  }),

  // ==================== TASKS ====================
  tasks: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getTasksByUserId(ctx.user.id);
    }),
    listPending: protectedProcedure.query(async ({ ctx }) => {
      return await db.getPendingTasksByUserId(ctx.user.id);
    }),
    create: protectedProcedure
      .input(z.object({
        fieldId: z.number().optional(),
        title: z.string().min(1),
        description: z.string().optional(),
        taskType: z.enum(["planting", "irrigation", "fertilization", "spraying", "harvest", "maintenance", "inspection", "other"]).optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
        dueDate: z.date().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await db.createTask({
          ...input,
          userId: ctx.user.id,
        });
        return { id, success: true };
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().optional(),
        description: z.string().optional(),
        taskType: z.enum(["planting", "irrigation", "fertilization", "spraying", "harvest", "maintenance", "inspection", "other"]).optional(),
        priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
        status: z.enum(["pending", "in_progress", "completed", "cancelled"]).optional(),
        dueDate: z.date().optional(),
        completedAt: z.date().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const task = await db.getTaskById(input.id);
        if (!task || task.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Tarefa não encontrada" });
        }
        const { id, ...data } = input;
        await db.updateTask(id, data);
        return { success: true };
      }),
    complete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const task = await db.getTaskById(input.id);
        if (!task || task.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Tarefa não encontrada" });
        }
        await db.updateTask(input.id, { status: "completed", completedAt: new Date() });
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const task = await db.getTaskById(input.id);
        if (!task || task.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Tarefa não encontrada" });
        }
        await db.deleteTask(input.id);
        return { success: true };
      }),
  }),

  // ==================== NOTIFICATIONS ====================
  notifications: router({
    list: protectedProcedure
      .input(z.object({ limit: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        return await db.getNotificationsByUserId(ctx.user.id, input.limit ?? 20);
      }),
    unreadCount: protectedProcedure.query(async ({ ctx }) => {
      return await db.getUnreadNotificationCount(ctx.user.id);
    }),
    markAsRead: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.markNotificationAsRead(input.id);
        return { success: true };
      }),
    markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
      await db.markAllNotificationsAsRead(ctx.user.id);
      return { success: true };
    }),
  }),

  // ==================== DASHBOARD ====================
  dashboard: router({
    getStats: protectedProcedure.query(async ({ ctx }) => {
      return await db.getDashboardStats(ctx.user.id);
    }),
    getOverview: protectedProcedure.query(async ({ ctx }) => {
      const [stats, fields, pendingTasks, alerts, recentNotes] = await Promise.all([
        db.getDashboardStats(ctx.user.id),
        db.getFieldsByUserId(ctx.user.id),
        db.getPendingTasksByUserId(ctx.user.id),
        db.getWeatherAlertsByUserId(ctx.user.id),
        db.getFieldNotesByUserId(ctx.user.id),
      ]);
      
      return {
        stats,
        fields: fields.slice(0, 5),
        pendingTasks: pendingTasks.slice(0, 5),
        alerts: alerts.slice(0, 5),
        recentNotes: recentNotes.slice(0, 5),
      };
    }),
  }),

  // ==================== GEOCODING ====================
  geocoding: router({
    search: protectedProcedure
      .input(z.object({ query: z.string().min(2) }))
      .query(async ({ input }) => {
        const mapboxToken = ENV.mapboxToken;
        if (!mapboxToken) {
          throw new TRPCError({ 
            code: "INTERNAL_SERVER_ERROR", 
            message: "Mapbox token não configurado" 
          });
        }
        
        try {
          const response = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(input.query)}.json?` +
            `access_token=${mapboxToken}&country=br&language=pt&limit=5&types=place,locality,address,poi`
          );
          
          if (!response.ok) {
            throw new Error(`Geocoding API error: ${response.status}`);
          }
          
          const data = await response.json();
          
          return data.features.map((feature: any) => ({
            id: feature.id,
            name: feature.place_name,
            center: feature.center, // [lng, lat]
            bbox: feature.bbox,
            type: feature.place_type[0],
          }));
        } catch (error) {
          console.error("Geocoding error:", error);
          throw new TRPCError({ 
            code: "INTERNAL_SERVER_ERROR", 
            message: "Erro ao buscar localização" 
          });
        }
      }),
    reverse: protectedProcedure
      .input(z.object({ 
        lat: z.number(), 
        lng: z.number() 
      }))
      .query(async ({ input }) => {
        const mapboxToken = ENV.mapboxToken;
        if (!mapboxToken) {
          throw new TRPCError({ 
            code: "INTERNAL_SERVER_ERROR", 
            message: "Mapbox token não configurado" 
          });
        }
        
        try {
          const response = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${input.lng},${input.lat}.json?` +
            `access_token=${mapboxToken}&language=pt&limit=1`
          );
          
          if (!response.ok) {
            throw new Error(`Reverse geocoding API error: ${response.status}`);
          }
          
          const data = await response.json();
          const feature = data.features[0];
          
          if (!feature) {
            return null;
          }
          
          return {
            id: feature.id,
            name: feature.place_name,
            address: feature.place_name,
            city: feature.context?.find((c: any) => c.id.startsWith('place'))?.text,
            state: feature.context?.find((c: any) => c.id.startsWith('region'))?.text,
            country: feature.context?.find((c: any) => c.id.startsWith('country'))?.text,
          };
        } catch (error) {
          console.error("Reverse geocoding error:", error);
          throw new TRPCError({ 
            code: "INTERNAL_SERVER_ERROR", 
            message: "Erro ao buscar endereço" 
          });
        }
      }),
  }),

  // ==================== UPLOAD DE FOTOS ====================
  upload: router({
    photo: protectedProcedure
      .input(z.object({
        base64: z.string(), // Base64 encoded image
        fileName: z.string(),
        contentType: z.string().default("image/jpeg"),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          // Decode base64 to buffer
          const base64Data = input.base64.replace(/^data:image\/\w+;base64,/, "");
          const buffer = Buffer.from(base64Data, "base64");
          
          // Generate unique filename
          const timestamp = Date.now();
          const uniqueName = `photos/${ctx.user.id}/${timestamp}_${input.fileName}`;
          
          // Upload to storage
          const result = await storagePut(uniqueName, buffer, input.contentType);
          
          return {
            success: true,
            url: result.url,
            key: result.key,
          };
        } catch (error) {
          console.error("Upload error:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Erro ao fazer upload da foto",
          });
        }
      }),
    // Upload múltiplas fotos
    photos: protectedProcedure
      .input(z.object({
        photos: z.array(z.object({
          base64: z.string(),
          fileName: z.string(),
          contentType: z.string().default("image/jpeg"),
        })),
      }))
      .mutation(async ({ ctx, input }) => {
        const results = [];
        
        for (const photo of input.photos) {
          try {
            const base64Data = photo.base64.replace(/^data:image\/\w+;base64,/, "");
            const buffer = Buffer.from(base64Data, "base64");
            const timestamp = Date.now();
            const uniqueName = `photos/${ctx.user.id}/${timestamp}_${photo.fileName}`;
            
            const result = await storagePut(uniqueName, buffer, photo.contentType);
            results.push({
              success: true,
              url: result.url,
              key: result.key,
              fileName: photo.fileName,
            });
          } catch (error) {
            results.push({
              success: false,
              url: null,
              key: null,
              fileName: photo.fileName,
              error: "Erro no upload",
            });
          }
        }
        
        return { results };
      }),
  }),

  // ==================== OFFLINE SYNC ====================
  sync: router({
    // Buscar alterações pendentes do servidor
    getPendingChanges: protectedProcedure
      .input(z.object({ lastSyncTimestamp: z.string().optional() }))
      .query(async ({ ctx, input }) => {
        const lastSync = input.lastSyncTimestamp 
          ? new Date(input.lastSyncTimestamp) 
          : new Date(0);
        
        // Buscar dados atualizados desde o último sync
        const [fields, notes, tasks] = await Promise.all([
          db.getFieldsByUserId(ctx.user.id),
          db.getFieldNotesByUserId(ctx.user.id),
          db.getTasksByUserId(ctx.user.id),
        ]);
        
        // Filtrar apenas itens atualizados após lastSync
        const updatedFields = fields.filter(f => new Date(f.updatedAt) > lastSync);
        const updatedNotes = notes.filter(n => new Date(n.updatedAt) > lastSync);
        const updatedTasks = tasks.filter(t => new Date(t.updatedAt) > lastSync);
        
        return {
          fields: updatedFields,
          notes: updatedNotes,
          tasks: updatedTasks,
          serverTimestamp: new Date().toISOString(),
        };
      }),
    // Enviar alterações do cliente para o servidor
    pushChanges: protectedProcedure
      .input(z.object({
        fields: z.array(z.object({
          localId: z.string(),
          action: z.enum(["create", "update", "delete"]),
          data: z.any(),
        })).optional(),
        notes: z.array(z.object({
          localId: z.string(),
          action: z.enum(["create", "update", "delete"]),
          data: z.any(),
        })).optional(),
        tasks: z.array(z.object({
          localId: z.string(),
          action: z.enum(["create", "update", "delete"]),
          data: z.any(),
        })).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const results = {
          fields: [] as { localId: string; serverId?: number; success: boolean; error?: string }[],
          notes: [] as { localId: string; serverId?: number; success: boolean; error?: string }[],
          tasks: [] as { localId: string; serverId?: number; success: boolean; error?: string }[],
        };
        
        // Processar campos
        for (const field of input.fields ?? []) {
          try {
            if (field.action === "create") {
              const id = await db.createField({ ...field.data, userId: ctx.user.id });
              results.fields.push({ localId: field.localId, serverId: id, success: true });
            } else if (field.action === "update" && field.data.id) {
              await db.updateField(field.data.id, field.data);
              results.fields.push({ localId: field.localId, serverId: field.data.id, success: true });
            } else if (field.action === "delete" && field.data.id) {
              await db.deleteField(field.data.id);
              results.fields.push({ localId: field.localId, success: true });
            }
          } catch (error: any) {
            results.fields.push({ localId: field.localId, success: false, error: error.message });
          }
        }
        
        // Processar notas
        for (const note of input.notes ?? []) {
          try {
            if (note.action === "create") {
              const id = await db.createFieldNote({ ...note.data, userId: ctx.user.id });
              results.notes.push({ localId: note.localId, serverId: id, success: true });
            } else if (note.action === "update" && note.data.id) {
              await db.updateFieldNote(note.data.id, note.data);
              results.notes.push({ localId: note.localId, serverId: note.data.id, success: true });
            } else if (note.action === "delete" && note.data.id) {
              await db.deleteFieldNote(note.data.id);
              results.notes.push({ localId: note.localId, success: true });
            }
          } catch (error: any) {
            results.notes.push({ localId: note.localId, success: false, error: error.message });
          }
        }
        
        // Processar tarefas
        for (const task of input.tasks ?? []) {
          try {
            if (task.action === "create") {
              const id = await db.createTask({ ...task.data, userId: ctx.user.id });
              results.tasks.push({ localId: task.localId, serverId: id, success: true });
            } else if (task.action === "update" && task.data.id) {
              await db.updateTask(task.data.id, task.data);
              results.tasks.push({ localId: task.localId, serverId: task.data.id, success: true });
            } else if (task.action === "delete" && task.data.id) {
              await db.deleteTask(task.data.id);
              results.tasks.push({ localId: task.localId, success: true });
            }
          } catch (error: any) {
            results.tasks.push({ localId: task.localId, success: false, error: error.message });
          }
        }
        
        return {
          results,
          serverTimestamp: new Date().toISOString(),
        };
      }),
  }),

  // ==================== FIELD SHARING ====================
  sharing: router({
    getByField: protectedProcedure
      .input(z.object({ fieldId: z.number() }))
      .query(async ({ ctx, input }) => {
        const field = await db.getFieldById(input.fieldId);
        if (!field || field.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Campo não encontrado" });
        }
        return await db.getFieldSharesByFieldId(input.fieldId);
      }),
    getSharedWithMe: protectedProcedure.query(async ({ ctx }) => {
      return await db.getSharedFieldsForUser(ctx.user.id);
    }),
    create: protectedProcedure
      .input(z.object({
        fieldId: z.number(),
        sharedWithEmail: z.string().email().optional(),
        permission: z.enum(["view", "edit", "admin"]).optional(),
        isPublic: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const field = await db.getFieldById(input.fieldId);
        if (!field || field.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Campo não encontrado" });
        }
        
        // Generate share token
        const shareToken = crypto.randomUUID().replace(/-/g, '');
        
        const id = await db.createFieldShare({
          fieldId: input.fieldId,
          ownerUserId: ctx.user.id,
          sharedWithEmail: input.sharedWithEmail,
          permission: input.permission ?? "view",
          isPublic: input.isPublic ?? false,
          shareToken,
        });
        
        return { id, shareToken, success: true };
      }),
    acceptByToken: protectedProcedure
      .input(z.object({ token: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const share = await db.getFieldShareByToken(input.token);
        if (!share) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Link de compartilhamento inválido" });
        }
        if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Link de compartilhamento expirado" });
        }
        await db.acceptFieldShare(share.id, ctx.user.id);
        return { success: true, fieldId: share.fieldId };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const shares = await db.getFieldSharesByUserId(ctx.user.id);
        const share = shares.find(s => s.id === input.id);
        if (!share) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Compartilhamento não encontrado" });
        }
        await db.deleteFieldShare(input.id);
        return { success: true };
      }),
    getShareLink: protectedProcedure
      .input(z.object({ fieldId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const field = await db.getFieldById(input.fieldId);
        if (!field || field.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Campo não encontrado" });
        }
        
        // Check if public share already exists
        const shares = await db.getFieldSharesByFieldId(input.fieldId);
        const publicShare = shares.find(s => s.isPublic);
        
        if (publicShare?.shareToken) {
          return { shareToken: publicShare.shareToken };
        }
        
        // Create new public share
        const shareToken = crypto.randomUUID().replace(/-/g, '');
        await db.createFieldShare({
          fieldId: input.fieldId,
          ownerUserId: ctx.user.id,
          isPublic: true,
          shareToken,
        });
        
        return { shareToken };
      }),
  }),

  // ==================== PUSH NOTIFICATIONS ====================
  pushNotifications: router({
    registerToken: protectedProcedure
      .input(z.object({
        token: z.string().min(1),
        platform: z.enum(["ios", "android", "web"]),
        deviceName: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await db.savePushToken({
          userId: ctx.user.id,
          ...input,
        });
        return { id, success: true };
      }),
    unregisterToken: protectedProcedure
      .input(z.object({ token: z.string() }))
      .mutation(async ({ input }) => {
        await db.deactivatePushToken(input.token);
        return { success: true };
      }),
    // Send test notification (for debugging)
    sendTest: protectedProcedure
      .mutation(async ({ ctx }) => {
        const tokens = await db.getPushTokensByUserId(ctx.user.id);
        if (tokens.length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Nenhum dispositivo registrado" });
        }
        
        // In production, this would call Expo Push API or Firebase
        // For now, just create a notification in the database
        await db.createNotification({
          userId: ctx.user.id,
          title: "Teste de Notificação",
          message: "Se você viu isso, as notificações estão funcionando! 🎉",
          notificationType: "system",
        });
        
        return { success: true, deviceCount: tokens.length };
      }),
  }),

  // ==================== EXPORT/REPORTS ====================
  reports: router({
    generateFieldReport: protectedProcedure
      .input(z.object({ 
        fieldId: z.number(),
        includeNdvi: z.boolean().optional(),
        includeWeather: z.boolean().optional(),
        includeNotes: z.boolean().optional(),
        includeCrops: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const field = await db.getFieldById(input.fieldId);
        if (!field || field.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Campo não encontrado" });
        }
        
        // Gather all requested data
        const reportData: any = {
          field,
          generatedAt: new Date().toISOString(),
        };
        
        if (input.includeNdvi) {
          reportData.ndviHistory = await db.getNdviByFieldId(input.fieldId, 30);
          reportData.latestNdvi = await db.getLatestNdviByFieldId(input.fieldId);
        }
        
        if (input.includeWeather) {
          reportData.weatherHistory = await db.getWeatherByFieldId(input.fieldId, 14);
        }
        
        if (input.includeNotes) {
          reportData.notes = await db.getFieldNotesByFieldId(input.fieldId);
        }
        
        if (input.includeCrops) {
          reportData.crops = await db.getCropsByFieldId(input.fieldId);
          reportData.rotationPlans = await db.getCropRotationByFieldId(input.fieldId);
        }
        
        // Generate PDF HTML template
        const htmlReport = generatePdfHtml(reportData);
        
        return {
          success: true,
          htmlContent: htmlReport,
          data: reportData,
        };
      }),
    generateFarmReport: protectedProcedure
      .input(z.object({
        farmId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const farm = await db.getFarmById(input.farmId);
        if (!farm || farm.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Fazenda não encontrada" });
        }
        
        const fields = await db.getFieldsByFarmId(input.farmId);
        const fieldsWithData = await Promise.all(
          fields.map(async (field) => ({
            ...field,
            latestNdvi: await db.getLatestNdviByFieldId(field.id),
            activeCrop: (await db.getCropsByFieldId(field.id)).find(c => c.status === "growing"),
          }))
        );
        
        const reportData = {
          farm,
          fields: fieldsWithData,
          totalArea: fields.reduce((sum, f) => sum + (f.areaHectares || 0), 0),
          generatedAt: new Date().toISOString(),
        };
        
        const htmlReport = generateFarmPdfHtml(reportData);
        
        return {
          success: true,
          htmlContent: htmlReport,
          data: reportData,
        };
      }),
  }),

  // ==================== ADVANCED ROUTES (CampoVivo 2.0) ====================
  pests: pestsRouter,
  health: healthRouter,
  agronomist: agronomistRouter,
});

// Helper function to generate PDF HTML for field report
function generatePdfHtml(data: any): string {
  const field = data.field;
  const ndvi = data.latestNdvi;
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Relatório - ${field.name}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
    .header { border-bottom: 2px solid #22C55E; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { color: #22C55E; margin: 0; }
    .section { margin-bottom: 30px; }
    .section h2 { color: #166534; border-bottom: 1px solid #ddd; padding-bottom: 10px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .stat-box { background: #f5f5f5; padding: 15px; border-radius: 8px; }
    .stat-value { font-size: 24px; font-weight: bold; color: #22C55E; }
    .stat-label { color: #666; font-size: 14px; }
    .ndvi-bar { height: 20px; border-radius: 4px; margin-top: 10px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f5f5f5; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🌱 CampoVivo</h1>
    <p>Relatório do Campo: <strong>${field.name}</strong></p>
    <p>Gerado em: ${new Date(data.generatedAt).toLocaleDateString('pt-BR')}</p>
  </div>
  
  <div class="section">
    <h2>Informações do Campo</h2>
    <div class="grid">
      <div class="stat-box">
        <div class="stat-value">${field.areaHectares ? (field.areaHectares / 100).toFixed(1) : '-'} ha</div>
        <div class="stat-label">Área Total</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${field.soilType || 'Não informado'}</div>
        <div class="stat-label">Tipo de Solo</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${field.irrigationType || 'Nenhuma'}</div>
        <div class="stat-label">Irrigação</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${field.city || '-'}, ${field.state || '-'}</div>
        <div class="stat-label">Localização</div>
      </div>
    </div>
  </div>
  
  ${ndvi ? `
  <div class="section">
    <h2>Índice de Vegetação (NDVI)</h2>
    <div class="grid">
      <div class="stat-box">
        <div class="stat-value">${(ndvi.ndviAverage / 1000).toFixed(2)}</div>
        <div class="stat-label">NDVI Médio</div>
        <div class="ndvi-bar" style="background: linear-gradient(to right, #d73027, #fc8d59, #fee08b, #d9ef8b, #91cf60, #1a9850);"></div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${new Date(ndvi.captureDate).toLocaleDateString('pt-BR')}</div>
        <div class="stat-label">Data da Captura</div>
      </div>
    </div>
  </div>
  ` : ''}
  
  ${data.notes?.length > 0 ? `
  <div class="section">
    <h2>Notas de Campo</h2>
    <table>
      <tr><th>Data</th><th>Tipo</th><th>Conteúdo</th></tr>
      ${data.notes.slice(0, 10).map((n: any) => `
        <tr>
          <td>${new Date(n.createdAt).toLocaleDateString('pt-BR')}</td>
          <td>${n.noteType}</td>
          <td>${n.content.substring(0, 100)}...</td>
        </tr>
      `).join('')}
    </table>
  </div>
  ` : ''}
  
  ${data.crops?.length > 0 ? `
  <div class="section">
    <h2>Histórico de Cultivos</h2>
    <table>
      <tr><th>Cultura</th><th>Variedade</th><th>Plantio</th><th>Status</th></tr>
      ${data.crops.map((c: any) => `
        <tr>
          <td>${c.cropType}</td>
          <td>${c.variety || '-'}</td>
          <td>${c.plantingDate ? new Date(c.plantingDate).toLocaleDateString('pt-BR') : '-'}</td>
          <td>${c.status}</td>
        </tr>
      `).join('')}
    </table>
  </div>
  ` : ''}
  
  <div class="footer">
    <p>CampoVivo - Sistema de Gestão Agrícola</p>
    <p>Este relatório foi gerado automaticamente.</p>
  </div>
</body>
</html>
  `;
}

// Helper function to generate PDF HTML for farm report
function generateFarmPdfHtml(data: any): string {
  const farm = data.farm;
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Relatório - ${farm.name}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
    .header { border-bottom: 2px solid #22C55E; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { color: #22C55E; margin: 0; }
    .section { margin-bottom: 30px; }
    .section h2 { color: #166534; border-bottom: 1px solid #ddd; padding-bottom: 10px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; }
    .stat-box { background: #f5f5f5; padding: 15px; border-radius: 8px; }
    .stat-value { font-size: 24px; font-weight: bold; color: #22C55E; }
    .stat-label { color: #666; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f5f5f5; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🌱 CampoVivo</h1>
    <p>Relatório da Fazenda: <strong>${farm.name}</strong></p>
    <p>Gerado em: ${new Date(data.generatedAt).toLocaleDateString('pt-BR')}</p>
  </div>
  
  <div class="section">
    <h2>Resumo da Fazenda</h2>
    <div class="grid">
      <div class="stat-box">
        <div class="stat-value">${data.fields.length}</div>
        <div class="stat-label">Total de Campos</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${(data.totalArea / 100).toFixed(1)} ha</div>
        <div class="stat-label">Área Total</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${farm.city || '-'}</div>
        <div class="stat-label">Localização</div>
      </div>
    </div>
  </div>
  
  <div class="section">
    <h2>Campos da Fazenda</h2>
    <table>
      <tr><th>Nome</th><th>Área (ha)</th><th>NDVI</th><th>Cultura Atual</th></tr>
      ${data.fields.map((f: any) => `
        <tr>
          <td>${f.name}</td>
          <td>${f.areaHectares ? (f.areaHectares / 100).toFixed(1) : '-'}</td>
          <td>${f.latestNdvi ? (f.latestNdvi.ndviAverage / 1000).toFixed(2) : '-'}</td>
          <td>${f.activeCrop?.cropType || '-'}</td>
        </tr>
      `).join('')}
    </table>
  </div>
  
  <div class="footer">
    <p>CampoVivo - Sistema de Gestão Agrícola</p>
    <p>Este relatório foi gerado automaticamente.</p>
  </div>
</body>
</html>
  `;
}

export type AppRouter = typeof appRouter;
