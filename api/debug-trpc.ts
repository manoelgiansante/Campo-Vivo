import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const results: any = {
    step: "init",
    errors: []
  };
  
  try {
    // Step 1: Test basic imports
    results.step = "importing @trpc/server";
    const { fetchRequestHandler } = await import("@trpc/server/adapters/fetch");
    results.trpcImported = true;
    
    // Step 2: Test router import
    results.step = "importing appRouter";
    const { appRouter } = await import("../../server/routers");
    results.routerImported = true;
    results.routerProcedures = Object.keys((appRouter as any)._def?.procedures || {}).slice(0, 10);
    
    // Step 3: Test db import
    results.step = "importing db";
    const db = await import("../../server/db");
    results.dbImported = true;
    results.dbFunctions = Object.keys(db).slice(0, 10);
    
    results.step = "complete";
    results.success = true;
    
  } catch (error: any) {
    results.error = {
      message: error?.message,
      name: error?.name,
      stack: error?.stack?.split("\n").slice(0, 5)
    };
  }
  
  res.status(200).json(results);
}
