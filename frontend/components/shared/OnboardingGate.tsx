"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useIntegrationStatus } from "@/hooks/useIntegrations";
import { useWorkspaces } from "@/hooks/useWorkspaces";

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const workspaces = useWorkspaces();
  const integrations = useIntegrationStatus();

  useEffect(() => {
    if (pathname === "/onboarding") {
      return;
    }

    if (workspaces.isLoading || integrations.isLoading) {
      return;
    }

    const hasWorkspace = (workspaces.data?.length ?? 0) > 0;
    const hasGithub = integrations.data?.has_github ?? false;
    const hasJira = integrations.data?.has_jira ?? false;

    if (!hasWorkspace) {
      router.replace("/onboarding");
    }
  }, [
    pathname,
    router,
    workspaces.isLoading,
    workspaces.data,
    integrations.isLoading,
    integrations.data,
  ]);

  if (workspaces.isLoading || integrations.isLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Checking onboarding status...</p>
      </div>
    );
  }

  return <>{children}</>;
}
