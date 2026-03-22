"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useSupabase } from "@/components/providers/SupabaseProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const authSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type AuthForm = z.infer<typeof authSchema>;

async function resolvePostAuthRoute(accessToken: string): Promise<"/dashboard" | "/onboarding"> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const headers = {
    Authorization: `Bearer ${accessToken}`,
  };

  const [workspaceResponse, integrationResponse] = await Promise.all([
    fetch(`${apiBase}/api/workspaces`, { headers, cache: "no-store" }),
    fetch(`${apiBase}/api/integrations/status`, { headers, cache: "no-store" }),
  ]);

  if (!workspaceResponse.ok || !integrationResponse.ok) {
    return "/onboarding";
  }

  const workspaces = (await workspaceResponse.json()) as Array<{ id: string }>;
  const integrations = (await integrationResponse.json()) as {
    has_github: boolean;
    has_jira: boolean;
  };

  return workspaces.length > 0 && integrations.has_github && integrations.has_jira
    ? "/dashboard"
    : "/onboarding";
}

export default function LoginPage() {
  const router = useRouter();
  const supabase = useSupabase();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");

  const form = useForm<AuthForm>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  useEffect(() => {
    let isMounted = true;

    const redirectIfAuthenticated = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (isMounted && session) {
        const destination = await resolvePostAuthRoute(session.access_token);
        router.replace(destination);
      }
    };

    redirectIfAuthenticated();

    return () => {
      isMounted = false;
    };
  }, [router, supabase]);

  const handleSignIn = async (values: AuthForm) => {
    setIsSubmitting(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

    setIsSubmitting(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    setMode("signin");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    router.replace(
      session ? await resolvePostAuthRoute(session.access_token) : "/onboarding",
    );
  };

  const handleSignUp = async (values: AuthForm) => {
    setIsSubmitting(true);
    setError(null);

    const { error: signUpError } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
    });

    setIsSubmitting(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    setMode("signup");
    router.replace("/onboarding");
  };

  return (
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

          <Button nativeButton={false} variant="ghost" render={<Link href="/" />}>
            <ArrowLeft className="mr-1" />
            Back Home
          </Button>
        </header>

        <section className="grid flex-1 items-center gap-10 lg:grid-cols-[0.98fr_1.02fr]">
          <div className="-mt-16 flex justify-center text-center lg:justify-center">
            <div className="flex max-w-lg flex-col items-center justify-center">
            <h1 className="text-5xl font-semibold leading-[0.94] tracking-[-0.06em] text-slate-950 md:text-6xl">
              You handle the call.
              <span className="block text-[rgba(219,87,52,0.96)]">Sprynt handles the rest.</span>
            </h1>

            <p className="mt-5 max-w-md text-lg leading-8 text-slate-700">
              Sign in to get back to your incidents, action items, and live investigations.
            </p>
          </div>
          </div>

          <div className="landing-float-delayed relative mx-auto w-full max-w-lg">
            <Card className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/72 p-2 shadow-[0_28px_80px_rgba(15,23,42,0.16)] backdrop-blur-xl">
              <div className="rounded-[1.6rem] border border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.92)_0%,rgba(248,245,238,0.94)_100%)] p-6 md:p-7">
                <CardHeader className="px-0 pt-0">
                  <CardTitle className="text-3xl font-semibold tracking-[-0.04em] text-slate-950">
                    {mode === "signin" ? "Sign In To Sprynt" : "Create Your Account"}
                  </CardTitle>
                  <p className="mt-3 text-sm leading-7 text-slate-600">
                    {mode === "signin"
                      ? "Rejoin your dashboard, incident rooms, and live investigation streams."
                      : "Set up your account and continue into onboarding for integrations and workspace setup."}
                  </p>
                </CardHeader>

                <CardContent className="px-0 pb-0">
                  <form
                    className="space-y-5"
                    onSubmit={form.handleSubmit(handleSignIn)}
                    noValidate
                  >
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-800" htmlFor="email">
                        Email
                      </label>
                      <Input
                        id="email"
                        type="email"
                        className="h-12 rounded-2xl border-slate-200 bg-white/85 px-4 shadow-none"
                        {...form.register("email")}
                      />
                      {form.formState.errors.email ? (
                        <p className="text-sm text-destructive">
                          {form.formState.errors.email.message}
                        </p>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-800" htmlFor="password">
                        Password
                      </label>
                      <Input
                        id="password"
                        type="password"
                        className="h-12 rounded-2xl border-slate-200 bg-white/85 px-4 shadow-none"
                        {...form.register("password")}
                      />
                      {form.formState.errors.password ? (
                        <p className="text-sm text-destructive">
                          {form.formState.errors.password.message}
                        </p>
                      ) : null}
                    </div>

                    {error ? (
                      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {error}
                      </div>
                    ) : null}

                    <div className="grid gap-3 sm:grid-cols-2">
                      <Button
                        className="h-12 rounded-2xl text-base shadow-[0_14px_30px_rgba(15,23,42,0.12)]"
                        disabled={isSubmitting}
                        type="submit"
                        onClick={() => setMode("signin")}
                      >
                        {isSubmitting && mode === "signin" ? "Signing in..." : "Sign In"}
                      </Button>
                      <Button
                        className="h-12 rounded-2xl border-slate-200 bg-white/85 text-base"
                        disabled={isSubmitting}
                        onClick={form.handleSubmit(handleSignUp)}
                        type="button"
                        variant="outline"
                      >
                        {isSubmitting && mode === "signup" ? "Creating account..." : "Sign Up"}
                      </Button>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-200 pt-4 text-xs text-slate-500">
                      <span>Protected by Supabase auth</span>
                      <span className="inline-flex items-center gap-1">
                        Continue
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </form>
                </CardContent>
              </div>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}
