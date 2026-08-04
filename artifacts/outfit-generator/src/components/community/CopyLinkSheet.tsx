/**
 * CopyLinkSheet — share sheet that opens each app's compose/share screen.
 * Uses proper share URLs (not bare URL schemes) so the app opens to a post
 * preview / composer rather than the home feed.
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { App } from "@capacitor/app";

interface Props {
  open: boolean;
  onClose: () => void;
  url: string;
}

// useWindowOpen: true  → window.open(_system) — required for sms: / mailto: / https: on iOS
// useWindowOpen: false → App.openUrl          — required for custom 3rd-party schemes
const APPS = [
  {
    name: "Facebook",
    bg: "#1877F2",
    shareUrl: (_text: string) => "fb://",
    fallbackUrl: (_text: string) => "itms-apps://itunes.apple.com/app/id284882215",
    copyBeforeOpen: true,
    useWindowOpen: false,
    icon: (
      <span className="text-white font-black text-base leading-none" style={{ fontFamily: "Georgia, serif" }}>
        f
      </span>
    ),
  },
  {
    name: "Messages",
    bg: "#34C759",
    shareUrl: (text: string) => `sms:?body=${encodeURIComponent(text)}`,
    fallbackUrl: null,
    copyBeforeOpen: false,
    useWindowOpen: true,   // sms: must go through window.open(_system) on iOS
    icon: <span className="text-base leading-none">💬</span>,
  },
  {
    name: "Instagram",
    bg: "linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)",
    shareUrl: (_text: string) => "instagram://",
    fallbackUrl: (_text: string) => "itms-apps://itunes.apple.com/app/id389801252",
    copyBeforeOpen: true,
    useWindowOpen: false,
    icon: <span className="text-base leading-none">📷</span>,
  },
  {
    name: "TikTok",
    bg: "#010101",
    shareUrl: (_text: string) => "tiktok://",
    fallbackUrl: (_text: string) => "itms-apps://itunes.apple.com/app/id1235601864",
    copyBeforeOpen: true,
    useWindowOpen: false,
    icon: <span className="text-base leading-none">🎵</span>,
  },
  {
    name: "WhatsApp",
    bg: "#25D366",
    shareUrl: (text: string) => `whatsapp://send?text=${encodeURIComponent(text)}`,
    fallbackUrl: (_text: string) => "itms-apps://itunes.apple.com/app/id310633997",
    copyBeforeOpen: false,
    useWindowOpen: false,
    icon: <span className="text-white font-black text-sm leading-none">W</span>,
  },
  {
    name: "Gmail",
    bg: "#EA4335",
    shareUrl: (text: string) =>
      `googlegmail://co?subject=${encodeURIComponent("Check out My Digital Closet")}&body=${encodeURIComponent(text)}`,
    fallbackUrl: (_text: string) => "itms-apps://itunes.apple.com/app/id422689480",
    copyBeforeOpen: false,
    useWindowOpen: false,
    icon: <span className="text-base leading-none">📧</span>,
  },
  {
    name: "X",
    bg: "#000000",
    // twitter:// for the app; https: fallback opens in Safari via window.open
    shareUrl: (text: string) => `twitter://post?message=${encodeURIComponent(text)}`,
    fallbackUrl: (text: string) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
    copyBeforeOpen: false,
    useWindowOpen: false,
    icon: <span className="text-white font-black text-sm leading-none">𝕏</span>,
  },
];

export function CopyLinkSheet({ open, onClose, url }: Props) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [copiedApp, setCopiedApp] = useState<string | null>(null);

  // Reset inputs whenever the sheet opens
  React.useEffect(() => {
    if (open) setValues({});
  }, [open]);

  const defaultText = `✨ Love This App!\nCheck Out My Digital Closet:\n${url}`;
  const getValue = (name: string) =>
    values[name] !== undefined ? values[name] : defaultText;

  async function handleShare(app: (typeof APPS)[number], text: string) {
    const primary = app.shareUrl(text);
    const fallback = app.fallbackUrl ? app.fallbackUrl(text) : null;

    // Copy to clipboard for all apps.
    try { await navigator.clipboard.writeText(text); } catch {}

    // Show feedback on the button.
    setCopiedApp(app.name);
    setTimeout(() => setCopiedApp(null), 2500);

    // Open immediately — iOS blocks any URL open inside a setTimeout.
    if (app.useWindowOpen) {
      // sms: must use window.open(_system) on iOS.
      window.open(primary, "_system");
    } else {
      // App.openUrl for custom URL schemes (fb://, instagram://, whatsapp://, etc.)
      // It resolves without throwing even on failure, so we can't use try/catch to
      // detect failure. Fire primary; if there's a fallback (App Store or https web),
      // use window.open for https URLs and App.openUrl for itms-apps:// URLs.
      await App.openUrl({ url: primary });
      if (fallback) {
        // https:// fallbacks (X web intent) need window.open; itms-apps:// needs App.openUrl.
        // Both fire after a short delay so primary gets a chance to open first.
        // On a device with the app installed, the app is already open and the fallback is a no-op.
        setTimeout(() => {
          if (fallback.startsWith("https://")) {
            window.open(fallback, "_system");
          } else {
            App.openUrl({ url: fallback }).catch(() => {});
          }
        }, 1500);
      }
    }
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
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_e, info) => {
              if (info.offset.y > 80 || info.velocity.y > 400) onClose();
            }}
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
                                   active:opacity-80 transition-all min-w-[64px] text-center"
                        style={{ background: app.bg }}
                      >
                        {copiedApp === app.name ? "Copied! Paste to Post." : "Share"}
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
