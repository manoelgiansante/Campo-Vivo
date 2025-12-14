import { describe, it, expect } from "vitest";

describe("Agromonitoring API Integration", () => {
  it("should have AGROMONITORING_API_KEY configured", () => {
    const apiKey = process.env.AGROMONITORING_API_KEY;
    expect(apiKey).toBeDefined();
    expect(apiKey).not.toBe("");
    expect(apiKey!.length).toBeGreaterThan(10);
  });

  it("should be able to list polygons from Agromonitoring API", async () => {
    const apiKey = process.env.AGROMONITORING_API_KEY;
    if (!apiKey) {
      throw new Error("AGROMONITORING_API_KEY not configured");
    }

    const response = await fetch(
      `https://api.agromonitoring.com/agro/1.0/polygons?appid=${apiKey}`
    );

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
    
    console.log(`[Test] Found ${data.length} polygons in Agromonitoring`);
  });

  it("should be able to search satellite images for a polygon", async () => {
    const apiKey = process.env.AGROMONITORING_API_KEY;
    if (!apiKey) {
      throw new Error("AGROMONITORING_API_KEY not configured");
    }

    // First get a polygon
    const polygonsResponse = await fetch(
      `https://api.agromonitoring.com/agro/1.0/polygons?appid=${apiKey}`
    );
    const polygons = await polygonsResponse.json();

    if (polygons.length === 0) {
      console.log("[Test] No polygons found, skipping satellite image test");
      return;
    }

    const polygonId = polygons[0].id;
    const endDate = Math.floor(Date.now() / 1000);
    const startDate = endDate - 60 * 24 * 60 * 60; // 60 days ago

    const imagesResponse = await fetch(
      `https://api.agromonitoring.com/agro/1.0/image/search?polyid=${polygonId}&start=${startDate}&end=${endDate}&appid=${apiKey}`
    );

    expect(imagesResponse.ok).toBe(true);

    const images = await imagesResponse.json();
    expect(Array.isArray(images)).toBe(true);

    console.log(`[Test] Found ${images.length} satellite images for polygon ${polygonId}`);

    if (images.length > 0) {
      // Verify image structure
      const firstImage = images[0];
      expect(firstImage).toHaveProperty("dt");
      expect(firstImage).toHaveProperty("image");
      expect(firstImage.image).toHaveProperty("ndvi");
      console.log(`[Test] NDVI image URL: ${firstImage.image.ndvi.substring(0, 80)}...`);
    }
  });
});
