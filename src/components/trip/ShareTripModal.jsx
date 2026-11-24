// src/components/trip/ShareTripModal.jsx
import { useState } from 'react';
import {
  X,
  Copy,
  Check,
  Share2,
  ExternalLink,
  MessageCircle,
  ShieldCheck,
} from 'lucide-react';
import { buildShareTripUrl } from '../../services/tripService';

export default function ShareTripModal({ isOpen, onClose, trip }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !trip) return null;

  const shareUrl = trip.shareUrl || buildShareTripUrl(trip.share_token);
  const shareMessage = `Track my live HerWay trip to ${trip.dest_label} (Safety Score: ${trip.safety_score}/100): ${shareUrl}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback selection handled via readOnly input
    }
  }

  async function handleNativeShare() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'HerWay Live Safe Trip',
          text: `Follow my live trip to ${trip.dest_label} on HerWay:`,
          url: shareUrl,
        });
      } catch {
        // User dismissed share sheet
      }
    } else {
      handleCopyLink();
    }
  }

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-end justify-center bg-slate-900/50 p-3 backdrop-blur-xs sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-trip-title"
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <div>
              <h2 id="share-trip-title" className="text-sm font-bold text-slate-900">
                Share Live Tracking Link
              </h2>
              <p className="text-xs text-slate-500">Anyone with this link can watch live—no login needed</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close share dialog"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
            <p className="text-[11px] font-semibold text-slate-500">Destination</p>
            <p className="mt-0.5 font-bold text-slate-900">{trip.dest_label}</p>
            <p className="mt-1 text-[11px] text-emerald-700">
              Route Safety Score: <strong>{trip.safety_score}/100</strong>
            </p>
          </div>

          {/* Copyable Link Box */}
          <div>
            <label htmlFor="herway-share-url" className="mb-1 block text-xs font-semibold text-slate-700">
              Live Tracking URL
            </label>
            <div className="flex items-center gap-2">
              <input
                id="herway-share-url"
                type="text"
                readOnly
                value={shareUrl}
                onFocus={(e) => e.target.select()}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700 focus:border-rose-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Share Actions */}
          <div className="grid grid-cols-2 gap-2.5">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              <MessageCircle className="h-4 w-4" />
              <span>WhatsApp</span>
            </a>

            <button
              type="button"
              onClick={handleNativeShare}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              <Share2 className="h-4 w-4 text-rose-600" />
              <span>More Apps</span>
            </button>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
            <a
              href={`/track/${encodeURIComponent(trip.share_token)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-sky-700 hover:underline"
            >
              <span>Preview live tracker page</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </a>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-rose-600 px-4 py-1.5 font-semibold text-white hover:bg-rose-700"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}