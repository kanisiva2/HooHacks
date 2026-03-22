import Link from "next/link";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import {
  ArrowRight,
  Bot,
  Cable,
  GitBranch,
  MessageSquareMore,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-landing-heading",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-landing-mono",
  weight: ["400", "500"],
});

const featureCards = [
  {
    title: "Live Meeting Operator",
    copy:
      "Sprynt joins the outage call, tracks who said what, and turns the room into a structured incident timeline in real time.",
    icon: Bot,
  },
  {
    title: "Action Items That Don’t Drift",
    copy:
      "Assignments become proposed tasks, sync into Jira when approved, and stay aligned as ownership changes during the call.",
    icon: MessageSquareMore,
  },
  {
    title: "Code-Aware Deep Dive",
    copy:
      "Recent commits, repo structure, suspect files, and line-level evidence are surfaced while the meeting is still happening.",
    icon: GitBranch,
  },
];

const workflow = [
  "Joins Zoom, Meet, or Teams through Skribby and starts tracking the conversation.",
  "Extracts owners, decisions, and repo signals while the team is still debugging.",
  "Streams live updates to the dashboard so everyone shares the same operational picture.",
];

export default function Home() {
  return (
    <main
      className={`${spaceGrotesk.variable} ${ibmPlexMono.variable} min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(245,118,87,0.14),_transparent_28%),radial-gradient(circle_at_85%_15%,_rgba(0,180,170,0.12),_transparent_24%),linear-gradient(180deg,_#f7f3eb_0%,_#f2efe8_42%,_#ece9e1_100%)] text-slate-950`}
    >
      <div className="landing-grid pointer-events-none absolute inset-0 opacity-60" />
      <div className="landing-orb absolute left-[-8rem] top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,_rgba(245,118,87,0.26),_transparent_68%)] blur-3xl" />
      <div className="landing-orb absolute right-[-5rem] top-36 h-80 w-80 rounded-full bg-[radial-gradient(circle,_rgba(0,166,160,0.18),_transparent_70%)] blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-6 pb-12 pt-6 md:px-10 lg:px-12">
        <header className="mb-12 flex items-center justify-between gap-4 rounded-full border border-white/60 bg-white/55 px-4 py-3 backdrop-blur-xl md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(15,23,42,0.22)]">
              S
            </div>
            <div>
              <p className="font-[var(--font-landing-heading)] text-sm font-semibold tracking-[0.2em] text-slate-900 uppercase">
                Sprynt
              </p>
              <p className="text-xs text-slate-600">AI Incident Operator</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button nativeButton={false} variant="ghost" render={<Link href="/login" />}>
              Sign In
            </Button>
            <Button nativeButton={false} render={<Link href="/login" />}>
              Sign Up
            </Button>
          </div>
        </header>

        <section className="grid flex-1 items-center gap-12 pb-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="max-w-2xl">
            <Badge
              variant="outline"
              className="mb-6 rounded-full border-slate-300/80 bg-white/75 px-4 py-1 text-[11px] tracking-[0.22em] uppercase text-slate-700"
            >
              Built For Live Outage Calls
            </Badge>

            <h1 className="font-[var(--font-landing-heading)] text-5xl font-semibold leading-[0.92] tracking-[-0.06em] text-slate-950 md:text-7xl">
              The incident room that
              <span className="block text-[rgba(219,87,52,0.96)]">actually keeps up.</span>
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-700 md:text-xl">
              Sprynt joins the meeting, captures the conversation, syncs action items, and
              investigates the repo while your team is still on the call.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button
                nativeButton={false}
                size="lg"
                className="rounded-full px-5 shadow-[0_16px_35px_rgba(15,23,42,0.16)]"
                render={<Link href="/login" />}
              >
                Start With Sprynt
                <ArrowRight className="ml-1" />
              </Button>
              <Button
                nativeButton={false}
                size="lg"
                variant="outline"
                className="rounded-full border-slate-300 bg-white/70 px-5"
                render={<Link href="/login" />}
              >
                See The Flow
              </Button>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/70 bg-white/65 p-4 backdrop-blur-sm">
                <p className="font-[var(--font-landing-mono)] text-xs uppercase tracking-[0.2em] text-slate-500">
                  Meeting
                </p>
                <p className="mt-2 text-sm font-medium text-slate-900">Joins the call as an operator</p>
              </div>
              <div className="rounded-3xl border border-white/70 bg-white/65 p-4 backdrop-blur-sm">
                <p className="font-[var(--font-landing-mono)] text-xs uppercase tracking-[0.2em] text-slate-500">
                  Tasks
                </p>
                <p className="mt-2 text-sm font-medium text-slate-900">Turns discussion into structured work</p>
              </div>
              <div className="rounded-3xl border border-white/70 bg-white/65 p-4 backdrop-blur-sm">
                <p className="font-[var(--font-landing-mono)] text-xs uppercase tracking-[0.2em] text-slate-500">
                  Evidence
                </p>
                <p className="mt-2 text-sm font-medium text-slate-900">Surfaces likely code paths live</p>
              </div>
            </div>
          </div>

          <div className="relative lg:pl-8">
            <div className="landing-float relative mx-auto max-w-xl rounded-[2rem] border border-slate-200/70 bg-[linear-gradient(180deg,rgba(19,27,45,0.97)_0%,rgba(18,24,38,0.94)_100%)] p-4 text-slate-100 shadow-[0_40px_100px_rgba(15,23,42,0.28)]">
              <div className="absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" />
              <div className="mb-4 flex items-center justify-between rounded-[1.5rem] border border-white/10 bg-white/5 px-4 py-3">
                <div>
                  <p className="font-[var(--font-landing-heading)] text-sm font-semibold tracking-[0.18em] uppercase text-white/80">
                    Incident Session
                  </p>
                  <p className="text-xs text-slate-400">Payments API latency spike</p>
                </div>
                <div className="rounded-full bg-emerald-400/18 px-3 py-1 text-xs text-emerald-200">
                  Live
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="font-[var(--font-landing-mono)] text-[11px] uppercase tracking-[0.22em] text-slate-400">
                      Transcript
                    </p>
                    <span className="rounded-full bg-white/8 px-2 py-1 text-[10px] text-slate-300">
                      diarized
                    </span>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div className="rounded-2xl bg-white/6 p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-teal-200">Owen</p>
                      <p className="mt-1 text-slate-100">
                        Error rates are climbing after the queue deploy. Sprynt, track rollback owner.
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white/6 p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-orange-200">Sprynt</p>
                      <p className="mt-1 text-slate-100">
                        Proposed task created. Investigating recent commit history in `payments-worker`.
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white/6 p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-sky-200">Deep Dive</p>
                      <p className="mt-1 text-slate-100">
                        Suspect file ranked: `workers/retry_consumer.py` with commit evidence from the last 32 minutes.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-orange-300" />
                      <p className="font-[var(--font-landing-heading)] text-sm font-semibold">
                        Live Task Board
                      </p>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="rounded-2xl bg-orange-400/10 p-3">
                        <p className="text-orange-200">Rollback queue consumer</p>
                        <p className="mt-1 text-xs text-slate-300">Owner: Nina · Proposed</p>
                      </div>
                      <div className="rounded-2xl bg-emerald-400/10 p-3">
                        <p className="text-emerald-200">Confirm safe deploy window</p>
                        <p className="mt-1 text-xs text-slate-300">Owner: Alex · Synced to Jira</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-teal-200" />
                      <p className="font-[var(--font-landing-heading)] text-sm font-semibold">
                        Investigation Stream
                      </p>
                    </div>
                    <div className="space-y-2 text-xs text-slate-300">
                      <p className="rounded-full border border-white/8 bg-white/6 px-3 py-2">
                        Ranking suspect files from repo tree + commits
                      </p>
                      <p className="rounded-full border border-white/8 bg-white/6 px-3 py-2">
                        Matching spoken action items to Jira assignees
                      </p>
                      <p className="rounded-full border border-white/8 bg-white/6 px-3 py-2">
                        Answering in-meeting questions through chat
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="landing-float-delayed absolute -bottom-10 -left-4 rounded-[1.75rem] border border-slate-200/80 bg-white/85 p-4 shadow-[0_20px_50px_rgba(15,23,42,0.12)] backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-teal-100 p-2 text-teal-700">
                  <Cable className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-[var(--font-landing-mono)] text-[11px] uppercase tracking-[0.22em] text-slate-500">
                    Real-time Fabric
                  </p>
                  <p className="text-sm font-medium text-slate-900">Meeting, Jira, GitHub, dashboard</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 border-t border-slate-300/70 py-8 md:grid-cols-3">
          {featureCards.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="rounded-[1.75rem] border border-white/75 bg-white/62 p-5 backdrop-blur-sm"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="font-[var(--font-landing-heading)] text-xl font-semibold text-slate-950">
                  {item.title}
                </h2>
                <p className="mt-3 text-sm leading-7 text-slate-700">{item.copy}</p>
              </div>
            );
          })}
        </section>

        <section className="grid gap-6 py-8 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-[2rem] border border-slate-300/70 bg-slate-950 p-8 text-white shadow-[0_24px_60px_rgba(15,23,42,0.22)]">
            <p className="font-[var(--font-landing-mono)] text-xs uppercase tracking-[0.22em] text-white/55">
              Why Teams Use It
            </p>
            <p className="mt-4 font-[var(--font-landing-heading)] text-3xl font-semibold leading-tight">
              Fewer dropped details. Faster alignment. Better incident memory.
            </p>
            <p className="mt-4 max-w-md text-sm leading-7 text-white/70">
              Sprynt is designed for the exact moment when engineers are juggling live discussion,
              repo context, and follow-up tasks at once.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {workflow.map((step, index) => (
              <div
                key={step}
                className="rounded-[1.75rem] border border-slate-300/70 bg-white/68 p-5 backdrop-blur-sm"
              >
                <p className="font-[var(--font-landing-mono)] text-[11px] uppercase tracking-[0.2em] text-slate-500">
                  0{index + 1}
                </p>
                <p className="mt-4 text-sm leading-7 text-slate-800">{step}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
