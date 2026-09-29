"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Gamepad2, Heart, Home, MessageCircle, MonitorPlay } from "lucide-react";

const navigation = [
  { href: "/dashboard", label: "Domů", icon: Home },
  { href: "/dashboard/chat", label: "Chat", icon: MessageCircle },
  { href: "/dashboard/watch", label: "Watch", icon: MonitorPlay },
  { href: "/dashboard/games", label: "Hry", icon: Gamepad2 },
  { href: "/dashboard/world", label: "Svět", icon: Compass },
];

export default function BottomNav() {
  const pathname = usePathname();
  return <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/[.08] bg-[#09090f]/90 px-2 pb-[max(env(safe-area-inset-bottom),10px)] pt-2 backdrop-blur-2xl md:hidden" aria-label="Hlavní navigace"><div className="mx-auto flex max-w-lg justify-around">{navigation.map(({ href, label, icon: Icon }) => { const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href); return <Link key={href} href={href} aria-label={label} aria-current={active ? "page" : undefined} className={`flex min-w-[54px] flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[10px] ${active ? "text-[#ff7aaa]" : "text-white/42"}`}><Icon size={20} strokeWidth={active ? 2.4 : 1.8} />{label}</Link>; })}</div><Heart className="sr-only" /></nav>;
}