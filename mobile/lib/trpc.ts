import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../../../api/trpc/index';
import Constants from 'expo-constants';
import superjson from 'superjson';

export const trpc = createTRPCReact<AppRouter>();

// Get the API URL based on environment
const getBaseUrl = () => {
  // For production, use your deployed API URL
  const productionUrl = process.env.EXPO_PUBLIC_API_URL;
  if (productionUrl) return productionUrl;
  
  // For development
  // On iOS simulator: localhost works
  // On Android emulator: use 10.0.2.2
  // On physical device: use your computer's IP address
  const debuggerHost = Constants.expoConfig?.hostUri;
  const localhost = debuggerHost?.split(':')[0];
  
  if (!localhost) {
    // Default fallback - use production URL if available
    return 'https://campovivo.vercel.app';
  }
  
  return `http://${localhost}:5000`;
};

export const createTRPCClient = () => {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${getBaseUrl()}/api/trpc`,
        transformer: superjson,
        headers() {
          return {
            // Add authentication headers here if needed
          };
        },
      }),
    ],
  });
};

// Export the API URL for other uses
export const API_URL = getBaseUrl();
