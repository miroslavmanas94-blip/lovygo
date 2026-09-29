"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export function useAvatarUrl(path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!path) { setUrl(null); return; }
    if (path.startsWith("https://") || path.startsWith("http://")) { setUrl(path); return; }
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setUrl(null); return; }
    let alive = true;
    const load = async () => {
      const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 3600);
      if (alive) setUrl(data?.signedUrl ?? null);
    };
    void load();
    const refresh = window.setInterval(() => void load(), 50 * 60 * 1000);
    return () => { alive = false; window.clearInterval(refresh); };
  }, [path]);
  return url;
}