"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight, Camera, Check, Heart, KeyRound, LockKeyhole, Mail, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import Brand from "@/components/Brand";
import IconField from "@/components/IconField";

function getAuthRedirectUrl(nextPath?: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://lovygo.vercel.app";
  const url = new URL("/auth/callback", `${appUrl.replace(/\/+$/, "")}/`);
  if (nextPath) url.searchParams.set("next", nextPath);
  return url.toString();
}

function waitForRequest<T>(request: PromiseLike<T>, timeoutMs: number) {
  let timeoutId: number | undefined;
  const timeout = new Promise<{ timedOut: true }>((resolve) => {
    timeoutId = window.setTimeout(() => resolve({ timedOut: true }), timeoutMs);
  });
  return Promise.race([
    Promise.resolve(request).then((result) => ({ result })),
    timeout,
  ]).finally(() => {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  });
}

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot" | "verify-recovery" | "set-password">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [registrationInviteCode, setRegistrationInviteCode] = useState("");
  const [registrationCoupleId, setRegistrationCoupleId] = useState<string | null>(null);
  const [pairMode, setPairMode] = useState<"create" | "join">("create");
  const [signupStep, setSignupStep] = useState(1);
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [configured, setConfigured] = useState(true);
  const signingUp = mode === "signup";
  const recoveringPassword = mode === "forgot";
  const verifyingRecovery = mode === "verify-recovery";
  const verifyingOtp = verifyingRecovery;
  const settingNewPassword = mode === "set-password";

  useEffect(() => {
    if (!avatarPreview) return;
    return () => URL.revokeObjectURL(avatarPreview);
  }, [avatarPreview]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error_code") === "otp_expired") {
      setMessage("Tento starý potvrzovací odkaz už není platný. Přihlaste se nebo požádejte o obnovení hesla.");
    } else if (params.get("auth_error") === "confirmation") {
      setMessage("Ověřovací odkaz už není potřeba. Přihlaste se, nebo obnovte zapomenuté heslo.");
    } else if (params.get("auth_error") === "configuration") {
      setMessage("Ověřovací odkaz dorazil na web, který nemá nastavené Supabase prostředí.");
    }
    const supabase = getSupabaseBrowserClient();
    setConfigured(Boolean(supabase));
    if (!supabase) return;
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) router.replace("/dashboard");
    });
  }, [router]);

  useEffect(() => {
    if (!registrationCoupleId) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    let active = true;
    const checkForPartner = async () => {
      const { data, error } = await supabase.from("couples").select("user_two").eq("id", registrationCoupleId).maybeSingle();
      if (active && !error && data?.user_two) {
        router.replace("/dashboard");
        router.refresh();
      }
    };
    void checkForPartner();
    const interval = window.setInterval(() => void checkForPartner(), 3000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [registrationCoupleId, router]);

  async function finishSignup(userId: string): Promise<{ ok: boolean; coupleId?: string; inviteCode?: string }> {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return { ok: false };
    let avatarPath: string | null = null;
    if (avatar) {
      const extension = avatar.name.split(".").pop()?.toLowerCase() ?? "jpg";
      avatarPath = `${userId}/${crypto.randomUUID()}.${extension}`;
      const upload = await supabase.storage.from("avatars").upload(avatarPath, avatar, { contentType: avatar.type });
      if (upload.error) {
        setMessage("E-mail ověřen, ale profilovou fotku se nepodařilo nahrát. Nahrajte ji po přihlášení.");
        return { ok: false };
      }
    }

    const { error: profileError } = await supabase.from("profiles").update({ display_name: name.trim(), bio: bio.trim(), avatar_url: avatarPath }).eq("id", userId);
    if (profileError) {
      if (avatarPath) await supabase.storage.from("avatars").remove([avatarPath]);
      setMessage("E-mail ověřen, ale profil se nepodařilo uložit. Dokončete jej po přihlášení.");
      return { ok: false };
    }

    const result = pairMode === "join"
      ? await supabase.rpc("join_couple", { code: inviteCode.trim().toUpperCase() })
      : await supabase.rpc("create_couple", { relationship_date: null });
    if (result.error) {
      if (pairMode === "join") sessionStorage.setItem("lovygo-pending-invite", inviteCode.trim().toUpperCase());
      else setMessage("Profil je uložený, ale pár se nepodařilo vytvořit. Přihlaste se a zkuste to znovu.");
      return { ok: pairMode === "join" };
    }
    if (pairMode === "create") {
      const { data: createdCouple, error: coupleError } = await supabase
        .from("couples")
        .select("invite_code")
        .eq("id", result.data)
        .single();
      if (coupleError || !createdCouple) {
        setMessage("Pár je vytvořený. Párovací kód najdete po přihlášení na dashboardu.");
        return { ok: true };
      }
      return { ok: true, coupleId: result.data, inviteCode: createdCouple.invite_code };
    }
    return { ok: true };
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
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
    if (verifyingOtp) {
      setBusy(true);
      const result = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otp.trim(),
        type: "recovery",
      });
      setBusy(false);
      if (result.error || !result.data.user) {
        setMessage("Kód není platný nebo vypršel. Zkontrolujte e-mail a zkuste to znovu.");
        return;
      }
      setMode("set-password");
      setOtp("");
      return;
    }
    if (settingNewPassword) {
      if (newPassword !== confirmNewPassword) {
        setMessage("Hesla se neshodují.");
        return;
      }
      setBusy(true);
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      setBusy(false);
      if (error) {
        setMessage("Nové heslo se nepodařilo uložit. Požádejte o nový resetovací kód.");
        return;
      }
      setMode("signin");
      setPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setMessage("Heslo je změněné. Nyní se přihlaste novým heslem.");
      return;
    }
    if (recoveringPassword) {
      setBusy(true);
      try {
        const response = await waitForRequest(
          supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: getAuthRedirectUrl("/auth/update-password") }),
          15000,
        );
        if ("timedOut" in response) {
          setMessage("Odesílání trvá déle než obvykle. Zkontrolujte e-mail i spam; pokud kód nepřijde, zkuste to znovu.");
          return;
        }
        if (response.result.error) {
          setMessage("Resetovací e-mail se nepodařilo odeslat. Zkontrolujte adresu a zkuste to znovu.");
          return;
        }
        setMode("verify-recovery");
        setOtp("");
        setMessage(`Na ${email.trim()} jsme poslali resetovací kód.`);
      } catch {
        setMessage("Resetovací e-mail se nepodařilo odeslat. Zkontrolujte připojení a zkuste to znovu.");
      } finally {
        setBusy(false);
      }
      return;
    }
    if (signingUp && avatar && avatar.size > 5 * 1024 * 1024) {
      setMessage("Profilová fotka může mít nejvýše 5 MB.");
      return;
    }
    setBusy(true);
    const result = signingUp
      ? await supabase.auth.signUp({ email, password, options: { data: { display_name: name.trim(), bio: bio.trim(), couple_invite_code: pairMode === "join" ? inviteCode.trim().toUpperCase() : null } } })
      : await supabase.auth.signInWithPassword({ email, password });
    if (result.error) {
      setBusy(false);
      setMessage(result.error.message);
      return;
    }
    if (signingUp && !result.data.session) {
      setBusy(false);
      setMessage("Supabase stále vyžaduje potvrzení e-mailu. Vypněte Confirm email v Authentication → Providers → Email a zkuste registraci znovu.");
      return;
    }
    if (signingUp && result.data.user) {
      const completion = await finishSignup(result.data.user.id);
      setBusy(false);
      if (!completion.ok) return;
      if (completion.inviteCode) {
        setRegistrationInviteCode(completion.inviteCode);
        setRegistrationCoupleId(completion.coupleId ?? null);
        return;
      }
    }
    setBusy(false);
    router.replace("/dashboard");
    router.refresh();
  }

  async function resendOtp() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !email.trim()) {
      setMessage("Nejdřív zadejte e-mail použitý při registraci.");
      return;
    }
    setBusy(true);
    try {
      const response = await waitForRequest(
        supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: getAuthRedirectUrl("/auth/update-password") }),
        15000,
      );
      setMessage("timedOut" in response
        ? "Odesílání trvá déle než obvykle. Zkontrolujte e-mail i spam; pokud kód nepřijde, zkuste to znovu."
        : response.result.error
          ? "Nový e-mail se nepodařilo odeslat. Zkontrolujte adresu a zkuste to znovu."
          : `Nový e-mail jsme poslali na ${email.trim()}.`);
    } catch {
      setMessage("Nový e-mail se nepodařilo odeslat. Zkontrolujte připojení a zkuste to znovu.");
    } finally {
      setBusy(false);
    }
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
          <div className="mb-6"><p className="eyebrow">{mode === "signin" ? "Vítejte zpátky" : signingUp ? `Krok ${signupStep} ze 3 · ${stepLabels[signupStep - 1]}` : verifyingRecovery ? "Reset hesla" : settingNewPassword ? "Zabezpečení účtu" : "Obnovení přístupu"}</p><h2 className="mt-2 text-[25px] font-medium tracking-[-.02em]">{mode === "signin" ? "Přihlášení" : signingUp ? ["Vaše přihlášení", "Váš profil", "Propojte se"][signupStep - 1] : verifyingRecovery ? "Zadejte resetovací kód" : settingNewPassword ? "Nastavte nové heslo" : "Zapomenuté heslo"}</h2></div>
          {!configured && <div className="mb-5 rounded-2xl border border-amber-300/20 bg-amber-300/[.07] p-4 text-sm leading-6 text-amber-100/80">Pro zapnutí přihlášení nejdříve nastavte Supabase URL a anon key v `.env.local` a spusťte `supabase/schema.sql`.</div>}
          {signingUp && <ol aria-label="Průběh registrace" className="mb-6 grid grid-cols-3 gap-2">{stepLabels.map((label, index) => { const number = index + 1; const active = number === signupStep; const complete = number < signupStep; return <li key={label} aria-current={active ? "step" : undefined} className={`rounded-xl border px-3 py-2.5 ${active ? "border-pink-200/25 bg-pink-400/[.08]" : complete ? "border-emerald-200/10 bg-emerald-300/[.035]" : "border-white/[.07] bg-white/[.02]"}`}><span className={`mr-2 inline-grid size-5 place-items-center rounded-full text-[10px] ${active ? "bg-[#ff4d8d] text-white" : complete ? "bg-emerald-300/15 text-emerald-100" : "bg-white/[.07] text-white/45"}`}>{complete ? <Check size={12} /> : number}</span><span className={`text-xs ${active ? "text-white" : "text-white/45"}`}>{label}</span></li>; })}</ol>}
          <form className="space-y-4" onSubmit={submit}>
            {mode === "signin" && <>
              <label className="block space-y-2 text-sm text-white/65">E-mail<IconField icon={Mail}><input className="icon-field-input" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="vas@email.cz" /></IconField></label>
              <label className="block space-y-2 text-sm text-white/65">Heslo<IconField icon={LockKeyhole}><input className="icon-field-input" type="password" autoComplete="current-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required placeholder="Alespoň 8 znaků" /></IconField></label>
              <div className="-mt-2 text-right"><button type="button" className="text-xs text-[#ff9abc] transition hover:text-white" onClick={() => { setMode("forgot"); setMessage(""); }}>Zapomněli jste heslo?</button></div>
            </>}
            {recoveringPassword && <><p className="text-sm leading-6 text-white/50">Zadejte e-mail účtu. Pošleme vám resetovací kód.</p><label className="block space-y-2 text-sm text-white/65">E-mail<IconField icon={Mail}><input className="icon-field-input" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="vas@email.cz" /></IconField></label></>}
            {verifyingOtp && <><p className="text-sm leading-6 text-white/50">Kód pro obnovu hesla jsme poslali na <span className="text-white/80">{email}</span>. Zadejte 6–8místný kód z e-mailu.</p><label className="block space-y-2 text-sm text-white/65">Obnovovací kód<IconField icon={KeyRound}><input className="icon-field-input text-center text-lg tracking-[.35em]" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,8}" minLength={6} maxLength={8} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 8))} required placeholder="000000" /></IconField></label><button type="button" className="text-sm text-[#ff9abc] transition hover:text-white" disabled={busy} onClick={() => void resendOtp()}>Poslat nový kód</button></>}
            {settingNewPassword && <><p className="text-sm leading-6 text-white/50">Kód platí jen jednou. Nastavte si nové heslo.</p><label className="block space-y-2 text-sm text-white/65">Nové heslo<IconField icon={LockKeyhole}><input className="icon-field-input" type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required placeholder="Alespoň 8 znaků" /></IconField></label><label className="block space-y-2 text-sm text-white/65">Potvrdit nové heslo<IconField icon={Check}><input className="icon-field-input" type="password" autoComplete="new-password" minLength={8} value={confirmNewPassword} onChange={(event) => setConfirmNewPassword(event.target.value)} required placeholder="Zadejte heslo znovu" /></IconField></label></>}
            {signingUp && signupStep === 1 && <>
              <label className="block space-y-2 text-sm text-white/65">E-mail<IconField icon={Mail}><input className="icon-field-input" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="vas@email.cz" /></IconField></label>
              <label className="block space-y-2 text-sm text-white/65">Heslo<IconField icon={LockKeyhole}><input className="icon-field-input" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required placeholder="Alespoň 8 znaků" /></IconField></label>
              <label className="block space-y-2 text-sm text-white/65">Jméno<IconField icon={UserRound}><input className="icon-field-input" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={60} placeholder="Jak vám máme říkat?" /></IconField></label>
            </>}
            {signingUp && signupStep === 2 && <>
              <label className="block space-y-2 text-sm text-white/65">Krátké bio<textarea className="field min-h-24 resize-y" value={bio} onChange={(event) => setBio(event.target.value)} maxLength={180} required placeholder="Pár slov o vás…" /></label>
              <div className="flex items-center gap-3 rounded-2xl border border-white/[.07] bg-white/[.025] p-3"><span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-full border border-white/10 bg-pink-400/10 text-[#ff8db4]">{avatarPreview ? <Image src={avatarPreview} alt="Náhled profilové fotky" width={48} height={48} unoptimized className="size-full object-cover" /> : <Camera size={18} />}</span><label className="min-w-0 flex-1 cursor-pointer"><span className="block text-sm text-white/75">Profilová fotka</span><span className="mt-1 block text-xs text-white/40">JPG, PNG nebo WebP, max. 5 MB</span><input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" required onChange={(event) => { const file = event.target.files?.[0] ?? null; setAvatar(file); setAvatarPreview(file ? URL.createObjectURL(file) : ""); }} /></label>{avatar && <Check size={16} className="shrink-0 text-emerald-200" />}</div>
            </>}
            {signingUp && signupStep === 3 && (registrationInviteCode ? <>
              <p className="eyebrow">Váš párovací kód</p>
              <p className="select-all rounded-xl border border-white/[.08] bg-white/[.04] px-4 py-4 text-center font-mono text-2xl tracking-[.14em] text-white">{registrationInviteCode}</p>
              <p className="text-sm leading-6 text-white/50">Pošlete kód partnerovi. Jakmile ho zadá a připojí se, oba se automaticky dostanete do společného prostoru.</p>
            </> : <>
              <p className="text-sm leading-6 text-white/50">Vyberte, jestli chcete vytvořit nový pár s náhodným kódem, nebo zadat kód od partnera.</p>
              <div className="grid grid-cols-2 gap-2" role="group" aria-label="Způsob propojení páru"><button type="button" aria-pressed={pairMode === "create"} onClick={() => { setPairMode("create"); setInviteCode(""); }} className={`rounded-xl border px-3 py-3 text-sm transition ${pairMode === "create" ? "border-pink-200/30 bg-pink-400/[.09] text-white" : "border-white/[.08] bg-white/[.025] text-white/50 hover:bg-white/[.05]"}`}><Heart className="mx-auto mb-1.5 text-[#ff7aaa]" size={17} />Vytvořit pár</button><button type="button" aria-pressed={pairMode === "join"} onClick={() => setPairMode("join")} className={`rounded-xl border px-3 py-3 text-sm transition ${pairMode === "join" ? "border-pink-200/30 bg-pink-400/[.09] text-white" : "border-white/[.08] bg-white/[.025] text-white/50 hover:bg-white/[.05]"}`}><KeyRound className="mx-auto mb-1.5 text-[#ff7aaa]" size={17} />Mám kód</button></div>
              {pairMode === "create" ? <p className="rounded-xl border border-white/[.07] bg-white/[.025] px-4 py-3 text-sm leading-6 text-white/50">Po vytvoření účtu se automaticky založí pár a vygeneruje se kód pro pozvání partnera.</p> : <label className="block space-y-2 text-sm text-white/65">Párovací kód od partnera<IconField icon={KeyRound}><input className="icon-field-input uppercase tracking-[.08em] placeholder:normal-case placeholder:tracking-normal" value={inviteCode} onChange={(event) => setInviteCode(event.target.value.toUpperCase())} pattern="LOVE-[A-F0-9]{5}" placeholder="LOVE-8A9B2" autoCapitalize="characters" autoCorrect="off" required /></IconField></label>}
            </>)}
            {message && <p role="status" className="rounded-xl border border-white/10 bg-white/[.04] px-4 py-3 text-sm leading-5 text-white/75">{message}</p>}
            {registrationInviteCode ? <button className="button-quiet w-full" type="button" disabled>Čekáme na partnera…</button> : <div className="flex gap-2 pt-1">{signingUp && signupStep > 1 && <button className="button-quiet flex-1" type="button" onClick={() => { setSignupStep((current) => current - 1); setMessage(""); }}>Zpět</button>}<button className="button-primary mt-0 flex-1" disabled={busy || !configured || (signingUp && signupStep === 3 && pairMode === "join" && !inviteCode.trim()) || (verifyingOtp && (otp.length < 6 || otp.length > 8))} type="submit">{busy ? "Chvilku…" : verifyingRecovery ? "Ověřit kód" : settingNewPassword ? "Uložit nové heslo" : recoveringPassword ? "Poslat resetovací kód" : mode === "signin" ? "Přihlásit se" : signupStep < 3 ? "Pokračovat" : pairMode === "join" ? "Vytvořit účet a připojit" : "Vytvořit účet a pár"}<ArrowRight size={17} /></button></div>}
          </form>
          {!registrationInviteCode && <p className="mt-6 text-center text-sm text-white/45">{mode === "signup" ? "Už účet máte?" : recoveringPassword ? "Už si vzpomínáte?" : verifyingRecovery || settingNewPassword ? "Chcete zpět na přihlášení?" : "Ještě účet nemáte?"}{" "}<button className="text-[#ff91b7] transition hover:text-white" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setSignupStep(1); setMessage(""); }}>{recoveringPassword || verifyingRecovery || settingNewPassword ? "Přihlásit se" : mode === "signup" ? "Přihlásit se" : "Zaregistrovat se"}</button></p>}
        </section>
      </div>
    </main>
  );
}