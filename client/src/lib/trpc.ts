import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../../../api/trpc-standalone";

export const trpc = createTRPCReact<AppRouter>();
