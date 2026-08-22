'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, Copy, Crown, Eye, Moon, RotateCcw, Shield, Sparkles, Users, Wand2 } from 'lucide-react'

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
  activeRoleHasPlayer?: boolean
  remainingSeconds?: number
  actionStartedAt?: string | null
  players: Player[]
  centerRoles: string[]
  enabledRoles?: string[]
  eliminatedIds?: string[]
  outcome?: string | null
  spectatorCount?: number
  me?: {
    id: string
    name: string
    isHost: boolean
    isSpectator?: boolean
    startingRole?: string | null
    finalRole?: string | null
    roleArt?: string | null
    nightAction?: { peek?: string[]; target?: string; target2?: string; center?: string; center2?: string; copiedRole?: string; completed?: boolean } | null
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
  Drunk: '0% 50%', Insomniac: '33.333% 50%', Mason: '66.666% 50%', Hunter: '100% 50%',
  Minion: '0% 100%', Tanner: '33.333% 100%', Villager: '66.666% 100%', Doppelgänger: '100% 100%',
}
function RoleIcon({ role, className = '' }: { role: string; className?: string }) {
  return <div aria-label={`${role} role card`} role="img" className={`role-art bg-no-repeat ${className}`} style={{ backgroundImage: `url(${ROLE_SHEET})`, backgroundPosition: ROLE_POSITIONS[role] || '0% 0%', backgroundSize: '400% 300%' }} />
}

