"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "success") => {
    const id = ++nextId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismiss = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const colorMap: Record<ToastType, { bg: string; border: string; text: string; icon: string }> = {
    success: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-800", icon: "✓" },
    error:   { bg: "bg-rose-50",    border: "border-rose-200",    text: "text-rose-800",    icon: "✕" },
    warning: { bg: "bg-amber-50",   border: "border-amber-200",   text: "text-amber-800",   icon: "⚠" },
    info:    { bg: "bg-sky-50",     border: "border-sky-200",     text: "text-sky-800",     icon: "ℹ" },
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast Container — fixed top-right */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2.5 pointer-events-none max-w-sm w-full">
        {toasts.map((t) => {
          const c = colorMap[t.type];
          return (
            <div
              key={t.id}
              className={`pointer-events-auto ${c.bg} ${c.border} ${c.text} border rounded-xl px-4 py-3 shadow-lg flex items-start gap-2.5 text-sm font-medium animate-slideIn`}
            >
              <span className="text-base leading-none shrink-0 mt-0.5">{c.icon}</span>
              <span className="flex-1 leading-snug">{t.message}</span>
              <button
                onClick={() => dismiss(t.id)}
                className="shrink-0 opacity-60 hover:opacity-100 text-xs font-bold ml-2"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
