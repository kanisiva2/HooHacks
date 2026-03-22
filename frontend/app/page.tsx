import Link from "next/link";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import {
  ArrowRight,
  Bot,
  Cable,
  GitBranch,
  MessageSquareMore,
  Mic,
  ListChecks,
  Search,
  Monitor,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LandingNav } from "@/components/landing/LandingNav";

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
    title: "Joins the Call",
    copy: "Sits in the meeting, tracks who said what, and builds a timeline as the incident unfolds.",
    icon: Bot,
  },
  {
    title: "Captures Action Items",
    copy: "Picks up assignments from the conversation, turns them into tasks, and syncs them to Jira.",
    icon: MessageSquareMore,
  },
  {
    title: "Investigates the Code",
    copy: "Finds suspect files and recent commits so your team has evidence before the call is over.",
    icon: GitBranch,
  },
];

const workflow = [
  "Joins Zoom, Meet, or Teams and starts listening.",
  "Picks out owners, decisions, and code signals as they come up.",
  "Pushes everything to a shared dashboard in real time.",
];

export default function Home() {
  return (
    <main
      className={`${spaceGrotesk.variable} ${ibmPlexMono.variable} min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(245,118,87,0.14),_transparent_28%),radial-gradient(circle_at_85%_15%,_rgba(0,180,170,0.12),_transparent_24%),linear-gradient(180deg,_#f7f3eb_0%,_#f2efe8_42%,_#ece9e1_100%)] text-slate-950`}
    >
      <div className="landing-grid pointer-events-none absolute inset-0 opacity-60" />
      <div className="landing-orb absolute left-[-8rem] top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,_rgba(245,118,87,0.26),_transparent_68%)] blur-3xl" />
      <div className="landing-orb absolute right-[-5rem] top-36 h-80 w-80 rounded-full bg-[radial-gradient(circle,_rgba(0,166,160,0.18),_transparent_70%)] blur-3xl" />

      <LandingNav />

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-6 pb-12 pt-32 md:px-10 lg:px-12">
        <section className="grid flex-1 items-center gap-12 pb-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="max-w-2xl">
            <h1 className="font-[var(--font-landing-heading)] text-5xl font-semibold leading-[0.92] tracking-[-0.06em] text-slate-950 md:text-7xl">
              You handle the call.
              <span className="block text-[rgba(219,87,52,0.96)]">Sprynt handles the rest.</span>
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-700 md:text-xl">
              Sprynt sits in the meeting, tracks the conversation, syncs tasks to Jira, and
              looks into the repo while your team is still talking.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button
                nativeButton={false}
                size="lg"
                className="rounded-full px-5 shadow-[0_16px_35px_rgba(15,23,42,0.16)]"
                render={<Link href="/login" />}
              >
                Get Started
                <ArrowRight className="ml-1" />
              </Button>
              <Button
                nativeButton={false}
                size="lg"
                variant="outline"
                className="rounded-full border-slate-300 bg-white/70 px-5"
                render={<a href="#flow" />}
              >
                See How It Works
              </Button>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/70 bg-white/65 p-4 backdrop-blur-sm">
                <p className="font-[var(--font-landing-mono)] text-xs uppercase tracking-[0.2em] text-slate-500">
                  Meeting
                </p>
                <p className="mt-2 text-sm font-medium text-slate-900">Joins as an operator</p>
              </div>
              <div className="rounded-3xl border border-white/70 bg-white/65 p-4 backdrop-blur-sm">
                <p className="font-[var(--font-landing-mono)] text-xs uppercase tracking-[0.2em] text-slate-500">
                  Tasks
                </p>
                <p className="mt-2 text-sm font-medium text-slate-900">Talk becomes action items</p>
              </div>
              <div className="rounded-3xl border border-white/70 bg-white/65 p-4 backdrop-blur-sm">
                <p className="font-[var(--font-landing-mono)] text-xs uppercase tracking-[0.2em] text-slate-500">
                  Evidence
                </p>
                <p className="mt-2 text-sm font-medium text-slate-900">Suspect code found live</p>
              </div>
            </div>
          </div>

          <div className="relative lg:pl-4 lg:pt-4">
            <div className="landing-float relative mx-auto max-w-2xl rounded-[2rem] border border-slate-200/70 bg-[linear-gradient(180deg,rgba(19,27,45,0.97)_0%,rgba(18,24,38,0.94)_100%)] p-4 text-slate-100 shadow-[0_40px_100px_rgba(15,23,42,0.28)]">
              <div className="absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" />

              {/* Header bar */}
              <div className="mb-3 flex items-center justify-between px-2 pt-1">
                <div className="flex items-center gap-3">
                  <p className="text-sm font-semibold text-white/90">Payments API latency spike</p>
                  <span className="rounded-full bg-red-400/20 px-2 py-0.5 text-[10px] font-medium text-red-300">SEV1</span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-400">active</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                  <span className="text-[10px] text-emerald-300">Listening</span>
                </div>
              </div>

              {/* Two-column layout */}
              <div className="grid gap-3 lg:grid-cols-2">

                {/* Transcript panel */}
                <div className="rounded-xl border border-white/10 bg-white/5">
                  <div className="border-b border-white/8 px-3 py-2">
                    <p className="text-xs font-medium text-white/70">Transcript</p>
                  </div>
                  <div className="space-y-3 p-3 text-[12px]">
                    <div>
                      <div className="mb-0.5 flex items-center gap-2">
                        <span className="font-semibold text-white/90">Owen</span>
                        <span className="text-[10px] text-slate-500">2m ago</span>
                      </div>
                      <p className="text-slate-300">Error rates spiking after the queue deploy. Sprynt, track rollback owner.</p>
                    </div>
                    <div>
                      <div className="mb-0.5 flex items-center gap-2">
                        <span className="font-semibold text-white/90">Nina</span>
                        <span className="text-[10px] text-slate-500">1m ago</span>
                      </div>
                      <p className="text-slate-300">I can take the rollback. Checking the consumer logs now.</p>
                    </div>
                    <div>
                      <div className="mb-0.5 flex items-center gap-2">
                        <span className="font-semibold text-white/90">Alex</span>
                        <span className="text-[10px] text-slate-500">30s ago</span>
                      </div>
                      <p className="text-slate-300">Deploy window looks clear after 4pm, we can push a fix then.</p>
                    </div>
                    <div className="italic text-slate-500">
                      <div className="mb-0.5 flex items-center gap-2">
                        <span className="font-semibold not-italic text-white/60">Owen</span>
                        <span className="text-[10px] not-italic text-slate-600">just now</span>
                      </div>
                      <p>Let me check the retry logic in...</p>
                    </div>
                  </div>
                </div>

                {/* Task board panel */}
                <div className="rounded-xl border border-white/10 bg-white/5">
                  <div className="border-b border-white/8 px-3 py-2">
                    <p className="text-xs font-medium text-white/70">Task Board</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 p-3">
                    {/* Proposed column */}
                    <div className="rounded-lg bg-white/4 p-2">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-[11px] font-semibold text-slate-400">Proposed</p>
                        <span className="rounded-full bg-white/8 px-1.5 py-0.5 text-[9px] text-slate-500">2</span>
                      </div>
                      <div className="space-y-2">
                        <div className="rounded-md border border-white/8 bg-white/5 p-2.5">
                          <p className="text-[11px] font-medium text-white/80">Rollback queue consumer</p>
                          <div className="mt-1.5 flex gap-1">
                            <span className="rounded-full bg-white/8 px-1.5 py-0.5 text-[9px] text-slate-400">Nina</span>
                            <span className="rounded-full bg-orange-400/15 px-1.5 py-0.5 text-[9px] text-orange-300">high</span>
                          </div>
                          <div className="mt-2 flex gap-1">
                            <span className="rounded bg-white/12 px-2 py-0.5 text-[9px] font-medium text-white/70">Approve</span>
                            <span className="rounded bg-white/6 px-2 py-0.5 text-[9px] text-slate-400">Dismiss</span>
                          </div>
                        </div>
                        <div className="rounded-md border border-white/8 bg-white/5 p-2.5">
                          <p className="text-[11px] font-medium text-white/80">Check retry backoff config</p>
                          <div className="mt-1.5 flex gap-1">
                            <span className="rounded-full bg-white/8 px-1.5 py-0.5 text-[9px] text-slate-400">Owen</span>
                            <span className="rounded-full bg-yellow-400/15 px-1.5 py-0.5 text-[9px] text-yellow-300">med</span>
                          </div>
                          <div className="mt-2 flex gap-1">
                            <span className="rounded bg-white/12 px-2 py-0.5 text-[9px] font-medium text-white/70">Approve</span>
                            <span className="rounded bg-white/6 px-2 py-0.5 text-[9px] text-slate-400">Dismiss</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Synced column */}
                    <div className="rounded-lg bg-white/4 p-2">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-[11px] font-semibold text-slate-400">Synced</p>
                        <span className="rounded-full bg-white/8 px-1.5 py-0.5 text-[9px] text-slate-500">1</span>
                      </div>
                      <div className="space-y-2">
                        <div className="rounded-md border border-white/8 bg-white/5 p-2.5">
                          <p className="text-[11px] font-medium text-white/80">Confirm safe deploy window</p>
                          <div className="mt-1.5 flex gap-1">
                            <span className="rounded-full bg-white/8 px-1.5 py-0.5 text-[9px] text-slate-400">Alex</span>
                          </div>
                          <p className="mt-1.5 text-[9px] text-blue-400">PAYS-421</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="landing-float-delayed absolute -bottom-8 -left-4 rounded-[1.75rem] border border-slate-200/80 bg-white/85 p-4 shadow-[0_20px_50px_rgba(15,23,42,0.12)] backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-teal-100 p-2 text-teal-700">
                  <Cable className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-[var(--font-landing-mono)] text-[11px] uppercase tracking-[0.22em] text-slate-500">
                    Connected
                  </p>
                  <p className="text-sm font-medium text-slate-900">Meeting, Jira, GitHub</p>
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

        <section id="flow" className="scroll-mt-28 py-12">
          <p className="text-center font-[var(--font-landing-mono)] text-xs uppercase tracking-[0.22em] text-slate-500">
            How It Works
          </p>
          <h2 className="mt-3 text-center font-[var(--font-landing-heading)] text-3xl font-semibold tracking-[-0.04em] text-slate-950 md:text-4xl">
            From call to resolution
          </h2>

          <div className="relative mx-auto mt-12 max-w-4xl">
            <div className="absolute left-1/2 top-0 hidden h-full w-px -translate-x-1/2 bg-gradient-to-b from-slate-300/0 via-slate-300 to-slate-300/0 md:block" />

            <div className="grid gap-8 md:gap-0">
              {[
                {
                  icon: Mic,
                  title: "Joins the meeting",
                  desc: "A bot hops into the call through Skribby and starts streaming a speaker-labeled transcript.",
                  color: "bg-teal-100 text-teal-700",
                  side: "left" as const,
                },
                {
                  icon: ListChecks,
                  title: "Extracts tasks",
                  desc: "Picks up assignments from the conversation, waits for them to settle, then syncs them to Jira.",
                  color: "bg-orange-100 text-orange-700",
                  side: "right" as const,
                },
                {
                  icon: Search,
                  title: "Investigates the repo",
                  desc: "Looks at recent commits, ranks the most likely files, and flags suspect lines.",
                  color: "bg-sky-100 text-sky-700",
                  side: "left" as const,
                },
                {
                  icon: Monitor,
                  title: "Streams to the dashboard",
                  desc: "Transcript, tasks, and code evidence show up in a shared view your whole team can see.",
                  color: "bg-violet-100 text-violet-700",
                  side: "right" as const,
                },
              ].map((step, i) => {
                const Icon = step.icon;
                const isLeft = step.side === "left";
                return (
                  <div key={step.title} className="relative md:py-6">
                    <div className="absolute left-1/2 top-1/2 z-10 hidden h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-slate-300 bg-white md:block" />
                    <div
                      className={`md:w-[calc(50%-2rem)] ${
                        isLeft ? "md:mr-auto md:pr-4" : "md:ml-auto md:pl-4"
                      }`}
                    >
                      <div className="rounded-[1.75rem] border border-white/75 bg-white/65 p-5 backdrop-blur-sm">
                        <div className="mb-3 flex items-center gap-3">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${step.color}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="font-[var(--font-landing-mono)] text-[11px] uppercase tracking-[0.22em] text-slate-400">
                            0{i + 1}
                          </div>
                        </div>
                        <h3 className="font-[var(--font-landing-heading)] text-lg font-semibold text-slate-950">
                          {step.title}
                        </h3>
                        <p className="mt-2 text-sm leading-7 text-slate-700">
                          {step.desc}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="grid gap-6 py-8 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-[2rem] border border-slate-300/70 bg-slate-950 p-8 text-white shadow-[0_24px_60px_rgba(15,23,42,0.22)]">
            <p className="font-[var(--font-landing-mono)] text-xs uppercase tracking-[0.22em] text-white/55">
              Why Teams Use It
            </p>
            <p className="mt-4 font-[var(--font-landing-heading)] text-3xl font-semibold leading-tight">
              Nothing gets dropped. Everyone stays on the same page.
            </p>
            <p className="mt-4 max-w-md text-sm leading-7 text-white/70">
              Built for the moment when your team is on a live call, jumping between the repo, and trying to keep track of who owns what.
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
