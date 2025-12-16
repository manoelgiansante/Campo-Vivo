import { describe, it, expect } from "vitest";
import * as sentinelHub from "./services/sentinelHub";

describe("Sentinel Hub Integration", () => {
  it("deve obter dados NDVI reais do Sentinel Hub", async () => {
    // Geometria de teste (pequeno polígono em WGS84)
    const testGeometry: sentinelHub.FieldGeometry = {
      type: "Polygon",
      coordinates: [
        [
          [-47.8, -15.8],
          [-47.8, -15.81],
          [-47.81, -15.81],
          [-47.81, -15.8],
          [-47.8, -15.8],
        ],
      ],
    };

    // Buscar dados dos últimos 30 dias
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const ndviData = await sentinelHub.getNDVITimeSeries(
      testGeometry,
      startDate.toISOString(),
      endDate.toISOString(),
      "P10D" // Intervalos de 10 dias
    );

    // Verificar se retornou dados
    expect(ndviData).toBeDefined();
    expect(Array.isArray(ndviData)).toBe(true);
    
    // Se houver dados, verificar estrutura
    if (ndviData.length > 0) {
      const firstPoint = ndviData[0];
      expect(firstPoint).toHaveProperty("date");
      expect(firstPoint).toHaveProperty("ndvi");
      expect(firstPoint).toHaveProperty("mean");
      expect(typeof firstPoint.ndvi).toBe("number");
      expect(firstPoint.ndvi).toBeGreaterThanOrEqual(-1);
      expect(firstPoint.ndvi).toBeLessThanOrEqual(1);
    }

    console.log(`✓ Sentinel Hub retornou ${ndviData.length} pontos de dados NDVI`);
  }, 30000); // Timeout de 30 segundos
});
