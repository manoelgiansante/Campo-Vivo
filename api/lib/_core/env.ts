export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  openWeatherApiKey: process.env.OPENWEATHER_API_KEY ?? "",
  mapboxToken: process.env.MAPBOX_TOKEN ?? "",
  // Sentinel Hub for real NDVI data
  sentinelHubClientId: process.env.SENTINEL_HUB_CLIENT_ID ?? "",
  sentinelHubClientSecret: process.env.SENTINEL_HUB_CLIENT_SECRET ?? "",
  // Agromonitoring API for NDVI (free tier available)
  agromonitoringApiKey: process.env.AGROMONITORING_API_KEY ?? "",
};
