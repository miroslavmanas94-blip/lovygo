"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Check, Circle, Plus, Trash2 } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { useAppSession } from "@/components/AppShell";
import type { BucketItem } from "@/types";

export default function BucketList() {
  const { couple, userId, notify } = useAppSession();
  const [items, setItems] = useState<BucketItem[]>([]);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const coupleId = couple?.id;
  useEffect(() => {
    if (!coupleId) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    let alive = true;
    const load = async () => { const { data, error } = await supabase.from("bucket_list").select("*").eq("couple_id", coupleId).order("created_at", { ascending: false }); if (alive) { if (error) notify("Seznam přání se nepodařilo načíst."); else setItems((data ?? []) as BucketItem[]); } };
    void load();
    const channel = supabase.channel(`bucket:${coupleId}`).on("postgres_changes", { event: "*", schema: "public", table: "bucket_list", filter: `couple_id=eq.${coupleId}` }, () => void load()).subscribe();
    return () => { alive = false; void supabase.removeChannel(channel); };
  }, [coupleId, notify]);

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !couple || !userId || !title.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("bucket_list").insert({ couple_id: couple.id, created_by: userId, title: title.trim() });
    setBusy(false);
    if (error) notify("Přání se nepodařilo přidat."); else setTitle("");
  }

  async function update(item: BucketItem, changes: { completed?: boolean; remove?: boolean }) {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const result = changes.remove ? await supabase.from("bucket_list").delete().eq("id", item.id) : await supabase.from("bucket_list").update({ completed: changes.completed }).eq("id", item.id);
    if (result.error) notify("Změnu se nepodařilo uložit.");
  }

  return <section className="glass rounded-[22px] p-5 sm:p-6"><div className="mb-4"><p className="eyebrow">Jednou spolu</p><h2 className="mt-1 text-xl font-medium">Bucket list</h2></div><form onSubmit={add} className="flex gap-2"><input className="field min-w-0 text-sm" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={140} placeholder="Co byste chtěli zažít?" aria-label="Nové společné přání" /><button className="button-primary size-11 shrink-0 p-0" disabled={busy || !title.trim()} aria-label="Přidat přání"><Plus size={18} /></button></form><div className="mt-4 space-y-2">{items.length === 0 ? <p className="py-4 text-center text-sm text-white/40">Váš seznam je zatím prázdný.</p> : items.map((item) => <div key={item.id} className="flex items-center gap-3 rounded-xl border border-white/[.06] bg-white/[.025] px-3 py-3"><button className={`grid size-6 shrink-0 place-items-center rounded-full border ${item.completed ? "border-[#ff7aaa] bg-[#ff4d8d] text-white" : "border-white/20 text-transparent hover:border-pink-200/60"}`} onClick={() => void update(item, { completed: !item.completed })} aria-label={item.completed ? "Označit jako nesplněné" : "Označit jako splněné"}>{item.completed ? <Check size={14} /> : <Circle size={12} />}</button><span className={`flex-1 text-sm ${item.completed ? "text-white/35 line-through" : "text-white/75"}`}>{item.title}</span><button className="p-1.5 text-white/30 transition hover:text-rose-200" onClick={() => void update(item, { remove: true })} aria-label="Odstranit přání"><Trash2 size={15} /></button></div>)}</div></section>;
}