import Link from "next/link";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import {
  ArrowRight,
  Bot,
  GitBranch,
  MessageSquareMore,
  Mic,
  ListChecks,
  Search,
  Monitor,
  Shield,
  Clock,
  Zap,
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
        {/* Hero */}
        <section className="flex flex-1 flex-col items-center gap-10 pb-12">
          {/* Text block — full width, centered */}
          <div className="max-w-3xl text-center">
            <h1 className="font-[var(--font-landing-heading)] text-5xl font-semibold leading-[0.92] tracking-[-0.06em] text-slate-950 md:text-7xl">
              You handle the call.
              <span className="block text-[rgba(219,87,52,0.96)]">Sprynt handles the rest.</span>
            </h1>

            <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-slate-700 md:text-xl">
              Sprynt sits in the meeting, tracks the conversation, syncs tasks to Jira, and
              investigates your repo — all while your team is still talking.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
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
          </div>

          {/* Dashboard mock — matches the actual 3-column incident room */}
          <div className="relative w-full">
            <div className="landing-float relative mx-auto max-w-5xl rounded-[2rem] border border-slate-200/70 bg-[linear-gradient(180deg,rgba(19,27,45,0.97)_0%,rgba(18,24,38,0.94)_100%)] p-4 text-slate-100 shadow-[0_40px_100px_rgba(15,23,42,0.28)]">
              <div className="absolute inset-x-12 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" />

              {/* Header bar */}
              <div className="mb-3 flex items-center justify-between px-2 pt-1">
                <div className="flex items-center gap-2">
                  <div className="flex h-5 w-5 items-center justify-center rounded-md bg-white/10 text-[8px] font-bold text-white/70">S</div>
                  <p className="text-sm font-semibold text-white/90">Payments API latency spike</p>
                  <span className="rounded-full bg-red-400/20 px-2 py-0.5 text-[10px] font-medium text-red-300">P1</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                  <span className="text-[10px] text-emerald-300">Listening</span>
                </div>
              </div>

              {/* Three-column layout matching actual app */}
              <div className="grid grid-cols-[0.7fr_1.4fr_0.9fr] gap-2">

                {/* Transcript panel — narrow with speaker initials */}
                <div className="rounded-xl border border-white/10 bg-white/5">
                  <div className="flex items-center gap-1.5 border-b border-white/8 px-2.5 py-1.5">
                    <div className="flex h-4 w-4 items-center justify-center rounded bg-sky-500/20">
                      <Mic className="h-2.5 w-2.5 text-sky-400" />
                    </div>
                    <p className="text-[10px] font-medium text-white/70">Transcript</p>
                  </div>
                  <div className="space-y-2 p-2.5 text-[11px]">
                    <div className="flex items-start gap-1.5">
                      <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-[7px] font-bold text-blue-300">O</div>
                      <div>
                        <span className="font-semibold text-white/80">Owen</span>
                        <p className="text-slate-400">Error rates spiking after the queue deploy.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-[7px] font-bold text-amber-300">N</div>
                      <div>
                        <span className="font-semibold text-white/80">Nina</span>
                        <p className="text-slate-400">I can take the rollback.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[7px] font-bold text-emerald-300">A</div>
                      <div>
                        <span className="font-semibold text-white/80">Alex</span>
                        <p className="text-slate-400">Deploy window looks clear after 4pm.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-1.5 opacity-50">
                      <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-[7px] font-bold text-blue-300">O</div>
                      <div>
                        <span className="font-semibold text-white/60">Owen</span>
                        <p className="italic text-slate-500">Let me check the retry...</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Task board panel — wider with two columns */}
                <div className="rounded-xl border border-white/10 bg-white/5">
                  <div className="flex items-center gap-1.5 border-b border-white/8 px-2.5 py-1.5">
                    <div className="flex h-4 w-4 items-center justify-center rounded bg-amber-500/20">
                      <ListChecks className="h-2.5 w-2.5 text-amber-400" />
                    </div>
                    <p className="text-[10px] font-medium text-white/70">Task Board</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 p-2.5">
                    {/* Proposed */}
                    <div className="rounded-lg bg-white/4 p-2">
                      <div className="mb-1.5 flex items-center justify-between">
                        <p className="text-[10px] font-semibold text-slate-400">Proposed</p>
                        <span className="rounded-full bg-white/8 px-1.5 py-0.5 text-[8px] text-slate-500">2</span>
                      </div>
                      <div className="space-y-1.5">
                        <div className="rounded-md border border-white/8 bg-white/5 p-2">
                          <p className="text-[10px] font-medium text-white/80">Rollback queue consumer</p>
                          <div className="mt-1 flex gap-1">
                            <span className="rounded-full bg-white/8 px-1.5 py-0.5 text-[8px] text-slate-400">Nina</span>
                            <span className="rounded-full bg-orange-400/15 px-1.5 py-0.5 text-[8px] text-orange-300">72%</span>
                          </div>
                          <div className="mt-1.5 flex gap-1">
                            <span className="rounded bg-white/12 px-1.5 py-0.5 text-[8px] font-medium text-white/70">Approve</span>
                            <span className="rounded bg-white/6 px-1.5 py-0.5 text-[8px] text-slate-400">Dismiss</span>
                          </div>
                        </div>
                        <div className="rounded-md border border-white/8 bg-white/5 p-2">
                          <p className="text-[10px] font-medium text-white/80">Check retry backoff config</p>
                          <div className="mt-1 flex gap-1">
                            <span className="rounded-full bg-white/8 px-1.5 py-0.5 text-[8px] text-slate-400">Owen</span>
                            <span className="rounded-full bg-yellow-400/15 px-1.5 py-0.5 text-[8px] text-yellow-300">58%</span>
                          </div>
                          <div className="mt-1.5 flex gap-1">
                            <span className="rounded bg-white/12 px-1.5 py-0.5 text-[8px] font-medium text-white/70">Approve</span>
                            <span className="rounded bg-white/6 px-1.5 py-0.5 text-[8px] text-slate-400">Dismiss</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Synced */}
                    <div className="rounded-lg bg-white/4 p-2">
                      <div className="mb-1.5 flex items-center justify-between">
                        <p className="text-[10px] font-semibold text-slate-400">Synced</p>
                        <span className="rounded-full bg-white/8 px-1.5 py-0.5 text-[8px] text-slate-500">1</span>
                      </div>
                      <div className="space-y-1.5">
                        <div className="rounded-md border border-white/8 bg-white/5 p-2">
                          <p className="text-[10px] font-medium text-white/80">Confirm safe deploy window</p>
                          <div className="mt-1 flex gap-1">
                            <span className="rounded-full bg-white/8 px-1.5 py-0.5 text-[8px] text-slate-400">Alex</span>
                          </div>
                          <p className="mt-1 text-[9px] font-medium text-blue-400">PAYS-421</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Deep dive panel */}
                <div className="rounded-xl border border-white/10 bg-white/5">
                  <div className="flex items-center gap-1.5 border-b border-white/8 px-2.5 py-1.5">
                    <div className="flex h-4 w-4 items-center justify-center rounded bg-violet-500/20">
                      <Search className="h-2.5 w-2.5 text-violet-400" />
                    </div>
                    <p className="text-[10px] font-medium text-white/70">Deep Dive</p>
                  </div>
                  <div className="space-y-1.5 p-2.5">
                    <div className="rounded-md border border-white/8 bg-white/5 p-2">
                      <div className="flex items-center gap-1.5">
                        <span className="flex h-4 w-4 items-center justify-center rounded bg-violet-500/20 text-[8px] font-bold text-violet-300">1</span>
                        <p className="truncate text-[10px] font-medium text-white/80">src/queue/consumer.ts</p>
                      </div>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <div className="h-1 flex-1 rounded-full bg-white/10">
                          <div className="h-1 w-[87%] rounded-full bg-violet-400/60" />
                        </div>
                        <span className="text-[8px] text-slate-400">87%</span>
                      </div>
                    </div>
                    <div className="rounded-md border border-white/8 bg-white/5 p-2">
                      <div className="flex items-center gap-1.5">
                        <span className="flex h-4 w-4 items-center justify-center rounded bg-violet-500/20 text-[8px] font-bold text-violet-300">2</span>
                        <p className="truncate text-[10px] font-medium text-white/80">src/config/retry.ts</p>
                      </div>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <div className="h-1 flex-1 rounded-full bg-white/10">
                          <div className="h-1 w-[64%] rounded-full bg-violet-400/60" />
                        </div>
                        <span className="text-[8px] text-slate-400">64%</span>
                      </div>
                    </div>
                    <div className="rounded-md border border-white/8 bg-white/5 p-2">
                      <div className="flex items-center gap-1.5">
                        <span className="flex h-4 w-4 items-center justify-center rounded bg-violet-500/20 text-[8px] font-bold text-violet-300">3</span>
                        <p className="truncate text-[10px] font-medium text-white/80">src/deploy/rollback.ts</p>
                      </div>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <div className="h-1 flex-1 rounded-full bg-white/10">
                          <div className="h-1 w-[41%] rounded-full bg-violet-400/60" />
                        </div>
                        <span className="text-[8px] text-slate-400">41%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Stat pills */}
          <div className="mt-12 grid gap-3 sm:grid-cols-3 md:max-w-2xl md:mx-auto">
            <div className="rounded-3xl border border-white/70 bg-white/65 p-4 text-center backdrop-blur-sm">
              <p className="font-[var(--font-landing-mono)] text-xs uppercase tracking-[0.2em] text-slate-500">
                Meeting
              </p>
              <p className="mt-2 text-sm font-medium text-slate-900">Joins as an operator</p>
            </div>
            <div className="rounded-3xl border border-white/70 bg-white/65 p-4 text-center backdrop-blur-sm">
              <p className="font-[var(--font-landing-mono)] text-xs uppercase tracking-[0.2em] text-slate-500">
                Tasks
              </p>
              <p className="mt-2 text-sm font-medium text-slate-900">Talk becomes action items</p>
            </div>
            <div className="rounded-3xl border border-white/70 bg-white/65 p-4 text-center backdrop-blur-sm">
              <p className="font-[var(--font-landing-mono)] text-xs uppercase tracking-[0.2em] text-slate-500">
                Evidence
              </p>
              <p className="mt-2 text-sm font-medium text-slate-900">Suspect code found live</p>
            </div>
          </div>
        </section>

        {/* Feature cards */}
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

        {/* How It Works */}
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
                  title: "Bot joins the meeting",
                  desc: "Joins the call in seconds and streams a speaker-labeled transcript live.",
                  color: "bg-teal-100 text-teal-700",
                  side: "left" as const,
                },
                {
                  icon: ListChecks,
                  title: "Tasks extracted and synced",
                  desc: "Picks up assignments, stabilizes them, and pushes approved items to Jira.",
                  color: "bg-orange-100 text-orange-700",
                  side: "right" as const,
                },
                {
                  icon: Search,
                  title: "Code investigation runs live",
                  desc: "Ranks suspect files from recent commits and highlights likely lines.",
                  color: "bg-sky-100 text-sky-700",
                  side: "left" as const,
                },
                {
                  icon: Monitor,
                  title: "Everything streams to one view",
                  desc: "Transcript, tasks, and evidence update live on a shared dashboard.",
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

        {/* Why Teams Use It */}
        <section className="grid gap-6 py-8 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-[2rem] border border-slate-300/70 bg-slate-950 p-8 text-white shadow-[0_24px_60px_rgba(15,23,42,0.22)]">
            <p className="font-[var(--font-landing-mono)] text-xs uppercase tracking-[0.22em] text-white/55">
              Why Teams Use It
            </p>
            <p className="mt-4 font-[var(--font-landing-heading)] text-3xl font-semibold leading-tight">
              Nothing gets dropped. Everyone stays aligned.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <Clock className="mb-2 h-4 w-4 text-white/50" />
                <p className="text-[13px] font-medium text-white/90">Faster resolution</p>
                <p className="mt-1 text-[11px] text-white/50">Evidence surfaces during the call.</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <Shield className="mb-2 h-4 w-4 text-white/50" />
                <p className="text-[13px] font-medium text-white/90">Nothing lost</p>
                <p className="mt-1 text-[11px] text-white/50">Every task captured and synced.</p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {[
              { label: "Join", text: "Bot enters the meeting and starts listening." },
              { label: "Extract", text: "Tasks synced to Jira, code investigated live." },
              { label: "Stream", text: "Everything shows up on a shared dashboard." },
            ].map((step, index) => (
              <div
                key={step.label}
                className="rounded-[1.75rem] border border-slate-300/70 bg-white/68 p-5 backdrop-blur-sm"
              >
                <p className="font-[var(--font-landing-mono)] text-[11px] uppercase tracking-[0.2em] text-slate-500">
                  0{index + 1}
                </p>
                <p className="mt-2 text-xs font-semibold text-slate-900">{step.label}</p>
                <p className="mt-2 text-sm leading-7 text-slate-700">{step.text}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
