"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Check, Github } from "lucide-react";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import { ProtectedPage } from "@/components/shared/ProtectedPage";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  useIntegrationStatus,
} from "@/hooks/useIntegrations";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { api } from "@/lib/api";
import type { Workspace } from "@/types/api";
import { toastError } from "@/lib/toast";

export default function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useSupabase();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [isConnectingGithub, setIsConnectingGithub] = useState(false);
  const [isConnectingJira, setIsConnectingJira] = useState(false);
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const autoCreateStartedRef = useRef(false);

  const workspaces = useWorkspaces();
  const integrations = useIntegrationStatus();
  const workspace = workspaces.data?.[0] ?? null;
  const effectiveWorkspaceId = workspaceId ?? workspace?.id ?? null;

  const completion = useMemo(() => {
    return {
      workspace: Boolean(effectiveWorkspaceId),
      github: integrations.data?.has_github ?? false,
      jira: integrations.data?.has_jira ?? false,
      complete:
        Boolean(effectiveWorkspaceId) &&
        (integrations.data?.has_github ?? false) &&
        (integrations.data?.has_jira ?? false),
    };
  }, [effectiveWorkspaceId, integrations.data]);

  useEffect(() => {
    if (workspaces.isLoading || effectiveWorkspaceId || autoCreateStartedRef.current) {
      return;
    }

    autoCreateStartedRef.current = true;
    setIsCreatingWorkspace(true);

    const createWorkspace = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const emailName = user?.email?.split("@")[0]?.trim();
      const fallbackName = emailName
        ? `${emailName}'s Workspace`
        : "My Workspace";

      try {
        const { data } = await api.post<Workspace>("/api/workspaces", {
          name: fallbackName,
        });
        setWorkspaceId(data.id);
        await workspaces.refetch();
      } catch {
        autoCreateStartedRef.current = false;
        toastError("Failed to create your workspace");
      } finally {
        setIsCreatingWorkspace(false);
      }
    };

    void createWorkspace();
  }, [effectiveWorkspaceId, supabase, workspaces, workspaces.isLoading]);

  const handleFinish = () => {
    router.push("/dashboard");
  };

  const beginOAuthFlow = async (provider: "github" | "jira") => {
    if (!effectiveWorkspaceId) {
      return;
    }

    if (provider === "github") {
      setIsConnectingGithub(true);
    } else {
      setIsConnectingJira(true);
    }

    try {
      const { data } = await api.get<{ url: string }>(
        `/api/integrations/${provider}/connect`,
        {
          params: {
            workspace_id: effectiveWorkspaceId,
            next: "/onboarding",
          },
        },
      );
      window.location.href = data.url;
    } catch {
      toastError(`Failed to start ${provider === "github" ? "GitHub" : "Jira"} connection`);
      if (provider === "github") {
        setIsConnectingGithub(false);
      } else {
        setIsConnectingJira(false);
      }
    }
  };

  const stepsComplete = [completion.github, completion.jira].filter(Boolean).length;

  return (
    <ProtectedPage>
      <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(245,118,87,0.14),_transparent_28%),radial-gradient(circle_at_85%_18%,_rgba(0,180,170,0.12),_transparent_24%),linear-gradient(180deg,_#f7f3eb_0%,_#f2efe8_42%,_#ece9e1_100%)] text-slate-950">
        <div className="landing-grid pointer-events-none absolute inset-0 opacity-60" />
        <div className="landing-orb absolute left-[-7rem] top-20 h-72 w-72 rounded-full bg-[radial-gradient(circle,_rgba(245,118,87,0.24),_transparent_68%)] blur-3xl" />
        <div className="landing-orb absolute right-[-4rem] top-28 h-72 w-72 rounded-full bg-[radial-gradient(circle,_rgba(0,166,160,0.18),_transparent_68%)] blur-3xl" />

        <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-6 md:px-10 lg:px-12">
          <header className="mb-10 flex items-center justify-between gap-4 rounded-full border border-white/60 bg-white/55 px-4 py-3 backdrop-blur-xl md:px-6">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(15,23,42,0.22)]">
                S
              </div>
              <p className="text-sm font-semibold tracking-[0.2em] uppercase text-slate-900">
                Sprynt
              </p>
            </Link>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>{stepsComplete} of 2 complete</span>
              <div className="flex gap-1">
                {[completion.github, completion.jira].map((done, i) => (
                  <div
                    key={i}
                    className={`h-1.5 w-6 rounded-full transition-colors ${done ? "bg-emerald-500" : "bg-slate-300/60"}`}
                  />
                ))}
              </div>
            </div>
          </header>

          <section className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-lg">
              <div className="mb-8 text-center">
                <h1 className="text-4xl font-semibold leading-[0.94] tracking-[-0.04em] text-slate-950 md:text-5xl">
                  Almost there.
                  <span className="mt-2 block text-[rgba(219,87,52,0.96)]">Connect your tools.</span>
                </h1>
              </div>

              {searchParams.get("github") === "connected" || searchParams.get("jira") === "connected" ? (
                <div className="mb-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/60 px-4 py-3 text-center text-sm text-emerald-700 backdrop-blur">
                  {searchParams.get("github") === "connected" && "GitHub connected successfully."}
                  {searchParams.get("github") === "connected" && searchParams.get("jira") === "connected" && " "}
                  {searchParams.get("jira") === "connected" && "Jira connected successfully."}
                </div>
              ) : null}

              <Card className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/72 p-2 shadow-[0_28px_80px_rgba(15,23,42,0.16)] backdrop-blur-xl">
                <div className="rounded-[1.6rem] border border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(248,245,238,0.94)_100%)] p-6 md:p-7">
                  <div className="space-y-3">
                    <IntegrationStep
                      step={1}
                      label="GitHub"
                      description="Code investigation & repo access"
                      connected={completion.github}
                      loading={isConnectingGithub}
                      icon={<Github className="h-5 w-5" />}
                      action={
                        !completion.github ? (
                          <Button
                            className="h-10 rounded-2xl text-sm shadow-[0_14px_30px_rgba(15,23,42,0.12)]"
                            disabled={!completion.workspace || isConnectingGithub}
                            onClick={() => void beginOAuthFlow("github")}
                            type="button"
                          >
                            {isConnectingGithub ? "Connecting..." : "Connect"}
                          </Button>
                        ) : null
                      }
                    />

                    <IntegrationStep
                      step={2}
                      label="Jira"
                      description="Action items & issue sync"
                      connected={completion.jira}
                      loading={isConnectingJira}
                      icon={
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M11.53 2c0 2.4 1.97 4.35 4.35 4.35h1.78v1.7c0 2.4 1.94 4.34 4.34 4.35V2.84a.84.84 0 0 0-.84-.84H11.53Zm-4.67 4.65c-.02 2.4 1.95 4.35 4.35 4.35h1.78v1.72c0 2.4 1.94 4.34 4.34 4.35V7.5a.84.84 0 0 0-.84-.84H6.86Zm-4.67 4.67c0 2.4 1.96 4.35 4.35 4.35h1.78v1.7c0 2.4 1.97 4.35 4.37 4.35V12.16a.84.84 0 0 0-.84-.84H2.19Z" />
                        </svg>
                      }
                      action={
                        !completion.jira ? (
                          <Button
                            className="h-10 rounded-2xl text-sm shadow-[0_14px_30px_rgba(15,23,42,0.12)]"
                            disabled={!completion.workspace || isConnectingJira}
                            onClick={() => void beginOAuthFlow("jira")}
                            type="button"
                          >
                            {isConnectingJira ? "Connecting..." : "Connect"}
                          </Button>
                        ) : null
                      }
                    />
                  </div>

                  <div className="mt-6 border-t border-slate-200/70 pt-5">
                    <Button
                      className="h-12 w-full rounded-2xl text-base shadow-[0_14px_30px_rgba(15,23,42,0.12)]"
                      disabled={!completion.complete}
                      onClick={handleFinish}
                      type="button"
                    >
                      Continue to Dashboard
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>

                  <div className="mt-4 flex items-center justify-center text-xs text-slate-400">
                    <span>All connections use secure OAuth 2.0</span>
                  </div>
                </div>
              </Card>
            </div>
          </section>
        </div>
      </main>
    </ProtectedPage>
  );
}

function IntegrationStep({
  step,
  label,
  description,
  connected,
  loading,
  icon,
  action,
}: {
  step: number;
  label: string;
  description: string;
  connected: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={`flex items-center gap-4 rounded-2xl border px-4 py-4 transition-all ${
        connected
          ? "border-emerald-200/80 bg-emerald-50/40"
          : "border-slate-200/70 bg-white/60"
      }`}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold transition-colors ${
          connected
            ? "bg-emerald-500 text-white"
            : "bg-slate-100 text-slate-500"
        }`}
      >
        {connected ? <Check className="h-4.5 w-4.5" /> : icon ?? step}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        <p className="text-xs text-slate-500">
          {loading ? "Connecting..." : connected ? "Connected" : description}
        </p>
      </div>

      {action}
    </div>
  );
}
