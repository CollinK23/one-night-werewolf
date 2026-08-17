'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, Copy, Moon, RotateCcw, Shield, Sparkles, Users, Vote, Wand2 } from 'lucide-react'

type Player = {
  id: string
  name: string
  seat: number
  isHost: boolean
  isMe?: boolean
  role?: string | null
  startingRole?: string | null
  hasActed?: boolean
  hasVoted?: boolean
  voteFor?: string | null
  roleArt?: string | null
}
type Room = {
  code: string
  phase: string
  status?: string
  actionSeconds?: number
  activeRole?: string | null
  remainingSeconds?: number
  actionStartedAt?: string | null
  players: Player[]
  centerRoles: string[]
  enabledRoles?: string[]
  eliminatedIds?: string[]
  outcome?: string | null
  me?: {
    id: string
    name: string
    isHost: boolean
    startingRole?: string | null
    finalRole?: string | null
    roleArt?: string | null
    nightAction?: { peek?: string[]; target?: string; target2?: string; center?: string; center2?: string } | null
  }
}

const roleInfo: Record<string, { title: string; text: string }> = {
  Werewolf: { title: 'Werewolf', text: 'Wake with the pack and learn who else is a Werewolf. If you are the only Werewolf, you may inspect one center card.' },
  Seer: { title: 'Seer', text: 'Inspect one other player’s card, or inspect two center cards. Keep the information secret.' },
  Robber: { title: 'Robber', text: 'Swap your card with another player, then look at your new role.' },
  Troublemaker: { title: 'Troublemaker', text: 'Swap the cards of two other players. You do not see either card.' },
  Drunk: { title: 'Drunk', text: 'Swap your card with one center card. You do not see the new role.' },
  Insomniac: { title: 'Insomniac', text: 'At the end of the night, look at your card to learn whether it changed.' },
  Mason: { title: 'Mason', text: 'Look for the other Mason. If nobody else is a Mason, the other Mason card is in the center.' },
  Hunter: { title: 'Hunter', text: 'No night action. If you are eliminated, whoever you voted for is also eliminated.' },
  Tanner: { title: 'Tanner', text: 'No night action. Your goal is to be voted out.' },
  Minion: { title: 'Minion', text: 'Wake and learn who the Werewolves are. Help them win, even if you are eliminated.' },
  Doppelgänger: { title: 'Doppelgänger', text: 'Choose one player, look at their starting role, and become that role. Perform that role’s action if it has one.' },
  Villager: { title: 'Villager', text: 'No night action. Listen carefully and decide who is lying.' },
}
const ROLE_SHEET = 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-t7Wo32vetIDaGJkUq3mgbkxPpXgE5r.png'
const ROLE_POSITIONS: Record<string, string> = {
  Werewolf: '0% 0%', Seer: '33.333% 0%', Robber: '66.666% 0%', Troublemaker: '100% 0%',
  Drunk: '0% 50%', Insomniac: '33.333% 50%', Mason: '66.666% 50%', Hunter: '0% 100%',
  Minion: '25% 100%', Tanner: '50% 100%', Villager: '75% 100%', Doppelgänger: '100% 100%',
}
function RoleIcon({ role, className = '' }: { role: string; className?: string }) {
  return <div aria-label={`${role} role icon`} role="img" className={`bg-no-repeat ${className}`} style={{ backgroundImage: `url(${ROLE_SHEET})`, backgroundPosition: ROLE_POSITIONS[role] || '0% 0%', backgroundSize: '400% 300%' }} />
}

