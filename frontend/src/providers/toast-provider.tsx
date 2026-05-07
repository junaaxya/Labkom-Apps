"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TbCheck,
  TbX,
  TbAlertTriangle,
  TbInfoCircle,
} from "react-icons/tb";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  toast: {
    success: (message: string, duration?: number) => void;
    error: (message: string, duration?: number) => void;
    warning: (message: string, duration?: number) => void;
    info: (message: string, duration?: number) => void;
  };
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx.toast;
}

const TOAST_CONFIG: Record<
  ToastType,
  { icon: typeof TbCheck; bg: string; border: string; text: string }
> = {
  success: {
    icon: TbCheck,
    bg: "bg-green-50",
    border: "border-green-600",
    text: "text-green-800",
  },
  error: {
    icon: TbX,
    bg: "bg-red-50",
    border: "border-red-600",
    text: "text-red-800",
  },
  warning: {
    icon: TbAlertTriangle,
    bg: "bg-yellow-50",
    border: "border-yellow-600",
    text: "text-yellow-800",
  },
  info: {
    icon: TbInfoCircle,
    bg: "bg-blue-50",
    border: "border-blue-600",
    text: "text-blue-800",
  },
};

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  const config = TOAST_CONFIG[toast.type];
  const Icon = config.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={`
        relative flex items-start gap-3 px-4 py-3 rounded-lg
        border-2 ${config.border} ${config.bg}
        shadow-[4px_4px_0px_0px_rgba(26,26,26,0.9)]
        min-w-[300px] max-w-[420px]
        cursor-pointer
      `}
      onClick={() => onDismiss(toast.id)}
    >
      <div
        className={`flex-shrink-0 w-6 h-6 rounded-full border-2 ${config.border} flex items-center justify-center ${config.bg}`}
      >
        <Icon className={`w-3.5 h-3.5 ${config.text}`} />
      </div>
      <p className={`text-sm font-medium ${config.text} leading-snug pr-6`}>
        {toast.message}
      </p>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(toast.id);
        }}
        className="absolute top-2 right-2 p-0.5 rounded hover:bg-black/5 transition-colors"
      >
        <TbX className="w-4 h-4 text-gray-500" />
      </button>
    </motion.div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const addToast = useCallback(
    (type: ToastType, message: string, duration = 4000) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const newToast: Toast = { id, type, message, duration };

      setToasts((prev) => {
        const updated = [...prev, newToast];
        // Keep max 5 toasts visible
        if (updated.length > 5) return updated.slice(-5);
        return updated;
      });

      if (duration > 0) {
        const timer = setTimeout(() => dismiss(id), duration);
        timersRef.current.set(id, timer);
      }
    },
    [dismiss]
  );

  const toast = {
    success: (message: string, duration?: number) =>
      addToast("success", message, duration),
    error: (message: string, duration?: number) =>
      addToast("error", message, duration ?? 6000),
    warning: (message: string, duration?: number) =>
      addToast("warning", message, duration ?? 5000),
    info: (message: string, duration?: number) =>
      addToast("info", message, duration),
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => (
            <div key={t.id} className="pointer-events-auto">
              <ToastItem toast={t} onDismiss={dismiss} />
            </div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
