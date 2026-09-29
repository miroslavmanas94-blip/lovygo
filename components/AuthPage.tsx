"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Heart, LockKeyhole, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [configured, setConfigured] = useState(true);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    setConfigured(Boolean(supabase));
    if (!supabase) return;
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) router.replace("/dashboard");
    });
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setConfigured(false);
      setMessage("Aplikace zatím není připojena k Supabase. Doplňte proměnné prostředí a spusťte SQL schema.");
      return;
    }
    setBusy(true);
    const result = mode === "signup"
      ? await supabase.auth.signUp({ email, password, options: { data: { display_name: name.trim() } } })
      : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    if (mode === "signup" && !result.data.session) {
      setMessage("Zkontrolujte svůj e-mail a potvrďte registraci. Potom se přihlaste.");
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <main className="page-enter min-h-screen overflow-hidden px-5 py-7 sm:px-10 sm:py-10">
      <header className="mx-auto flex max-w-[1380px] items-center justify-between">
        <Link href="/" className="flex items-center gap-3" aria-label="Lovygo domů">
          <span className="grid size-10 place-items-center rounded-2xl border border-pink-300/20 bg-pink-500/10 text-[#ff7aaa]"><Heart size={19} fill="currentColor" /></span>
          <span className="text-[18px] font-semibold tracking-[.02em]">lovygo</span>
        </Link>
        <span className="hidden items-center gap-2 text-xs text-white/45 sm:flex"><ShieldCheck size={15} /> Soukromý prostor. Jen pro vás dva.</span>
      </header>

      <div className="mx-auto grid min-h-[calc(100vh-105px)] max-w-[1180px] items-center gap-14 py-14 lg:grid-cols-[1fr_420px] lg:gap-20">
        <section className="relative max-w-[630px]">
          <div className="absolute -left-20 top-10 -z-10 size-72 rounded-full bg-[#ff4d8d]/10 blur-[100px]" />
          <p className="eyebrow mb-6 inline-flex items-center gap-2"><Sparkles size={13} /> Váš společný prostor</p>
          <h1 className="max-w-[610px] text-[clamp(48px,7vw,82px)] font-medium leading-[.98] tracking-[-.045em] text-white">Blízko,<br /><span className="text-[#ff7aaa]">i když</span> daleko.</h1>
          <p className="mt-7 max-w-[430px] text-[16px] leading-7 text-white/55">Maličkosti, které vás drží spolu. Zprávy, vzpomínky a chvíle, které patří jen vám dvěma.</p>
          <div className="mt-11 flex items-center gap-3"><ShieldCheck size={16} className="text-[#ff7aaa]/70" /><span className="text-sm text-white/48">Váš vztah. Vaše tempo. Vaše místo.</span></div>
        </section>

        <section className="glass w-full rounded-[24px] p-6 sm:p-8">
          <div className="mb-7"><p className="eyebrow">{mode === "signin" ? "Vítejte zpátky" : "Začněte společnou cestu"}</p><h2 className="mt-2 text-[25px] font-medium tracking-[-.02em]">{mode === "signin" ? "Přihlášení" : "Vytvořit účet"}</h2></div>
          {!configured && <div className="mb-5 rounded-2xl border border-amber-300/20 bg-amber-300/[.07] p-4 text-sm leading-6 text-amber-100/80">Pro zapnutí přihlášení nejdříve nastavte Supabase URL a anon key v `.env.local` a spusťte `supabase/schema.sql`.</div>}
          <form className="space-y-4" onSubmit={submit}>
            {mode === "signup" && <label className="block space-y-2 text-sm text-white/65">Jméno<input className="field" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={60} placeholder="Jak vám máme říkat?" /></label>}
            <label className="block space-y-2 text-sm text-white/65">E-mail<span className="relative block"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35" size={17} /><input className="field pl-11" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="vas@email.cz" /></span></label>
            <label className="block space-y-2 text-sm text-white/65">Heslo<span className="relative block"><LockKeyhole className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35" size={17} /><input className="field pl-11" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required placeholder="Alespoň 8 znaků" /></span></label>
            {message && <p role="status" className="rounded-xl border border-white/10 bg-white/[.04] px-4 py-3 text-sm leading-5 text-white/75">{message}</p>}
            <button className="button-primary mt-2 w-full" disabled={busy || !configured} type="submit">{busy ? "Chvilku…" : mode === "signin" ? "Přihlásit se" : "Vytvořit účet"}<ArrowRight size={17} /></button>
          </form>
          <p className="mt-6 text-center text-sm text-white/45">{mode === "signin" ? "Ještě nemáte účet?" : "Už účet máte?"}{" "}<button className="text-[#ff91b7] transition hover:text-white" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(""); }}>{mode === "signin" ? "Zaregistrovat se" : "Přihlásit se"}</button></p>
        </section>
      </div>
    </main>
  );
}