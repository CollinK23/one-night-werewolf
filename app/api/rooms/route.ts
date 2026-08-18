import { NextResponse } from 'next/server'
import { randomBytes, randomUUID } from 'crypto'
import { and, asc, eq, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { werewolfPlayers, werewolfRooms } from '@/lib/db/schema'

const REVEAL_SECONDS = 15
const NIGHT_ORDER = ['Doppelgänger', 'Mason', 'Werewolf', 'Minion', 'Seer', 'Robber', 'Troublemaker', 'Drunk', 'Insomniac']
const ALL_ROLES = ['Werewolf', 'Seer', 'Robber', 'Troublemaker', 'Drunk', 'Insomniac', 'Mason', 'Hunter', 'Minion', 'Tanner', 'Villager', 'Doppelgänger']
const DEFAULT_ROLE_POOL = ['Werewolf', 'Werewolf', 'Seer', 'Robber', 'Troublemaker', 'Drunk', 'Insomniac', 'Mason', 'Mason', 'Hunter', 'Tanner', 'Minion', 'Villager', 'Villager', 'Villager', 'Doppelgänger']
const AUTO_REVEAL_ROLES = ['Werewolf', 'Minion', 'Mason', 'Insomniac']
const ROLE_ART: Record<string, string> = { Werewolf: '/roles/werewolf.png', Seer: '/roles/seer.png', Tanner: '/roles/tanner.png', Villager: '/roles/villager.png' }

const makeToken = () => randomBytes(18).toString('hex')
const makeCode = () => randomBytes(3).toString('hex').toUpperCase()
const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5)

async function getRoom(code: string) {
  return (await db.select().from(werewolfRooms).where(eq(werewolfRooms.code, code)).limit(1))[0]
}
async function getPlayer(roomId: string, token: string) {
  return (await db.select().from(werewolfPlayers).where(and(eq(werewolfPlayers.roomId, roomId), eq(werewolfPlayers.token, token))).limit(1))[0]
}
async function getPlayers(roomId: string) {
  return db.select().from(werewolfPlayers).where(eq(werewolfPlayers.roomId, roomId)).orderBy(asc(werewolfPlayers.seat))
}
async function nextRole(roomId: string, current: string | null) {
  const players = await getPlayers(roomId)
  const dealtRoles = new Set(players.map((player) => player.startingRole).filter(Boolean))
  const rolesInPlay = NIGHT_ORDER.filter((role) => dealtRoles.has(role))
  const index = Math.max(-1, rolesInPlay.indexOf(current || ''))
  return rolesInPlay[index + 1] || null
}
function centerCards(room: any) {
  return Array.isArray(room.centerRoles) ? ([...room.centerRoles] as string[]) : []
}

// A Doppelgänger keeps `startingRole` as 'Doppelgänger' forever (so the night order still calls on
// them only once), but for pack-identity purposes (who is a fellow Werewolf/Minion/Mason) everyone
// should see them as whatever role they copied.
function effectiveRole(p: any) {
  if (p.startingRole === 'Doppelgänger') {
    const copied = (p.nightAction as any)?.copiedRole
    if (copied) return copied
  }
  return p.startingRole
}
function wolfPack(players: any[], selfId: string) {
  return players.filter((p) => p.id !== selfId && effectiveRole(p) === 'Werewolf').map((p) => `Player ${p.seat}`)
}
function allWolves(players: any[]) {
  return players.filter((p) => effectiveRole(p) === 'Werewolf').map((p) => `Player ${p.seat}`)
}
function masonPair(players: any[], selfId: string) {
  return players.filter((p) => p.id !== selfId && effectiveRole(p) === 'Mason').map((p) => `Player ${p.seat}`)
}

// Shared logic for the roles that have no real choice to make (or an optional one for the lone
// Werewolf). Used both when a player explicitly re-opens their turn and to auto-populate the
// reveal the instant their turn starts, so nobody has to click a button just to be told who else
// is on their team.
function autoNightResult(role: string, player: any, players: any[], centers: string[], center?: string) {
  if (role === 'Werewolf') {
    const pack = wolfPack(players, player.id)
    if (pack.length) return { type: 'Werewolf', peek: [`Fellow werewolves: ${pack.join(', ')}`] }
    if (center !== undefined && center !== '') return { type: 'Werewolf', peek: [`You are the only Werewolf. Center card: ${centers[Number(center)]}`], center }
    return { type: 'Werewolf', peek: ['You are the only Werewolf. Pick a center card below to peek at it (optional).'] }
  }
  if (role === 'Minion') {
    const wolves = allWolves(players)
    return { type: 'Minion', peek: [wolves.length ? `Werewolves: ${wolves.join(', ')}` : 'No Werewolves are in play. You are alone.'] }
  }
  if (role === 'Mason') {
    const others = masonPair(players, player.id)
    return { type: 'Mason', peek: [others.length ? `Fellow Mason: ${others.join(', ')}` : 'No other Mason at the table — the second Mason card is in the center.'] }
  }
  if (role === 'Insomniac') return { type: 'Insomniac', peek: [`Your final card is: ${player.role}`] }
  return null
}

