"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Compass, Gamepad2, Home, LogOut, MessageCircle, MonitorPlay } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { useAppSession } from "@/components/AppShell";
import Avatar from "@/components/Avatar";
import Brand from "@/components/Brand";

const navigation = [
  { href: "/dashboard", label: "Domů", icon: Home },
  { href: "/dashboard/chat", label: "Chat", icon: MessageCircle },
  { href: "/dashboard/watch", label: "Watch", icon: MonitorPlay },
  { href: "/dashboard/games", label: "Hry", icon: Gamepad2 },
  { href: "/dashboard/world", label: "Svět", icon: Compass },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useAppSession();
  async function signOut() {
    await getSupabaseBrowserClient()?.auth.signOut();
    router.replace("/");
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-white/[.07] bg-[#09090f]/70 px-5 py-7 backdrop-blur-2xl md:flex">
      <Brand href="/dashboard" size={43} />
      <p className="eyebrow mb-3 px-3">Váš společný prostor</p>
      <nav className="space-y-1" aria-label="Hlavní navigace">
        {navigation.map(({ href, label, icon: Icon }) => {
          const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
          return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`group flex items-center gap-3 rounded-[14px] px-3 py-3 text-sm transition ${active ? "border border-pink-200/10 bg-pink-500/[.12] text-white" : "text-white/50 hover:bg-white/[.045] hover:text-white/85"}`}><Icon size={18} className={active ? "text-[#ff7aaa]" : "text-white/42 group-hover:text-white/75"} />{label}{active && <span className="ml-auto size-1.5 rounded-full bg-[#ff7aaa] shadow-[0_0_10px_#ff4d8d]" />}</Link>;
        })}
      </nav>
      <div className="mt-auto border-t border-white/[.07] pt-5">
        <div className="mb-4 flex items-center gap-3 px-2">
          <Avatar profile={profile} label="Váš profil" size="size-9" />
          <div className="min-w-0"><p className="truncate text-sm text-white/85">{profile?.display_name || "Váš profil"}</p><p className="text-xs text-white/35">Soukromý účet</p></div>
        </div>
        <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/45 transition hover:bg-white/[.04] hover:text-white" onClick={signOut}><LogOut size={17} />Odhlásit se</button>
      </div>
    </aside>
  );
}