function PhaseProgress({ remaining, total }: { remaining: number; total: number }) {
  const percentage = total > 0 ? Math.max(0, Math.min(100, (remaining / total) * 100)) : 0
  return <div className="phase-progress" role="progressbar" aria-label="Phase time remaining" aria-valuemin={0} aria-valuemax={total} aria-valuenow={remaining}><span style={{ width: `${percentage}%` }} /></div>
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
  const [selectedCenters, setSelectedCenters] = useState<string[]>([])
  const [copied, setCopied] = useState(false)

  const enter = useCallback(
    async (action: 'create' | 'join' | 'spectate') => {
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

  useEffect(() => {
    setSelected('')
    setSelected2('')
    setCenter('')
    setSelectedCenters([])
  }, [room?.phase, room?.activeRole, room?.me?.nightAction?.copiedRole])

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
      setSelectedCenters([])
    }
  }

  const me = room?.players.find((p) => p.isMe)
  const role = room?.phase === 'results' ? me?.role || me?.startingRole || 'Villager' : me?.startingRole || me?.role || 'Villager'
  const info = roleInfo[role] || roleInfo.Villager
  const copiedRole = room?.me?.nightAction?.completed === false ? room.me.nightAction.copiedRole : null
  const actionRole = copiedRole || role
  const actionInfo = roleInfo[actionRole] || info
  const copy = async () => {
    await navigator.clipboard?.writeText(codeInput)
    setCopied(true)
    setTimeout(() => setCopied(false), 1000)
  }

  return (
    <main className={mode === 'home' ? 'night-home' : 'min-h-screen bg-background text-foreground'}>
      {mode === 'home' ? (
        <div className="night-home-content">
          {/* <header className="night-brand">
            <span className="night-brand-mark"><Moon size={18} /></span>
            <span>ONE NIGHT</span>
          </header> */}
          <section className="night-hero-copy">
            <div className="night-kicker">Digital cards for one night</div>
            <h1 className="night-title">One Night<span className='text-accent'>Werewolf</span></h1>
            <div className="night-rule" aria-hidden="true"><i /></div>
            <p className="night-description">Keep the narrator. Replace the physical cards with a fast, private table on everyone&apos;s phone.</p>
            <div className="mt-6 flex w-full max-w-[35rem] flex-col gap-3 sm:flex-row">
              <label className="sr-only" htmlFor="home-name">Your display name</label>
              <input id="home-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your display name" className="h-12 min-w-0 flex-1 border border-border bg-card/70 px-4 text-foreground outline-none placeholder:text-muted-foreground focus:border-accent" />
            </div>
            <button onClick={() => name.trim() && setMode('join')} className="night-start">
              <span>Enter the night</span><ArrowRight size={27} />
            </button>
          </section>
        </div>
      ) : (
      <div className="mx-auto min-h-screen max-w-6xl px-5 py-6 md:px-10">
        <header className="flex items-center justify-center border-b border-border pb-6">
          <div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-full border border-accent text-accent"><Moon size={19} /></div><div><div className="font-mono text-[10px] uppercase tracking-[.35em] text-accent">A night of suspicion</div><div className="font-serif text-xl">ONE NIGHT</div></div></div>
          <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex"><Shield size={14} /> Private rooms. No accounts.</div>
        </header>

        {mode === 'join' && null}

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
            <button onClick={() => enter('spectate')} disabled={codeInput.length < 6} className="mt-3 flex h-14 items-center justify-center gap-3 rounded-md border border-accent/50 bg-accent/10 font-mono text-xs font-bold uppercase tracking-widest text-accent disabled:opacity-40">
              <Eye size={16} /> Join as spectator
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
          <section className="py-5 md:py-8">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[.3em] text-accent">Private table</div>
                <h2 className="mt-1 font-serif text-2xl md:text-3xl">Miller's Hollow{room.me?.isSpectator ? ' · Spectator' : ''}</h2>
              </div>
              <button onClick={copy} className="flex h-11 items-center gap-3 rounded-md border border-accent/50 bg-accent/10 px-4 font-mono text-sm tracking-[.25em] text-accent">
                {codeInput}
                <Copy size={14} />
                <span className="hidden text-[9px] tracking-normal text-muted-foreground sm:inline">{copied ? 'COPIED' : 'INVITE'}</span>
              </button>
            </div>

            <GameTable
              room={room}
              role={actionRole}
              info={actionInfo}
              selected={selected}
              selected2={selected2}
              selectedCenters={selectedCenters}
              center={center}
              onAction={(action, extra) => act(action, extra)}
              onPlayerPick={(id) => {
                if (room.phase === 'vote') return setSelected(selected === id ? '' : id)
                if (role === 'Seer') setSelectedCenters([])
                if (role === 'Troublemaker') {
                  if (selected === id) setSelected('')
                  else if (selected2 === id) setSelected2('')
                  else if (!selected) setSelected(id)
                  else setSelected2(id)
                  return
                }
                setSelected(selected === id ? '' : id)
              }}
              onCenterPick={(index) => {
                if (role === 'Seer') {
                  setSelected('')
                  setSelectedCenters((current) => current.includes(index) ? current.filter((value) => value !== index) : current.length < 2 ? [...current, index] : current)
                  return
                }
                setCenter(center === index ? '' : index)
              }}
            />

            <div className="game-console">
              <div className="mb-7 border-b border-border pb-6">
                <div className="font-mono text-xs uppercase tracking-[.3em] text-accent">{room.phase === 'lobby' ? 'Waiting room' : room.phase.toUpperCase()}</div>
                <h2 className="mt-2 font-serif text-4xl md:text-5xl">
                  {room.me?.isSpectator
                    ? 'Live from the table.'
                    : room.phase === 'lobby'
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

            {room.me?.isSpectator ? (
              <SpectatorPanel room={room} />
            ) : room.phase === 'lobby' && (
              <Lobby
                room={room}
                onStart={() => act('start')}
                onSettings={(seconds) => act('settings', { seconds: String(seconds) })}
                onRoles={(roles) => act('settings', { roles: JSON.stringify(roles) })}
                error={error}
              />
            )}
            {!room.me?.isSpectator && room.phase === 'reveal' && <Reveal role={role} info={info} isHost={Boolean(me?.isHost)} remaining={room.remainingSeconds || 0} onAdvance={() => act('advance')} />}
            {!room.me?.isSpectator && room.phase === 'night' && (
              <>
                <NightFixed
                  role={role}
                  activeRole={room.activeRole || ''}
                  remaining={room.remainingSeconds || 0}
                  total={room.actionSeconds || 30}
                  info={actionInfo}
                  acted={Boolean(me?.hasActed)}
                  peek={room.me?.nightAction?.peek || []}
                />
              </>
            )}
            {!room.me?.isSpectator && room.phase === 'discussion' && <Discussion room={room} isHost={Boolean(me?.isHost)} onAdvance={() => act('advance')} />}
            {!room.me?.isSpectator && room.phase === 'results' && <Results room={room} isHost={Boolean(me?.isHost)} onRestart={() => act('restart')} />}
            {error && <p className="mt-6 text-sm text-destructive">{error}</p>}
            </div>
          </section>
        )}
      </div>
      )}
    </main>
  )
}