async function autoResolve(room: any, role: string | null) {
  if (!role || !AUTO_REVEAL_ROLES.includes(role)) return
  const players = await getPlayers(room.id)
  const centers = centerCards(room)
  for (const p of players) {
    if (p.startingRole !== role || p.nightAction) continue
    const result = autoNightResult(role, p, players, centers)
    if (result) await db.update(werewolfPlayers).set({ nightAction: result }).where(eq(werewolfPlayers.id, p.id))
  }
}

async function advanceNight(room: any) {
  const next = await nextRole(room.id, room.activeRole)
  const updated = await db
    .update(werewolfRooms)
    .set(next ? { activeRole: next, actionStartedAt: new Date(), updatedAt: new Date() } : { phase: 'discussion', activeRole: null, actionStartedAt: null, updatedAt: new Date() })
    .where(and(eq(werewolfRooms.id, room.id), eq(werewolfRooms.phase, 'night'), eq(werewolfRooms.activeRole, room.activeRole)))
    .returning({ id: werewolfRooms.id })
  if (!updated.length) return
  const freshRoom = await getRoom(room.code)
  await autoResolve(freshRoom, next)
}
async function advanceReveal(room: any) {
  const first = await nextRole(room.id, null)
  const updated = await db
    .update(werewolfRooms)
    .set(first ? { phase: 'night', activeRole: first, actionStartedAt: new Date(), updatedAt: new Date() } : { phase: 'discussion', activeRole: null, actionStartedAt: null, updatedAt: new Date() })
    .where(and(eq(werewolfRooms.id, room.id), eq(werewolfRooms.phase, 'reveal')))
    .returning({ id: werewolfRooms.id })
  if (!updated.length) return
  const freshRoom = await getRoom(room.code)
  await autoResolve(freshRoom, first)
}

function computeOutcome(rows: any[]) {
  const counts: Record<string, number> = {}
  for (const p of rows) if (p.voteFor) counts[p.voteFor] = (counts[p.voteFor] || 0) + 1
  const max = Math.max(0, ...Object.values(counts))
  const eliminatedIds = max > 0 ? Object.keys(counts).filter((id) => counts[id] === max) : []
  const eliminatedRoles = rows.filter((p) => eliminatedIds.includes(p.id)).map((p) => p.role)
  const anyWerewolf = rows.some((p) => p.role === 'Werewolf')
  let outcome: string
  if (eliminatedRoles.includes('Tanner')) outcome = 'The Tanner wanted this. The Tanner wins!'
  else if (eliminatedRoles.includes('Werewolf')) outcome = 'A Werewolf was found. The Village wins!'
  else if (anyWerewolf) outcome = 'The Werewolves survived the night. The Werewolves win!'
  else outcome = 'No Werewolves were in play. The Village wins!'
  return { eliminatedIds, outcome }
}

