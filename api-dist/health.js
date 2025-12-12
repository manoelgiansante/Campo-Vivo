// api/health.ts
async function handler(req, res) {
  try {
    const dbUrl = process.env.DATABASE_URL;
    res.status(200).json({
      status: "ok",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      env: {
        hasDbUrl: !!dbUrl,
        dbUrlPrefix: dbUrl ? dbUrl.substring(0, 30) + "..." : null,
        nodeEnv: process.env.NODE_ENV
      }
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      error: error?.message || String(error)
    });
  }
}
export {
  handler as default
};
