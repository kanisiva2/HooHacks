import { MobileNav } from "@/components/layout/MobileNav";
import { Sidebar } from "@/components/layout/Sidebar";
import { ProtectedPage } from "@/components/shared/ProtectedPage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function OnboardingPage() {
  return (
    <ProtectedPage>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="w-full p-6 pb-20 md:pb-6">
          <h1 className="mb-6 text-2xl font-semibold">Onboarding</h1>
          <Card>
            <CardHeader>
              <CardTitle>Setup Continues In Sprint 2</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Workspace creation and integration setup will be implemented in
                Sprint 2.
              </p>
            </CardContent>
          </Card>
        </main>
        <MobileNav />
      </div>
    </ProtectedPage>
  );
}
