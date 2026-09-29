"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { CalendarDays, Check, Copy, Heart, Link2, MessageCircle, Sparkles, UsersRound } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { useAppSession } from "@/components/AppShell";
import LovePetWidget from "@/components/LovePetWidget";
import Avatar from "@/components/Avatar";

function PairingPanel() {
  const { profile, userId, couple, refresh, notify } = useAppSession();
  const [joining, setJoining] = useState(false);
  const [code, setCode] = useState("");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [name, setName] = useState(profile?.display_name ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const supabase = getSupabaseBrowserClient();
  const needsProfile = !profile?.display_name || !profile.bio || !profile.avatar_url;

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getUser().then(({ data }) => {
      const metadataCode = data.user?.user_metadata.couple_invite_code;
      const pendingCode = sessionStorage.getItem("lovygo-pending-invite");
      const savedCode = typeof metadataCode === "string" ? metadataCode : pendingCode;
      if (savedCode) {
        setCode(savedCode.toUpperCase());
        setJoining(true);
      }
    });
  }, [supabase]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !userId) return;
    setBusy(true);
    let avatarPath = profile?.avatar_url ?? null;
    if (avatar) {
      const extension = avatar.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${userId}/${crypto.randomUUID()}.${extension}`;
      const upload = await supabase.storage.from("avatars").upload(path, avatar, { upsert: false });
      if (upload.error) {
        notify("Fotku se nepodařilo nahrát. Zkontrolujte nastavení úložiště.");
        setBusy(false);
        return;
      }
      avatarPath = path;
    }
    const { error } = await supabase.from("profiles").update({ display_name: name.trim(), bio: bio.trim(), avatar_url: avatarPath }).eq("id", userId);
    setBusy(false);
    if (error) notify("Profil se nepodařilo uložit.");
    else { notify("Profil je uložený."); await refresh(); }
  }

  async function connect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    const result = joining
      ? await supabase.rpc("join_couple", { code: code.trim().toUpperCase() })
      : await supabase.rpc("create_couple", { relationship_date: date || null });
    setBusy(false);
    if (result.error) notify(result.error.message.includes("invalid") ? "Kód není platný nebo už byl použit." : "Pár se nepodařilo propojit. Zkuste to znovu.");
    else {
      sessionStorage.removeItem("lovygo-pending-invite");
      if (joining) await supabase.auth.updateUser({ data: { couple_invite_code: null } });
      notify(joining ? "Jste propojeni. Váš společný prostor je připraven." : "Váš prostor je připravený. Pošlete partnerovi kód.");
      await refresh();
    }
  }

  return <div className="mx-auto max-w-[760px] space-y-5 page-enter">
    <div className="mb-8"><p className="eyebrow">Začněme u vás</p><h1 className="mt-2 text-3xl font-medium tracking-[-.03em]">Vytvořte si svůj prostor</h1><p className="mt-3 max-w-xl text-sm leading-6 text-white/50">Nejdřív dokončete profil, potom vytvořte pár nebo se připojte pomocí kódu od partnera.</p></div>
    {needsProfile && <section className="glass rounded-[22px] p-5 sm:p-7"><div className="mb-5 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-pink-400/10 text-[#ff7aaa]"><UsersRound size={18} /></span><div><p className="font-medium">Váš profil</p><p className="text-xs text-white/40">Viditelný pouze vám a vašemu partnerovi</p></div></div>
      <form className="grid gap-4 sm:grid-cols-[1fr_1fr]" onSubmit={saveProfile}>
        <label className="space-y-2 text-sm text-white/60">Jméno<input className="field" value={name} onChange={(event) => setName(event.target.value)} maxLength={60} required /></label>
        <label className="space-y-2 text-sm text-white/60">Profilová fotka<input className="field file:mr-3 file:rounded-lg file:border-0 file:bg-pink-500/15 file:px-3 file:py-1.5 file:text-xs file:text-pink-100" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0] ?? null; setAvatar(file); setAvatarPreview(file ? URL.createObjectURL(file) : ""); }} required={!profile?.avatar_url} />{avatarPreview && <Image src={avatarPreview} alt="Náhled profilové fotky" width={64} height={64} unoptimized className="size-16 rounded-full object-cover" />}</label>
        <label className="space-y-2 text-sm text-white/60 sm:col-span-2">Krátké bio<textarea className="field min-h-20 resize-y" value={bio} onChange={(event) => setBio(event.target.value)} maxLength={180} required placeholder="Pár slov o vás…" /></label>
        <button className="button-primary sm:col-span-2 sm:justify-self-start" disabled={busy}>{busy ? "Ukládám…" : "Uložit profil"}<Check size={16} /></button>
      </form>
    </section>}
    {couple && <section className="glass rounded-[22px] p-5 sm:p-6"><p className="eyebrow">Váš párovací kód</p><p className="mt-2 select-all font-mono text-2xl tracking-[.14em] text-white">{couple.invite_code}</p><p className="mt-2 text-sm text-white/45">Pošlete kód partnerovi. Profilovou fotku můžete doplnit hned vedle.</p></section>}
    {!needsProfile && <div className="grid gap-4 md:grid-cols-2">
      <button className={`glass rounded-[22px] p-6 text-left transition hover:border-pink-200/25 ${!joining ? "border-pink-300/20" : ""}`} onClick={() => setJoining(false)}><span className="grid size-11 place-items-center rounded-2xl bg-pink-400/10 text-[#ff7aaa]"><Heart size={19} /></span><p className="mt-5 text-lg font-medium">Vytvořit nový pár</p><p className="mt-2 text-sm leading-5 text-white/45">Založte společný prostor a pozvěte partnera jedinečným kódem.</p></button>
      <button className={`glass rounded-[22px] p-6 text-left transition hover:border-pink-200/25 ${joining ? "border-pink-300/20" : ""}`} onClick={() => setJoining(true)}><span className="grid size-11 place-items-center rounded-2xl bg-white/[.06] text-white/80"><Link2 size={19} /></span><p className="mt-5 text-lg font-medium">Mám kód od partnera</p><p className="mt-2 text-sm leading-5 text-white/45">Připojte se k již vytvořenému páru.</p></button>
    </div>}
    {!needsProfile && <form className="glass space-y-4 rounded-[22px] p-5 sm:p-7" onSubmit={connect}>
      <div><p className="eyebrow">{joining ? "Připojení" : "Nový pár"}</p><h2 className="mt-1 text-xl font-medium">{joining ? "Zadejte pozvánkový kód" : "Nastavte začátek vztahu"}</h2></div>
      {joining ? <input className="field max-w-sm uppercase tracking-[.12em]" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="LOVE-8A9B2" pattern="LOVE-[A-F0-9]{5}" required /> : <label className="block max-w-sm space-y-2 text-sm text-white/60">Datum začátku vztahu<span className="relative block"><CalendarDays size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35" /><input className="field pl-11" type="date" value={date} onChange={(event) => setDate(event.target.value)} max={new Date().toISOString().slice(0, 10)} /></span></label>}
      <button className="button-primary" disabled={busy || needsProfile}>{busy ? "Propojuji…" : joining ? "Připojit se" : "Vytvořit společný prostor"}<Heart size={16} /></button>
    </form>}
  </div>;
}

function RelationshipTimer() {
  const { couple } = useAppSession();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const interval = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(interval); }, []);
  if (!couple?.relationship_start) return <p className="mt-4 text-sm text-white/45">Začátek vztahu zatím není nastavený.</p>;
  const start = new Date(`${couple.relationship_start}T00:00:00`).getTime();
  const seconds = Math.max(0, Math.floor((now - start) / 1000));
  const units = [{ value: Math.floor(seconds / 86400), label: "dní" }, { value: Math.floor(seconds / 3600) % 24, label: "hodin" }, { value: Math.floor(seconds / 60) % 60, label: "minut" }, { value: seconds % 60, label: "sekund" }];
  return <div className="mt-6 grid max-w-[470px] grid-cols-4 gap-2">{units.map(({ value, label }) => <div className="rounded-2xl border border-white/[.07] bg-black/20 px-3 py-3 text-center" key={label}><p className="text-2xl font-medium tabular-nums text-white">{value.toLocaleString("cs-CZ")}</p><p className="mt-1 text-[10px] uppercase tracking-wider text-white/40">{label}</p></div>)}</div>;
}

function DailyNoteCard() {
  const { couple, userId, notify } = useAppSession();
  const [content, setContent] = useState("");
  const [noteId, setNoteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const coupleId = couple?.id;
  const today = new Date().toISOString().slice(0, 10);
  useEffect(() => {
    if (!coupleId) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const load = async () => {
      const { data } = await supabase.from("daily_notes").select("id,content").eq("couple_id", coupleId).eq("note_date", today).maybeSingle();
      if (data) { setNoteId(data.id); setContent(data.content); }
    };
    void load();
    const channel = supabase.channel(`note:${coupleId}`).on("postgres_changes", { event: "*", schema: "public", table: "daily_notes", filter: `couple_id=eq.${coupleId}` }, (payload) => { const row = payload.new as { id?: string; content?: string; note_date?: string }; if (row.note_date === today) { setNoteId(row.id ?? null); setContent(row.content ?? ""); } }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [coupleId, today]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !couple || !userId || !content.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("daily_notes").upsert({ ...(noteId ? { id: noteId } : {}), couple_id: couple.id, author_id: userId, note_date: today, content: content.trim() }, { onConflict: "couple_id,note_date" });
    setBusy(false);
    notify(error ? "Vzkaz dne se nepodařilo uložit." : "Vzkaz dne je uložený.");
  }
  return <section className="glass rounded-[22px] p-5 sm:p-6"><div className="mb-4 flex items-center justify-between"><div><p className="eyebrow">Na dnešek</p><h2 className="mt-1 text-lg font-medium">Vzkaz dne</h2></div><Sparkles size={17} className="text-[#ff7aaa]" /></div><form onSubmit={save}><textarea className="field min-h-[104px] resize-none text-sm leading-6" value={content} onChange={(event) => setContent(event.target.value)} maxLength={500} placeholder="Napište partnerovi něco hezkého…" /><button className="button-quiet mt-3 w-full text-sm" disabled={busy || !content.trim()}>{busy ? "Ukládám…" : noteId ? "Uložit změnu" : "Poslat vzkaz"}<Heart size={15} /></button></form></section>;
}

export default function DashboardPage() {
  const { profile, partner, couple, loading, configured } = useAppSession();
  const [copied, setCopied] = useState(false);
  if (loading) return null;
  if (!configured) return <section className="glass mx-auto max-w-2xl rounded-[22px] p-6 sm:p-8"><p className="eyebrow">Připojení k databázi</p><h1 className="mt-2 text-2xl font-medium">Nejdřív nastavte Supabase</h1><p className="mt-3 text-sm leading-6 text-white/55">Vytvořte projekt Supabase, vložte URL a veřejný anon key do `.env.local`, spusťte `supabase/schema.sql` a restartujte vývojový server.</p><a className="button-quiet mt-5" href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">Otevřít Supabase</a></section>;
  if (!profile?.display_name || !profile.bio || !profile.avatar_url || !profile.couple_id || !couple) return <PairingPanel />;
  const avatar = (person: typeof profile, label: string) => <div className="flex items-center gap-3"><Avatar profile={person} label={label} size="size-12" /><div><p className="text-sm font-medium">{person?.display_name || label}</p><p className="mt-0.5 text-xs text-white/40">{label}</p></div></div>;
  return <div className="page-enter space-y-7">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Dobrý den, {profile.display_name}</p><h1 className="mt-2 text-3xl font-medium tracking-[-.03em] sm:text-[36px]">Váš společný prostor</h1></div><div className="flex items-center gap-3 text-sm text-white/45"><span className={`size-2 rounded-full ${partner ? "bg-emerald-300 shadow-[0_0_10px_#6ee7b7]" : "bg-amber-200"}`} />{partner ? "Propojeni" : "Kód připraven"}</div></header>
    <section className="glass relative overflow-hidden rounded-[25px] p-6 sm:p-8"><div className="absolute -right-12 -top-24 size-64 rounded-full bg-pink-500/[.08] blur-[80px]" /><div className="relative flex flex-wrap items-center justify-between gap-5"><div className="flex flex-wrap items-center gap-5 sm:gap-8">{avatar(profile, "Vy")}<Heart size={17} className="text-[#ff7aaa]" fill="currentColor" />{partner ? avatar(partner, "Partner") : <div className="text-sm text-white/50">Čekáme na partnera</div>}</div><button className="button-quiet text-xs" onClick={async () => { await navigator.clipboard.writeText(couple.invite_code); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Zkopírováno" : couple.invite_code}</button></div><div className="relative mt-7 border-t border-white/[.08] pt-5"><p className="text-xs text-white/40">Společně od</p><RelationshipTimer /></div></section>
    <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]"><LovePetWidget /><div className="space-y-5"><DailyNoteCard /><section className="glass flex items-center gap-4 rounded-[22px] p-5"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/[.06] text-[#ff7aaa]"><MessageCircle size={19} /></span><div><p className="font-medium">Jste na dálku, ne sami.</p><p className="mt-1 text-sm text-white/45">Pošlete si zprávu nebo se spojte přes video.</p></div><Link href="/dashboard/chat" aria-label="Otevřít chat" className="button-quiet ml-auto size-10 shrink-0 p-0"><Heart size={16} /></Link></section></div></div>
  </div>;
}