async function payload(code: string, token?: string) {
  const room = await getRoom(code)
  if (!room) return null
  const rows = await getPlayers(room.id)
  const me = rows.find((p) => p.token === token)
  const started = room.actionStartedAt ? new Date(room.actionStartedAt).getTime() : Date.now()
  const elapsed = Math.floor((Date.now() - started) / 1000)
  const remaining = room.phase === 'reveal' ? Math.max(0, REVEAL_SECONDS - elapsed) : room.phase === 'night' ? Math.max(0, room.actionSeconds - elapsed) : room.actionSeconds
  const privateAction = me?.nightAction as any
  const { eliminatedIds, outcome } = room.phase === 'results' ? computeOutcome(rows) : { eliminatedIds: [] as string[], outcome: null as string | null }
  return {
    code: room.code,
    status: room.status,
    phase: room.phase,
    actionSeconds: room.actionSeconds,
    activeRole: room.activeRole,
    actionStartedAt: room.actionStartedAt,
    remainingSeconds: remaining,
    centerRoles: room.phase === 'results' ? room.centerRoles : [],
    enabledRoles: Array.isArray(room.enabledRoles) && room.enabledRoles.length ? room.enabledRoles : DEFAULT_ROLE_POOL,
    eliminatedIds,
    outcome,
    me: me
      ? {
          id: me.id,
          name: me.name,
          isHost: me.isHost,
          startingRole: me.startingRole,
          finalRole: room.phase === 'results' ? me.role : null,
          roleArt: me.role ? ROLE_ART[me.role] || '/roles/role-cards.png' : null,
          nightAction: privateAction || null,
        }
      : null,
    players: rows.map((p) => ({
      id: p.id,
      name: p.name,
      isHost: p.isHost,
      isMe: p.token === token,
      seat: p.seat,
      hasActed: Boolean(p.nightAction),
      hasVoted: Boolean(p.voteFor),
      role: room.phase === 'results' || p.token === token ? p.role : null,
      startingRole: p.token === token ? p.startingRole : room.phase === 'results' ? p.startingRole : null,
      voteFor: room.phase === 'results' ? p.voteFor : null,
      roleArt: (room.phase === 'results' || p.token === token) && p.role ? ROLE_ART[p.role] || '/roles/role-cards.png' : null,
    })),
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')?.toUpperCase()
  const token = searchParams.get('token') || undefined
  if (!code) return NextResponse.json({ error: 'Missing room code.' }, { status: 400 })
  const room = await getRoom(code)
  if (room?.phase === 'reveal' && room.actionStartedAt && Date.now() - new Date(room.actionStartedAt).getTime() >= REVEAL_SECONDS * 1000) await advanceReveal(room)
  else if (room?.phase === 'night' && (!room.activeRole || (room.actionStartedAt && Date.now() - new Date(room.actionStartedAt).getTime() >= room.actionSeconds * 1000))) await advanceNight(room)
  const data = await payload(code, token)
  return data ? NextResponse.json(data) : NextResponse.json({ error: 'Room not found.' }, { status: 404 })
}

export async function POST(request: Request) {
  return mutate(await request.json())
}
export async function PATCH(request: Request) {
  return mutate(await request.json())
}

async function mutate(body: any) {
  const action = body.action
  if (action === 'create') {
    const token = makeToken()
    let code = makeCode()
    while (await getRoom(code)) code = makeCode()
    const roomId = randomUUID()
    await db
      .insert(werewolfRooms)
      .values({ id: roomId, code, hostToken: token, centerRoles: [], deckRoles: [], enabledRoles: DEFAULT_ROLE_POOL, actionSeconds: 30, activeRole: null, actionStartedAt: null, status: 'lobby', phase: 'lobby', updatedAt: new Date() })
    await db.insert(werewolfPlayers).values({ id: randomUUID(), roomId, token, name: String(body.name || 'Host').trim().slice(0, 24) || 'Host', seat: 1, isHost: true })
    return NextResponse.json({ code, token })
  }
  const code = String(body.code || '').trim().toUpperCase()
  const room = await getRoom(code)
  if (!room) return NextResponse.json({ error: 'Room not found.' }, { status: 404 })
  const token = String(body.token || '')
  const player = await getPlayer(room.id, token)

  if (action === 'join') {
    const current = await getPlayers(room.id)
    if (current.length >= 10) return NextResponse.json({ error: 'This game supports up to 10 players.' }, { status: 400 })
    const joinToken = makeToken()
    await db.insert(werewolfPlayers).values({ id: randomUUID(), roomId: room.id, token: joinToken, name: String(body.name || 'Player').trim().slice(0, 24) || 'Player', seat: current.length + 1, isHost: false })
    return NextResponse.json({ code, token: joinToken })
  }
  if (!player) return NextResponse.json({ error: 'Player not found.' }, { status: 403 })

  if (action === 'settings') {
    if (!player.isHost || room.phase !== 'lobby') return NextResponse.json({ error: 'Host only in lobby.' }, { status: 403 })
    const patch: any = { updatedAt: new Date() }
    if (body.seconds !== undefined) patch.actionSeconds = Math.min(120, Math.max(10, Number(body.seconds) || 30))
    if (body.roles !== undefined) {
      let roles: string[] = []
      try {
        roles = JSON.parse(body.roles)
      } catch {
        return NextResponse.json({ error: 'Invalid role selection.' }, { status: 400 })
      }
      roles = roles.filter((r) => ALL_ROLES.includes(r))
      if (!roles.length) return NextResponse.json({ error: 'Select at least one role.' }, { status: 400 })
      patch.enabledRoles = roles
    }
    await db.update(werewolfRooms).set(patch).where(eq(werewolfRooms.id, room.id))
    return NextResponse.json({ ok: true })
  }

  if (action === 'restart') {
    if (!player.isHost) return NextResponse.json({ error: 'Only the host can restart.' }, { status: 403 })
    await db.update(werewolfPlayers).set({ startingRole: null, role: null, nightAction: null, voteFor: null }).where(eq(werewolfPlayers.roomId, room.id))
    await db.update(werewolfRooms).set({ status: 'lobby', phase: 'lobby', activeRole: null, actionStartedAt: null, centerRoles: [], deckRoles: [], updatedAt: new Date() }).where(eq(werewolfRooms.id, room.id))
    return NextResponse.json({ ok: true })
  }

  if (action === 'start') {
    if (!player.isHost) return NextResponse.json({ error: 'Only the host can start.' }, { status: 403 })
    const players = await getPlayers(room.id)
    if (players.length < 3) return NextResponse.json({ error: 'You need at least 3 players.' }, { status: 400 })
    const basePool = Array.isArray(room.enabledRoles) && room.enabledRoles.length ? (room.enabledRoles as string[]) : DEFAULT_ROLE_POOL
    const requiredCards = players.length + 3
    if (basePool.length !== requiredCards) return NextResponse.json({ error: `Choose exactly ${requiredCards} role cards for ${players.length} players.` }, { status: 400 })
    const deck = shuffle(basePool)
    for (let i = 0; i < players.length; i++) await db.update(werewolfPlayers).set({ startingRole: deck[i], role: deck[i], nightAction: null, voteFor: null }).where(eq(werewolfPlayers.id, players[i].id))
    await db
      .update(werewolfRooms)
      .set({ status: 'playing', phase: 'reveal', centerRoles: deck.slice(players.length), deckRoles: deck, activeRole: null, actionStartedAt: new Date(), updatedAt: new Date() })
      .where(eq(werewolfRooms.id, room.id))
    return NextResponse.json({ ok: true })
  }

  if (action === 'advance') {
    if (!player.isHost) return NextResponse.json({ error: 'Only the host can advance.' }, { status: 403 })
    if (room.phase === 'reveal') await advanceReveal(room)
    else if (room.phase === 'discussion') await db.update(werewolfRooms).set({ phase: 'vote', updatedAt: new Date() }).where(eq(werewolfRooms.id, room.id))
    return NextResponse.json({ ok: true })
  }

  if (action === 'night') {
    const activeRoom = await getRoom(code)
    if (activeRoom.phase !== 'night' || activeRoom.activeRole !== player.startingRole) return NextResponse.json({ error: 'It is not your turn.' }, { status: 400 })
    if ((Date.now() - new Date(activeRoom.actionStartedAt || Date.now()).getTime()) / 1000 > activeRoom.actionSeconds) return NextResponse.json({ error: 'Your turn expired.' }, { status: 400 })
    const previousAction = player.nightAction as any
    const canAddSoloWolfPeek = player.startingRole === 'Werewolf' && previousAction?.peek?.some((message: string) => message.includes('only Werewolf')) && previousAction.center === undefined && body.center !== undefined
    if (previousAction && !canAddSoloWolfPeek) return NextResponse.json({ error: 'Your action is already recorded.' }, { status: 400 })
    const players = await getPlayers(room.id)
    const centers = centerCards(activeRoom)
    const target = players.find((p) => p.id === body.target)
    const target2 = players.find((p) => p.id === body.target2)
    let result: any = { type: player.startingRole, target: body.target, target2: body.target2, center: body.center }
    let actionSaved = false

    if (AUTO_REVEAL_ROLES.includes(player.startingRole!)) {
      result = { ...result, ...autoNightResult(player.startingRole!, player, players, centers, body.center) }
    }
    if (player.startingRole === 'Seer') {
      if (body.mode === 'player' && target) result.peek = [`Player ${target.seat}'s card: ${target.role}`]
      else if (body.mode === 'center' && body.center !== undefined && body.center2 !== undefined) result.peek = [`Center ${Number(body.center) + 1}: ${centers[Number(body.center)]}`, `Center ${Number(body.center2) + 1}: ${centers[Number(body.center2)]}`]
      else return NextResponse.json({ error: 'Choose one player or two center cards.' }, { status: 400 })
    }
    if (player.startingRole === 'Robber') {
      if (!target || target.id === player.id) return NextResponse.json({ error: 'Choose another player.' }, { status: 400 })
      const myOldRole = player.role
      result.peek = [`Your new role: ${target.role}`]
      actionSaved = await db.transaction(async (tx) => {
        const claimed = await tx.update(werewolfPlayers).set({ role: target.role, nightAction: result }).where(and(eq(werewolfPlayers.id, player.id), isNull(werewolfPlayers.nightAction))).returning({ id: werewolfPlayers.id })
        if (!claimed.length) return false
        await tx.update(werewolfPlayers).set({ role: myOldRole }).where(eq(werewolfPlayers.id, target.id))
        return true
      })
    }
    if (player.startingRole === 'Troublemaker') {
      if (!target || !target2 || target.id === target2.id || target.id === player.id || target2.id === player.id) return NextResponse.json({ error: 'Choose two other players.' }, { status: 400 })
      result.peek = [`Swapped Player ${target.seat} and Player ${target2.seat}. You did not see either card.`]
      actionSaved = await db.transaction(async (tx) => {
        const claimed = await tx.update(werewolfPlayers).set({ nightAction: result }).where(and(eq(werewolfPlayers.id, player.id), isNull(werewolfPlayers.nightAction))).returning({ id: werewolfPlayers.id })
        if (!claimed.length) return false
        await tx.update(werewolfPlayers).set({ role: target2.role }).where(eq(werewolfPlayers.id, target.id))
        await tx.update(werewolfPlayers).set({ role: target.role }).where(eq(werewolfPlayers.id, target2.id))
        return true
      })
    }
    if (player.startingRole === 'Drunk') {
      if (body.center === undefined || body.center === '') return NextResponse.json({ error: 'Choose a center card.' }, { status: 400 })
      const c = centers[Number(body.center)]
      centers[Number(body.center)] = player.role!
      result.peek = ['Your card was swapped with the center. You do not know your new role.']
      actionSaved = await db.transaction(async (tx) => {
        const claimed = await tx.update(werewolfPlayers).set({ role: c, nightAction: result }).where(and(eq(werewolfPlayers.id, player.id), isNull(werewolfPlayers.nightAction))).returning({ id: werewolfPlayers.id })
        if (!claimed.length) return false
        await tx.update(werewolfRooms).set({ centerRoles: centers }).where(eq(werewolfRooms.id, room.id))
        return true
      })
    }
    if (player.startingRole === 'Doppelgänger') {
      if (!target) return NextResponse.json({ error: 'Choose a player to copy.' }, { status: 400 })
      const copied = target.role
      result.peek = [`You copied Player ${target.seat}: ${copied}`]
      result.copiedRole = copied
      // If the copied role is one of the identity-reveal roles, resolve that reveal right now —
      // it's the Doppelgänger's only chance, since they never get a second turn later.
      if (AUTO_REVEAL_ROLES.includes(copied!) && copied !== 'Insomniac') {
        const packResult = autoNightResult(copied!, player, players, centers)
        if (packResult?.peek) result.peek = [...result.peek, ...packResult.peek]
      }
      const claimed = await db.update(werewolfPlayers).set({ role: copied, nightAction: result }).where(and(eq(werewolfPlayers.id, player.id), isNull(werewolfPlayers.nightAction))).returning({ id: werewolfPlayers.id })
      actionSaved = Boolean(claimed.length)
    }

    if (!actionSaved) {
      const claimed = await db.update(werewolfPlayers).set({ nightAction: result }).where(canAddSoloWolfPeek ? eq(werewolfPlayers.id, player.id) : and(eq(werewolfPlayers.id, player.id), isNull(werewolfPlayers.nightAction))).returning({ id: werewolfPlayers.id })
      if (!claimed.length) return NextResponse.json({ error: 'Your action is already recorded.' }, { status: 400 })
    }
    return NextResponse.json({ ok: true })
  }



  if (action === 'vote') {
    if (room.phase !== 'vote' || player.voteFor) return NextResponse.json({ error: 'Vote unavailable.' }, { status: 400 })
    await db.update(werewolfPlayers).set({ voteFor: body.target || null }).where(eq(werewolfPlayers.id, player.id))
    const all = await getPlayers(room.id)
    if (all.every((p) => p.voteFor)) await db.update(werewolfRooms).set({ phase: 'results', updatedAt: new Date() }).where(eq(werewolfRooms.id, room.id))
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
}
