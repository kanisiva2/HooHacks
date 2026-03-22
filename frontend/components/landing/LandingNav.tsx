"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 48);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed left-1/2 z-50 flex -translate-x-1/2 items-center justify-between gap-4 rounded-full border backdrop-blur-xl transition-all duration-300 ease-out ${
        scrolled
          ? "top-3 w-[min(92%,72rem)] border-white/70 bg-white/78 px-3 py-1.5 shadow-[0_8px_30px_rgba(15,23,42,0.10)] md:px-5"
          : "top-6 w-[min(90%,72rem)] border-white/60 bg-white/55 px-4 py-3 shadow-none md:px-6"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <div
          className={`flex items-center justify-center rounded-2xl bg-slate-950 font-semibold text-white transition-all duration-300 ${
            scrolled
              ? "h-7 w-7 text-[11px] shadow-[0_8px_20px_rgba(15,23,42,0.18)]"
              : "h-10 w-10 text-sm shadow-[0_14px_30px_rgba(15,23,42,0.22)]"
          }`}
        >
          S
        </div>
        <p
          className={`font-[var(--font-landing-heading)] font-semibold tracking-[0.2em] text-slate-900 uppercase transition-all duration-300 ${
            scrolled ? "text-xs" : "text-sm"
          }`}
        >
          Sprynt
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button
          nativeButton={false}
          variant="ghost"
          size={scrolled ? "sm" : "default"}
          render={<Link href="/login" />}
        >
          Sign In
        </Button>
        <Button
          nativeButton={false}
          size={scrolled ? "sm" : "default"}
          render={<Link href="/login" />}
        >
          Sign Up
        </Button>
      </div>
    </header>
  );
}
