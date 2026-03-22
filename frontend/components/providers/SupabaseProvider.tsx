"use client";

import { createContext, useContext, useState } from "react";
import { type SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase";

type SupabaseContextValue = {
  supabase: SupabaseClient;
};

const SupabaseContext = createContext<SupabaseContextValue | undefined>(undefined);

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const [supabase] = useState(() => createClient());

  return (
    <SupabaseContext.Provider value={{ supabase }}>
      {children}
    </SupabaseContext.Provider>
  );
}

export function useSupabase() {
  const context = useContext(SupabaseContext);

  if (!context) {
    throw new Error("useSupabase must be used within SupabaseProvider");
  }

  return context.supabase;
}
