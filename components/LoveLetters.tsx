"use client";

import { useEffect, useState, type FormEvent } from "react";
import { LockKeyhole, MailOpen, Plus, Send } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { useAppSession } from "@/components/AppShell";
import type { LoveLetter } from "@/types";

export default function LoveLetters() {
  const { couple, userId, profile, partner, notify } = useAppSession();
  const [letters, setLetters] = useState<LoveLetter[]>([]);
  const [compose, setCompose] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [unlockAt, setUnlockAt] = useState("");
  const [open, setOpen] = useState<LoveLetter | null>(null);
  const [busy, setBusy] = useState(false);
  const coupleId = couple?.id;
  useEffect(() => {
    if (!coupleId) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    let alive = true;
    const load = async () => { const { data, error } = await supabase.from("love_letters").select("*").eq("couple_id", coupleId).order("unlock_at", { ascending: true }); if (alive) { if (error) notify("Dostupné dopisy se nepodařilo načíst."); else setLetters((data ?? []) as LoveLetter[]); } };
    void load();
    const channel = supabase.channel(`letters:${coupleId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "love_letters", filter: `couple_id=eq.${coupleId}` }, () => void load()).subscribe();
    const refreshTimer = window.setInterval(() => void load(), 60000);
    return () => { alive = false; window.clearInterval(refreshTimer); void supabase.removeChannel(channel); };
  }, [coupleId, notify]);
  async function createLetter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !couple || !userId) return;
    setBusy(true);
    const { error } = await supabase.from("love_letters").insert({ couple_id: couple.id, author_id: userId, title: title.trim(), content: content.trim(), unlock_at: new Date(unlockAt).toISOString() });
    setBusy(false);
    if (error) notify("Dopis se nepodařilo uložit.");
    else { notify("Dopis je uložený a otevře se ve zvolený čas."); setCompose(false); setTitle(""); setContent(""); setUnlockAt(""); }
  }
  const now = Date.now();
  return <section className="glass rounded-[22px] p-5 sm:p-6"><div className="mb-5 flex items-center justify-between gap-3"><div><p className="eyebrow">Slova na později</p><h2 className="mt-1 text-xl font-medium">Love letters</h2></div><button className="button-quiet size-10 p-0" onClick={() => setCompose(!compose)} aria-label={compose ? "Zavřít formulář dopisu" : "Napsat dopis"}><Plus size={17} /></button></div>
    {compose && <form className="mb-5 space-y-3 rounded-2xl border border-white/[.07] bg-black/15 p-4" onSubmit={createLetter}><input className="field" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={90} required placeholder="Název dopisu" /><textarea className="field min-h-32 resize-y" value={content} onChange={(event) => setContent(event.target.value)} maxLength={10000} required placeholder="Napište, co chcete partnerovi říct…" /><label className="block space-y-2 text-xs text-white/50">Odemknout dne<input className="field" type="datetime-local" value={unlockAt} onChange={(event) => setUnlockAt(event.target.value)} min={new Date(Date.now() + 60000).toISOString().slice(0, 16)} required /></label><button className="button-primary w-full" disabled={busy}>{busy ? "Ukládám…" : "Zapečetit dopis"}<Send size={15} /></button></form>}
    <div className="space-y-2">{letters.length === 0 ? <div className="rounded-2xl border border-dashed border-white/[.08] px-4 py-8 text-center"><MailOpen size={21} className="mx-auto text-pink-200/60" /><p className="mt-3 text-sm text-white/50">Zatím tu na vás žádný dopis nečeká.</p></div> : letters.map((letter) => { const unlocked = Date.parse(letter.unlock_at) <= now; const authorName = letter.author_id === userId ? profile?.display_name ?? "Vy" : partner?.display_name ?? "Partner"; return <button key={letter.id} onClick={() => unlocked && setOpen(letter)} disabled={!unlocked} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${unlocked ? "border-white/[.07] bg-white/[.035] hover:border-pink-200/20" : "border-white/[.04] bg-white/[.015] opacity-60"}`}><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${unlocked ? "bg-pink-400/10 text-[#ff7aaa]" : "bg-white/[.04] text-white/35"}`}>{unlocked ? <MailOpen size={17} /> : <LockKeyhole size={16} />}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{unlocked ? letter.title : "Zapečetěný dopis"}</span><span className="mt-1 block text-xs text-white/40">{unlocked ? `Od: ${authorName}` : `Odemkne se ${new Date(letter.unlock_at).toLocaleString("cs-CZ", { dateStyle: "medium", timeStyle: "short" })}`}</span></span></button>; })}</div>
    {open && <div role="dialog" aria-modal="true" aria-labelledby="letter-title" className="fixed inset-0 z-[90] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setOpen(null)}><article className="glass max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-[24px] p-6 sm:p-8" onClick={(event) => event.stopPropagation()}><p className="eyebrow">Otevřený dopis</p><h3 id="letter-title" className="mt-2 text-2xl font-medium">{open.title}</h3><p className="mt-2 text-xs text-white/40">Od {open.author_id === userId ? profile?.display_name : partner?.display_name}</p><p className="mt-6 whitespace-pre-wrap text-sm leading-7 text-white/75">{open.content}</p><button className="button-quiet mt-7 w-full" onClick={() => setOpen(null)}>Zavřít</button></article></div>}
  </section>;
}