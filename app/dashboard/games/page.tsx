"use client";

import { useState } from "react";
import { ArrowLeft, ArrowUpRight, Gamepad2, Sparkles } from "lucide-react";
import { useAppSession } from "@/components/AppShell";
import TicTacToeGame from "@/components/TicTacToeGame";
import GameRoom from "@/components/GameRoom";

const games = [
  { id: "tic-tac-toe", name: "Piškvorky", kind: "Strategie", description: "Tři v řadě. Tahy se synchronizují okamžitě.", symbol: "×○" },
  { id: "rock-paper-scissors", name: "Kámen-nůžky-papír", kind: "Rychlá hra", description: "Současně odhalte svůj tah a zjistěte, kdo vyhrál.", symbol: "✊" },
  { id: "guess-number", name: "Hádej číslo", kind: "Hádání", description: "Jeden zvolí tajné číslo, druhý zkusí trefit odpověď.", symbol: "?" },
  { id: "couple-quiz", name: "Párový kvíz", kind: "O vás dvou", description: "Vytvořte si vlastní otázky a ověřte, jak dobře se znáte.", symbol: "Q" },
  { id: "truth-dare", name: "Pravda nebo úkol", kind: "Výzva", description: "Vymyslete otázku nebo úkol přímo pro vás dva.", symbol: "!" },
  { id: "memory", name: "Párové pexeso", kind: "Paměť", description: "Otočte karty a najděte všechny dvojice.", symbol: "▦" },
  { id: "word-football", name: "Slovní fotbal", kind: "Slova", description: "Navazujte slovem na poslední písmeno soupeře.", symbol: "Aa" },
  { id: "battleships", name: "Párové lodě", kind: "Strategie", description: "Skryjte lodě a střídejte se v hledání zásahů.", symbol: "⌖" },
  { id: "twenty-questions", name: "20 otázek", kind: "Hádání", description: "Ptejte se jen ano/ne. Máte dvacet pokusů.", symbol: "20" },
  { id: "would-you-rather", name: "Co bys raději?", kind: "O vás dvou", description: "Nabídněte dvě možnosti a zjistěte, co si partner vybere.", symbol: "↔" },
  { id: "draw-guess", name: "Kreslení & hádání", kind: "Kreativní", description: "Nakreslete nápovědu a nechte partnera hádat.", symbol: "✎" },
  { id: "chess", name: "Šachy", kind: "Strategie", description: "Klasická partie s pravidly a střídáním tahů.", symbol: "♞" },
  { id: "checkers", name: "Dáma", kind: "Strategie", description: "Skákejte přes kameny a dostaňte je na druhou stranu.", symbol: "◉" },
  { id: "connect-four", name: "Čtyři v řadě", kind: "Strategie", description: "Spojte čtyři kameny dřív než partner.", symbol: "▤" },
  { id: "who-is-who", name: "Kdo je kdo?", kind: "O vás dvou", description: "Hádejte osobu pomocí chytrých otázek.", symbol: "☺" },
  { id: "couple-bingo", name: "Párové bingo", kind: "Spolu", description: "Vytvořte políčka s věcmi, které spolu zažijete.", symbol: "▦" },
  { id: "story-word", name: "Příběh po slově", kind: "Kreativní", description: "Napište příběh společně. Jeden po druhém, slovo po slově.", symbol: "…" },
  { id: "reaction", name: "Rychlé reakce", kind: "Rychlá hra", description: "Reagujte rychleji než partner, až přijde signál.", symbol: "⚡" },
  { id: "secrets", name: "Odhalení tajemství", kind: "O vás dvou", description: "Sdílejte něco, co jste si ještě neřekli.", symbol: "♡" },
  { id: "partner-trivia", name: "Partner Trivia", kind: "O vás dvou", description: "Tipněte si, jak odpoví člověk, kterého milujete.", symbol: "♥" },
];

export default function GamesPage() {
  const { couple } = useAppSession();
  const [selected, setSelected] = useState<string | null>(null);
  if (!couple) return <div className="glass rounded-[22px] p-7"><h1 className="text-2xl font-medium">Nejdřív propojte svůj pár</h1><p className="mt-2 text-sm text-white/50">Hry jsou určené jen pro vás dva.</p><a href="/dashboard" className="button-primary mt-5">Otevřít párování</a></div>;
  if (selected === "tic-tac-toe") return <div className="page-enter mx-auto max-w-3xl"><button className="button-quiet mb-5" onClick={() => setSelected(null)}><ArrowLeft size={16} />Všechny hry</button><TicTacToeGame /></div>;
  if (selected) return <GameRoom gameId={selected} onBack={() => setSelected(null)} />;
  return <div className="page-enter space-y-7"><header className="flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">Jen vy dva</p><h1 className="mt-2 text-3xl font-medium tracking-[-.03em]">Games Center</h1><p className="mt-2 text-sm text-white/45">Malé hry pro chvíle, kdy chcete být spolu.</p></div><span className="flex items-center gap-2 text-sm text-white/40"><Gamepad2 size={16} className="text-[#ff7aaa]" />{games.length} her</span></header>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{games.map((game, index) => <button key={game.id} onClick={() => setSelected(game.id)} className="glass fade-up group flex min-h-[170px] flex-col rounded-[20px] p-5 text-left transition hover:-translate-y-0.5 hover:border-pink-200/20" style={{ animationDelay: `${index * 35}ms` }}><div className="flex items-start justify-between"><span className="grid size-10 place-items-center rounded-[14px] border border-white/[.07] bg-white/[.035] text-lg text-[#ff9abc]">{game.symbol}</span><ArrowUpRight size={16} className="text-white/25 transition group-hover:text-white/70" /></div><span className="eyebrow mt-5">{game.kind}</span><h2 className="mt-1 font-medium">{game.name}</h2><p className="mt-1 text-xs leading-5 text-white/40">{game.description}</p></button>)}</div>
    <div className="flex items-center gap-2 text-xs text-white/35"><Sparkles size={14} className="text-[#ff7aaa]/70" />Ve hře Piškvorky je tah pořadí chráněný přímo databází.</div>
  </div>;
}