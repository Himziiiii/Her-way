// src/components/trip/CheckInAlertModal.jsx
import { useEffect, useState } from 'react';
import { BellRing, CheckCircle2, ShieldAlert } from 'lucide-react';

function CheckInDialogContent({
  graceSeconds,
  onConfirmSafe,
  onEscalateMissed,
  onTriggerSos,
}) {
  const [secondsLeft, setSecondsLeft] = useState(graceSeconds);

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onEscalateMissed?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [onEscalateMissed]);

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="checkin-dialog-title"
    >
      <div className="w-full max-w-sm rounded-2xl border border-amber-300 bg-white p-5 text-center shadow-2xl">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <BellRing className="h-6 w-6 animate-bounce" />
        </div>

        <h2 id="checkin-dialog-title" className="mt-3 text-base font-extrabold text-slate-900">
          Scheduled Safety Check-In
        </h2>
        <p className="mt-1 text-xs text-slate-600">
          Tap below to confirm your trip is going smoothly. Your live link will show a{' '}
          <strong>Missed Check-In</strong> alert in{' '}
          <span className="font-mono font-bold text-amber-700">{secondsLeft}s</span>.
        </p>

        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={onConfirmSafe}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-xs hover:bg-emerald-700"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>I&apos;m Safe — Continue Trip</span>
          </button>

          <button
            type="button"
            onClick={onTriggerSos}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100"
          >
            <ShieldAlert className="h-4 w-4" />
            <span>Need Help — Trigger SOS</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CheckInAlertModal({
  isOpen,
  graceSeconds = 60,
  onConfirmSafe,
  onEscalateMissed,
  onTriggerSos,
}) {
  if (!isOpen) return null;

  return (
    <CheckInDialogContent
      key={graceSeconds}
      graceSeconds={graceSeconds}
      onConfirmSafe={onConfirmSafe}
      onEscalateMissed={onEscalateMissed}
      onTriggerSos={onTriggerSos}
    />
  );
}