export default function Page() {
  const [name, setName] = useState('')
  const [codeInput, setCodeInput] = useState('')
  const [room, setRoom] = useState<Room | null>(null)
  const [token, setToken] = useState('')
  const [mode, setMode] = useState<'home' | 'join' | 'room'>('home')
  const [error, setError] = useState('')
  const [selected, setSelected] = useState('')
  const [selected2, setSelected2] = useState('')
  const [center, setCenter] = useState('')
  const [copied, setCopied] = useState(false)

  const enter = useCallback(
    async (action: 'create' | 'join') => {
      setError('')
      const r = await fetch('/api/rooms', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, name, code: codeInput }) })
      const d = await r.json()
      if (!r.ok) return setError(d.error)
      setToken(d.token)
      setCodeInput(d.code)
      setMode('room')
    },
    [name, codeInput],
  )

  useEffect(() => {
    if (mode !== 'room' || !codeInput || !token) return
    let live = true
    const load = async () => {
      const r = await fetch(`/api/rooms?code=${codeInput}&token=${token}`, { cache: 'no-store' })
      if (r.ok && live) setRoom(await r.json())
    }
    load()
    const id = setInterval(load, 1500)
    return () => {
      live = false
      clearInterval(id)
    }
  }, [mode, codeInput, token])

  const act = async (action: string, extra: Record<string, string | undefined> = {}) => {
    setError('')
    const r = await fetch('/api/rooms', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: codeInput, token, action, ...extra }) })
    const d = await r.json()
    if (!r.ok) {
      setError(d.error)
      return
    }
    if (action !== 'night') {
      setSelected('')
      setSelected2('')
      setCenter('')
    }
  }

  const me = room?.players.find((p) => p.isMe)
  const role = room?.phase === 'results' ? me?.role || me?.startingRole || 'Villager' : me?.startingRole || me?.role || 'Villager'
  const info = roleInfo[role] || roleInfo.Villager
  const copy = async () => {
    await navigator.clipboard?.writeText(codeInput)
    setCopied(true)
    setTimeout(() => setCopied(false), 1000)
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto min-h-screen max-w-6xl px-5 py-6 md:px-10">
        <header className="flex items-center justify-between border-b border-border pb-6">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-full border border-accent text-accent">
              <Moon size={19} />
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[.35em] text-accent">A night of suspicion</div>
              <div className="font-serif text-xl">ONE NIGHT</div>
            </div>
          </div>
          <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
            <Shield size={14} /> Private rooms. No accounts.
          </div>
        </header>

        {mode === 'home' && (
          <section className="grid min-h-[75vh] items-center gap-12 py-12 lg:grid-cols-[1fr_.8fr]">
            <div>
              <div className="mb-6 flex items-center gap-2 font-mono text-xs uppercase tracking-[.3em] text-accent">
                <Sparkles size={14} /> Social deduction, simplified
              </div>
              <h1 className="max-w-xl font-serif text-6xl leading-[.92] tracking-[-.04em] md:text-8xl">
                Trust no one.
                <br />
                <span className="text-accent">Especially</span> yourself.
              </h1>
              <p className="mt-8 max-w-md leading-7 text-muted-foreground">Create a room, share the code, and play one complete round with secret roles, swaps, accusations, and a final vote.</p>
              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your display name" className="h-12 rounded-md border border-border bg-card px-4 outline-none focus:border-accent" />
                <button onClick={() => name.trim() && setMode('join')} className="h-12 rounded-md bg-accent px-6 font-mono text-xs font-bold uppercase tracking-widest text-accent-foreground">
                  Enter the night
                </button>
              </div>
            </div>
            <div className="mx-auto w-full max-w-sm rotate-[-3deg] border border-accent/40 bg-card p-5">
              <div className="flex aspect-[.72] flex-col justify-between border border-border p-6">
                <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Role card · keep secret</div>
                <div className="text-center">
                  <div className="mx-auto mb-6 text-6xl text-accent">◈</div>
                  <div className="font-serif text-4xl">Unknown</div>
                  <div className="mt-4 text-sm text-muted-foreground">Your starting role may not be your final role.</div>
                </div>
                <div className="font-mono text-[10px] text-muted-foreground">ONE NIGHT / 01</div>
              </div>
            </div>
          </section>
        )}

        {mode === 'join' && (
          <section className="mx-auto flex min-h-[75vh] w-full max-w-lg flex-col justify-center py-16">
            <button onClick={() => setMode('home')} className="mb-10 w-fit font-mono text-xs uppercase tracking-widest text-muted-foreground">
              ← Back
            </button>
            <div className="font-mono text-xs uppercase tracking-[.3em] text-accent">Join a game</div>
            <h2 className="mt-3 font-serif text-5xl">Where is the pack?</h2>
            <p className="mt-4 text-muted-foreground">Ask the host for their six-character room code.</p>
            <input
              autoFocus
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="ABC123"
              className="mt-8 h-20 rounded-md border border-border bg-card px-5 font-mono text-3xl tracking-[.4em] outline-none focus:border-accent"
            />
            <button onClick={() => enter('join')} disabled={codeInput.length < 6} className="mt-4 h-14 rounded-md bg-accent font-mono text-xs font-bold uppercase tracking-widest text-accent-foreground disabled:opacity-40">
              Join room
            </button>
            <div className="my-8 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>
            <button onClick={() => enter('create')} className="h-14 rounded-md border border-border font-mono text-xs uppercase tracking-widest">
              Create a new room
            </button>
            {error && <p className="mt-5 text-sm text-destructive">{error}</p>}
          </section>
        )}

        {mode === 'room' && room && (
          <section className="py-10">
            <div className="flex flex-col justify-between gap-6 border-b border-border pb-8 sm:flex-row sm:items-end">
              <div>
                <div className="font-mono text-xs uppercase tracking-[.3em] text-accent">{room.phase === 'lobby' ? 'Waiting room' : room.phase.toUpperCase()}</div>
                <h2 className="mt-3 font-serif text-5xl">
                  {room.phase === 'lobby'
                    ? 'Gather your pack.'
                    : room.phase === 'reveal'
                      ? 'Your starting role.'
                      : room.phase === 'night'
                        ? 'The village sleeps.'
                        : room.phase === 'discussion'
                          ? 'Everyone is awake.'
                          : room.phase === 'vote'
                            ? 'Who gets eliminated?'
                            : 'The truth comes out.'}
                </h2>
              </div>
              <button onClick={copy} className="flex h-14 items-center gap-4 border border-accent/50 bg-accent/10 px-5 font-mono text-sm tracking-[.3em] text-accent">
                {codeInput}
                <Copy size={15} />
                <span className="text-[10px] tracking-normal text-muted-foreground">{copied ? 'COPIED' : 'COPY'}</span>
              </button>
            </div>

            {room.phase === 'lobby' && (
              <Lobby
                room={room}
                onStart={() => act('start')}
                onSettings={(seconds) => act('settings', { seconds: String(seconds) })}
                onRoles={(roles) => act('settings', { roles: JSON.stringify(roles) })}
                error={error}
              />
            )}
            {room.phase === 'reveal' && <Reveal role={role} info={info} isHost={Boolean(me?.isHost)} remaining={room.remainingSeconds || 0} onAdvance={() => act('advance')} />}
            {room.phase === 'night' && (
              <>
                <NightFixed
                  role={role}
                  activeRole={room.activeRole || ''}
                  remaining={room.remainingSeconds || 0}
                  info={info}
                  players={room.players}
                  selected={selected}
                  selected2={selected2}
                  center={center}
                  setSelected={setSelected}
                  setSelected2={setSelected2}
                  setCenter={setCenter}
                  acted={Boolean(me?.hasActed)}
                  peek={room.me?.nightAction?.peek || []}
                  onAction={(x) => act('night', x)}
                />
                {room.activeRole === role && me?.hasActed && (
                  <button onClick={() => act('finish-night')} className="mt-6 flex h-14 items-center justify-center gap-3 bg-accent px-7 font-mono text-xs font-bold uppercase tracking-widest text-accent-foreground">
                    Finish my action <ArrowRight size={15} />
                  </button>
                )}
              </>
            )}
            {room.phase === 'discussion' && <Discussion room={room} isHost={Boolean(me?.isHost)} onAdvance={() => act('advance')} />}
            {room.phase === 'vote' && <VotePanel room={room} selected={selected} setSelected={setSelected} acted={Boolean(me?.hasVoted)} onVote={() => act('vote', { target: selected })} />}
            {room.phase === 'results' && <Results room={room} isHost={Boolean(me?.isHost)} onRestart={() => act('restart')} />}
            {error && <p className="mt-6 text-sm text-destructive">{error}</p>}
          </section>
        )}
      </div>
    </main>
  )
}

