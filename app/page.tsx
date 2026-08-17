'use client'

import { useCallback, useEffect, useState } from 'react'
import { Copy, Moon, Shield, Sparkles, Users, Wand2 } from 'lucide-react'

type Player = { id: string; name: string; seat: number; isHost: boolean; isMe?: boolean; role?: string | null }
type Room = { code: string; status: string; phase: string; players: Player[]; centerRoles: string[] }

const roleInfo: Record<string, { icon: string; tone: string; text: string }> = {
  Werewolf: { icon: '☾', tone: 'red', text: 'Wake with the other werewolves. Choose one player to suspect.' },
  Seer: { icon: '◈', tone: 'violet', text: 'Look at another player’s card or two cards in the center.' },
  Robber: { icon: '↔', tone: 'gold', text: 'Swap your card with another player, then view your new role.' },
  Troublemaker: { icon: '✦', tone: 'blue', text: 'Swap the cards of two other players without looking.' },
  Villager: { icon: '○', tone: 'green', text: 'Sleep through the night. Use your instincts at dawn.' },
}

export default function Page() {
  const [name, setName] = useState('')
  const [codeInput, setCodeInput] = useState('')
  const [room, setRoom] = useState<Room | null>(null)
  const [token, setToken] = useState('')
  const [mode, setMode] = useState<'home' | 'join' | 'room'>('home')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const enterRoom = useCallback(async (action: 'create' | 'join') => {
    setError('')
    const response = await fetch('/api/rooms', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, name, code: codeInput }) })
    const data = await response.json()
    if (!response.ok) return setError(data.error)
    setToken(data.token); setMode('room'); setCodeInput(data.code); setName(name.trim())
  }, [codeInput, name])

  useEffect(() => {
    if (mode !== 'room' || !codeInput || !token) return
    let active = true
    const load = async () => { const response = await fetch(`/api/rooms?code=${codeInput}&token=${token}`, { cache: 'no-store' }); if (response.ok && active) setRoom(await response.json()) }
    load(); const interval = setInterval(load, 1800)
    return () => { active = false; clearInterval(interval) }
  }, [codeInput, mode, token])

  const startGame = async () => {
    const response = await fetch('/api/rooms', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: codeInput, token }) })
    const data = await response.json(); if (!response.ok) setError(data.error)
  }
  const copyCode = async () => { await navigator.clipboard?.writeText(codeInput); setCopied(true); setTimeout(() => setCopied(false), 1500) }
  const me = room?.players.find((player) => player.isMe)
  const canStart = room?.players.find((player) => player.isMe)?.isHost

  return <main className="min-h-screen overflow-hidden bg-[#101214] text-[#f4f0e8] selection:bg-[#e0b867] selection:text-[#101214]">
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-6 md:px-10 md:py-8">
      <header className="flex items-center justify-between border-b border-white/10 pb-6">
        <div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-full border border-[#e0b867]/50 bg-[#1b1d20] text-[#e0b867]"><Moon size={19} /></div><div><div className="font-mono text-[10px] uppercase tracking-[0.35em] text-[#e0b867]">A night of suspicion</div><div className="font-serif text-xl tracking-tight">ONE NIGHT</div></div></div>
        <div className="hidden items-center gap-2 text-xs text-white/45 sm:flex"><Shield size={14} /> Private rooms. No accounts.</div>
      </header>

      {mode === 'home' && <section className="grid flex-1 items-center gap-12 py-12 lg:grid-cols-[1fr_0.82fr] lg:gap-24">
        <div><div className="mb-6 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.3em] text-[#e0b867]"><Sparkles size={14} /> Social deduction, simplified</div><h1 className="max-w-xl font-serif text-6xl leading-[0.92] tracking-[-0.04em] text-balance md:text-8xl">Trust no one.<br /><span className="text-[#e0b867]">Especially</span> yourself.</h1><p className="mt-8 max-w-md text-base leading-7 text-white/55">A fast, chaotic round of One Night Ultimate Werewolf for your next game night. Make a room, share the code, and let the accusations begin.</p><div className="mt-10 flex flex-col gap-3 sm:flex-row"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your display name" className="h-12 rounded-md border border-white/15 bg-white/[0.04] px-4 text-sm outline-none transition placeholder:text-white/30 focus:border-[#e0b867]" /><button onClick={() => name.trim() && setMode('join')} className="h-12 rounded-md bg-[#e0b867] px-6 font-mono text-xs font-bold uppercase tracking-widest text-[#101214] transition hover:bg-[#f0d18a]">Enter the night</button></div></div>
        <div className="relative mx-auto w-full max-w-sm"><div className="absolute -inset-5 rounded-full bg-[#e0b867]/[0.04] blur-3xl" /><div className="relative rotate-[-3deg] border border-[#e0b867]/40 bg-[#17191c] p-5 shadow-2xl shadow-black/30"><div className="flex aspect-[0.72] flex-col justify-between border border-white/10 p-6"><div className="flex justify-between font-mono text-[10px] uppercase tracking-[0.25em] text-white/40"><span>Role card</span><span>01 / 09</span></div><div className="text-center"><div className="mx-auto mb-6 grid size-20 place-items-center rounded-full border border-[#e0b867]/30 text-4xl text-[#e0b867]">☾</div><div className="font-serif text-4xl">Werewolf</div><div className="mx-auto mt-4 max-w-[220px] text-sm leading-6 text-white/45">Wake up. Find your pack. Leave no trace.</div></div><div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/30">Keep this card secret</div></div></div></div>
      </section>}

      {mode === 'join' && <section className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center py-16"><button onClick={() => setMode('home')} className="mb-10 w-fit font-mono text-xs uppercase tracking-widest text-white/40 hover:text-white">← Back</button><div className="mb-8"><div className="font-mono text-xs uppercase tracking-[0.3em] text-[#e0b867]">Join a game</div><h2 className="mt-3 font-serif text-5xl">Where is the pack?</h2><p className="mt-4 text-white/50">Ask the host for their six-character room code.</p></div><input autoFocus value={codeInput} onChange={(event) => setCodeInput(event.target.value.toUpperCase().slice(0, 6))} placeholder="ABC123" className="h-20 rounded-md border border-white/15 bg-white/[0.04] px-5 font-mono text-3xl tracking-[0.4em] outline-none placeholder:text-white/15 focus:border-[#e0b867]" /><button onClick={() => enterRoom('join')} disabled={codeInput.length < 6} className="mt-4 h-14 rounded-md bg-[#e0b867] font-mono text-xs font-bold uppercase tracking-widest text-[#101214] disabled:cursor-not-allowed disabled:opacity-40">Join room</button><div className="my-8 flex items-center gap-4 text-xs text-white/25"><span className="h-px flex-1 bg-white/10" />or<span className="h-px flex-1 bg-white/10" /></div><button onClick={() => enterRoom('create')} className="h-14 rounded-md border border-white/15 font-mono text-xs uppercase tracking-widest text-white/70 transition hover:border-[#e0b867] hover:text-[#e0b867]">Create a new room</button>{error && <p className="mt-5 text-sm text-[#e6786b]">{error}</p>}</section>}

      {mode === 'room' && room && <section className="flex-1 py-10"><div className="flex flex-col justify-between gap-6 border-b border-white/10 pb-8 sm:flex-row sm:items-end"><div><div className="font-mono text-xs uppercase tracking-[0.3em] text-[#e0b867]">{room.status === 'lobby' ? 'Waiting room' : 'The night begins'}</div><h2 className="mt-3 font-serif text-5xl">{room.status === 'lobby' ? 'Gather your pack.' : `Good luck, ${me?.name}.`}</h2></div><button onClick={copyCode} className="flex h-14 items-center gap-4 self-start border border-[#e0b867]/50 bg-[#e0b867]/10 px-5 font-mono text-sm tracking-[0.3em] text-[#e0b867] sm:self-auto">{codeInput}<Copy size={15} /> <span className="text-[10px] tracking-normal text-white/40">{copied ? 'COPIED' : 'COPY'}</span></button></div>
        {room.status === 'lobby' ? <div className="grid gap-10 py-10 lg:grid-cols-[1fr_280px]"><div><div className="mb-5 flex items-center justify-between"><div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-white/40"><Users size={15} /> {room.players.length} / 12 players</div><span className="font-mono text-xs text-[#e0b867]">{room.players.length < 3 ? 'Need 3 to start' : 'Ready to begin'}</span></div><div className="grid gap-3 sm:grid-cols-2">{room.players.map((player) => <div key={player.id} className="flex items-center justify-between border border-white/10 bg-white/[0.03] p-4"><div className="flex items-center gap-3"><div className="grid size-8 place-items-center rounded-full bg-[#2d3033] font-mono text-xs text-[#e0b867]">{player.name[0]?.toUpperCase()}</div><span>{player.name}{player.isMe && <span className="ml-2 text-xs text-white/30">(you)</span>}</span></div>{player.isHost && <span className="font-mono text-[10px] uppercase tracking-widest text-[#e0b867]">Host</span>}</div>)}{Array.from({ length: Math.max(0, 4 - room.players.length) }).map((_, index) => <div key={index} className="flex h-[65px] items-center border border-dashed border-white/10 px-4 font-mono text-xs uppercase tracking-widest text-white/20">Waiting for player...</div>)}</div>{canStart && <button onClick={startGame} disabled={room.players.length < 3} className="mt-8 flex h-14 items-center gap-3 bg-[#e0b867] px-7 font-mono text-xs font-bold uppercase tracking-widest text-[#101214] disabled:opacity-35"><Wand2 size={16} /> Start the night</button>}</div><aside className="border border-white/10 bg-white/[0.03] p-6"><div className="font-mono text-[10px] uppercase tracking-widest text-[#e0b867]">How to play</div><p className="mt-4 text-sm leading-6 text-white/55">Everyone receives a secret role. The night phase is quick. Then talk, bluff, and vote for the werewolf.</p><div className="mt-6 border-t border-white/10 pt-5 text-xs leading-5 text-white/35">Best with 3–9 players<br />One round takes 10 minutes</div></aside></div> : <div className="grid gap-10 py-12 lg:grid-cols-[1fr_0.7fr]"><div className="border border-[#e0b867]/30 bg-[#17191c] p-8"><div className="font-mono text-[10px] uppercase tracking-widest text-[#e0b867]">Your secret role</div><div className="py-16 text-center"><div className="mx-auto mb-6 grid size-20 place-items-center rounded-full border border-[#e0b867]/40 text-4xl text-[#e0b867]">{roleInfo[me?.role || 'Villager']?.icon || '○'}</div><h3 className="font-serif text-5xl">{me?.role || 'Villager'}</h3><p className="mx-auto mt-5 max-w-sm text-sm leading-6 text-white/50">{roleInfo[me?.role || 'Villager']?.text}</p></div><div className="border-t border-white/10 pt-4 font-mono text-[10px] uppercase tracking-widest text-white/30">Do not show anyone this screen</div></div><aside className="border border-white/10 bg-white/[0.03] p-7"><div className="font-mono text-[10px] uppercase tracking-widest text-[#e0b867]">Night phase</div><h3 className="mt-4 font-serif text-3xl">The town is asleep.</h3><p className="mt-4 text-sm leading-6 text-white/50">Read your role, then wait for the host to move everyone through the night.</p><div className="mt-8 flex items-center gap-3 text-xs text-white/35"><span className="size-2 animate-pulse rounded-full bg-[#e0b867]" /> {room.players.length} players are in the room</div></aside></div>}
      </section>}
      {error && mode === 'room' && <p className="pb-6 text-sm text-[#e6786b]">{error}</p>}
    </div>
  </main>
}
