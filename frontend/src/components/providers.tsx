import { QtProvider } from "@/lib/qt";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export default function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: Infinity,
      },
    },
  });
  return (
    <QtProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </QtProvider>
  );
}
