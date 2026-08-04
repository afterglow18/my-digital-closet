/**
 * CopyLinkSheet — native-style share sheet.
 * Link is already on the clipboard. Each app row has a paste field + Post button.
 * Tapping Post opens the app via URL scheme (or its App Store page if not installed).
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  url: string;
}

const APPS = [
  {
    name: "Facebook",
    bg: "#1877F2",
    scheme: "fb://",
    fallback: "itms-apps://itunes.apple.com/app/id284882215",
    icon: (
      <span className="text-white font-black text-xl leading-none" style={{ fontFamily: "Georgia, serif" }}>
        f
      </span>
    ),
  },
  {
    name: "Messages",
    bg: "#34C759",
    scheme: "sms:",
    fallback: null,
    icon: <span className="text-xl leading-none">💬</span>,
  },
  {
    name: "Instagram",
    bg: "linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)",
    scheme: "instagram://",
    fallback: "itms-apps://itunes.apple.com/app/id389801252",
    icon: <span className="text-xl leading-none">📷</span>,
  },
  {
    name: "WhatsApp",
    bg: "#25D366",
    scheme: "whatsapp://",
    fallback: "itms-apps://itunes.apple.com/app/id310633997",
    icon: <span className="text-white font-black text-base leading-none">W</span>,
  },
  {
    name: "Mail",
    bg: "#007AFF",
    scheme: "mailto:",
    fallback: null,
    icon: <span className="text-xl leading-none">✉️</span>,
  },
  {
    name: "X",
    bg: "#000000",
    scheme: "twitter://",
    fallback: "itms-apps://itunes.apple.com/app/id333903271",
    icon: <span className="text-white font-black text-lg leading-none">𝕏</span>,
  },
];

function openApp(scheme: string, fallback: string | null) {
  const start = Date.now();
  window.location.href = scheme;
  if (fallback) {
    setTimeout(() => {
      if (Date.now() - start < 1500) {
        window.location.href = fallback;
      }
    }, 1000);
  }
}

export function CopyLinkSheet({ open, onClose, url }: Props) {
  // One text-input value per app, pre-filled with the URL
  const [values, setValues] = useState<Record<string, string>>({});

  const getValue = (name: string) =>
    values[name] !== undefined ? values[name] : url;

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
            className="fixed bottom-0 left-0 right-0 z-[201] bg-white rounded-t-3xl shadow-2xl
                       flex flex-col"
            style={{ maxHeight: "85dvh" }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 32 }}
          >
            {/* Fixed header */}
            <div className="px-5 pt-3 pb-2 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-black/20 mx-auto mb-4" />
              <div className="flex items-center justify-between mb-1">
                <p className="text-base font-bold text-black">Link copied ✓</p>
                <button
                  onClick={onClose}
                  className="w-7 h-7 rounded-full bg-black/8 flex items-center justify-center"
                >
                  <X className="w-4 h-4 text-black/50" />
                </button>
              </div>
              <p className="text-sm text-black/50">
                Paste your link below, then tap Post to share.
              </p>
            </div>

            {/* Scrollable app list */}
            <div className="overflow-y-auto flex-1 px-5 py-3 space-y-4">
              {APPS.map((app) => (
                <div key={app.name} className="flex flex-col gap-1.5">
                  {/* App icon + name */}
                  <div className="flex items-center gap-2">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0"
                      style={{ background: app.bg }}
                    >
                      {app.icon}
                    </div>
                    <span className="text-sm font-semibold text-black">{app.name}</span>
                  </div>

                  {/* Paste field */}
                  <input
                    type="text"
                    value={getValue(app.name)}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [app.name]: e.target.value }))
                    }
                    placeholder="Paste"
                    className="w-full px-3 py-2 rounded-xl border-2 border-black/10 bg-black/[0.03]
                               text-sm text-black/70 placeholder:text-black/30 focus:outline-none
                               focus:border-black/20"
                  />

                  {/* Post button */}
                  <button
                    onClick={() => openApp(app.scheme, app.fallback)}
                    className="w-full py-2 rounded-xl text-white text-sm font-bold
                               active:opacity-80 transition-opacity"
                    style={{ background: app.bg }}
                  >
                    Post
                  </button>
                </div>
              ))}
            </div>

            {/* Fixed footer */}
            <div className="px-5 pt-2 pb-8 flex-shrink-0">
              <button
                onClick={onClose}
                className="w-full py-3 rounded-2xl bg-black text-white text-sm font-bold
                           active:opacity-80 transition-opacity"
              >
                Done
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
