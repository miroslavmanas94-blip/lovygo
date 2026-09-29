"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Circle, RotateCcw, Send, X } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { useAppSession } from "@/components/AppShell";
import type { Game } from "@/types";

type Move = { user_id: string; value: string; round: number; created_at: string };
type RoomState = { moves?: Move[]; turn?: string; round?: number; score?: Record<string, number>; choices?: Record<string, string>; board?: string[]; player_one?: string; player_two?: string };
type RoomGame = Omit<Game, "state"> & { state: RoomState };
type Definition = { name: string; description: string; action: string; placeholder: string; options?: string[]; mode?: "rps" | "words" | "choice" };

const definitions: Record<string, Definition> = {
  "rock-paper-scissors": { name: "Kámen-nůžky-papír", description: "Zvolte oba tah. Kola se odhalí až ve chvíli, kdy vyberete oba.", action: "Váš tah", placeholder: "", options: ["Kámen", "Nůžky", "Papír"], mode: "rps" },
  "guess-number": { name: "Hádej číslo", description: "Vymyslete vlastní číslo a nechte partnera hádat.", action: "Váš tip", placeholder: "Napište číslo nebo nápovědu…" },
  "couple-quiz": { name: "Párový kvíz", description: "Pište otázky a odpovědi, které jsou jen vaše.", action: "Přidat otázku nebo odpověď", placeholder: "Vaše otázka / odpověď…" },
  "truth-dare": { name: "Pravda nebo úkol", description: "Přidejte vlastní otázku nebo výzvu a střídejte se.", action: "Vaše pravda nebo úkol", placeholder: "Napište otázku či výzvu…" },
  memory: { name: "Párové pexeso", description: "Střídejte se v otáčení karet a hledejte dvojice.", action: "Otočit kartu", placeholder: "", mode: "choice" },
  "word-football": { name: "Slovní fotbal", description: "Navazujte na poslední písmeno slova partnera.", action: "Vaše slovo", placeholder: "Napište slovo…", mode: "words" },
  battleships: { name: "Párové lodě", description: "Popište své souřadnice a střídejte se ve výběru polí.", action: "Vaše souřadnice / tah", placeholder: "Například B4…" },
  "twenty-questions": { name: "20 otázek", description: "Ptejte se jeden druhého otázkami s odpovědí ano/ne.", action: "Vaše otázka nebo odpověď", placeholder: "Napište otázku…" },
  "would-you-rather": { name: "Co bys raději?", description: "Napište dvě možnosti a partner na ně zareaguje.", action: "Vaše dvě možnosti", placeholder: "Raději… nebo…" },
  "draw-guess": { name: "Kreslení & hádání", description: "Popište své kreslení nebo zkuste uhodnout, co partner myslí.", action: "Nápověda nebo tip", placeholder: "Napište nápovědu / tip…" },
  chess: { name: "Šachy", description: "Zaznamenávejte tahy partie a sdílejte svou pozici.", action: "Váš šachový tah", placeholder: "Například Nf3…" },
  checkers: { name: "Dáma", description: "Zaznamenávejte tahy partie a střídejte se.", action: "Váš tah", placeholder: "Například c3-d4…" },
  "connect-four": { name: "Čtyři v řadě", description: "Vyberte sloupec a propojte čtyři tahy za sebou.", action: "Sloupec 1–7", placeholder: "Číslo sloupce…" },
  "who-is-who": { name: "Kdo je kdo?", description: "Ptejte se na vlastnosti a hádejte zvolenou osobu.", action: "Vaše otázka nebo tip", placeholder: "Napište otázku / tip…" },
  "couple-bingo": { name: "Párové bingo", description: "Přidávejte společné zážitky, které chcete zaškrtnout.", action: "Přání do binga", placeholder: "Přidejte políčko…" },
  "story-word": { name: "Příběh po slově", description: "Pište příběh společně. Každý tah přidá jednu větu.", action: "Další věta", placeholder: "Pokračujte v příběhu…", mode: "words" },
  reaction: { name: "Rychlé reakce", description: "Zapište svůj čas nebo reakci a porovnejte si výsledky.", action: "Váš výsledek", placeholder: "Napište čas v ms…" },
  secrets: { name: "Odhalení tajemství", description: "Sdílejte něco nového a střídejte se v odhalování.", action: "Vaše odhalení", placeholder: "Napište něco, co partner ještě neví…" },
  "partner-trivia": { name: "Partner Trivia", description: "Předložte otázku o sobě a nechte partnera tipovat.", action: "Otázka o vás", placeholder: "Na co se má partner zeptat?…" },
};