function GameTable({ room, role, info, selected, selected2, selectedCenters, center, onPlayerPick, onCenterPick, onAction }: {
  room: Room
  role: string
  info: { title: string; text: string }
  selected: string
  selected2: string
  selectedCenters: string[]
  center: string
  onPlayerPick: (id: string) => void
  onCenterPick: (index: string) => void
  onAction: (action: string, extra?: Record<string, string | undefined>) => void
}) {
  const orderedPlayers = [...room.players].sort((a, b) => Number(Boolean(b.isMe)) - Number(Boolean(a.isMe)))
  const isSpectator = Boolean(room.me?.isSpectator)
  const isResults = room.phase === 'results'
  const me = room.players.find((player) => player.isMe)
  const isMyNightTurn = !isSpectator && room.phase === 'night' && room.activeRole === me?.startingRole
  const nightPrompt: Record<string, string> = {
    Seer: 'Pick a seat or 2 cards',
    Robber: 'Pick a seat to rob',
    Troublemaker: 'Pick 2 seats to swap',
    Drunk: 'Pick a center card',
    Werewolf: 'The pack is awake',
    Doppelgänger: 'Pick a seat to copy',
  }
  const status = room.phase === 'lobby'
    ? `${room.players.length} seated`
    : room.phase === 'night'
      ? !room.activeRoleHasPlayer ? `No ${room.activeRole || 'role'} wakes` : isMyNightTurn && nightPrompt[role] ? nightPrompt[role] : `${room.activeRole || 'Village'} wakes`
      : room.phase === 'discussion'
        ? 'Table talk'
        : room.phase === 'vote'
          ? 'Final vote'
          : room.phase === 'results'
            ? isSpectator ? 'Round complete' : 'Cards revealed'
            : 'Cards dealt'
  const isSoloWerewolf = room.me?.nightAction?.peek?.some((message) => message.includes('only Werewolf'))
  const playerTargetingRoles = ['Seer', 'Robber', 'Troublemaker', 'Doppelgänger']
  const canAct = !me?.hasActed || role === 'Werewolf'
  const canPickPlayers = !isSpectator && ((room.phase === 'vote' && !me?.hasVoted) || (isMyNightTurn && canAct && playerTargetingRoles.includes(role)))
  const canPickCenters = isMyNightTurn && canAct && (role === 'Drunk' || role === 'Seer' || (role === 'Werewolf' && Boolean(isSoloWerewolf)))

  return (
    <div className="table-room" aria-label="Game table">
      <div className="game-table">
        <div className="table-felt">
          <div className="table-mark">
            <Moon size={14} />
            <span>One Night</span>
          </div>
          <div className="table-status">
            <span className={`status-light ${room.phase === 'night' ? 'is-night' : ''}`} />
            <span>{status}</span>
            {room.phase === 'night' && <PhaseProgress remaining={room.remainingSeconds || 0} total={room.actionSeconds || 30} />}
          </div>

          <div className="center-cards" aria-label="Center cards">
            {[0, 1, 2].map((index) => (
              <button
                type="button"
                className={`center-card ${isResults ? 'is-revealed' : ''} ${canPickCenters ? 'is-pickable' : ''} ${center === String(index) || selectedCenters.includes(String(index)) ? 'is-selected' : ''}`}
                disabled={!canPickCenters}
                onClick={() => onCenterPick(String(index))}
                aria-label={`Center card ${index + 1}`}
                key={index}
              >
                {isResults ? (
                  <>
                    <RoleIcon role={room.centerRoles[index] || 'Villager'} className="center-role-art" />
                    <span>{room.centerRoles[index]}</span>
                  </>
                ) : (
                  <>
                    <Moon size={17} />
                    <span>{index + 1}</span>
                  </>
                )}
              </button>
            ))}
          </div>

          {orderedPlayers.map((player, index) => {
            const angle = Math.PI / 2 + (index * Math.PI * 2) / orderedPlayers.length
            const position = {
              left: `${50 + Math.cos(angle) * 44}%`,
              top: `${50 + Math.sin(angle) * 40}%`,
            }
            const eliminated = room.eliminatedIds?.includes(player.id)
            return (
              <button
                type="button"
                className={`table-seat ${player.isMe ? 'is-me' : ''} ${eliminated ? 'is-eliminated' : ''} ${canPickPlayers && !player.isMe ? 'is-pickable' : ''} ${selected === player.id || selected2 === player.id ? 'is-selected' : ''}`}
                style={position}
                disabled={!canPickPlayers || Boolean(player.isMe)}
                onClick={() => onPlayerPick(player.id)}
                aria-label={`Select ${player.name}, seat ${player.seat}`}
                key={player.id}
              >
                <div className={`player-card ${isResults || (!isSpectator && player.isMe && room.phase !== 'lobby') ? 'is-face-up' : 'is-face-down'}`}>
                  {isResults || (!isSpectator && player.isMe && room.phase !== 'lobby') ? (
                    <RoleIcon role={(isResults ? player.role : role) || 'Villager'} className="player-role-art" />
                  ) : (
                    <Moon size={18} />
                  )}
                </div>
                <div className="seat-label">
                  <span>{player.name}</span>
                  <small>
                    {player.isHost && <Crown size={10} />}
                    {player.isMe ? 'You' : `Seat ${player.seat}`}
                  </small>
                </div>
              </button>
            )
          })}
        </div>
      </div>
      <BoardActionDock
        room={room}
        role={role}
        info={info}
        selected={selected}
        selected2={selected2}
        selectedCenters={selectedCenters}
        center={center}
        onAction={onAction}
      />
    </div>
  )
}

