import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    status: "trpc-simple working",
    url: req.url,
    method: req.method
  });
}
