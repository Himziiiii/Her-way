// src/pages/IntroLanding.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import {
  Shield,
  Target,
  Lightbulb,
  Settings,
  ArrowRight,
  Radio,
  ShieldAlert,
} from 'lucide-react';

export default function IntroLanding({ onNavigateToMap, onOpenSOS, onOpenLiveShare }) {
  const scrollToSection = (e, id) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div
      className="min-h-screen text-slate-900"
      style={{
        background: 'linear-gradient(180deg, #fff5f8 0%, #ffeef4 52%, #fff8fa 100%)',
      }}
    >
      {/* Top Header matching deployed HerWay */}
      <header className="sticky top-0 z-40 border-b border-rose-100/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Link to="/" className="inline-flex items-center gap-2">
            <Shield className="h-6 w-6 stroke-[2.4] text-[#e11d63]" />
            <span className="text-xl font-extrabold tracking-tight text-[#e11d63]">
              HerWay
            </span>
          </Link>

          <nav className="flex items-center gap-5 sm:gap-7">
            <a
              href="#about"
              onClick={(e) => scrollToSection(e, 'about')}
              className="text-sm font-medium text-slate-700 transition hover:text-[#e11d63]"
            >
              About
            </a>
            <a
              href="#features"
              onClick={(e) => scrollToSection(e, 'features')}
              className="text-sm font-medium text-slate-700 transition hover:text-[#e11d63]"
            >
              Features
            </a>
            <button
              type="button"
              onClick={onNavigateToMap}
              className="cursor-pointer rounded-full bg-gradient-to-r from-[#ec1c68] to-[#db145c] px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-rose-500/25 transition hover:brightness-105 active:scale-[0.99]"
            >
              Open Web App
            </button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main id="about" className="mx-auto max-w-6xl px-4 pt-12 pb-16 sm:px-6 sm:pt-16">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-rose-200/80 bg-white/90 px-4 py-1.5 text-xs font-semibold text-[#d81b60] shadow-xs">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ec1c68]" />
            <span>India&apos;s First AI Safety &amp; Wellness Ecosystem</span>
          </div>

          <h1 className="mt-6 text-4xl font-black tracking-tight text-[#0f172a] sm:text-6xl sm:leading-[1.08]">
            Navigate Life,
            <span className="mt-1 block text-[#ec1c68]">Her Way.</span>
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
            We combine real-time AI route mapping with an active SOS shield and holistic
            safety intelligence to give you the ultimate tool for independence and confidence.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={onNavigateToMap}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#ec1c68] px-6 py-3 text-sm font-bold text-white shadow-md shadow-rose-500/20 transition hover:bg-[#d8165d]"
            >
              <span>Launch Safe Route Navigator</span>
              <ArrowRight className="h-4 w-4" />
            </button>

            {typeof onOpenLiveShare === 'function' && (
              <button
                type="button"
                onClick={onOpenLiveShare}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-rose-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-rose-50"
              >
                <Radio className="h-4 w-4 text-[#ec1c68]" />
                <span>Live Tracking</span>
              </button>
            )}

            {typeof onOpenSOS === 'function' && (
              <button
                type="button"
                onClick={onOpenSOS}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-[#d8165d] transition hover:bg-rose-100"
              >
                <ShieldAlert className="h-4 w-4" />
                <span>SOS</span>
              </button>
            )}
          </div>
        </div>

        {/* 3 Feature Cards matching deployed HerWay */}
        <section id="features" className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="rounded-3xl border border-rose-100/90 bg-white p-7 shadow-sm transition hover:shadow-md">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-[#ec1c68]">
              <Target className="h-5 w-5" />
            </div>
            <h2 className="mt-5 text-lg font-extrabold text-slate-900">Our Aim</h2>
            <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
              To eliminate hesitation on everyday commutes by scoring routes on lighting,
              crowd activity, police proximity, and real-time community reports.
            </p>
          </div>

          <div className="rounded-3xl border border-rose-100/90 bg-white p-7 shadow-sm transition hover:shadow-md">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-[#ec1c68]">
              <Lightbulb className="h-5 w-5" />
            </div>
            <h2 className="mt-5 text-lg font-extrabold text-slate-900">Why Us</h2>
            <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
              Fastest isn&apos;t always safest. We separate live route guidance, trusted live
              location sharing, and instant SOS alerts with accurate walk and car ETAs.
            </p>
          </div>

          <div className="rounded-3xl border border-rose-100/90 bg-white p-7 shadow-sm transition hover:shadow-md">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-[#ec1c68]">
              <Settings className="h-5 w-5" />
            </div>
            <h2 className="mt-5 text-lg font-extrabold text-slate-900">How It Works</h2>
            <p className="mt-2.5 text-sm leading-relaxed text-slate-600">
              Compare candidate routes with safety scores, start animated turn-by-turn
              guidance, share a live tracking link, or log local safety updates.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}