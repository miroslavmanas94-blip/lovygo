"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, Camera, Check, KeyRound, LockKeyhole, Mail, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import Brand from "@/components/Brand";
import IconField from "@/components/IconField";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [signupStep, setSignupStep] = useState(1);
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [canResend, setCanResend] = useState(false);
  const [configured, setConfigured] = useState(true);
  const signingUp = mode === "signup";

  useEffect(() => {
    if (!avatarPreview) return;
    return () => URL.revokeObjectURL(avatarPreview);
  }, [avatarPreview]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error_code") === "otp_expired") {
      setMessage("Potvrzovací odkaz vypršel. Zadejte stejný e-mail a požádejte o nový odkaz.");
      setCanResend(true);
    }
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
    setCanResend(false);
    if (signingUp && signupStep < 3) {
      if (signupStep === 2 && avatar && avatar.size > 5 * 1024 * 1024) {
        setMessage("Profilová fotka může mít nejvýše 5 MB.");
        return;
      }
      setSignupStep((current) => current + 1);
      return;
    }
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setConfigured(false);
      setMessage("Aplikace zatím není připojena k Supabase. Doplňte proměnné prostředí a spusťte SQL schema.");
      return;
    }
    if (signingUp && avatar && avatar.size > 5 * 1024 * 1024) {
      setMessage("Profilová fotka může mít nejvýše 5 MB.");
      return;
    }
    setBusy(true);
    const result = signingUp
      ? await supabase.auth.signUp({ email, password, options: { data: { display_name: name.trim(), bio: bio.trim(), couple_invite_code: inviteCode.trim().toUpperCase() || null } } })
      : await supabase.auth.signInWithPassword({ email, password });
    if (result.error) {
      setBusy(false);
      setMessage(result.error.message);
      setCanResend(signingUp && result.error.message.toLowerCase().includes("already registered"));
      return;
    }
    if (signingUp && !result.data.session) {
      setBusy(false);
      setMessage("Účet je založený. Potvrďte e-mail a potom se přihlaste. Z bezpečnostních důvodů se fotka nahraje po potvrzení při prvním vstupu do profilu.");
      setCanResend(true);
      return;
    }
    if (signingUp && result.data.user) {
      let avatarPath: string | null = null;
      if (avatar) {
        const extension = avatar.name.split(".").pop()?.toLowerCase() ?? "jpg";
        avatarPath = `${result.data.user.id}/${crypto.randomUUID()}.${extension}`;
        const upload = await supabase.storage.from("avatars").upload(avatarPath, avatar, { contentType: avatar.type });
        if (upload.error) {
          setBusy(false);
          setMessage("Účet je založený, ale fotku se nepodařilo nahrát. Přihlaste se a zkuste ji nahrát z profilu.");
          return;
        }
      }
      const { error: profileError } = await supabase.from("profiles").update({ display_name: name.trim(), bio: bio.trim(), avatar_url: avatarPath }).eq("id", result.data.user.id);
      if (profileError) {
        if (avatarPath) await supabase.storage.from("avatars").remove([avatarPath]);
        setBusy(false);
        setMessage("Účet je založený, ale profil se nepodařilo uložit. Přihlaste se a dokončete jej v nastavení profilu.");
        return;
      }
      if (inviteCode.trim()) {
        const { error: coupleError } = await supabase.rpc("join_couple", { code: inviteCode.trim().toUpperCase() });
        if (coupleError) sessionStorage.setItem("lovygo-pending-invite", inviteCode.trim().toUpperCase());
      }
    }
    setBusy(false);
    router.replace("/dashboard");
    router.refresh();
  }

  async function resendConfirmation() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !email.trim()) {
      setMessage("Nejdřív zadejte e-mail použitý při registraci.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.resend({ type: "signup", email: email.trim() });
    setBusy(false);
    setMessage(error ? "Nový potvrzovací e-mail se nepodařilo odeslat. Zkontrolujte adresu a zkuste to znovu." : "Poslali jsme nový potvrzovací odkaz. Zkontrolujte e-mailovou schránku.");
  }

  const stepLabels = ["Účet", "Profil", "Pár"];
  return (
    <main className="page-enter min-h-screen overflow-hidden px-5 py-7 sm:px-10 sm:py-10">
      <header className="mx-auto flex max-w-[1380px] items-center justify-between">
        <Brand size={46} />
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
          <div className="mb-6"><p className="eyebrow">{mode === "signin" ? "Vítejte zpátky" : `Krok ${signupStep} ze 3 · ${stepLabels[signupStep - 1]}`}</p><h2 className="mt-2 text-[25px] font-medium tracking-[-.02em]">{mode === "signin" ? "Přihlášení" : ["Vaše přihlášení", "Váš profil", "Propojte se"][signupStep - 1]}</h2></div>
          {!configured && <div className="mb-5 rounded-2xl border border-amber-300/20 bg-amber-300/[.07] p-4 text-sm leading-6 text-amber-100/80">Pro zapnutí přihlášení nejdříve nastavte Supabase URL a anon key v `.env.local` a spusťte `supabase/schema.sql`.</div>}
          {signingUp && <ol aria-label="Průběh registrace" className="mb-6 grid grid-cols-3 gap-2">{stepLabels.map((label, index) => { const number = index + 1; const active = number === signupStep; const complete = number < signupStep; return <li key={label} aria-current={active ? "step" : undefined} className={`rounded-xl border px-3 py-2.5 ${active ? "border-pink-200/25 bg-pink-400/[.08]" : complete ? "border-emerald-200/10 bg-emerald-300/[.035]" : "border-white/[.07] bg-white/[.02]"}`}><span className={`mr-2 inline-grid size-5 place-items-center rounded-full text-[10px] ${active ? "bg-[#ff4d8d] text-white" : complete ? "bg-emerald-300/15 text-emerald-100" : "bg-white/[.07] text-white/45"}`}>{complete ? <Check size={12} /> : number}</span><span className={`text-xs ${active ? "text-white" : "text-white/45"}`}>{label}</span></li>; })}</ol>}
          <form className="space-y-4" onSubmit={submit}>
            {mode === "signin" && <>
              <label className="block space-y-2 text-sm text-white/65">E-mail<IconField icon={Mail}><input className="icon-field-input" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="vas@email.cz" /></IconField></label>
              <label className="block space-y-2 text-sm text-white/65">Heslo<IconField icon={LockKeyhole}><input className="icon-field-input" type="password" autoComplete="current-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required placeholder="Alespoň 8 znaků" /></IconField></label>
            </>}
            {signingUp && signupStep === 1 && <>
              <label className="block space-y-2 text-sm text-white/65">E-mail<IconField icon={Mail}><input className="icon-field-input" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="vas@email.cz" /></IconField></label>
              <label className="block space-y-2 text-sm text-white/65">Heslo<IconField icon={LockKeyhole}><input className="icon-field-input" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required placeholder="Alespoň 8 znaků" /></IconField></label>
              <label className="block space-y-2 text-sm text-white/65">Jméno<IconField icon={UserRound}><input className="icon-field-input" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={60} placeholder="Jak vám máme říkat?" /></IconField></label>
            </>}
            {signingUp && signupStep === 2 && <>
              <label className="block space-y-2 text-sm text-white/65">Krátké bio<textarea className="field min-h-24 resize-y" value={bio} onChange={(event) => setBio(event.target.value)} maxLength={180} required placeholder="Pár slov o vás…" /></label>
              <div className="flex items-center gap-3 rounded-2xl border border-white/[.07] bg-white/[.025] p-3"><span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-full border border-white/10 bg-pink-400/10 text-[#ff8db4]">{avatarPreview ? <Image src={avatarPreview} alt="Náhled profilové fotky" width={48} height={48} unoptimized className="size-full object-cover" /> : <Camera size={18} />}</span><label className="min-w-0 flex-1 cursor-pointer"><span className="block text-sm text-white/75">Profilová fotka</span><span className="mt-1 block text-xs text-white/40">JPG, PNG nebo WebP, max. 5 MB</span><input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" required onChange={(event) => { const file = event.target.files?.[0] ?? null; setAvatar(file); setAvatarPreview(file ? URL.createObjectURL(file) : ""); }} /></label>{avatar && <Check size={16} className="shrink-0 text-emerald-200" />}</div>
            </>}
            {signingUp && signupStep === 3 && <>
              <p className="text-sm leading-6 text-white/50">Máte-li kód od partnera, zadejte ho a po vytvoření účtu se připojíte rovnou. Bez kódu můžete pár vytvořit později.</p>
              <label className="block space-y-2 text-sm text-white/65">Párovací kód <span className="text-xs text-white/35">(nepovinné)</span><IconField icon={KeyRound}><input className="icon-field-input uppercase tracking-[.08em] placeholder:normal-case placeholder:tracking-normal" value={inviteCode} onChange={(event) => setInviteCode(event.target.value.toUpperCase())} pattern="LOVE-[A-F0-9]{5}" placeholder="LOVE-8A9B2" autoCapitalize="characters" autoCorrect="off" /></IconField></label>
            </>}
            {message && <div role="status" className="rounded-xl border border-white/10 bg-white/[.04] px-4 py-3 text-sm leading-5 text-white/75"><p>{message}</p>{canResend && <button type="button" className="mt-2 inline-flex items-center gap-2 text-[#ff9abc] hover:text-white" disabled={busy} onClick={() => void resendConfirmation()}><Mail size={14} />Odeslat nový potvrzovací e-mail</button>}</div>}
            <div className="flex gap-2 pt-1">{signingUp && signupStep > 1 && <button className="button-quiet flex-1" type="button" onClick={() => { setSignupStep((current) => current - 1); setMessage(""); }}>Zpět</button>}<button className="button-primary mt-0 flex-1" disabled={busy || !configured} type="submit">{busy ? "Chvilku…" : mode === "signin" ? "Přihlásit se" : signupStep < 3 ? "Pokračovat" : inviteCode.trim() ? "Vytvořit účet a připojit" : "Vytvořit účet"}<ArrowRight size={17} /></button></div>
          </form>
          <p className="mt-6 text-center text-sm text-white/45">{mode === "signin" ? "Ještě nemáte účet?" : "Už účet máte?"}{" "}<button className="text-[#ff91b7] transition hover:text-white" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setSignupStep(1); setMessage(""); }}>{mode === "signin" ? "Zaregistrovat se" : "Přihlásit se"}</button></p>
        </section>
      </div>
    </main>
  );
}