"use client";

import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface AuthState {
  session: Session | null;
  user: User | null;
  /** True until the first getSession() resolves — lets UI avoid a flash of
   *  "signed out" before a real session has had a chance to hydrate. */
  loading: boolean;
  initialized: boolean;
  init: () => void;
  signOut: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  session: null,
  user: null,
  loading: true,
  initialized: false,

  init() {
    const client = getSupabaseBrowserClient();
    if (!client) {
      set({ loading: false, initialized: true });
      return;
    }
    void client.auth.getSession().then(({ data }) => {
      set({ session: data.session, user: data.session?.user ?? null, loading: false });
    });
    client.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null, loading: false });
    });
    set({ initialized: true });
  },

  async signOut() {
    const client = getSupabaseBrowserClient();
    if (!client) return;
    await client.auth.signOut();
    set({ session: null, user: null });
  },
}));
