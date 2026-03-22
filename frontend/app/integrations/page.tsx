import { redirect } from "next/navigation";

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = searchParams ? await searchParams : {};
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(resolved)) {
    if (typeof value === "string") {
      query.set(key, value);
    }
  }

  redirect(query.size ? `/settings?${query.toString()}` : "/settings");
}
