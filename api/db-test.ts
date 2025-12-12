import type { VercelRequest, VercelResponse } from "@vercel/node";
import postgres from "postgres";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const dbUrl = process.env.DATABASE_URL;
  
  if (!dbUrl) {
    return res.status(500).json({ error: "DATABASE_URL not set" });
  }
  
  try {
    const client = postgres(dbUrl, { 
      connect_timeout: 10,
      idle_timeout: 20,
    });
    
    const result = await client`SELECT version()`;
    await client.end();
    
    res.status(200).json({
      status: "ok",
      database: "connected",
      version: result[0]?.version
    });
  } catch (error: any) {
    res.status(500).json({
      status: "error",
      error: error?.message || String(error),
      stack: error?.stack
    });
  }
}