function BoardActionDock({ room, role, info, selected, selected2, selectedCenters, center, onAction }: {
  room: Room
  role: string
  info: { title: string; text: string }
  selected: string
  selected2: string
  selectedCenters: string[]
  center: string
  onAction: (action: string, extra?: Record<string, string | undefined>) => void
}) {
  if (room.me?.isSpectator) return <SpectatorNarration room={room} />

  const me = room.players.find((player) => player.isMe)
  const active = room.phase === 'night' && room.activeRole === me?.startingRole
  const peek = room.me?.nightAction?.peek || []
  const soloWolf = peek.some((message) => message.includes('only Werewolf'))
  const hasCenterPeek = peek.some((message) => message.includes('Center card:'))

  if (room.phase === 'vote') {
    const target = room.players.find((player) => player.id === selected)
    return (
      <div className="table-action-dock">
        <div><strong>Final vote</strong><span>Select a player card, then lock your vote.</span></div>
        <button disabled={Boolean(me?.hasVoted) || !selected} onClick={() => onAction('vote', { target: selected })}>
          {me?.hasVoted ? 'Vote locked' : target ? `Vote for ${target.name}` : 'Select a player'}
        </button>
      </div>
    )
  }

  if (!active) return null
  if (me?.hasActed && !(role === 'Werewolf' && soloWolf && !hasCenterPeek)) {
    return <div className="table-action-dock is-complete"><div><strong>Action recorded</strong><span>Your private information is below the table.</span></div></div>
  }

  let instruction = info.text
  let label = ''
  let disabled = true
  let submit: Record<string, string | undefined> = {}

  if (role === 'Seer') {
    instruction = 'Select one player card or exactly two center cards.'
    if (selected) {
      label = 'Reveal player card'
      disabled = false
      submit = { mode: 'player', target: selected }
    } else {
      label = selectedCenters.length === 2 ? 'Reveal center cards' : `Select 2 center cards (${selectedCenters.length}/2)`
      disabled = selectedCenters.length !== 2
      submit = { mode: 'center', center: selectedCenters[0], center2: selectedCenters[1] }
    }
  } else if (role === 'Robber') {
    instruction = 'Select another player card to swap with.'
    label = 'Swap cards'
    disabled = !selected
    submit = { target: selected }
  } else if (role === 'Doppelgänger') {
    instruction = 'Select another player card to copy.'
    label = 'Copy role'
    disabled = !selected
    submit = { target: selected }
  } else if (role === 'Troublemaker') {
    instruction = 'Select two player cards to swap.'
    label = selected2 ? 'Swap selected cards' : selected ? 'Select one more player' : 'Select two players'
    disabled = !selected || !selected2
    submit = { target: selected, target2: selected2 }
  } else if (role === 'Drunk') {
    instruction = 'Select one center card to swap with.'
    label = 'Swap with center'
    disabled = !center
    submit = { center }
  } else if (role === 'Werewolf' && soloWolf && !hasCenterPeek) {
    instruction = 'You are the only Werewolf. You may inspect one center card.'
    label = 'Peek at center card'
    disabled = !center
    submit = { center }
  } else {
    return <div className="table-action-dock is-complete"><div><strong>{info.title} wakes</strong><span>Your information is shown below the table.</span></div></div>
  }

  return (
    <div className="table-action-dock">
      <div><strong>{info.title} action</strong><span>{instruction}</span></div>
      <button disabled={disabled} onClick={() => onAction('night', submit)}>{label}</button>
    </div>
  )
}

