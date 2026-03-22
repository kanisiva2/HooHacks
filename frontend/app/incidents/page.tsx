import { MobileNav } from "@/components/layout/MobileNav";
import { Sidebar } from "@/components/layout/Sidebar";
import { OnboardingGate } from "@/components/shared/OnboardingGate";
import { ProtectedPage } from "@/components/shared/ProtectedPage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function IncidentsPage() {
  return (
    <ProtectedPage>
      <OnboardingGate>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="w-full p-6 pb-20 md:pb-6">
          <h1 className="mb-6 text-2xl font-semibold">Incidents</h1>
          <Card>
            <CardHeader>
              <CardTitle>Incident Room Arrives In Sprint 2</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Live transcript, task board, and socket updates are part of
                Sprint 2 Path B.
              </p>
            </CardContent>
          </Card>
        </main>
        <MobileNav />
      </div>
    </OnboardingGate>
    </ProtectedPage>
  );
}
