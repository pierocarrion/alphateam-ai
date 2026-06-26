"use client";

import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ApiError } from "@/shared/lib/api";
import { createLogger } from "@/shared/lib/logger";
import { LocaleProvider } from "@/i18n/LocaleProvider";

const log = createLogger("query");

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: (failureCount, error) => {
              if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
                return false;
              }
              return failureCount < 1;
            },
          },
          mutations: {
            onError: (error: unknown) => {
              log.error("mutation error", {
                message: error instanceof Error ? error.message : String(error),
              });
              const message =
                error instanceof ApiError || error instanceof Error
                  ? error.message
                  : "Something went wrong on our end. Please try again in a moment.";
              toast.error(message);
            },
          },
        },
      })
  );

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <LocaleProvider>{children}</LocaleProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