const SINGLE_ROLES = ['Seer', 'Robber', 'Troublemaker', 'Drunk', 'Insomniac', 'Hunter', 'Minion', 'Tanner', 'Doppelgänger']
function poolCounts(roles: string[]) {
  const wolves = roles.filter((r) => r === 'Werewolf').length
  const villagers = roles.filter((r) => r === 'Villager').length
  const masons = roles.filter((r) => r === 'Mason').length >= 2
  const single: Record<string, boolean> = {}
  for (const r of SINGLE_ROLES) single[r] = roles.includes(r)
  return { wolves, villagers, masons, single }
}
function buildPool(wolves: number, villagers: number, masons: boolean, single: Record<string, boolean>) {
  const pool: string[] = []
  for (let i = 0; i < wolves; i++) pool.push('Werewolf')
  for (let i = 0; i < villagers; i++) pool.push('Villager')
  if (masons) pool.push('Mason', 'Mason')
  for (const r of SINGLE_ROLES) if (single[r]) pool.push(r)
  return pool
}

function RoleSelector({ roles, onRoles }: { roles: string[]; onRoles: (roles: string[]) => void }) {
  const initial = poolCounts(roles)
  const [wolves, setWolves] = useState(initial.wolves)
  const [villagers, setVillagers] = useState(initial.villagers)
  const [masons, setMasons] = useState(initial.masons)
  const [single, setSingle] = useState(initial.single)

  const commit = (next: { wolves?: number; villagers?: number; masons?: boolean; single?: Record<string, boolean> }) => {
    const w = next.wolves ?? wolves
    const v = next.villagers ?? villagers
    const m = next.masons ?? masons
    const s = next.single ?? single
    setWolves(w)
    setVillagers(v)
    setMasons(m)
    setSingle(s)
    onRoles(buildPool(w, v, m, s))
  }

  const total = wolves + villagers + (masons ? 2 : 0) + SINGLE_ROLES.filter((r) => single[r]).length

  return (
    <div className="mt-8 border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between font-mono text-xs uppercase tracking-widest text-muted-foreground">
        <span>Roles in play</span>
        <span className="text-accent">{total} cards selected</span>
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div className="flex items-center justify-between border border-border p-3">
          <span className="text-sm">Werewolf</span>
          <div className="flex items-center gap-3">
            <button onClick={() => commit({ wolves: Math.max(0, wolves - 1) })} className="size-7 border border-border text-sm">
              −
            </button>
            <span className="w-4 text-center font-mono text-sm">{wolves}</span>
            <button onClick={() => commit({ wolves: Math.min(3, wolves + 1) })} className="size-7 border border-border text-sm">
              +
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between border border-border p-3">
          <span className="text-sm">Villager</span>
          <div className="flex items-center gap-3">
            <button onClick={() => commit({ villagers: Math.max(0, villagers - 1) })} className="size-7 border border-border text-sm">
              −
            </button>
            <span className="w-4 text-center font-mono text-sm">{villagers}</span>
            <button onClick={() => commit({ villagers: Math.min(4, villagers + 1) })} className="size-7 border border-border text-sm">
              +
            </button>
          </div>
        </div>
        <button onClick={() => commit({ masons: !masons })} className={`flex items-center justify-between border p-3 text-left ${masons ? 'border-accent bg-accent/10' : 'border-border'}`}>
          <span className="text-sm">Mason (pair)</span>
          <span className="font-mono text-xs text-muted-foreground">{masons ? 'included' : 'off'}</span>
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {SINGLE_ROLES.map((r) => (
          <button
            key={r}
            onClick={() => commit({ single: { ...single, [r]: !single[r] } })}
            className={`border p-3 text-left text-sm ${single[r] ? 'border-accent bg-accent/10' : 'border-border'}`}
          >
            {r}
          </button>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">If there are more players than selected roles, extra Villagers are added automatically to fill the deck.</p>
    </div>
  )
}

function Lobby({ room, onStart, onSettings, onRoles, error }: { room: Room; onStart: () => void; onSettings: (seconds: number) => void; onRoles: (roles: string[]) => void; error: string }) {
  const me = room.players.find((p) => p.isMe)
  return (
    <div className="py-10">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          <Users size={15} /> {room.players.length} / 10 players
        </div>
        <span className="font-mono text-xs text-accent">{room.players.length < 3 ? 'Need 3 to start' : 'Ready to begin'}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {room.players.map((p) => (
          <div key={p.id} className="flex items-center justify-between border border-border bg-card p-4">
            <span>
              {p.name}
              {p.isMe && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
            </span>
            {p.isHost && <span className="font-mono text-[10px] uppercase tracking-widest text-accent">Host</span>}
          </div>
        ))}
      </div>
      {me?.isHost && (
        <div className="mt-8 flex flex-wrap items-center gap-3 border border-border bg-card p-4">
          <label className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Seconds per role</label>
          <input type="number" min={10} max={120} defaultValue={room.actionSeconds || 30} onBlur={(e) => onSettings(Number(e.target.value))} className="h-10 w-20 rounded border border-border bg-background px-3" />
          <span className="text-xs text-muted-foreground">10–120 seconds</span>
        </div>
      )}
      {me?.isHost && <RoleSelector roles={room.enabledRoles || []} onRoles={onRoles} />}
      {!me?.isHost && (
        <div className="mt-8 border border-border bg-card p-4 text-sm text-muted-foreground">The host is choosing which roles are in play.</div>
      )}
      {me?.isHost && (
        <button onClick={onStart} disabled={room.players.length < 3} className="mt-8 flex h-14 items-center gap-3 bg-accent px-7 font-mono text-xs font-bold uppercase tracking-widest text-accent-foreground disabled:opacity-35">
          <Wand2 size={16} /> Deal the cards
        </button>
      )}
      {error && <p className="mt-5 text-sm text-destructive">{error}</p>}
    </div>
  )
}

function Reveal({ role, info, isHost, remaining, onAdvance }: { role: string; info: { title: string; text: string }; isHost: boolean; remaining: number; onAdvance: () => void }) {
  return (
    <div className="mx-auto max-w-lg py-12">
      <div className="border border-accent/40 bg-card p-6">
        <div className="flex aspect-[.75] flex-col justify-between border border-border p-8 text-center">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Your starting card · keep secret</div>
          <div>
            <RoleIcon role={role} className="mx-auto mb-6 h-40 w-28 rounded-lg bg-black" />
            <h3 className="font-serif text-5xl">{info.title}</h3>
            <p className="mx-auto mt-5 max-w-xs leading-7 text-muted-foreground">{info.text}</p>
          </div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Do not show this card</div>
        </div>
      </div>
      <p className="mt-6 text-center font-mono text-xs uppercase tracking-widest text-accent">Night begins in 00:{String(remaining).padStart(2, '0')}</p>
      {isHost && (
        <button onClick={onAdvance} className="mt-8 flex w-full items-center justify-center gap-3 bg-accent px-6 py-4 font-mono text-xs font-bold uppercase tracking-widest text-accent-foreground">
          Begin the night now <ArrowRight size={15} />
        </button>
      )}
    </div>
  )
}

function PlayerGrid({ players, value, onPick, exclude }: { players: Player[]; value: string; onPick: (id: string) => void; exclude?: string[] }) {
  return (
    <div className="mt-5 grid gap-2 sm:grid-cols-2">
      {players
        .filter((p) => !p.isMe && !exclude?.includes(p.id))
        .map((p) => (
          <button key={p.id} onClick={() => onPick(p.id)} className={`border p-4 text-left ${value === p.id ? 'border-accent bg-accent/10' : 'border-border bg-card'}`}>
            Player {p.seat}
          </button>
        ))}
    </div>
  )
}
function CenterGrid({ value, onPick }: { value: string[]; onPick: (i: string) => void }) {
  return (
    <div className="mt-5 grid grid-cols-3 gap-2">
      {[0, 1, 2].map((i) => (
        <button key={i} onClick={() => onPick(String(i))} className={`border p-4 ${value.includes(String(i)) ? 'border-accent bg-accent/10' : 'border-border bg-card'}`}>
          Center {i + 1}
        </button>
      ))}
    </div>
  )
}
function PeekPanel({ peek }: { peek: string[] }) {
  if (!peek.length) return null
  return (
    <div className="mt-8 border border-accent/40 bg-accent/10 p-6">
      <div className="font-mono text-xs uppercase tracking-widest text-accent">Private information</div>
      {peek.map((p, i) => (
        <p key={i} className="mt-3 font-serif text-2xl leading-tight">
          {p}
        </p>
      ))}
      <p className="mt-3 text-sm text-muted-foreground">Only you can see this. The timer keeps running — press Finish my action when ready.</p>
    </div>
  )
}

function NightFixed({
  role,
  activeRole,
  remaining,
  info,
  players,
  selected,
  selected2,
  center,
  setSelected,
  setSelected2,
  setCenter,
  acted,
  peek,
  onAction,
}: {
  role: string
  activeRole: string
  remaining: number
  info: { title: string; text: string }
  players: Player[]
  selected: string
  selected2: string
  center: string
  setSelected: (v: string) => void
  setSelected2: (v: string) => void
  setCenter: (v: string) => void
  acted: boolean
  peek: string[]
  onAction: (v: Record<string, string | undefined>) => void
}) {
  const [seerMode, setSeerMode] = useState<'player' | 'center'>('player')
  const [seerCenters, setSeerCenters] = useState<string[]>([])
  const active = activeRole === role
  const soloWolf = peek.some((p) => p.includes('only Werewolf'))
  const hasCenterPeek = peek.some((p) => p.includes('Center card:'))

  const OriginalRoleBadge = (
    <div className="mb-5 inline-flex items-center gap-2 border border-border bg-card px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
      Your original role <span className="text-foreground">{role}</span>
    </div>
  )

  if (!active) {
    return (
      <div className="py-16">
        <div>{OriginalRoleBadge}</div>
        <div className="mb-5 flex items-center gap-3 font-mono text-xs uppercase tracking-widest text-accent">
          <Moon size={18} /> Everyone is watching
        </div>
        <h3 className="font-serif text-5xl">The {activeRole || 'next role'} is now looking at cards.</h3>
        <p className="mt-5 max-w-xl leading-7 text-muted-foreground">Keep your eyes down. Their action resolves in {remaining} seconds or less, then the next role wakes.</p>
      </div>
    )
  }

  const toggleSeerCenter = (i: string) => {
    setSeerCenters((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : prev.length < 2 ? [...prev, i] : prev))
  }

  return (
    <div className="py-12">
      <div>{OriginalRoleBadge}</div>
      <div className="mb-5 flex items-center justify-between font-mono text-xs uppercase tracking-widest text-accent">
        <span>{info.title} · night action</span>
        <span className="text-foreground">00:{String(remaining).padStart(2, '0')}</span>
      </div>
      <h3 className="font-serif text-5xl">{info.title} wakes.</h3>
      <p className="mt-4 max-w-xl leading-7 text-muted-foreground">{info.text}</p>

      <PeekPanel peek={peek} />

      {(role === 'Insomniac' || role === 'Mason' || role === 'Minion') && (
        <p className="mt-6 text-sm text-muted-foreground">This information was revealed to you automatically the moment your turn started.</p>
      )}

      {role === 'Werewolf' && soloWolf && !hasCenterPeek && (
        <div className="mt-8">
          <p className="mb-2 text-sm text-muted-foreground">You are the only Werewolf. You may optionally peek at one center card before finishing.</p>
          <CenterGrid value={center ? [center] : []} onPick={(i) => setCenter(center === i ? '' : i)} />
          <button onClick={() => onAction({ center })} disabled={!center} className="mt-4 bg-accent px-6 py-4 font-mono text-xs font-bold uppercase tracking-widest text-accent-foreground disabled:opacity-35">
            Peek this center card
          </button>
        </div>
      )}

      {!acted && (
        <div className="mt-8">
          {role === 'Seer' && (
            <div>
              <div className="mb-5 flex gap-3">
                <button
                  onClick={() => {
                    setSeerMode('player')
                    setSeerCenters([])
                  }}
                  className={`border px-4 py-3 font-mono text-xs uppercase tracking-widest ${seerMode === 'player' ? 'border-accent bg-accent/10 text-accent' : 'border-border text-muted-foreground'}`}
                >
                  Look at a player
                </button>
                <button
                  onClick={() => {
                    setSeerMode('center')
                    setSelected('')
                  }}
                  className={`border px-4 py-3 font-mono text-xs uppercase tracking-widest ${seerMode === 'center' ? 'border-accent bg-accent/10 text-accent' : 'border-border text-muted-foreground'}`}
                >
                  Look at two center cards
                </button>
              </div>
              {seerMode === 'player' ? (
                <>
                  <p className="text-sm text-muted-foreground">Choose one player below.</p>
                  <PlayerGrid players={players} value={selected} onPick={setSelected} />
                  <button
                    onClick={() => onAction({ mode: 'player', target: selected })}
                    disabled={!selected}
                    className="mt-6 bg-accent px-6 py-4 font-mono text-xs font-bold uppercase tracking-widest text-accent-foreground disabled:opacity-35"
                  >
                    Reveal their card
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">Choose exactly two center cards ({seerCenters.length}/2 selected).</p>
                  <CenterGrid value={seerCenters} onPick={toggleSeerCenter} />
                  <button
                    onClick={() => onAction({ mode: 'center', center: seerCenters[0], center2: seerCenters[1] })}
                    disabled={seerCenters.length !== 2}
                    className="mt-6 bg-accent px-6 py-4 font-mono text-xs font-bold uppercase tracking-widest text-accent-foreground disabled:opacity-35"
                  >
                    Reveal these cards
                  </button>
                </>
              )}
            </div>
          )}

          {role === 'Robber' && (
            <div>
              <p className="text-sm text-muted-foreground">Choose a player to swap cards with.</p>
              <PlayerGrid players={players} value={selected} onPick={setSelected} />
              <button onClick={() => onAction({ target: selected })} disabled={!selected} className="mt-6 bg-accent px-6 py-4 font-mono text-xs font-bold uppercase tracking-widest text-accent-foreground disabled:opacity-35">
                Swap with selected player
              </button>
            </div>
          )}

          {role === 'Doppelgänger' && (
            <div>
              <p className="text-sm text-muted-foreground">Choose a player to copy.</p>
              <PlayerGrid players={players} value={selected} onPick={setSelected} />
              <button onClick={() => onAction({ target: selected })} disabled={!selected} className="mt-6 bg-accent px-6 py-4 font-mono text-xs font-bold uppercase tracking-widest text-accent-foreground disabled:opacity-35">
                Copy selected player
              </button>
            </div>
          )}

          {role === 'Troublemaker' && (
            <div>
              <p className="text-sm text-muted-foreground">Choose two other players to swap. Order: {selected ? 'first player chosen' : 'pick first player'}{selected2 ? ', second player chosen' : ''}.</p>
              <PlayerGrid players={players} value={selected} onPick={(id) => (selected === id ? setSelected('') : selected2 === id ? setSelected2('') : selected ? setSelected2(id) : setSelected(id))} exclude={[]} />
              <button
                onClick={() => onAction({ target: selected, target2: selected2 })}
                disabled={!selected || !selected2}
                className="mt-6 bg-accent px-6 py-4 font-mono text-xs font-bold uppercase tracking-widest text-accent-foreground disabled:opacity-35"
              >
                Swap these two players
              </button>
            </div>
          )}

          {role === 'Drunk' && (
            <div>
              <p className="text-sm text-muted-foreground">Choose a center card to swap with (you will not see the new role).</p>
              <CenterGrid value={center ? [center] : []} onPick={(i) => setCenter(i)} />
              <button onClick={() => onAction({ center })} disabled={!center} className="mt-6 bg-accent px-6 py-4 font-mono text-xs font-bold uppercase tracking-widest text-accent-foreground disabled:opacity-35">
                Swap with center card
              </button>
            </div>
          )}
        </div>
      )}

      {acted && <p className="mt-6 text-sm text-green-300">Action recorded. Review your private information above, then choose Finish my action.</p>}
    </div>
  )
}

function Discussion({ room, isHost, onAdvance }: { room: Room; isHost: boolean; onAdvance: () => void }) {
  return (
    <div className="grid gap-10 py-12 lg:grid-cols-[1fr_280px]">
      <div>
        <div className="mb-5 font-mono text-xs uppercase tracking-widest text-accent">Open discussion</div>
        <h3 className="font-serif text-5xl">Everyone is awake.</h3>
        <p className="mt-5 max-w-xl leading-7 text-muted-foreground">Starting roles are not final roles. Tell the truth, bluff, accuse, and remember that swaps happened in secret.</p>
      </div>
      <aside className="border border-border bg-card p-6">
        <div className="font-mono text-[10px] uppercase tracking-widest text-accent">Players</div>
        <div className="mt-5 space-y-3">
          {room.players.map((p) => (
            <div key={p.id} className="flex justify-between text-sm">
              <span>Player {p.seat}</span>
              <span className="text-green-300">ready</span>
            </div>
          ))}
        </div>
        {isHost && (
          <button onClick={onAdvance} className="mt-7 flex h-12 w-full items-center justify-center gap-2 bg-accent font-mono text-xs font-bold uppercase tracking-widest text-accent-foreground">
            Open voting <ArrowRight size={14} />
          </button>
        )}
      </aside>
    </div>
  )
}

function VotePanel({ room, selected, setSelected, acted, onVote }: { room: Room; selected: string; setSelected: (v: string) => void; acted: boolean; onVote: () => void }) {
  return (
    <div className="grid gap-10 py-12 lg:grid-cols-[.8fr_1.2fr]">
      <div>
        <div className="mb-5 flex items-center gap-3 font-mono text-xs uppercase tracking-widest text-accent">
          <Vote size={18} /> Final vote
        </div>
        <h3 className="font-serif text-5xl">Point the finger.</h3>
        <p className="mt-5 leading-7 text-muted-foreground">Everyone votes at the same time. Ties eliminate every tied player. Players are shown by seat number to keep names private during discussion.</p>
        {acted && <div className="mt-8 border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-300">Vote locked. Waiting for the rest of the table.</div>}
      </div>
      <div className="border border-border bg-card p-5">
        <div className="grid gap-2">
          {room.players
            .filter((p) => !p.isMe)
            .map((p) => (
              <button key={p.id} disabled={acted} onClick={() => setSelected(p.id)} className={`flex justify-between border p-4 text-left ${selected === p.id ? 'border-accent bg-accent/10' : 'border-border'}`}>
                <span>Player {p.seat}</span>
                <span className="font-mono text-xs text-muted-foreground">seat {p.seat}</span>
              </button>
            ))}
        </div>
        <button disabled={acted || !selected} onClick={onVote} className="mt-4 h-12 w-full bg-accent font-mono text-xs font-bold uppercase tracking-widest text-accent-foreground disabled:opacity-35">
          Lock vote
        </button>
      </div>
    </div>
  )
}

function Results({ room, isHost, onRestart }: { room: Room; isHost: boolean; onRestart: () => void }) {
  const eliminated = room.players.filter((p) => room.eliminatedIds?.includes(p.id))
  return (
    <div className="py-14">
      <div className="mb-10 text-center">
        <div className="font-mono text-xs uppercase tracking-[.3em] text-accent">The truth</div>
        <h3 className="mt-3 font-serif text-6xl">{room.outcome || 'Cards on the table.'}</h3>
        <p className="mt-4 text-muted-foreground">Final roles are revealed below. The role in front of each player is what matters, not their starting card.</p>
      </div>
      <div className="mx-auto max-w-3xl border border-border bg-card p-6">
        <div className="mb-5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {eliminated.length ? `Eliminated: ${eliminated.map((p) => `Player ${p.seat}`).join(', ')}` : 'Nobody was eliminated.'}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {room.players.map((p) => (
            <div key={p.id} className={`flex items-center justify-between border p-4 ${room.eliminatedIds?.includes(p.id) ? 'border-destructive/50 bg-destructive/10' : 'border-border'}`}>
              <div>
                <div className="text-sm">
                  Player {p.seat}
                  {p.isMe && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                </div>
                <div className="font-serif text-2xl">{p.role}</div>
              </div>
              {p.voteFor && <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">voted a player</div>}
            </div>
          ))}
        </div>
        <div className="mt-6 border-t border-border pt-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Center cards: {room.centerRoles.join(' · ')}</div>
        {isHost && (
          <button onClick={onRestart} className="mt-8 flex h-12 items-center gap-3 bg-accent px-6 font-mono text-xs font-bold uppercase tracking-widest text-accent-foreground">
            <RotateCcw size={15} /> Restart game
          </button>
        )}
      </div>
    </div>
  )
}
