import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the database functions
vi.mock("./db", () => ({
  getFieldsByUserId: vi.fn().mockResolvedValue([
    {
      id: 1,
      userId: 1,
      name: "Campo Teste",
      description: "Descrição do campo",
      areaHectares: 5000,
      latitude: "-15.7801",
      longitude: "-47.9292",
      city: "Brasília",
      state: "DF",
      country: "Brasil",
      soilType: "Latossolo",
      irrigationType: "pivot",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]),
  getFieldById: vi.fn().mockImplementation((id: number) => {
    if (id === 1) {
      return Promise.resolve({
        id: 1,
        userId: 1,
        name: "Campo Teste",
        description: "Descrição do campo",
        areaHectares: 5000,
        latitude: "-15.7801",
        longitude: "-47.9292",
        city: "Brasília",
        state: "DF",
        country: "Brasil",
        soilType: "Latossolo",
        irrigationType: "pivot",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    return Promise.resolve(null);
  }),
  createField: vi.fn().mockResolvedValue(2),
  updateField: vi.fn().mockResolvedValue(undefined),
  deleteField: vi.fn().mockResolvedValue(undefined),
  updateUserProfile: vi.fn().mockResolvedValue(undefined),
  getWeatherAlertsByUserId: vi.fn().mockResolvedValue([]),
  getCropsByFieldId: vi.fn().mockResolvedValue([]),
  getFieldNotesByFieldId: vi.fn().mockResolvedValue([]),
  getWeatherByFieldId: vi.fn().mockResolvedValue([]),
  getNdviByFieldId: vi.fn().mockResolvedValue([]),
  getRotationByFieldId: vi.fn().mockResolvedValue([]),
  getCropsByUserId: vi.fn().mockResolvedValue([]),
  getFieldNotesByUserId: vi.fn().mockResolvedValue([]),
  getTasksByUserId: vi.fn().mockResolvedValue([]),
  getDashboardOverview: vi.fn().mockResolvedValue({
    stats: { totalFields: 1, activeCrops: 0, pendingTasks: 0, unreadAlerts: 0 },
    fields: [],
    pendingTasks: [],
    alerts: [],
    recentNotes: [],
  }),
  getDashboardStats: vi.fn().mockResolvedValue({
    totalFields: 1,
    activeCrops: 0,
    pendingTasks: 0,
    unreadAlerts: 0,
  }),
  getPendingTasksByUserId: vi.fn().mockResolvedValue([]),
  getRecentNotesByUserId: vi.fn().mockResolvedValue([]),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("fields router", () => {
  it("lists fields for authenticated user", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const fields = await caller.fields.list();

    expect(fields).toHaveLength(1);
    expect(fields[0].name).toBe("Campo Teste");
    expect(fields[0].city).toBe("Brasília");
  });

  it("gets field by id for owner", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const field = await caller.fields.getById({ id: 1 });

    expect(field).toBeDefined();
    expect(field.name).toBe("Campo Teste");
    expect(field.areaHectares).toBe(5000);
  });

  it("throws error for non-existent field", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.fields.getById({ id: 999 })).rejects.toThrow("Campo não encontrado");
  });

  it("creates a new field", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.fields.create({
      name: "Novo Campo",
      description: "Descrição do novo campo",
      areaHectares: 10000,
      city: "Rio Verde",
      state: "GO",
      irrigationType: "drip",
    });

    expect(result.success).toBe(true);
    expect(result.id).toBe(2);
  });

  it("updates an existing field", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.fields.update({
      id: 1,
      name: "Campo Atualizado",
      areaHectares: 6000,
    });

    expect(result.success).toBe(true);
  });

  it("deletes a field", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.fields.delete({ id: 1 });

    expect(result.success).toBe(true);
  });
});

describe("dashboard router", () => {
  it("gets dashboard overview", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const overview = await caller.dashboard.getOverview();

    expect(overview).toBeDefined();
    expect(overview.stats).toBeDefined();
    expect(overview.stats.totalFields).toBe(1);
  });
});
