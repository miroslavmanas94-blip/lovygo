"use client";

import type { UserProfile } from "@/types";
import Image from "next/image";
import { useAvatarUrl } from "@/lib/useAvatarUrl";

export default function Avatar({ profile, label, size = "size-10", className = "" }: { profile: UserProfile | null; label: string; size?: string; className?: string }) {
  const url = useAvatarUrl(profile?.avatar_url);
  const name = profile?.display_name?.trim();
  return url
    ? <Image src={url} alt={`${label} – profilová fotka`} width={80} height={80} unoptimized className={`${size} rounded-full border border-white/10 object-cover ${className}`} />
    : <span aria-label={label} className={`grid ${size} shrink-0 place-items-center rounded-full border border-white/10 bg-white/[.06] text-sm text-white/60 ${className}`}>{name?.slice(0, 1).toUpperCase() ?? "·"}</span>;
}