import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "../../server/routers";

// Handler para Vercel Serverless Functions
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization"
  );

  // Handle preflight request
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  // Convert Vercel request to standard Request
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
  const url = `${protocol}://${host}${req.url}`;
  
  const headers = new Headers();
  Object.entries(req.headers).forEach(([key, value]) => {
    if (value) {
      headers.set(key, Array.isArray(value) ? value.join(", ") : value);
    }
  });

  // Read body for POST requests
  let body: string | undefined;
  if (req.method === "POST" && req.body) {
    body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
  }

  const fetchRequest = new Request(url, {
    method: req.method || "GET",
    headers,
    body: body,
  });

  try {
    const response = await fetchRequestHandler({
      endpoint: "/api/trpc",
      req: fetchRequest,
      router: appRouter,
      createContext: async () => {
        // Parse cookies from request
        const cookieHeader = req.headers.cookie || "";
        const cookies: Record<string, string> = {};
        cookieHeader.split(";").forEach((cookie) => {
          const [name, value] = cookie.trim().split("=");
          if (name && value) {
            cookies[name] = decodeURIComponent(value);
          }
        });

        // Helper to create a dev user with all required fields
        const createDevUser = (overrides: { id?: number; openId?: string; name?: string; email?: string } = {}) => ({
          id: overrides.id ?? 1,
          openId: overrides.openId ?? "dev-local-user",
          name: overrides.name ?? "Usuário de Desenvolvimento",
          email: overrides.email ?? "dev@campovivo.app",
          loginMethod: "dev",
          role: "user" as const,
          userType: "farmer" as const,
          phone: null,
          company: null,
          avatarUrl: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        });

        // Check for development mode user from cookie
        const devUser = cookies["dev_user"];
        if (devUser) {
          try {
            const userData = JSON.parse(devUser);
            return {
              user: createDevUser({
                id: userData.id,
                openId: userData.openId,
                name: userData.name,
                email: userData.email,
              }),
            };
          } catch (e) {
            // Invalid cookie, continue without user
          }
        }

        // In development mode without OAuth, create a default dev user
        // This allows the app to work without WorkOS configuration
        if (!process.env.WORKOS_CLIENT_ID) {
          return {
            user: createDevUser(),
          };
        }

        // No authenticated user
        return { user: null };
      },
    });

    // Convert fetch response to Vercel response
    const responseBody = await response.text();
    
    response.headers.forEach((value, key) => {
      res.setHeader(key, value);
    });
    
    res.status(response.status).send(responseBody);
  } catch (error) {
    console.error("tRPC error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
