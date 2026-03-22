"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Gauge, Settings, Siren } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/incidents", label: "Incidents", icon: Siren },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden min-h-screen w-64 flex-col border-r border-slate-200/70 bg-white/60 backdrop-blur-sm md:flex">
      <div className="flex items-center gap-2.5 border-b border-slate-200/70 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-950 text-xs font-semibold text-white shadow-[0_8px_20px_rgba(15,23,42,0.18)]">
          S
        </div>
        <p className="text-sm font-semibold tracking-[0.2em] uppercase text-slate-900">
          Sprynt
        </p>
      </div>

      <nav className="flex-1 space-y-1 px-3 pt-5">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
          Navigation
        </p>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
                isActive
                  ? "bg-slate-950 text-white shadow-[0_4px_12px_rgba(15,23,42,0.15)]"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
              )}
            >
              <Icon
                className={cn(
                  "h-[18px] w-[18px] transition-colors",
                  isActive
                    ? "text-white"
                    : "text-slate-400 group-hover:text-slate-700",
                )}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-200/70 px-4 py-4">
        <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
          <Activity className="h-3.5 w-3.5 text-emerald-500" />
          <span className="text-xs text-slate-500">System Online</span>
        </div>
      </div>
    </aside>
  );
}
