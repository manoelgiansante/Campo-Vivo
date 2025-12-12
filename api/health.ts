import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Test database connection
    const dbUrl = process.env.DATABASE_URL;
    
    res.status(200).json({
      status: "ok",
      timestamp: new Date().toISOString(),
      env: {
        hasDbUrl: !!dbUrl,
        dbUrlPrefix: dbUrl ? dbUrl.substring(0, 30) + "..." : null,
        nodeEnv: process.env.NODE_ENV,
      }
    });
  } catch (error: any) {
    res.status(500).json({
      status: "error",
      error: error?.message || String(error)
    });
  }
}
