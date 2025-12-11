import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import type { AppRouter } from '../../../server/routers';
import Constants from 'expo-constants';

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
  const localhost = Constants.expoConfig?.hostUri?.split(':')[0] || 'localhost';
  return `http://${localhost}:5000`;
};

export const createTRPCClient = () => {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${getBaseUrl()}/trpc`,
        // You can pass any HTTP headers you wish here
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
