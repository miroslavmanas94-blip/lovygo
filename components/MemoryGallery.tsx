"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { CalendarDays, ImagePlus, Trash2, Upload } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { useAppSession } from "@/components/AppShell";
import type { Memory, UserProfile } from "@/types";

type MemoryView = Memory & { signedUrl: string | null; author?: UserProfile };

export default function MemoryGallery() {
  const { couple, userId, profile, partner, notify } = useAppSession();
  const [memories, setMemories] = useState<MemoryView[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const coupleId = couple?.id;

  useEffect(() => {
    if (!coupleId) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    let alive = true;
    const load = async () => {
      const { data, error } = await supabase.from("memories").select("*").eq("couple_id", coupleId).order("memory_date", { ascending: false });
      if (!alive) return;
      if (error) { notify("Vzpomínky se nepodařilo načíst."); return; }
      const authors = [profile, partner].filter((item): item is UserProfile => Boolean(item));
      const views = await Promise.all(((data ?? []) as Memory[]).map(async (item) => ({ ...item, author: authors.find((author) => author.id === item.author_id), signedUrl: (await supabase.storage.from("memories").createSignedUrl(item.image_path, 3600)).data?.signedUrl ?? null })));
      if (alive) setMemories(views);
    };
    void load();
    const channel = supabase.channel(`memories:${coupleId}`).on("postgres_changes", { event: "*", schema: "public", table: "memories", filter: `couple_id=eq.${coupleId}` }, () => void load()).subscribe();
    return () => { alive = false; void supabase.removeChannel(channel); };
  }, [coupleId, profile, partner, notify]);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !couple || !userId || !file) return;
    setBusy(true);
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const imagePath = `${couple.id}/${crypto.randomUUID()}.${extension}`;
    const uploaded = await supabase.storage.from("memories").upload(imagePath, file, { contentType: file.type });
    if (uploaded.error) { notify("Fotografii se nepodařilo nahrát. Maximální velikost je 10 MB."); setBusy(false); return; }
    const saved = await supabase.from("memories").insert({ couple_id: couple.id, author_id: userId, title: title.trim(), description: description.trim() || null, image_path: imagePath, memory_date: date });
    setBusy(false);
    if (saved.error) { await supabase.storage.from("memories").remove([imagePath]); notify("Vzpomínku se nepodařilo uložit."); return; }
    setFile(null); setTitle(""); setDescription(""); setDate(new Date().toISOString().slice(0, 10));
    const input = document.getElementById("memory-file") as HTMLInputElement | null;
    if (input) input.value = "";
  }

  async function remove(memory: MemoryView) {
    if (memory.author_id !== userId) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const { error } = await supabase.from("memories").delete().eq("id", memory.id);
    if (error) { notify("Vzpomínku se nepodařilo odstranit."); return; }
    const storageResult = await supabase.storage.from("memories").remove([memory.image_path]);
    if (storageResult.error) notify("Vzpomínka byla odstraněna, ale soubor zůstal v úložišti.");
  }

  return <section className="space-y-5"><div><p className="eyebrow">Váš společný příběh</p><h2 className="mt-1 text-xl font-medium">Vzpomínky</h2></div><form className="glass grid gap-3 rounded-[22px] p-5 sm:grid-cols-2" onSubmit={upload}><label className="space-y-2 text-xs text-white/55 sm:col-span-2">Fotografie<input id="memory-file" className="field file:mr-3 file:rounded-lg file:border-0 file:bg-pink-500/15 file:px-3 file:py-1.5 file:text-xs file:text-pink-100" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => setFile(event.target.files?.[0] ?? null)} required /></label><input className="field text-sm" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} required placeholder="Název vzpomínky" /><label className="relative"><CalendarDays size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35" /><input className="field pl-10 text-sm" type="date" value={date} onChange={(event) => setDate(event.target.value)} max={new Date().toISOString().slice(0, 10)} required aria-label="Datum vzpomínky" /></label><textarea className="field min-h-20 resize-y text-sm sm:col-span-2" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} placeholder="Krátký popis (nepovinné)" /><button className="button-primary sm:col-span-2 sm:justify-self-start" disabled={busy || !file}>{busy ? "Nahrávám…" : "Přidat vzpomínku"}{busy ? <Upload size={15} /> : <ImagePlus size={15} />}</button></form>
    {memories.length === 0 ? <div className="glass rounded-[22px] px-5 py-12 text-center"><ImagePlus size={24} className="mx-auto text-pink-200/55" /><p className="mt-4 text-sm text-white/45">Vaše společná galerie zatím čeká na první fotografii.</p></div> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{memories.map((memory) => <article key={memory.id} className="group overflow-hidden rounded-[19px] border border-white/[.08] bg-white/[.035]"><div className="relative aspect-[4/3] bg-black/25">{memory.signedUrl ? <Image src={memory.signedUrl} alt={memory.title} fill unoptimized sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw" className="object-cover transition duration-500 group-hover:scale-[1.02]" /> : <div className="grid size-full place-items-center text-white/20"><ImagePlus size={25} /></div>}</div><div className="p-4"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><h3 className="truncate text-sm font-medium">{memory.title}</h3><p className="mt-1 text-xs text-white/40">{new Date(`${memory.memory_date}T00:00:00`).toLocaleDateString("cs-CZ", { dateStyle: "long" })} · {memory.author?.display_name ?? "Partner"}</p></div>{memory.author_id === userId && <button className="p-1.5 text-white/35 transition hover:text-rose-200" onClick={() => void remove(memory)} aria-label={`Odstranit vzpomínku ${memory.title}`}><Trash2 size={15} /></button>}</div>{memory.description && <p className="mt-3 line-clamp-2 text-xs leading-5 text-white/50">{memory.description}</p>}</div></article>)}</div>}</section>;
}