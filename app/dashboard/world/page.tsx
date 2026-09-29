"use client";

import { Camera, Compass } from "lucide-react";
import { useAppSession } from "@/components/AppShell";
import BucketList from "@/components/BucketList";
import LoveLetters from "@/components/LoveLetters";
import MemoryGallery from "@/components/MemoryGallery";
import MoodTracker from "@/components/MoodTracker";

export default function WorldPage() {
  const { couple } = useAppSession();
  if (!couple) return <div className="glass rounded-[22px] p-7"><h1 className="text-2xl font-medium">Nejdřív propojte svůj pár</h1><p className="mt-2 text-sm text-white/50">Váš společný svět se otevře po připojení partnera.</p><a href="/dashboard" className="button-primary mt-5">Otevřít párování</a></div>;
  return <div className="page-enter space-y-7"><header><p className="eyebrow flex items-center gap-2"><Compass size={13} />Všechno vaše</p><h1 className="mt-2 text-3xl font-medium tracking-[-.03em]">Párový svět</h1><p className="mt-2 text-sm text-white/45">Vzpomínky, plány i to, jak se dnes cítíte.</p></header><div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]"><MemoryGallery /><div className="space-y-5"><BucketList /><MoodTracker /><LoveLetters /></div></div><div className="sr-only"><Camera /></div></div>;
}