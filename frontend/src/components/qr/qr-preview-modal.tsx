"use client";

import { AnimatePresence, motion } from "framer-motion";
import { TbDownload, TbPrinter, TbX } from "react-icons/tb";

interface QRPreviewModalProps {
  open: boolean;
  onClose: () => void;
  qrImage: string;
  code: string;
  label: string;
}

export function QRPreviewModal({ open, onClose, qrImage, code, label }: QRPreviewModalProps) {
  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = qrImage;
    link.download = `${code || "qr-code"}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank", "width=420,height=560");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>${label} - ${code}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 24px; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
            .wrap { text-align: center; }
            img { width: 300px; height: 300px; }
            p { margin-top: 12px; font-size: 16px; font-weight: 700; }
          </style>
        </head>
        <body>
          <div class="wrap">
            <img src="${qrImage}" alt="QR ${code}" />
            <p>${code}</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/40 z-[70] flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.92, y: 16 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.92, y: 16 }}
            transition={{ type: "spring", damping: 24, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-full sm:max-w-md bg-white border-2 border-[#1a1a1a] rounded-xl shadow-[4px_4px_0px_#1a1a1a] p-6"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-heading text-xl font-bold text-[#1a1a1a]">{label}</h2>
                <p className="text-sm text-[#5a5a5a] mt-0.5">Preview QR Code</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-11 h-11 rounded-lg border-2 border-[#1a1a1a] bg-white inline-flex items-center justify-center hover:bg-[#f5ede6]"
                aria-label="Close"
              >
                <TbX className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-2 border-[#1a1a1a] rounded-xl bg-[#f5ede6] flex flex-col items-center">
              <img src={qrImage} alt={`QR ${code}`} width={300} height={300} className="w-[300px] h-[300px]" />
              <p className="mt-3 text-sm font-bold text-[#1a1a1a]">{code}</p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleDownload}
                className="py-2.5 px-4 bg-[#4b607f] text-white border-2 border-[#1a1a1a] rounded-lg font-bold text-sm inline-flex items-center justify-center gap-2"
              >
                <TbDownload className="w-4 h-4" />
                Download PNG
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="py-2.5 px-4 bg-white text-[#1a1a1a] border-2 border-[#1a1a1a] rounded-lg font-bold text-sm inline-flex items-center justify-center gap-2"
              >
                <TbPrinter className="w-4 h-4" />
                Print
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
