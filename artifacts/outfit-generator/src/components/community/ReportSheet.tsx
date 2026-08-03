/**
 * ReportSheet — bottom sheet for reporting a public post.
 *
 * Requires the reporter to be signed in.
 * Prevents duplicate reports and self-reports (enforced by DB UNIQUE constraint
 * and the caller hiding the "Report" option for own content).
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flag, Loader2, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { submitReport } from "@/lib/supabase";

type ReportReason = "nudity" | "harassment" | "spam" | "copyright" | "other";

const REASONS: { value: ReportReason; label: string }[] = [
  { value: "nudity",      label: "Nudity or sexual content" },
  { value: "harassment",  label: "Harassment" },
  { value: "spam",        label: "Spam" },
  { value: "copyright",   label: "Copyright infringement" },
  { value: "other",       label: "Other" },
];

interface ReportSheetProps {
  postId: string;
  postType: "item" | "outfit";
  onClose: () => void;
}

export function ReportSheet({ postId, postType, onClose }: ReportSheetProps) {
  const { user } = useAuth();
  const [selected, setSelected]   = useState<ReportReason | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]           = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!selected || !user) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitReport({ postId, postType, reason: selected, reporterId: user.id });
      setDone(true);
      setTimeout(onClose, 1800);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      // Unique constraint violation = already reported
      setError(msg.includes("duplicate") ? "You've already reported this." : msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 bg-black/40 z-[60]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      {/* Sheet */}
      <motion.div
        className="fixed bottom-0 left-0 right-0 z-[61] bg-white rounded-t-3xl border-t-2 border-black p-6 pb-safe"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
      >
        {done ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <CheckCircle2 className="w-10 h-10 text-green-500" />
            <p className="font-bold text-base">Report submitted</p>
            <p className="text-sm text-black/50 text-center">
              Thank you. We'll review this post shortly.
            </p>
          </div>
        ) : !user ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <Flag className="w-8 h-8 text-black/30" />
            <p className="font-bold">Sign in to report</p>
            <p className="text-sm text-black/50">You need an account to submit a report.</p>
            <button
              onClick={onClose}
              className="mt-2 px-6 py-2.5 border-2 border-black rounded-xl font-bold text-sm
                         bg-primary shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                         active:shadow-none active:translate-x-0.5 active:translate-y-0.5 transition-all"
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-5">
              <Flag className="w-5 h-5" />
              <h2 className="font-display font-bold text-lg uppercase tracking-tight">Report</h2>
            </div>

            <div className="flex flex-col gap-2 mb-5">
              {REASONS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setSelected(r.value)}
                  className={`w-full text-left px-4 py-3 rounded-xl border-2 font-bold text-sm transition-all
                    ${selected === r.value
                      ? "border-black bg-primary shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                      : "border-black/20 bg-white hover:border-black/40"}`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {error && (
              <p className="text-xs text-red-500 font-bold mb-3">{error}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 border-2 border-black/20 rounded-xl font-bold text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!selected || submitting}
                className="flex-1 py-3 border-2 border-black rounded-xl font-bold text-sm
                           bg-black text-white disabled:opacity-40
                           shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)]
                           active:shadow-none active:translate-x-0.5 active:translate-y-0.5 transition-all
                           flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit Report"}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
