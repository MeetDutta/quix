"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../../lib/queryClient";
import { ToastProvider } from "../../components/Toast";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}
