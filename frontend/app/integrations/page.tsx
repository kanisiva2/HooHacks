import { MobileNav } from "@/components/layout/MobileNav";
import { Sidebar } from "@/components/layout/Sidebar";
import { ProtectedPage } from "@/components/shared/ProtectedPage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function IntegrationsPage() {
  return (
    <ProtectedPage>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="w-full p-6 pb-20 md:pb-6">
          <h1 className="mb-6 text-2xl font-semibold">Integrations</h1>
          <Card>
            <CardHeader>
              <CardTitle>OAuth Screens Ship In Sprint 2</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                GitHub and Jira connection management are scheduled for Sprint 2.
              </p>
            </CardContent>
          </Card>
        </main>
        <MobileNav />
      </div>
    </ProtectedPage>
  );
}
