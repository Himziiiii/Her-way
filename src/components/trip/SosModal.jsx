// src/components/trip/SosModal.jsx
import { useState } from 'react';
import {
  X,
  ShieldAlert,
  PhoneCall,
  Copy,
  Check,
  MapPin,
  Users,
} from 'lucide-react';
import { buildShareTripUrl } from '../../services/tripService';

export default function SosModal({
  isOpen,
  onClose,
  activeTrip = null,
  livePosition = null,
  emergencyContacts = [],
  onConfirmTriggerSos,
  isTriggering = false,
}) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const isAlreadySos = activeTrip?.status === 'sos_triggered';
  const lat = livePosition?.lat ?? activeTrip?.current_lat;
  const lng = livePosition?.lng ?? activeTrip?.current_lng;
  const shareUrl = activeTrip?.share_token ? buildShareTripUrl(activeTrip.share_token) : '';

  const emergencySummary = [
    'EMERGENCY SOS via HerWay.',
    typeof lat === 'number' && typeof lng === 'number'
      ? `My GPS location: https://www.openstreetmap.org/?mlat=${lat.toFixed(5)}&mlon=${lng.toFixed(5)}#map=16/${lat.toFixed(5)}/${lng.toFixed(5)}`
      : null,
    shareUrl ? `Live Trip Tracker: ${shareUrl}` : null,
  ]
    .filter(Boolean)
    .join(' ');

  async function handleCopyEmergencyText() {
    try {
      await navigator.clipboard.writeText(emergencySummary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Ignore clipboard failure
    }
  }

  return (
    <div
      className="fixed inset-0 z-[1150] flex items-end justify-center bg-slate-950/75 p-3 backdrop-blur-xs sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sos-modal-title"
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-rose-300 bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-rose-600 px-5 py-3.5 text-white">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" />
            <div>
              <h2 id="sos-modal-title" className="text-sm font-extrabold">
                Emergency SOS Controls
              </h2>
              <p className="text-[11px] text-rose-100">
                Immediate helplines &amp; live alert broadcast
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close SOS dialog"
            className="rounded-lg p-1.5 text-rose-100 hover:bg-rose-700 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {/* Active Trip SOS Broadcast */}
          {activeTrip ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5">
              <p className="text-xs font-bold text-rose-950">
                {isAlreadySos
                  ? 'SOS Alert is LIVE on your shared trip link'
                  : 'Broadcast SOS alert to everyone watching your trip link?'}
              </p>
              <p className="mt-1 text-[11px] text-rose-800">
                Switches your live tracker banner to high-priority red emergency mode with your latest GPS pin.
              </p>
              {!isAlreadySos && (
                <button
                  type="button"
                  disabled={isTriggering}
                  onClick={onConfirmTriggerSos}
                  className="mt-3 w-full rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-extrabold text-white shadow-xs hover:bg-rose-700 disabled:opacity-50"
                >
                  {isTriggering ? 'Activating SOS...' : 'ACTIVATE LIVE TRIP SOS ALERT'}
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              Start a Safe Trip from any route to broadcast a live SOS status link, or use the quick calls and coordinate copy below right now.
            </div>
          )}

          {/* Direct Emergency Calls (India) */}
          <div className="grid grid-cols-2 gap-2.5">
            <a
              href="tel:112"
              className="flex flex-col items-center justify-center rounded-xl bg-slate-900 px-3 py-3 text-center text-white hover:bg-slate-800"
            >
              <PhoneCall className="h-4 w-4 text-rose-400" />
              <span className="mt-1 text-xs font-extrabold">Call 112</span>
              <span className="text-[10px] text-slate-300">National Emergency</span>
            </a>

            <a
              href="tel:1091"
              className="flex flex-col items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-center text-rose-900 hover:bg-rose-100"
            >
              <PhoneCall className="h-4 w-4 text-rose-600" />
              <span className="mt-1 text-xs font-extrabold">Call 1091</span>
              <span className="text-[10px] text-rose-700">Women Helpline</span>
            </a>
          </div>

          {/* Saved Trusted Contacts */}
          {Array.isArray(emergencyContacts) && emergencyContacts.length > 0 && (
            <div className="space-y-1.5">
              <p className="inline-flex items-center gap-1 text-xs font-bold text-slate-700">
                <Users className="h-3.5 w-3.5 text-rose-600" />
                <span>Trusted Contacts</span>
              </p>
              <ul className="space-y-1.5">
                {emergencyContacts.map((c, idx) => (
                  <li
                    key={`${c.phone}-${idx}`}
                    className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">{c.name}</p>
                      <p className="text-[11px] text-slate-500">
                        {c.relation ? `${c.relation} • ` : ''}
                        {c.phone}
                      </p>
                    </div>
                    {c.phone && (
                      <a
                        href={`tel:${c.phone}`}
                        className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700"
                      >
                        Call
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Copy GPS Coordinates & Link */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                <MapPin className="h-3.5 w-3.5 text-rose-600" />
                Current GPS Coordinates
              </span>
              <button
                type="button"
                onClick={handleCopyEmergencyText}
                className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-800 shadow-2xs ring-1 ring-slate-200 hover:bg-slate-100"
              >
                {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                <span>{copied ? 'Copied SOS Info' : 'Copy Location + Link'}</span>
              </button>
            </div>
            <p className="mt-1 font-mono text-[11px] text-slate-600">
              {typeof lat === 'number' && typeof lng === 'number'
                ? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
                : 'Location unavailable — enable browser GPS'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}