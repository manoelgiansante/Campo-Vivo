import { describe, expect, it } from "vitest";

describe("Mapbox Configuration", () => {
  it("VITE_MAPBOX_TOKEN environment variable is set", () => {
    // Check if the token is available in the environment
    const token = process.env.VITE_MAPBOX_TOKEN;
    
    expect(token).toBeDefined();
    expect(token).not.toBe("");
    expect(token?.startsWith("pk.")).toBe(true);
  });

  it("Mapbox token has valid format", () => {
    const token = process.env.VITE_MAPBOX_TOKEN;
    
    // Mapbox public tokens start with "pk." and are base64-encoded
    expect(token).toMatch(/^pk\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/);
  });
});