function initialState(userId: string, partnerId: string, id: string): RoomState {
  if (id === "memory") {
    const symbols = ["♥", "✦", "☾", "♡", "✿", "◇"];
    const cards = [...symbols, ...symbols].sort(() => Math.random() - 0.5);
    return { moves: [], turn: userId, round: 0, board: cards, player_one: userId, player_two: partnerId };
  }
  return { moves: [], turn: userId, round: 0, score: { [userId]: 0, [partnerId]: 0 }, choices: {}, player_one: userId, player_two: partnerId };
}

export default function GameRoom({ gameId, onBack }: { gameId: string; onBack: () => void }) {
  const { couple, userId, partner, profile, notify } = useAppSession();
  const [game, setGame] = useState<RoomGame | null>(null);
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const definition = definitions[gameId];
  const coupleId = couple?.id;

  useEffect(() => {
    if (!coupleId) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    let alive = true;
    const load = async () => {
      const { data, error } = await supabase.from("games").select("*").eq("couple_id", coupleId).eq("game_type", gameId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!alive) return;
      if (error) notify("Hru se nepodařilo načíst.");
      else setGame(data as RoomGame | null);
      setLoading(false);
    };
    void load();
    const channel = supabase.channel(`game:${coupleId}:${gameId}`).on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `couple_id=eq.${coupleId}` }, (payload) => { const row = payload.new as RoomGame; if (row.game_type === gameId) setGame(row); }).subscribe();
    return () => { alive = false; void supabase.removeChannel(channel); };
  }, [coupleId, gameId, notify]);

  async function start() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !coupleId || !userId || !partner || busy) return;
    setBusy(true);
    const { data, error } = await supabase.from("games").insert({ couple_id: coupleId, game_type: gameId, created_by: userId, status: "active", state: initialState(userId, partner.id, gameId) }).select("*").single();
    setBusy(false);
    if (error) notify("Společnou hru se nepodařilo vytvořit."); else setGame(data as RoomGame);
  }

  async function saveState(nextState: RoomState) {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !game || busy) return;
    setBusy(true);
    const { data, error } = await supabase.from("games").update({ state: nextState, updated_at: new Date().toISOString() }).eq("id", game.id).select("*").single();
    setBusy(false);
    if (error) notify("Tah se nepodařilo uložit."); else setGame(data as RoomGame);
  }

  async function takeTurn(input: string) {
    if (!game || !userId || game.state.turn !== userId || !input.trim()) return;
    const moves = game.state.moves ?? [];
    const lastValue = moves.at(-1)?.value.trim();
    if (definition.mode === "words" && gameId === "word-football" && lastValue && input.trim()[0]?.toLocaleLowerCase() !== lastValue.slice(-1).toLocaleLowerCase()) { notify(`Slovo musí začínat na „${lastValue.slice(-1)}“.`); return; }
    const next: RoomState = { ...game.state, moves: [...moves, { user_id: userId, value: input.trim(), round: game.state.round ?? 0, created_at: new Date().toISOString() }], turn: userId === game.state.player_one ? game.state.player_two : game.state.player_one, round: (game.state.round ?? 0) + 1 };
    await saveState(next);
    setValue("");
  }

  async function playRps(choice: string) {
    if (!game || !userId) return;
    const choices = game.state.choices ?? {};
    if (choices[userId]) return;
    const nextChoices = { ...choices, [userId]: choice };
    let score = game.state.score ?? {};
    let round = game.state.round ?? 0;
    if (Object.keys(nextChoices).length === 2) {
      const ids = [game.state.player_one ?? "", game.state.player_two ?? ""];
      const a = nextChoices[ids[0]];
      const b = nextChoices[ids[1]];
      if (a !== b) {
        const aWins = (a === "Kámen" && b === "Nůžky") || (a === "Nůžky" && b === "Papír") || (a === "Papír" && b === "Kámen");
        const winner = aWins ? ids[0] : ids[1];
        score = { ...score, [winner]: (score[winner] ?? 0) + 1 };
      }
      round += 1;
    }
    await saveState({ ...game.state, choices: Object.keys(nextChoices).length === 2 ? {} : nextChoices, score, round, moves: Object.keys(nextChoices).length === 2 ? [...(game.state.moves ?? []), { user_id: userId, value: `${nextChoices[idsFor(game.state)[0]]} / ${nextChoices[idsFor(game.state)[1]]}`, round, created_at: new Date().toISOString() }] : game.state.moves });
  }

  async function flipCard(index: number) {
    if (!game || !userId || game.state.turn !== userId) return;
    const board = game.state.board ?? [];
    const flipped = (game.state.moves ?? []).filter((move) => move.round === game.state.round).map((move) => Number(move.value));
    if (flipped.includes(index)) return;
    const matched = new Set((game.state.moves ?? []).filter((move) => move.value.startsWith("match:")).map((move) => Number(move.value.slice(6))));
    if (matched.has(index)) return;
    const nextFlipped = flipped.length >= 2 ? [index] : [...flipped, index];
    let moves = (game.state.moves ?? []).filter((move) => move.round !== game.state.round);
    let nextTurn = game.state.turn ?? userId;
    let nextRound = game.state.round ?? 0;
    if (nextFlipped.length === 2) {
      if (board[nextFlipped[0]] === board[nextFlipped[1]]) {
        moves = [...moves, ...nextFlipped.map((card) => ({ user_id: userId, value: `match:${card}`, round: nextRound, created_at: new Date().toISOString() }))];
      } else nextTurn = userId === game.state.player_one ? game.state.player_two ?? userId : game.state.player_one ?? userId;
      nextRound += 1;
    } else moves = [...moves, ...nextFlipped.map((card) => ({ user_id: userId, value: String(card), round: nextRound, created_at: new Date().toISOString() }))];
    await saveState({ ...game.state, moves, turn: nextTurn, round: nextRound });
  }

  if (loading) return <div className="glass rounded-[22px] p-8"><div className="skeleton h-48 rounded-xl" /></div>;
  if (!definition || !userId) return null;
  const moves = game?.state.moves ?? [];
  const currentPlayer = game?.state.turn === userId;
  const names = new Map([[userId, profile?.display_name ?? "Vy"], [partner?.id ?? "", partner?.display_name ?? "Partner"]]);
  const memoryMatched = new Set(moves.filter((move) => move.value.startsWith("match:")).map((move) => Number(move.value.slice(6))));
  const memoryFlipped = moves.filter((move) => move.round === game?.state.round).map((move) => Number(move.value));

  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void takeTurn(value); }
  return <div className="page-enter mx-auto max-w-3xl"><button className="button-quiet mb-5" onClick={onBack}><ArrowLeft size={16} />Všechny hry</button><section className="glass rounded-[22px] p-5 sm:p-7"><div className="mb-6"><p className="eyebrow">Hra pro dva</p><h2 className="mt-1 text-2xl font-medium">{definition.name}</h2><p className="mt-2 text-sm leading-5 text-white/45">{definition.description}</p></div>
    {!game ? <button className="button-primary" disabled={busy || !partner} onClick={() => void start()}>{busy ? "Vytvářím…" : "Začít společnou hru"}<Send size={15} /></button> : <>
      <div className="mb-5 flex items-center justify-between rounded-xl border border-white/[.07] bg-black/15 px-4 py-3 text-sm"><span className="text-white/50">{currentPlayer ? "Jste na tahu" : `Na tahu: ${names.get(game.state.turn ?? "") ?? "Partner"}`}</span><span className="text-xs text-white/35">Kolo {game.state.round ?? 0}</span></div>
      {gameId === "rock-paper-scissors" && <div className="mb-5 flex flex-wrap items-center justify-center gap-3">{definition.options?.map((option) => <button key={option} className={`button-quiet min-w-28 ${game.state.choices?.[userId] === option ? "border-pink-200/30 bg-pink-400/10" : ""}`} disabled={busy || Boolean(game.state.choices?.[userId])} onClick={() => void playRps(option)}>{option}</button>)}{game.state.choices?.[userId] && <p className="w-full text-center text-sm text-white/45">Tah je zamčený, čekáme na partnera.</p>}</div>}
      {gameId === "memory" && <div className="mx-auto mb-5 grid max-w-[440px] grid-cols-4 gap-2">{(game.state.board ?? []).map((symbol, index) => { const matched = memoryMatched.has(index); const revealed = matched || memoryFlipped.includes(index); return <button key={index} className={`aspect-square rounded-xl border text-xl transition ${matched ? "border-emerald-200/15 bg-emerald-300/[.07] text-emerald-100/65" : revealed ? "border-pink-200/20 bg-pink-400/[.08] text-[#ff7aaa]" : "border-white/[.08] bg-white/[.035] text-white/20 hover:bg-white/[.07]"}`} disabled={busy || matched || !currentPlayer} onClick={() => void flipCard(index)} aria-label={`Karta ${index + 1}${revealed ? `, ${symbol}` : ""}`}>{revealed ? symbol : "?"}</button>; })}</div>}
      {gameId !== "rock-paper-scissors" && gameId !== "memory" && <form onSubmit={submit} className="mb-5 flex gap-2">{definition.mode === "choice" ? <input className="field" inputMode="numeric" value={value} onChange={(event) => setValue(event.target.value)} placeholder={definition.placeholder} /> : <input className="field min-w-0" value={value} onChange={(event) => setValue(event.target.value)} maxLength={2000} placeholder={definition.placeholder} />}<button className="button-primary shrink-0" disabled={busy || !currentPlayer || !value.trim()} aria-label={definition.action}><Send size={16} /><span className="hidden sm:inline">{definition.action}</span></button></form>}
      {gameId === "rock-paper-scissors" && (game.state.round ?? 0) > 0 && <p className="mb-4 text-center text-sm text-white/60">Skóre: {profile?.display_name ?? "Vy"} {game.state.score?.[userId] ?? 0} : {game.state.score?.[partner?.id ?? ""] ?? 0} {partner?.display_name ?? "Partner"}</p>}
      {moves.length > 0 ? <div className="space-y-2">{moves.slice(-12).map((move, index) => <div key={`${move.created_at}-${index}`} className="flex items-start gap-3 rounded-xl border border-white/[.06] bg-white/[.025] px-3 py-3"><span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-pink-400/10 text-[#ff7aaa]">{move.user_id === userId ? <X size={12} /> : <Circle size={9} />}</span><div className="min-w-0"><p className="text-xs text-white/40">{names.get(move.user_id) ?? "Partner"}</p><p className="mt-1 break-words text-sm text-white/75">{gameId === "memory" && move.value.startsWith("match:") ? "Dvojice nalezena" : move.value}</p></div></div>)}</div> : <p className="py-5 text-center text-sm text-white/35">První tah patří {names.get(game.state.turn ?? "") ?? "vám"}.</p>}
      <button className="button-quiet mt-5" disabled={busy} onClick={() => void start()}><RotateCcw size={15} />Nová hra</button>
    </>}
    </section></div>;
}

function idsFor(state: RoomState) { return [state.player_one ?? "", state.player_two ?? ""]; }