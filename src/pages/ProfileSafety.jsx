// src/pages/ProfileSafety.jsx
import { useState } from 'react';
import {
  ShieldCheck,
  Users,
  Plus,
  Trash2,
  Save,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sliders,
} from 'lucide-react';
import TopBar from '../components/layout/TopBar';
import { useAuth } from '../context/useAuth';

function AuthenticatedSafetyForm({ user, profile, signOut, updateSafetyProfile }) {
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [prefs, setPrefs] = useState({
    prioritize_lighting: profile?.safety_preferences?.prioritize_lighting ?? true,
    avoid_deserted: profile?.safety_preferences?.avoid_deserted ?? true,
    night_mode_strict: profile?.safety_preferences?.night_mode_strict ?? true,
    checkin_interval_mins: profile?.safety_preferences?.checkin_interval_mins ?? 15,
  });
  const [contacts, setContacts] = useState(
    Array.isArray(profile?.emergency_contacts) ? profile.emergency_contacts : []
  );

  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactRelation, setNewContactRelation] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState('');
  const [saveError, setSaveError] = useState('');

  function handleAddContact(e) {
    e.preventDefault();
    const cleanName = newContactName.trim();
    const cleanPhone = newContactPhone.trim();
    if (!cleanName || !cleanPhone) return;

    setContacts((prev) => [
      ...prev,
      {
        name: cleanName,
        phone: cleanPhone,
        relation: newContactRelation.trim() || 'Trusted Contact',
      },
    ]);
    setNewContactName('');
    setNewContactPhone('');
    setNewContactRelation('');
  }

  function handleRemoveContact(index) {
    setContacts((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSaveSettings() {
    setSaveFeedback('');
    setSaveError('');
    setIsSaving(true);
    try {
      await updateSafetyProfile({
        displayName,
        emergencyContacts: contacts,
        safetyPreferences: prefs,
      });
      setSaveFeedback('Safety preferences and trusted contacts saved.');
      setTimeout(() => setSaveFeedback(''), 3500);
    } catch (err) {
      setSaveError(err?.message || 'Unable to save settings.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <p className="text-xs font-semibold text-rose-600">Signed in as</p>
          <h1 className="text-base font-extrabold text-slate-900">{user.email}</h1>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Sign Out</span>
        </button>
      </div>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Sliders className="h-4 w-4 text-rose-600" />
          <h2 className="text-sm font-bold text-slate-900">
            Route Safety Scoring &amp; Check-In Timer
          </h2>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-700">Display Name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full max-w-sm rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-rose-500 focus:outline-none"
          />
        </div>

        <div className="space-y-2.5">
          {[
            {
              key: 'prioritize_lighting',
              title: 'Prioritize Well-Lit Roads',
              desc: 'Boost routes with mapped streetlights and positive lighting updates.',
            },
            {
              key: 'avoid_deserted',
              title: 'Penalize Deserted Stretches',
              desc: 'Down-rank low-foot-traffic lanes and favor active commercial corridors.',
            },
            {
              key: 'night_mode_strict',
              title: 'Strict Late-Night Weighting (8 PM – 6 AM)',
              desc: 'Increase caution penalties automatically after 8 PM.',
            },
          ].map((item) => (
            <label
              key={item.key}
              className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border border-slate-200/80 bg-slate-50/50 p-3"
            >
              <div>
                <p className="text-xs font-bold text-slate-900">{item.title}</p>
                <p className="text-[11px] text-slate-500">{item.desc}</p>
              </div>
              <input
                type="checkbox"
                checked={Boolean(prefs[item.key])}
                onChange={(e) =>
                  setPrefs((prev) => ({ ...prev, [item.key]: e.target.checked }))
                }
                className="mt-1 h-4 w-4 accent-rose-600"
              />
            </label>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-900">Active Trip Check-In Interval</span>
            <span className="rounded-full bg-rose-100 px-2.5 py-0.5 font-bold text-rose-700">
              Every {prefs.checkin_interval_mins} mins
            </span>
          </div>
          <input
            type="range"
            min={5}
            max={45}
            step={5}
            value={prefs.checkin_interval_mins}
            onChange={(e) =>
              setPrefs((prev) => ({
                ...prev,
                checkin_interval_mins: Number(e.target.value),
              }))
            }
            className="mt-2 w-full accent-rose-600"
          />
          <div className="mt-1 flex justify-between text-[10px] text-slate-400">
            <span>5 min (Frequent)</span>
            <span>25 min</span>
            <span>45 min</span>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-rose-600" />
          <div>
            <h2 className="text-sm font-bold text-slate-900">Trusted Emergency Contacts</h2>
            <p className="text-xs text-slate-500">
              Shown inside your quick SOS panel for 1-tap calling during trips
            </p>
          </div>
        </div>

        <form onSubmit={handleAddContact} className="grid grid-cols-1 gap-2 sm:grid-cols-4">
          <input
            type="text"
            placeholder="Name (e.g., Mom)"
            value={newContactName}
            onChange={(e) => setNewContactName(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-rose-500 focus:outline-none"
          />
          <input
            type="tel"
            placeholder="Phone (+91...)"
            value={newContactPhone}
            onChange={(e) => setNewContactPhone(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-rose-500 focus:outline-none"
          />
          <input
            type="text"
            placeholder="Relation (Sister, Friend)"
            value={newContactRelation}
            onChange={(e) => setNewContactRelation(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-rose-500 focus:outline-none"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Contact</span>
          </button>
        </form>

        {contacts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">
            No trusted contacts added yet. Add 1–3 people you rely on during late commutes.
          </p>
        ) : (
          <ul className="space-y-2">
            {contacts.map((c, idx) => (
              <li
                key={`${c.phone}-${idx}`}
                className="flex items-center justify-between rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs"
              >
                <div>
                  <p className="font-bold text-slate-900">{c.name}</p>
                  <p className="text-[11px] text-slate-500">
                    {c.relation} &bull; {c.phone}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveContact(idx)}
                  aria-label={`Remove ${c.name}`}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {saveError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-700">
          {saveError}
        </div>
      )}
      {saveFeedback && (
        <div className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-800">
          <CheckCircle2 className="h-4 w-4" />
          <span>{saveFeedback}</span>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSaveSettings}
          disabled={isSaving}
          className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-rose-700 disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          <span>Save Safety Settings</span>
        </button>
      </div>
    </>
  );
}

export default function ProfileSafety({ onOpenSOS }) {
  const { user, profile, loading, signInWithEmail, signUpWithEmail, signOut, updateSafetyProfile } =
    useAuth();

  const [authMode, setAuthMode] = useState('signin');
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authMsg, setAuthMsg] = useState('');
  const [authError, setAuthError] = useState('');

  async function handleAuthSubmit(e) {
    e.preventDefault();
    setAuthError('');
    setAuthMsg('');
    setAuthBusy(true);
    try {
      if (authMode === 'signin') {
        await signInWithEmail(email, password);
      } else {
        const res = await signUpWithEmail({
          email,
          password,
          displayName: displayNameInput,
        });
        if (!res?.session) {
          setAuthMsg(
            'Account created! Check your email inbox if confirmation is enabled, then sign in.'
          );
        }
      }
    } catch (err) {
      setAuthError(err?.message || 'Authentication failed.');
    } finally {
      setAuthBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-rose-50/30 text-slate-900">
      <TopBar onOpenSosModal={onOpenSOS} />

      <main className="mx-auto max-w-3xl space-y-5 p-4 py-6">
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
            Loading safety profile...
          </div>
        ) : !user ? (
          <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-base font-extrabold text-slate-900">
                  {authMode === 'signin' ? 'Sign in to HerWay' : 'Create HerWay Account'}
                </h1>
                <p className="text-xs text-slate-500">
                  Post daily route updates, save trusted contacts &amp; share live trip links
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signin');
                  setAuthError('');
                }}
                className={`rounded-lg py-1.5 text-xs font-semibold transition ${
                  authMode === 'signin' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signup');
                  setAuthError('');
                }}
                className={`rounded-lg py-1.5 text-xs font-semibold transition ${
                  authMode === 'signup' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                Create Account
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="mt-4 space-y-3">
              {authMode === 'signup' && (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Display Name
                  </label>
                  <input
                    type="text"
                    required
                    value={displayNameInput}
                    onChange={(e) => setDisplayNameInput(e.target.value)}
                    placeholder="How you appear on your profile"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none"
                />
              </div>

              {authError && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              {authMsg && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-800">
                  {authMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={authBusy}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {authBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>{authMode === 'signin' ? 'Sign In' : 'Create Account'}</span>
              </button>
            </form>
          </div>
        ) : (
          <AuthenticatedSafetyForm
            key={profile?.id || user.id}
            user={user}
            profile={profile}
            signOut={signOut}
            updateSafetyProfile={updateSafetyProfile}
          />
        )}
      </main>
    </div>
  );
}