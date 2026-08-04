/**
 * CopyLinkSheet — native-style share sheet that shows common app icons.
 * The link is already on the clipboard when this opens; users just tap
 * an app icon to open it, then paste.
 */

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

const APPS = [
  {
    name: "Facebook",
    bg: "#1877F2",
    content: (
      <span className="text-white font-black text-xl leading-none" style={{ fontFamily: "Georgia, serif" }}>
        f
      </span>
    ),
  },
  {
    name: "Messages",
    bg: "#34C759",
    content: <span className="text-xl leading-none">💬</span>,
  },
  {
    name: "Instagram",
    bg: "linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)",
    content: <span className="text-xl leading-none">📷</span>,
  },
  {
    name: "WhatsApp",
    bg: "#25D366",
    content: <span className="text-xl leading-none">📱</span>,
  },
  {
    name: "Mail",
    bg: "#007AFF",
    content: <span className="text-xl leading-none">✉️</span>,
  },
  {
    name: "X",
    bg: "#000000",
    content: (
      <span className="text-white font-black text-lg leading-none">𝕏</span>
    ),
  },
];

export function CopyLinkSheet({ open, onClose }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[200] bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-[201] bg-white rounded-t-3xl px-5 pt-3 pb-10 shadow-2xl"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 32 }}
          >
            {/* Handle */}
            <div className="w-10 h-1 rounded-full bg-black/20 mx-auto mb-4" />

            {/* Header */}
            <div className="flex items-center justify-between mb-1">
              <p className="text-base font-bold text-black">Link copied ✓</p>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-full bg-black/8 flex items-center justify-center"
              >
                <X className="w-4 h-4 text-black/50" />
              </button>
            </div>
            <p className="text-sm text-black/50 mb-5">
              Open any app below and paste your link.
            </p>

            {/* App grid */}
            <div className="grid grid-cols-6 gap-2 mb-6">
              {APPS.map((app) => (
                <div key={app.name} className="flex flex-col items-center gap-1.5">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm"
                    style={{ background: app.bg }}
                  >
                    {app.content}
                  </div>
                  <span className="text-[10px] text-black/60 font-medium text-center leading-tight">
                    {app.name}
                  </span>
                  <span className="text-[9px] text-black/35 font-medium">
                    Paste link
                  </span>
                </div>
              ))}
            </div>

            {/* Done button */}
            <button
              onClick={onClose}
              className="w-full py-3 rounded-2xl bg-black text-white text-sm font-bold
                         active:opacity-80 transition-opacity"
            >
              Done
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