function narrationFor(room: Room) {
  if (room.phase === 'lobby') return `${room.players.length} players are seated. The host is preparing a deck of ${room.players.length + 3} cards.`
  if (room.phase === 'reveal') return `The cards have been dealt. Each player is privately learning their starting role. Night falls in ${room.remainingSeconds || 0} seconds.`
  if (room.phase === 'night') return room.activeRoleHasPlayer
    ? `The village sleeps. ${room.activeRole || 'The next role'} is awake, and their move remains hidden. ${room.remainingSeconds || 0} seconds remain.`
    : `The ${room.activeRole || 'next role'} card is in the center, so no player wakes. The village waits ${room.remainingSeconds || 0} more seconds before continuing.`
  if (room.phase === 'discussion') return 'Morning breaks over the village. The players compare stories, make accusations, and try to reconstruct the hidden swaps.'
  if (room.phase === 'vote') return `${room.players.filter((player) => player.hasVoted).length} of ${room.players.length} votes are locked. No choice is revealed until everyone has voted.`
  if (room.phase === 'results') return room.outcome || 'The final votes are counted, but the cards remain hidden from the spectator gallery.'
  return 'The table is waiting for the next chapter.'
}

function SpectatorNarration({ room }: { room: Room }) {
  return (
    <div className="table-action-dock spectator-narration" aria-live="polite">
      <Eye size={18} />
      <div><strong>Live narration</strong><span>{narrationFor(room)}</span></div>
    </div>
  )
}

