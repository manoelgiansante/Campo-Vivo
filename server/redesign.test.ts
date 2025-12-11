import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

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
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("CampoVivo Redesign - API Tests", () => {
  describe("auth.me", () => {
    it("returns current user when authenticated", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.auth.me();

      expect(result).toBeDefined();
      expect(result?.email).toBe("test@example.com");
      expect(result?.name).toBe("Test User");
    });

    it("returns null when not authenticated", async () => {
      const ctx: TrpcContext = {
        user: null,
        req: { protocol: "https", headers: {} } as TrpcContext["req"],
        res: { clearCookie: () => {} } as TrpcContext["res"],
      };
      const caller = appRouter.createCaller(ctx);

      const result = await caller.auth.me();

      expect(result).toBeNull();
    });
  });

  describe("fields router", () => {
    it("has list procedure defined", () => {
      expect(appRouter._def.procedures).toHaveProperty("fields.list");
    });

    it("has getById procedure defined", () => {
      expect(appRouter._def.procedures).toHaveProperty("fields.getById");
    });

    it("has create procedure defined", () => {
      expect(appRouter._def.procedures).toHaveProperty("fields.create");
    });

    it("has update procedure defined", () => {
      expect(appRouter._def.procedures).toHaveProperty("fields.update");
    });

    it("has delete procedure defined", () => {
      expect(appRouter._def.procedures).toHaveProperty("fields.delete");
    });
  });

  describe("notes router", () => {
    it("has listAll procedure defined", () => {
      expect(appRouter._def.procedures).toHaveProperty("notes.listAll");
    });

    it("has listByField procedure defined", () => {
      expect(appRouter._def.procedures).toHaveProperty("notes.listByField");
    });

    it("has create procedure defined", () => {
      expect(appRouter._def.procedures).toHaveProperty("notes.create");
    });
  });

  describe("crops router", () => {
    it("has listByField procedure defined", () => {
      expect(appRouter._def.procedures).toHaveProperty("crops.listByField");
    });

    it("has create procedure defined", () => {
      expect(appRouter._def.procedures).toHaveProperty("crops.create");
    });
  });

  describe("ndvi router", () => {
    it("has getByField procedure defined", () => {
      expect(appRouter._def.procedures).toHaveProperty("ndvi.getByField");
    });
  });

  describe("weather router", () => {
    it("has getByField procedure defined", () => {
      expect(appRouter._def.procedures).toHaveProperty("weather.getByField");
    });
  });

  describe("user router", () => {
    it("has getProfile procedure defined", () => {
      expect(appRouter._def.procedures).toHaveProperty("user.getProfile");
    });

    it("has updateProfile procedure defined", () => {
      expect(appRouter._def.procedures).toHaveProperty("user.updateProfile");
    });
  });
});
