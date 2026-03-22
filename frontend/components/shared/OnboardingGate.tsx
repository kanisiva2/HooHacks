"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function check() {
      try {
        const wsResp = await api.get("/api/workspaces");
        if (!mounted) return;

        if (!wsResp.data || wsResp.data.length === 0) {
          router.replace("/onboarding");
          return;
        }

        const statusResp = await api.get("/api/integrations/status");
        if (!mounted) return;

        const { has_github, has_jira } = statusResp.data;
        if (!has_github || !has_jira) {
          router.replace("/onboarding");
          return;
        }

        setReady(true);
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 401) {
          router.replace("/login");
          return;
        }
        router.replace("/onboarding");
      } finally {
        if (mounted) setChecking(false);
      }
    }

    check();
    return () => {
      mounted = false;
    };
  }, [router]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md animate-pulse space-y-4">
          <div className="h-6 w-1/3 rounded bg-muted" />
          <div className="h-20 rounded bg-muted" />
          <div className="h-20 rounded bg-muted" />
        </div>
      </div>
    );
  }

  if (!ready) return null;

  return <>{children}</>;
}
