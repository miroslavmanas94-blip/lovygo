"use client";

import { useEffect, useState } from "react";
import { Circle, RotateCcw, Sparkles, X } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { useAppSession } from "@/components/AppShell";
import type { Game } from "@/types";

type TicTacToeState = { board: string[]; player_x: string; player_o: string | null; turn: "x" | "o"; winner: "x" | "o" | null };
type TicTacToeRecord = Omit<Game, "state"> & { state: TicTacToeState };

export default function TicTacToeGame() {
  const { couple, userId, profile, partner, notify } = useAppSession();
  const [game, setGame] = useState<TicTacToeRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const coupleId = couple?.id;

  useEffect(() => {
    if (!coupleId) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    let alive = true;
    const load = async () => {
      const { data, error } = await supabase.from("games").select("*").eq("couple_id", coupleId).eq("game_type", "tic-tac-toe").order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!alive) return;
      if (error) notify("Hru se nepodařilo načíst.");
      else setGame(data as TicTacToeRecord | null);
    };
    void load();
    const channel = supabase.channel(`ttt:${coupleId}`).on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `couple_id=eq.${coupleId}` }, (payload) => {
      const row = payload.new as TicTacToeRecord;
      if (row.game_type === "tic-tac-toe") setGame(row);
    }).subscribe();
    return () => { alive = false; void supabase.removeChannel(channel); };
  }, [coupleId, notify]);

  async function runRpc(name: "start_ttt_game" | "join_ttt_game" | "make_ttt_move" | "restart_ttt_game", args: Record<string, string | number>) {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || busy) return;
    setBusy(true);
    const { data, error } = await supabase.rpc(name, args);
    setBusy(false);
    if (error) notify(error.message.includes("turn") ? "Teď je na tahu partner." : error.message.includes("taken") ? "Tohle políčko už je obsazené." : "Tah se nepodařilo uložit.");
    else setGame(data as TicTacToeRecord);
  }

  if (!couple || !userId) return null;
  const state = game?.state;
  const mark = state?.player_x === userId ? "x" : state?.player_o === userId ? "o" : null;
  const waitingForPlayer = Boolean(game && !state?.player_o);
  const finished = game?.status === "finished";
  const draw = finished && !state?.winner;
  const turnName = !state ? "" : state.turn === "x" ? (state.player_x === userId ? "Váš tah" : partner?.display_name ?? "Partner") : (state.player_o === userId ? "Váš tah" : profile?.display_name ?? "Vy");
  const winnerName = state?.winner === "x" ? (state.player_x === userId ? "Vy jste vyhráli" : `${partner?.display_name ?? "Partner"} vyhrál/a`) : state?.winner === "o" ? (state.player_o === userId ? "Vy jste vyhráli" : `${partner?.display_name ?? "Partner"} vyhrál/a`) : "";

  return <section className="glass rounded-[22px] p-5 sm:p-7"><div className="mb-5 flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">Hra pro dva</p><h2 className="mt-1 text-xl font-medium">Piškvorky</h2><p className="mt-1 text-sm text-white/40">{!game ? "Vytvořte hru a pozvěte partnera." : waitingForPlayer ? "Čeká se na druhého hráče." : finished ? (draw ? "Remíza, pěkný souboj." : winnerName) : turnName}</p></div>{mark && game && <span className="rounded-full border border-white/10 bg-white/[.04] px-3 py-1.5 text-xs text-white/55">Hrajete za <b className="ml-1 text-[#ff7aaa]">{mark.toUpperCase()}</b></span>}</div>
    {!game ? <button className="button-primary" disabled={busy} onClick={() => void runRpc("start_ttt_game", { target_couple: couple.id })}>{busy ? "Vytvářím…" : "Vytvořit hru"}<Sparkles size={16} /></button> : waitingForPlayer && !mark ? <button className="button-primary" disabled={busy} onClick={() => void runRpc("join_ttt_game", { target_game: game.id })}>{busy ? "Připojuji…" : "Připojit se ke hře"}<X size={16} /></button> : <>
      <div className="mx-auto grid max-w-[390px] grid-cols-3 gap-2.5">{state?.board.map((cell, index) => <button key={index} className="aspect-square rounded-[18px] border border-white/[.08] bg-black/20 text-[#ff7aaa] transition hover:border-pink-200/25 hover:bg-pink-400/[.07] disabled:hover:border-white/[.08] disabled:hover:bg-black/20" disabled={busy || !mark || game.status !== "active" || state.turn !== mark || Boolean(cell)} onClick={() => void runRpc("make_ttt_move", { target_game: game.id, cell_index: index })} aria-label={`Políčko ${index + 1}${cell ? `, ${cell}` : ""}`}>{cell === "x" ? <X className="mx-auto size-10 sm:size-12" strokeWidth={1.6} /> : cell === "o" ? <Circle className="mx-auto size-9 sm:size-11" strokeWidth={1.6} /> : <span className="text-white/15">{index + 1}</span>}</button>)}</div>
      {finished && <button className="button-quiet mx-auto mt-5 flex" disabled={busy} onClick={() => void runRpc("restart_ttt_game", { target_game: game.id })}><RotateCcw size={15} />Zahrát znovu</button>}
    </>}
    {game && !waitingForPlayer && <div className="mt-5 flex justify-center gap-5 text-xs text-white/40"><span className="flex items-center gap-1.5"><X size={15} className="text-[#ff7aaa]" />{profile?.display_name ?? "Vy"}</span><span className="flex items-center gap-1.5"><Circle size={13} className="text-sky-200" />{partner?.display_name ?? "Partner"}</span></div>}
  </section>;
}