"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Heart, Send } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { useAppSession } from "@/components/AppShell";
import type { MoodEntry } from "@/types";

const moods = [{ value: "skvěle", emoji: "☀️" }, { value: "dobře", emoji: "🌿" }, { value: "tak napůl", emoji: "☁️" }, { value: "smutně", emoji: "🌧️" }, { value: "chybíš mi", emoji: "💌" }];

export default function MoodTracker() {
  const { couple, userId, profile, partner, notify } = useAppSession();
  const [mood, setMood] = useState("dobře");
  const [note, setNote] = useState("");
  const [latest, setLatest] = useState<MoodEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const coupleId = couple?.id;
  useEffect(() => {
    if (!coupleId) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    let alive = true;
    const load = async () => { const { data, error } = await supabase.from("mood_entries").select("*").eq("couple_id", coupleId).order("created_at", { ascending: false }).limit(2); if (alive) { if (error) notify("Nálady se nepodařilo načíst."); else setLatest((data ?? []) as MoodEntry[]); } };
    void load();
    const channel = supabase.channel(`mood:${coupleId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "mood_entries", filter: `couple_id=eq.${coupleId}` }, () => void load()).subscribe();
    return () => { alive = false; void supabase.removeChannel(channel); };
  }, [coupleId, notify]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !couple || !userId) return;
    setBusy(true);
    const { error } = await supabase.from("mood_entries").insert({ couple_id: couple.id, user_id: userId, mood, note: note.trim() || null });
    setBusy(false);
    if (error) notify("Náladu se nepodařilo uložit."); else setNote("");
  }
  const names = new Map([[userId ?? "", profile?.display_name ?? "Vy"], [partner?.id ?? "", partner?.display_name ?? "Partner"]]);
  return <section className="glass rounded-[22px] p-5 sm:p-6"><div className="mb-4"><p className="eyebrow">Jak se máte</p><h2 className="mt-1 text-xl font-medium">Nálady</h2></div><form onSubmit={submit}><div className="grid grid-cols-5 gap-2">{moods.map((entry) => <button key={entry.value} type="button" onClick={() => setMood(entry.value)} aria-pressed={mood === entry.value} className={`flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-xl border px-1 text-center transition ${mood === entry.value ? "border-pink-200/35 bg-pink-400/10" : "border-white/[.07] bg-white/[.025] hover:bg-white/[.055]"}`}><span className="text-xl">{entry.emoji}</span><span className="text-[10px] leading-3 text-white/60">{entry.value}</span></button>)}</div><textarea className="field mt-3 min-h-20 resize-y text-sm" value={note} onChange={(event) => setNote(event.target.value)} maxLength={180} placeholder="Chcete k náladě něco dodat?" /><button className="button-primary mt-3 w-full" disabled={busy}>{busy ? "Ukládám…" : "Sdílet náladu"}<Send size={15} /></button></form><div className="mt-5 space-y-2">{latest.map((entry) => <div key={entry.id} className="flex items-start gap-3 rounded-xl border border-white/[.06] bg-white/[.025] p-3"><span className="text-xl">{moods.find((item) => item.value === entry.mood)?.emoji ?? "💗"}</span><div className="min-w-0"><p className="text-sm"><span className="text-white/80">{names.get(entry.user_id) ?? "Partner"}</span><span className="ml-1 text-white/45">se cítí {entry.mood}</span></p>{entry.note && <p className="mt-1 text-xs leading-5 text-white/45">{entry.note}</p>}<p className="mt-1 text-[10px] text-white/30">{new Date(entry.created_at).toLocaleString("cs-CZ", { dateStyle: "medium", timeStyle: "short" })}</p></div><Heart size={14} className="ml-auto mt-1 shrink-0 text-pink-300/60" /></div>)}</div></section>;
}