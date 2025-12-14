import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { TRPCError } from "@trpc/server";
import { ENV } from "./_core/env";
import * as agromonitoring from "./services/agromonitoring";

// Helper para converter URLs HTTP para HTTPS
const toHttps = (url: string | null | undefined): string | null => 
  url ? url.replace('http://', 'https://') : null;

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
  }),

  // ==================== FIELDS ====================
  fields: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return await db.getFieldsByUserId(ctx.user.id);
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
        // Criar campo no banco de dados
        const id = await db.createField({
          ...input,
          userId: ctx.user.id,
        });
        
        // Tentar criar polígono no Agromonitoring automaticamente
        let agroPolygonId: string | null = null;
        if (input.boundaries && ENV.agromonitoringApiKey) {
          try {
            const boundaries = typeof input.boundaries === "string" 
              ? JSON.parse(input.boundaries) 
              : input.boundaries;
            
            if (Array.isArray(boundaries) && boundaries.length >= 3) {
              console.log(`[Fields] Criando polígono no Agromonitoring para campo ${id}...`);
              const agroPolygon = await agromonitoring.createPolygon(input.name, boundaries);
              agroPolygonId = agroPolygon.id;
              console.log(`[Fields] Polígono criado: ${agroPolygonId}`);
              
              // Atualizar campo com o ID do polígono
              await db.updateField(id, { agroPolygonId });
            }
          } catch (error) {
            console.error(`[Fields] Erro ao criar polígono no Agromonitoring:`, error);
            // Não falha a criação do campo se o Agromonitoring falhar
          }
        }
        
        return { id, success: true, agroPolygonId };
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
        const { id, ...data } = input;
        await db.updateCrop(id, data);
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteCrop(input.id);
        return { success: true };
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
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateFieldNote(id, data);
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteFieldNote(input.id);
        return { success: true };
      }),
  }),

  // ==================== WEATHER ====================
  weather: router({
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
        // TODO: Integrate with weather API (OpenWeatherMap, etc.)
        // For now, return mock data
        return { success: true, message: "Previsão atualizada" };
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
    
    // Buscar a imagem NDVI mais recente para exibir no mapa (OneSoil style)
    getLatestNdviImage: protectedProcedure
      .input(z.object({ fieldId: z.number(), days: z.number().optional() }))
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
          const days = input.days || 60;
          const endDate = new Date();
          const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
          
          const images = await agromonitoring.searchSatelliteImages(
            field.agroPolygonId,
            startDate,
            endDate
          );
          
          console.log(`[NDVI] Campo ${field.id}: ${images.length} imagens encontradas`);
          
          // Filtrar e ordenar por cobertura de nuvens
          const sortedImages = images
            .filter(img => img.cl < 50)
            .sort((a, b) => {
              const cloudDiff = a.cl - b.cl;
              if (Math.abs(cloudDiff) > 15) return cloudDiff;
              return b.dt - a.dt;
            });
          
          if (sortedImages.length === 0) {
            // Se não há imagens com <50% nuvens, pegar a melhor disponível
            const bestAvailable = images.sort((a, b) => a.cl - b.cl)[0];
            if (bestAvailable) {
              return {
                configured: true,
                imageUrl: toHttps(bestAvailable.image?.ndvi),
                tileUrl: toHttps(bestAvailable.tile?.ndvi),
                truecolorUrl: toHttps(bestAvailable.image?.truecolor),
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
              message: "Nenhuma imagem disponível nos últimos " + days + " dias"
            };
          }
          
          const latestImage = sortedImages[0];
          
          return {
            configured: true,
            imageUrl: toHttps(latestImage.image?.ndvi),
            tileUrl: toHttps(latestImage.tile?.ndvi),
            truecolorUrl: toHttps(latestImage.image?.truecolor),
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

    // Histórico de NDVI para timeline
    history: protectedProcedure
      .input(z.object({ fieldId: z.number(), days: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        const field = await db.getFieldById(input.fieldId);
        if (!field || field.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Campo não encontrado" });
        }
        
        // Retornar dados do banco de dados
        const ndviData = await db.getNdviByFieldId(input.fieldId, 30);
        return ndviData;
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
      .mutation(async ({ input }) => {
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
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateTask(id, data);
        return { success: true };
      }),
    complete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.updateTask(input.id, { status: "completed", completedAt: new Date() });
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
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
});

export type AppRouter = typeof appRouter;
