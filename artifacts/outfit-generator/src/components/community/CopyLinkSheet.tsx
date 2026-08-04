/**
 * CopyLinkSheet — share sheet that opens each app's compose/share screen.
 * Uses proper share URLs (not bare URL schemes) so the app opens to a post
 * preview / composer rather than the home feed.
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
    // Opens Facebook's share dialog with a link card preview
    shareUrl: (text: string) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(text)}`,
    icon: (
      <span className="text-white font-black text-base leading-none" style={{ fontFamily: "Georgia, serif" }}>
        f
      </span>
    ),
  },
  {
    name: "Messages",
    bg: "#34C759",
    // Pre-fills iMessage / SMS body
    shareUrl: (text: string) => `sms:?body=${encodeURIComponent(text)}`,
    icon: <span className="text-base leading-none">💬</span>,
  },
  {
    name: "Instagram",
    bg: "linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)",
    // Instagram doesn't support link pre-fill via URL scheme; opens the app
    shareUrl: (_text: string) => "instagram://",
    icon: <span className="text-base leading-none">📷</span>,
  },
  {
    name: "WhatsApp",
    bg: "#25D366",
    // Opens WhatsApp share composer with text pre-filled
    shareUrl: (text: string) =>
      `whatsapp://send?text=${encodeURIComponent(text)}`,
    icon: <span className="text-white font-black text-sm leading-none">W</span>,
  },
  {
    name: "Mail",
    bg: "#007AFF",
    // Opens Mail compose with subject + body pre-filled
    shareUrl: (text: string) =>
      `mailto:?subject=${encodeURIComponent("Check out My Digital Closet")}&body=${encodeURIComponent(text)}`,
    icon: <span className="text-base leading-none">✉️</span>,
  },
  {
    name: "X",
    bg: "#000000",
    // Opens X compose with text pre-filled
    shareUrl: (text: string) =>
      `twitter://post?message=${encodeURIComponent(text)}`,
    icon: <span className="text-white font-black text-sm leading-none">𝕏</span>,
  },
];

export function CopyLinkSheet({ open, onClose, url }: Props) {
  const [values, setValues] = useState<Record<string, string>>({});

  // Reset inputs whenever the sheet opens
  React.useEffect(() => {
    if (open) setValues({});
  }, [open]);

  const getValue = (name: string) =>
    values[name] !== undefined ? values[name] : url;

  function handleShare(app: (typeof APPS)[number], text: string) {
    const shareUrl = app.shareUrl(text);
    // _system tells Capacitor/WKWebView to hand off to iOS instead of
    // opening in the in-app browser — routes to the native app.
    window.open(shareUrl, "_system");
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[200] bg-black/50"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            className="fixed bottom-0 left-0 right-0 z-[201] bg-white rounded-t-3xl shadow-2xl px-4 pt-3 pb-8"
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 32 }}
          >
            {/* Handle */}
            <div className="w-10 h-1 rounded-full bg-black/20 mx-auto mb-3" />

            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-black">Share to</p>
              <button onClick={onClose} className="w-6 h-6 rounded-full bg-black/8 flex items-center justify-center">
                <X className="w-3.5 h-3.5 text-black/50" />
              </button>
            </div>

            {/* App rows */}
            <div className="space-y-2">
              {APPS.map((app) => {
                const text = getValue(app.name);
                return (
                  <div key={app.name} className="flex flex-col gap-1">
                    {/* Icon + name */}
                    <div className="flex items-center gap-1.5">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: app.bg }}
                      >
                        {app.icon}
                      </div>
                      <span className="text-xs font-semibold text-black">{app.name}</span>
                    </div>

                    {/* Input + Share */}
                    <div className="flex gap-1.5 items-center">
                      <input
                        type="text"
                        value={text}
                        onChange={(e) =>
                          setValues((v) => ({ ...v, [app.name]: e.target.value }))
                        }
                        placeholder="Paste"
                        className="flex-1 px-2.5 py-1.5 rounded-lg border border-black/10 bg-black/[0.03]
                                   text-xs text-black/70 placeholder:text-black/30 focus:outline-none
                                   focus:border-black/20 min-w-0"
                      />
                      <button
                        onClick={() => handleShare(app, text)}
                        className="px-3 py-1.5 rounded-lg text-white text-xs font-bold flex-shrink-0
                                   active:opacity-80 transition-opacity"
                        style={{ background: app.bg }}
                      >
                        Share
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Done */}
            <button
              onClick={onClose}
              className="w-full mt-4 py-2.5 rounded-2xl bg-black text-white text-sm font-bold
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
