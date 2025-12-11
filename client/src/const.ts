export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Track if OAuth warning was already shown
let oauthWarningShown = false;

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = () => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  
  // Return empty string if OAuth is not configured (only warn once)
  if (!oauthPortalUrl || !appId) {
    if (!oauthWarningShown) {
      console.info('OAuth não configurado - usando modo de desenvolvimento local');
      oauthWarningShown = true;
    }
    return '';
  }
  
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};