function SpectatorPanel({ room }: { room: Room }) {
  return (
    <div className="py-12">
      <div className="mb-5 flex items-center gap-3 font-mono text-xs uppercase tracking-widest text-accent"><Eye size={18} /> Spectator gallery</div>
      <h3 className="font-serif text-5xl">Watching from the shadows.</h3>
      <p className="mt-5 max-w-2xl text-xl leading-8 text-muted-foreground">{narrationFor(room)}</p>
      <p className="mt-8 border-l-2 border-accent/60 pl-4 text-sm text-muted-foreground">Private actions remain hidden during play. When voting ends, every player and center card is revealed.</p>
    </div>
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

function RoleSelector({ roles, required, onRoles }: { roles: string[]; required: number; onRoles: (roles: string[]) => void }) {
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
        <span className={total === required ? 'text-accent' : 'text-destructive'}>{total} / {required} cards</span>
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
      <p className="mt-4 text-xs text-muted-foreground">One Night uses one card per player plus exactly three center cards.</p>
    </div>
  )
}

function Lobby({ room, onStart, onSettings, onRoles, error }: { room: Room; onStart: () => void; onSettings: (seconds: number) => void; onRoles: (roles: string[]) => void; error: string }) {
  const me = room.players.find((p) => p.isMe)
  const requiredCards = room.players.length + 3
  const selectedCards = room.enabledRoles?.length || 0
  const deckReady = selectedCards === requiredCards
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
      {me?.isHost && <RoleSelector roles={room.enabledRoles || []} required={requiredCards} onRoles={onRoles} />}
      {!me?.isHost && (
        <div className="mt-8 border border-border bg-card p-4 text-sm text-muted-foreground">The host is choosing which roles are in play.</div>
      )}
      {me?.isHost && (
        <button onClick={onStart} disabled={room.players.length < 3 || !deckReady} className="mt-8 flex h-14 items-center gap-3 bg-accent px-7 font-mono text-xs font-bold uppercase tracking-widest text-accent-foreground disabled:opacity-35">
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
      <div className="mt-6"><PhaseProgress remaining={remaining} total={15} /></div>
      {isHost && (
        <button onClick={onAdvance} className="mt-8 flex w-full items-center justify-center gap-3 bg-accent px-6 py-4 font-mono text-xs font-bold uppercase tracking-widest text-accent-foreground">
          Begin the night now <ArrowRight size={15} />
        </button>
      )}
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
      <p className="mt-3 text-sm text-muted-foreground">Only you can see this. The role timer continues for the full duration.</p>
    </div>
  )
}

function NightFixed({
  role,
  activeRole,
  remaining,
  total,
  info,
  acted,
  peek,
}: {
  role: string
  activeRole: string
  remaining: number
  total: number
  info: { title: string; text: string }
  acted: boolean
  peek: string[]
}) {
  const active = activeRole === role

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
        <p className="mt-5 max-w-xl leading-7 text-muted-foreground">Keep your eyes down. When this turn ends, the next role wakes.</p>
        <div className="mt-6"><PhaseProgress remaining={remaining} total={total} /></div>
      </div>
    )
  }

  return (
    <div className="py-12">
      <div>{OriginalRoleBadge}</div>
      <div className="mb-5 flex items-center justify-between font-mono text-xs uppercase tracking-widest text-accent">
        <span>{info.title} · night action</span>
      </div>
      <PhaseProgress remaining={remaining} total={total} />
      <h3 className="font-serif text-5xl">{info.title} wakes.</h3>
      <p className="mt-4 max-w-xl leading-7 text-muted-foreground">{info.text}</p>

      <PeekPanel peek={peek} />

      {(role === 'Insomniac' || role === 'Mason' || role === 'Minion') && (
        <p className="mt-6 text-sm text-muted-foreground">This information was revealed to you automatically the moment your turn started.</p>
      )}

      {acted && <p className="mt-6 text-sm text-accent">Action recorded. Review your private information above while the night continues.</p>}
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
              <span className="text-accent">ready</span>
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
