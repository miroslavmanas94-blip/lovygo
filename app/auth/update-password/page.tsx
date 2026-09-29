"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, LockKeyhole } from "lucide-react";
import Brand from "@/components/Brand";
import IconField from "@/components/IconField";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setMessage("Připojení k Supabase není dostupné.");
      return;
    }
    void supabase.auth.getUser().then(({ data, error }) => {
      if (error || !data.user) setMessage("Resetovací odkaz chybí nebo už vypršel. Požádejte o nový.");
      else setReady(true);
    });
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (password !== confirmation) {
      setMessage("Hesla se neshodují.");
      return;
    }
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setMessage("Připojení k Supabase není dostupné.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setMessage("Heslo se nepodařilo změnit. Požádejte o nový resetovací e-mail.");
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  return <main className="page-enter min-h-screen px-5 py-8 sm:px-10"><header className="mx-auto max-w-[1120px]"><Brand size={46} /></header><section className="glass mx-auto mt-16 w-full max-w-md rounded-[24px] p-6 sm:p-8"><p className="eyebrow">Zabezpečení účtu</p><h1 className="mt-2 text-2xl font-medium">Nové heslo</h1><p className="mt-2 text-sm leading-6 text-white/50">Zvolte nové heslo pro svůj účet Lovygo.</p>{ready ? <form className="mt-6 space-y-4" onSubmit={submit}><label className="block space-y-2 text-sm text-white/65">Nové heslo<IconField icon={LockKeyhole}><input className="icon-field-input" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Alespoň 8 znaků" /></IconField></label><label className="block space-y-2 text-sm text-white/65">Potvrdit heslo<IconField icon={Check}><input className="icon-field-input" type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Zadejte heslo znovu" /></IconField></label>{message && <p role="status" className="rounded-xl border border-white/10 bg-white/[.04] px-4 py-3 text-sm text-white/75">{message}</p>}<button className="button-primary w-full" disabled={busy}>{busy ? "Ukládám…" : "Uložit nové heslo"}</button></form> : message && <p role="status" className="mt-6 rounded-xl border border-white/10 bg-white/[.04] px-4 py-3 text-sm leading-6 text-white/75">{message}</p>}<Link className="button-quiet mt-5 w-full" href="/"><ArrowLeft size={15} />Zpět na přihlášení</Link></section></main>;
}