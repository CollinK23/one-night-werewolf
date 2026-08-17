import { NextResponse } from 'next/server'
import { randomBytes, randomUUID } from 'crypto'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { werewolfPlayers, werewolfRooms } from '@/lib/db/schema'

const roles = ['Werewolf', 'Seer', 'Robber', 'Troublemaker', 'Villager', 'Villager', 'Villager', 'Drunk', 'Insomniac']
const makeToken = () => randomBytes(18).toString('hex')
const makeCode = () => randomBytes(3).toString('hex').toUpperCase()

async function roomPayload(code: string, token?: string) {
  const room = await db.select().from(werewolfRooms).where(eq(werewolfRooms.code, code)).limit(1)
  if (!room[0]) return null
  const players = await db.select({ id: werewolfPlayers.id, name: werewolfPlayers.name, seat: werewolfPlayers.seat, isHost: werewolfPlayers.isHost, role: werewolfPlayers.role, token: werewolfPlayers.token }).from(werewolfPlayers).where(eq(werewolfPlayers.roomId, room[0].id)).orderBy(asc(werewolfPlayers.seat))
  return { ...room[0], players: players.map(({ token: playerToken, ...player }) => ({ ...player, isMe: playerToken === token, role: playerToken === token ? player.role : null })) }
}

export async function POST(request: Request) {
  const body = await request.json()
  const name = String(body.name || '').trim().slice(0, 24)
  const action = body.action
  if (!name) return NextResponse.json({ error: 'Enter a display name.' }, { status: 400 })

  if (action === 'create') {
    const token = makeToken()
    let code = makeCode()
    while ((await db.select({ id: werewolfRooms.id }).from(werewolfRooms).where(eq(werewolfRooms.code, code)).limit(1)).length) code = makeCode()
    const roomId = randomUUID()
    await db.insert(werewolfRooms).values({ id: roomId, code, hostToken: token, centerRoles: roles.slice(0, 3) })
    await db.insert(werewolfPlayers).values({ id: randomUUID(), roomId, token, name, seat: 1, isHost: true })
    return NextResponse.json({ code, token })
  }

  const code = String(body.code || '').trim().toUpperCase()
  const room = await db.select().from(werewolfRooms).where(eq(werewolfRooms.code, code)).limit(1)
  if (!room[0]) return NextResponse.json({ error: 'That room code does not exist.' }, { status: 404 })
  const token = makeToken()
  const current = await db.select().from(werewolfPlayers).where(eq(werewolfPlayers.roomId, room[0].id))
  if (current.length >= room[0].maxPlayers) return NextResponse.json({ error: 'This lobby is full.' }, { status: 400 })
  await db.insert(werewolfPlayers).values({ id: randomUUID(), roomId: room[0].id, token, name, seat: current.length + 1 })
  return NextResponse.json({ code, token })
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')?.toUpperCase()
  const token = searchParams.get('token') || undefined
  if (!code) return NextResponse.json({ error: 'Missing room code.' }, { status: 400 })
  const payload = await roomPayload(code, token)
  if (!payload) return NextResponse.json({ error: 'Room not found.' }, { status: 404 })
  return NextResponse.json(payload)
}

export async function PATCH(request: Request) {
  const body = await request.json()
  const code = String(body.code || '').toUpperCase()
  const token = String(body.token || '')
  const room = await db.select().from(werewolfRooms).where(eq(werewolfRooms.code, code)).limit(1)
  const host = room[0] && await db.select().from(werewolfPlayers).where(and(eq(werewolfPlayers.roomId, room[0].id), eq(werewolfPlayers.token, token), eq(werewolfPlayers.isHost, true))).limit(1)
  if (!room[0] || !host?.[0]) return NextResponse.json({ error: 'Only the host can start the game.' }, { status: 403 })
  const players = await db.select().from(werewolfPlayers).where(eq(werewolfPlayers.roomId, room[0].id)).orderBy(asc(werewolfPlayers.seat))
  if (players.length < 3) return NextResponse.json({ error: 'You need at least 3 players.' }, { status: 400 })
  const deck = [...roles].sort(() => Math.random() - 0.5).slice(0, players.length + 3)
  for (let i = 0; i < players.length; i++) await db.update(werewolfPlayers).set({ role: deck[i] }).where(eq(werewolfPlayers.id, players[i].id))
  await db.update(werewolfRooms).set({ status: 'playing', phase: 'reveal', centerRoles: deck.slice(players.length), updatedAt: new Date() }).where(eq(werewolfRooms.id, room[0].id))
  return NextResponse.json({ ok: true })
}
