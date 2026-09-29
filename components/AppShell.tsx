"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import type { CoupleData, UserProfile } from "@/types";
import Sidebar from "@/components/Sidebar";
import BottomNav from "@/components/BottomNav";
import { Heart, X } from "lucide-react";
import Brand from "@/components/Brand";

type AppSessionValue = {
  userId: string | null;
  profile: UserProfile | null;
  partner: UserProfile | null;
  couple: CoupleData | null;
  loading: boolean;
  configured: boolean;
  refresh: () => Promise<void>;
  notify: (message: string) => void;
};

const AppSessionContext = createContext<AppSessionValue | null>(null);

export function useAppSession() {
  const value = useContext(AppSessionContext);
  if (!value) throw new Error("useAppSession must be used inside AppShell");
  return value;
}

export default function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [partner, setPartner] = useState<UserProfile | null>(null);
  const [couple, setCouple] = useState<CoupleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [toast, setToast] = useState("");

  const refresh = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setConfigured(false);
      setLoading(false);
      return;
    }
    setConfigured(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/");
      setLoading(false);
      return;
    }
    setUserId(user.id);
    let { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (!data) {
      const inserted = await supabase.from("profiles").upsert({ id: user.id, display_name: user.user_metadata.display_name ?? null, bio: user.user_metadata.bio ?? null }).select("*").single();
      data = inserted.data;
    } else if (!data.bio && typeof user.user_metadata.bio === "string") {
      const hydrated = await supabase.from("profiles").update({ bio: user.user_metadata.bio }).eq("id", user.id).select("*").single();
      if (hydrated.data) data = hydrated.data;
    }
    const current = data as UserProfile | null;
    setProfile(current);
    if (current?.couple_id) {
      const [coupleResult, partnerResult] = await Promise.all([
        supabase.from("couples").select("*").eq("id", current.couple_id).maybeSingle(),
        supabase.from("profiles").select("*").eq("couple_id", current.couple_id).neq("id", user.id).maybeSingle(),
      ]);
      setCouple(coupleResult.data as CoupleData | null);
      setPartner(partnerResult.data as UserProfile | null);
    } else {
      setCouple(null);
      setPartner(null);
    }
    setLoading(false);
  }, [router]);
  const notify = useCallback((message: string) => setToast(message), []);

  useEffect(() => {
    void refresh();
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const channel = supabase.channel("lovygo-session")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "couples" }, () => void refresh())
      .subscribe();
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.replace("/");
      else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") void refresh();
    });
    return () => {
      void supabase.removeChannel(channel);
      listener.subscription.unsubscribe();
    };
  }, [refresh, router]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 3600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const value: AppSessionValue = { userId, profile, partner, couple, loading, configured, refresh, notify };
  return (
    <AppSessionContext.Provider value={value}>
      <div className="min-h-screen">
        <Sidebar />
        <main className="min-h-screen pb-24 md:pl-[248px] md:pb-8">
          <div className="mx-auto w-full max-w-[1380px] px-5 pt-7 sm:px-8 md:px-10 md:pt-10">
            <div className="mb-7 flex items-center justify-between md:hidden"><Brand href="/dashboard" size={38} /><span className="max-w-[48%] truncate text-xs text-white/45">{profile?.display_name ?? "Prostor pro vás dva"}</span></div>
            {loading ? <div className="space-y-5"><div className="skeleton h-8 w-44 rounded-lg" /><div className="skeleton h-56 rounded-[24px]" /></div> : children}
          </div>
        </main>
        <BottomNav />
        {toast && <div role="status" className="toast-in fixed bottom-24 right-5 z-[80] flex max-w-[min(420px,calc(100vw-40px))] items-center gap-3 rounded-2xl border border-white/10 bg-[#17131b]/95 px-4 py-3 text-sm text-white shadow-2xl backdrop-blur-xl md:bottom-7"><Heart size={16} className="shrink-0 text-[#ff7aaa]" />{toast}<button className="ml-auto p-1 text-white/45 hover:text-white" onClick={() => setToast("")} aria-label="Zavřít oznámení"><X size={15} /></button></div>}
        <span className="sr-only">{pathname}</span>
      </div>
    </AppSessionContext.Provider>
  );
}