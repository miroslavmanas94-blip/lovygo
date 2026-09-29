"use client";

import WatchTogether from "@/components/WatchTogether";
import { useAppSession } from "@/components/AppShell";

export default function WatchPage() {
  const { couple } = useAppSession();
  if (!couple) return <div className="glass rounded-[22px] p-7"><h1 className="text-2xl font-medium">Nejdřív propojte svůj pár</h1><p className="mt-2 text-sm text-white/50">Watch místnost bude připravená po připojení partnera.</p><a href="/dashboard" className="button-primary mt-5">Otevřít párování</a></div>;
  return <WatchTogether />;
}