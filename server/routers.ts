import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { TRPCError } from "@trpc/server";

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
        const id = await db.createField({
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
