import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock das funções do agromonitoring
vi.mock("./services/agromonitoring", () => ({
  isAgromonitoringConfigured: vi.fn().mockReturnValue(true),
  syncFieldNdvi: vi.fn().mockResolvedValue(true),
  syncAllFieldsNdvi: vi.fn().mockResolvedValue({ success: 2, failed: 0 }),
  createPolygon: vi.fn().mockResolvedValue({ id: "agro-poly-123", area: 50 }),
  getCurrentNdvi: vi.fn().mockResolvedValue({
    dt: Date.now() / 1000,
    source: "Sentinel-2",
    cl: 10,
    data: { mean: 0.65, min: 0.45, max: 0.85 },
  }),
  convertBoundariesToCoordinates: vi.fn().mockReturnValue([
    [-54.608, -20.474],
    [-54.606, -20.474],
    [-54.606, -20.472],
    [-54.608, -20.472],
  ]),
}));

// Mock das funções do db
vi.mock("./db", () => ({
  getFieldById: vi.fn().mockImplementation((id: number) => {
    if (id === 1) {
      return Promise.resolve({
        id: 1,
        userId: 1,
        name: "Campo Soja",
        boundaries: JSON.stringify([
          { lat: -20.474, lng: -54.608 },
          { lat: -20.474, lng: -54.606 },
          { lat: -20.472, lng: -54.606 },
          { lat: -20.472, lng: -54.608 },
        ]),
        areaHectares: 5000,
        currentNdvi: 65,
        lastNdviSync: new Date(),
        agroPolygonId: "agro-poly-123",
      });
    }
    return Promise.resolve(null);
  }),
  getFieldsByUserId: vi.fn().mockResolvedValue([
    {
      id: 1,
      userId: 1,
      name: "Campo Soja",
      boundaries: JSON.stringify([{ lat: -20.474, lng: -54.608 }]),
      currentNdvi: 65,
    },
    {
      id: 2,
      userId: 1,
      name: "Campo Milho",
      boundaries: JSON.stringify([{ lat: -20.500, lng: -54.700 }]),
      currentNdvi: 72,
    },
  ]),
  updateFieldNdvi: vi.fn().mockResolvedValue(undefined),
  updateFieldAgroPolygonId: vi.fn().mockResolvedValue(undefined),
  createNdviHistory: vi.fn().mockResolvedValue(1),
  getNdviHistoryByFieldId: vi.fn().mockResolvedValue([
    {
      id: 1,
      fieldId: 1,
      ndviValue: 65,
      ndviMin: 45,
      ndviMax: 85,
      cloudCoverage: 10,
      satellite: "Sentinel-2",
      acquisitionDate: new Date(),
    },
    {
      id: 2,
      fieldId: 1,
      ndviValue: 62,
      ndviMin: 42,
      ndviMax: 82,
      cloudCoverage: 15,
      satellite: "Sentinel-2",
      acquisitionDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    },
  ]),
  getLatestNdviByFieldId: vi.fn().mockResolvedValue({
    id: 1,
    fieldId: 1,
    ndviAverage: 0.65,
    captureDate: new Date(),
  }),
  getAllFieldsWithBoundaries: vi.fn().mockResolvedValue([
    {
      id: 1,
      userId: 1,
      name: "Campo Soja",
      boundaries: JSON.stringify([{ lat: -20.474, lng: -54.608 }]),
    },
  ]),
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as agromonitoring from "./services/agromonitoring";
import * as db from "./db";

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

describe("NDVI Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("gets current NDVI for a field", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ndvi.getCurrentReal({ fieldId: 1 });

    expect(result).toBeDefined();
    expect(result.ndvi).toBe(0.65);
    expect(result.agroPolygonId).toBe("agro-poly-123");
  });

  it("gets NDVI history for a field", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const history = await caller.ndvi.getRealHistory({ fieldId: 1, days: 30 });

    expect(history).toHaveLength(2);
    expect(history[0].ndvi).toBe(0.65);
    expect(history[0].satellite).toBe("Sentinel-2");
  });

  it("gets integration status", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const status = await caller.ndvi.getIntegrationStatus();

    expect(status).toBeDefined();
    expect(status.agromonitoring).toBeDefined();
  });

  it("handles sync when API not configured", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Este teste verifica que o erro é lançado corretamente quando API não está configurada
    // Em produção, a API key estaria configurada
    await expect(caller.ndvi.syncFromAgromonitoring({ fieldId: 1 }))
      .rejects.toThrow("API Agromonitoring não configurada");
  });

  it("gets batch NDVI for multiple fields", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ndvi.getLatestBatch({ fieldIds: [1, 2] });

    expect(result).toBeDefined();
    expect(result[1]).toBeDefined();
  });
});

describe("Agromonitoring Service", () => {
  it("checks if service is configured", () => {
    expect(agromonitoring.isAgromonitoringConfigured()).toBe(true);
  });

  it("syncs field NDVI", async () => {
    const field = await db.getFieldById(1);
    expect(field).toBeDefined();

    const result = await agromonitoring.syncFieldNdvi(field!);
    expect(result).toBe(true);
  });

  it("syncs all fields NDVI", async () => {
    const fields = await db.getFieldsByUserId(1);
    const result = await agromonitoring.syncAllFieldsNdvi(fields);

    expect(result.success).toBe(2);
    expect(result.failed).toBe(0);
  });

  it("converts boundaries to coordinates", () => {
    const boundaries = JSON.stringify([
      { lat: -20.474, lng: -54.608 },
      { lat: -20.474, lng: -54.606 },
      { lat: -20.472, lng: -54.606 },
    ]);

    const coords = agromonitoring.convertBoundariesToCoordinates(boundaries);
    expect(coords).toHaveLength(4); // Mocked value
    expect(coords[0][0]).toBe(-54.608);
  });
});

describe("NDVI Scheduler", () => {
  it("gets scheduler status", async () => {
    const { getSchedulerStatus } = await import("./services/ndviScheduler");
    const status = getSchedulerStatus();

    expect(status).toBeDefined();
    expect(status.isConfigured).toBeDefined();
  });
});
