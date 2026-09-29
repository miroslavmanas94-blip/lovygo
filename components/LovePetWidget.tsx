"use client";

import { useEffect, useState } from "react";
import { BedDouble, Bone, Heart, Sparkles, Zap } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { useAppSession } from "@/components/AppShell";
import type { LovePet } from "@/types";

function Meter({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof Heart; tone: string }) {
  return <div><div className="mb-2 flex items-center justify-between text-xs"><span className="flex items-center gap-2 text-white/50"><Icon size={14} className={tone} />{label}</span><span className="text-white/70">{value}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-white/[.08]"><div className="h-full rounded-full bg-gradient-to-r from-[#ff4d8d] to-[#ff9abb] transition-[width] duration-500" style={{ width: `${value}%` }} /></div></div>;
}

export default function LovePetWidget() {
  const { couple, notify } = useAppSession();
  const [pet, setPet] = useState<LovePet | null>(null);
  const [busy, setBusy] = useState(false);
  const coupleId = couple?.id;

  useEffect(() => {
    if (!coupleId) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const load = async () => {
      const { data, error } = await supabase.from("love_pet").select("*").eq("couple_id", coupleId).maybeSingle();
      if (error) notify("Mazlíčka se nepodařilo načíst.");
      else setPet(data as LovePet | null);
    };
    void load();
    const channel = supabase.channel(`pet:${coupleId}`).on("postgres_changes", { event: "*", schema: "public", table: "love_pet", filter: `couple_id=eq.${coupleId}` }, (payload) => setPet(payload.new as LovePet)).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [coupleId, notify]);

  async function act(action: "feed" | "play" | "sleep") {
    const supabase = getSupabaseBrowserClient();
    if (!pet || !supabase || busy) return;
    setBusy(true);
    const changes = action === "feed"
      ? { hunger: Math.max(0, pet.hunger - 22), happiness: Math.min(100, pet.happiness + 4) }
      : action === "play"
        ? { happiness: Math.min(100, pet.happiness + 18), energy: Math.max(0, pet.energy - 20), hunger: Math.min(100, pet.hunger + 8) }
        : { energy: Math.min(100, pet.energy + 24), hunger: Math.min(100, pet.hunger + 4) };
    const { data, error } = await supabase.from("love_pet").update({ ...changes, updated_at: new Date().toISOString() }).eq("id", pet.id).select("*").single();
    if (error) notify("Akci se nepodařilo uložit. Zkuste to znovu.");
    else setPet(data as LovePet);
    setBusy(false);
  }

  if (!pet) return <section className="glass rounded-[22px] p-5"><div className="skeleton h-36 rounded-xl" /></section>;

  return <section className="glass rounded-[22px] p-5 sm:p-6">
    <div className="mb-5 flex items-start justify-between"><div><p className="eyebrow">Malý společný svět</p><h2 className="mt-1 text-xl font-medium">LovePet</h2></div><span className="grid size-10 place-items-center rounded-2xl bg-pink-400/10 text-[#ff7aaa]"><Heart size={18} fill="currentColor" /></span></div>
    <div className="mb-5 flex items-center gap-4 rounded-2xl border border-white/[.06] bg-black/15 p-4"><div className="grid size-14 shrink-0 place-items-center rounded-[18px] border border-pink-200/10 bg-gradient-to-br from-pink-300/15 to-indigo-300/10 text-[30px]" aria-hidden="true">🐈</div><div><p className="font-medium">{pet.name}</p><p className="mt-1 text-xs text-white/40">Váš společný mazlíček</p></div><Sparkles size={17} className="ml-auto text-[#ff7aaa]" /></div>
    <div className="space-y-4"><Meter label="Hlad" value={pet.hunger} icon={Bone} tone="text-amber-200" /><Meter label="Štěstí" value={pet.happiness} icon={Heart} tone="text-pink-300" /><Meter label="Energie" value={pet.energy} icon={Zap} tone="text-sky-200" /></div>
    <div className="mt-5 grid grid-cols-3 gap-2"><button className="button-quiet px-2 py-2.5 text-xs" disabled={busy || pet.hunger <= 0} onClick={() => void act("feed")}><Bone size={15} />Nakrmit</button><button className="button-quiet px-2 py-2.5 text-xs" disabled={busy || pet.energy < 20} onClick={() => void act("play")}><Heart size={14} />Hrát si</button><button className="button-quiet px-2 py-2.5 text-xs" disabled={busy || pet.energy >= 100} onClick={() => void act("sleep")}><BedDouble size={15} />Spát</button></div>
  </section>;
}