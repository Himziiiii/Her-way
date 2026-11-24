// src/components/layout/TopBar.jsx
import { Link, useLocation } from 'react-router-dom';
import {
  ShieldCheck,
  Compass,
  Sparkles,
  Users,
  UserCheck,
  ShieldAlert,
  LogIn,
} from 'lucide-react';
import { useAuth } from '../../context/useAuth';

export default function TopBar({ onOpenSosModal, activeTrip = null }) {
  const location = useLocation();
  const { user, profile } = useAuth();

  const isNav = location.pathname === '/navigate';
  const isIntro = location.pathname === '/';
  const isCommunity = location.pathname === '/community';
  const isProfile = location.pathname === '/profile';

  return (
    <header className="sticky top-0 z-[700] border-b border-rose-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ec1c68] text-white shadow-xs">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-base font-extrabold tracking-tight text-[#e11d63]">
                HerWay
              </span>
              <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-[#ec1c68]">
                SAFE NAV
              </span>
            </div>
            <p className="hidden text-[11px] text-slate-500 sm:block">
              Community-verified safer routes &amp; live trip sharing
            </p>
          </div>
        </Link>

        {/* Navigation + SOS */}
        <nav aria-label="Primary navigation" className="flex items-center gap-1.5 sm:gap-2">
          <Link
            to="/"
            className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition sm:px-3 ${
              isIntro
                ? 'bg-rose-50 text-[#ec1c68] ring-1 ring-rose-200'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5 text-[#ec1c68]" />
            <span>Intro</span>
          </Link>

          <Link
            to="/navigate"
            className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition sm:px-3 ${
              isNav
                ? 'bg-rose-50 text-[#ec1c68] ring-1 ring-rose-200'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Compass className="h-3.5 w-3.5" />
            <span>Navigator</span>
          </Link>

          <Link
            to="/community"
            className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition sm:px-3 ${
              isCommunity
                ? 'bg-rose-50 text-[#ec1c68] ring-1 ring-rose-200'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Users className="h-3.5 w-3.5 text-[#ec1c68]" />
            <span>Community</span>
          </Link>

          <Link
            to="/profile"
            className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition sm:px-3 ${
              isProfile
                ? 'bg-rose-50 text-[#ec1c68] ring-1 ring-rose-200'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {user ? (
              <>
                <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                <span className="max-w-[100px] truncate">
                  {profile?.display_name || 'Safety Setup'}
                </span>
              </>
            ) : (
              <>
                <LogIn className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign In / Safety</span>
                <span className="sm:hidden">Safety</span>
              </>
            )}
          </Link>

          {typeof onOpenSosModal === 'function' && (
            <button
              type="button"
              onClick={onOpenSosModal}
              className={`inline-flex cursor-pointer items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-extrabold text-white shadow-xs transition ${
                activeTrip?.status === 'sos_triggered'
                  ? 'animate-pulse bg-rose-700'
                  : 'bg-[#ec1c68] hover:bg-[#d8165d]'
              }`}
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              <span>SOS</span>
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}