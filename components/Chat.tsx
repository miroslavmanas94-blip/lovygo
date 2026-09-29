"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import { Heart, ImagePlus, Send, Smile } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { useAppSession } from "@/components/AppShell";
import type { Message, UserProfile } from "@/types";
import VideoCall from "@/components/VideoCall";
import Avatar from "@/components/Avatar";

type ChatMessage = Message & { sender?: UserProfile; signedImage?: string | null };

export default function Chat() {
  const { couple, userId, profile, partner, notify } = useAppSession();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const coupleId = couple?.id;

  useEffect(() => {
    if (!coupleId) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    let alive = true;
    const hydrate = async (rows: Message[]) => {
      const users = [profile, partner].filter((entry): entry is UserProfile => Boolean(entry));
      const hydrated = await Promise.all(rows.map(async (message) => {
        const signedImage = message.image_url ? (await supabase.storage.from("memories").createSignedUrl(message.image_url, 3600)).data?.signedUrl ?? null : null;
        return { ...message, sender: users.find((entry) => entry.id === message.sender_id), signedImage };
      }));
      if (alive) setMessages(hydrated);
    };
    const load = async () => {
      const { data, error } = await supabase.from("messages").select("*").eq("couple_id", coupleId).order("created_at", { ascending: true }).limit(100);
      if (error) notify("Zprávy se nepodařilo načíst.");
      else await hydrate((data ?? []) as Message[]);
    };
    void load();
    const channel = supabase.channel(`messages:${coupleId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `couple_id=eq.${coupleId}` }, (payload) => {
      const row = payload.new as Message;
      void (async () => {
        const signedImage = row.image_url ? (await supabase.storage.from("memories").createSignedUrl(row.image_url, 3600)).data?.signedUrl ?? null : null;
        if (alive) setMessages((current) => current.some((item) => item.id === row.id) ? current : [...current, { ...row, sender: [profile, partner].find((entry) => entry?.id === row.sender_id) ?? undefined, signedImage }]);
      })();
    }).subscribe();
    return () => { alive = false; void supabase.removeChannel(channel); };
  }, [coupleId, profile, partner, notify]);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !couple || !userId || (!text.trim() && !file) || busy) return;
    setBusy(true);
    let imagePath: string | null = null;
    if (file) {
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      imagePath = `${couple.id}/chat/${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage.from("memories").upload(imagePath, file, { contentType: file.type });
      if (error) { notify("Fotografii se nepodařilo nahrát."); setBusy(false); return; }
    }
    const { error } = await supabase.from("messages").insert({ couple_id: couple.id, sender_id: userId, content: text.trim() || null, image_url: imagePath });
    setBusy(false);
    if (error) notify("Zprávu se nepodařilo odeslat.");
    else { setText(""); setFile(null); if (picker.current) picker.current.value = ""; }
  }

  return <div className="grid min-h-[calc(100vh-150px)] gap-5 lg:grid-cols-[minmax(0,1fr)_310px]">
    <section className="glass flex min-h-[620px] flex-col overflow-hidden rounded-[24px]">
      <header className="flex items-center gap-3 border-b border-white/[.08] px-5 py-4"><Avatar profile={partner} label="Partner" size="size-10" /><div><h1 className="font-medium">{partner?.display_name || "Váš chat"}</h1><p className="mt-0.5 text-xs text-white/40">Soukromý chat pro dva</p></div><span className="ml-auto flex items-center gap-2 text-xs text-emerald-200/70"><span className="size-1.5 rounded-full bg-emerald-300" />Realtime</span></header>
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">{messages.length === 0 ? <div className="flex h-full min-h-[350px] flex-col items-center justify-center text-center"><span className="grid size-14 place-items-center rounded-[20px] bg-pink-400/10 text-[#ff7aaa]"><Heart size={22} /></span><p className="mt-4 font-medium">Váš příběh začíná tady</p><p className="mt-2 max-w-xs text-sm leading-5 text-white/40">Pošlete první zprávu. Tenhle prostor patří jen vám dvěma.</p></div> : messages.map((message) => { const mine = message.sender_id === userId; return <div key={message.id} className={`flex items-end gap-2.5 ${mine ? "justify-end" : "justify-start"}`}>{!mine && <Avatar profile={message.sender ?? null} label="Partner" size="size-7" />}<div className={`max-w-[min(82%,440px)] rounded-[18px] px-4 py-3 ${mine ? "rounded-br-md bg-gradient-to-br from-[#f64c87] to-[#d83a73]" : "rounded-bl-md border border-white/[.08] bg-white/[.055]"}`}>{!mine && <p className="mb-1 text-[11px] text-white/50">{message.sender?.display_name ?? "Partner"}</p>}{message.signedImage && <Image src={message.signedImage} alt="Fotografie v chatu" width={640} height={480} unoptimized className="mb-2 max-h-72 rounded-xl object-cover" />}{message.content && <p className="whitespace-pre-wrap break-words text-sm leading-5">{message.content}</p>}<p className={`mt-1 text-right text-[10px] ${mine ? "text-white/65" : "text-white/35"}`}>{new Date(message.created_at).toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}</p></div></div>; })}<div ref={bottom} /></div>
      <form className="border-t border-white/[.08] p-3 sm:p-4" onSubmit={send}><input ref={picker} type="file" accept="image/*" className="sr-only" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><div className="flex items-end gap-2"><button type="button" aria-label="Přidat fotografii" className="button-quiet size-11 shrink-0 p-0" onClick={() => picker.current?.click()}><ImagePlus size={18} /></button><textarea className="field max-h-32 min-h-11 flex-1 resize-y py-3 text-sm" rows={1} value={text} onChange={(event) => setText(event.target.value)} maxLength={4000} placeholder={file ? `Fotografie: ${file.name}` : "Napište zprávu…"} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} /><button type="submit" disabled={busy || (!text.trim() && !file)} className="button-primary size-11 shrink-0 p-0" aria-label="Odeslat zprávu">{busy ? <span className="size-4 animate-spin rounded-full border-2 border-white/35 border-t-white" /> : <Send size={17} />}</button></div>{file && <button type="button" className="mt-2 px-2 text-xs text-white/50 hover:text-white" onClick={() => { setFile(null); if (picker.current) picker.current.value = ""; }}>Odebrat fotografii: {file.name}</button>}</form>
    </section>
    <aside className="hidden space-y-5 lg:block"><VideoCall /><section className="glass rounded-[22px] p-5"><div className="mb-4 flex items-center gap-2"><Smile size={17} className="text-[#ff7aaa]" /><h2 className="font-medium">Váš společný prostor</h2></div><p className="text-sm leading-6 text-white/45">Každá zpráva zůstává mezi vámi. Sdílejte plány, fotky i obyčejné „dobrou noc“.</p></section></aside>
    <div className="lg:hidden"><VideoCall /></div>
  </div>;
}