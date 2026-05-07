"use client";

import { motion, AnimatePresence } from "framer-motion";
import { TbAlertTriangle } from "react-icons/tb";

interface ConfirmModalProps {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title = "Konfirmasi",
  message,
  confirmLabel = "Ya, Hapus",
  cancelLabel = "Batal",
  variant = "danger",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const variantStyles = {
    danger: {
      icon: "text-red-500",
      iconBg: "bg-red-100",
      button: "bg-red-500 text-white hover:bg-red-600",
    },
    warning: {
      icon: "text-yellow-600",
      iconBg: "bg-yellow-100",
      button: "bg-yellow-500 text-white hover:bg-yellow-600",
    },
    default: {
      icon: "text-[#4b607f]",
      iconBg: "bg-[#f5ede6]",
      button: "bg-[#4b607f] text-white hover:bg-[#3d4f6a]",
    },
  };

  const styles = variantStyles[variant];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4"
          onClick={onCancel}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white border-2 border-[#1a1a1a] rounded-xl shadow-[4px_4px_0px_#1a1a1a] p-6 w-full max-w-sm"
          >
            <div className="flex flex-col items-center text-center">
              <div className={`w-12 h-12 rounded-full ${styles.iconBg} flex items-center justify-center mb-4`}>
                <TbAlertTriangle className={`w-6 h-6 ${styles.icon}`} />
              </div>
              <h3 className="font-heading text-lg font-bold text-[#1a1a1a] mb-2">
                {title}
              </h3>
              <p className="text-sm text-[#5a5a5a] mb-6">
                {message}
              </p>
              <div className="flex gap-3 w-full">
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={loading}
                  className="flex-1 py-2.5 px-4 border-2 border-[#1a1a1a] rounded-lg font-medium text-sm hover:bg-[#f5ede6] transition-colors disabled:opacity-50"
                >
                  {cancelLabel}
                </button>
                <button
                  type="button"
                  onClick={onConfirm}
                  disabled={loading}
                  className={`flex-1 py-2.5 px-4 border-2 border-[#1a1a1a] rounded-lg font-medium text-sm transition-colors disabled:opacity-50 ${styles.button}`}
                >
                  {loading ? "Menghapus..." : confirmLabel}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
