import { NextResponse } from 'next/server'
import { randomBytes, randomUUID } from 'crypto'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { werewolfPlayers, werewolfRooms } from '@/lib/db/schema'

const roles = ['Werewolf', 'Seer', 'Robber', 'Troublemaker', 'Villager', 'Villager', 'Villager', 'Drunk', 'Insomniac']
const makeToken = () => randomBytes(18).toString('hex')
const makeCode = () => randomBytes(3).toString('hex').toUpperCase()

async function getRoom(code: string) { return (await db.select().from(werewolfRooms).where(eq(werewolfRooms.code, code)).limit(1))[0] }
async function getPlayer(roomId: string, token: string) { return (await db.select().from(werewolfPlayers).where(and(eq(werewolfPlayers.roomId, roomId), eq(werewolfPlayers.token, token))).limit(1))[0] }
async function roomPayload(code: string, token?: string) {
  const room = await getRoom(code); if (!room) return null
  const players = await db.select({ id: werewolfPlayers.id, name: werewolfPlayers.name, seat: werewolfPlayers.seat, isHost: werewolfPlayers.isHost, role: werewolfPlayers.role, voteFor: werewolfPlayers.voteFor, nightAction: werewolfPlayers.nightAction, token: werewolfPlayers.token }).from(werewolfPlayers).where(eq(werewolfPlayers.roomId, room.id)).orderBy(asc(werewolfPlayers.seat))
  return { ...room, players: players.map(({ token: playerToken, nightAction, voteFor, ...player }) => ({ ...player, isMe: playerToken === token, role: playerToken === token ? player.role : null, hasActed: Boolean(nightAction), hasVoted: Boolean(voteFor) })) }
}
export async function POST(request: Request) {
  const body = await request.json(); const name = String(body.name || '').trim().slice(0, 24); if (!name) return NextResponse.json({ error: 'Enter a display name.' }, { status: 400 })
  if (body.action === 'create') { const token = makeToken(); let code = makeCode(); while (await getRoom(code)) code = makeCode(); const roomId = randomUUID(); await db.insert(werewolfRooms).values({ id: roomId, code, hostToken: token, centerRoles: roles.slice(0, 3) }); await db.insert(werewolfPlayers).values({ id: randomUUID(), roomId, token, name, seat: 1, isHost: true }); return NextResponse.json({ code, token }) }
  const code = String(body.code || '').trim().toUpperCase(); const room = await getRoom(code); if (!room) return NextResponse.json({ error: 'That room code does not exist.' }, { status: 404 }); const current = await db.select().from(werewolfPlayers).where(eq(werewolfPlayers.roomId, room.id)); if (current.length >= room.maxPlayers) return NextResponse.json({ error: 'This lobby is full.' }, { status: 400 }); const token = makeToken(); await db.insert(werewolfPlayers).values({ id: randomUUID(), roomId: room.id, token, name, seat: current.length + 1 }); return NextResponse.json({ code, token })
}
export async function GET(request: Request) { const { searchParams } = new URL(request.url); const code = searchParams.get('code')?.toUpperCase(); const token = searchParams.get('token') || undefined; if (!code) return NextResponse.json({ error: 'Missing room code.' }, { status: 400 }); const payload = await roomPayload(code, token); return payload ? NextResponse.json(payload) : NextResponse.json({ error: 'Room not found.' }, { status: 404 }) }
export async function PATCH(request: Request) {
  const body = await request.json(); const code = String(body.code || '').toUpperCase(); const token = String(body.token || ''); const room = await getRoom(code); if (!room) return NextResponse.json({ error: 'Room not found.' }, { status: 404 }); const player = await getPlayer(room.id, token); if (!player) return NextResponse.json({ error: 'Player not found.' }, { status: 403 })
  if (!body.action || body.action === 'start') { if (!player.isHost) return NextResponse.json({ error: 'Only the host can start the game.' }, { status: 403 }); const players = await db.select().from(werewolfPlayers).where(eq(werewolfPlayers.roomId, room.id)).orderBy(asc(werewolfPlayers.seat)); if (players.length < 3) return NextResponse.json({ error: 'You need at least 3 players.' }, { status: 400 }); const deck = [...roles].sort(() => Math.random() - 0.5).slice(0, players.length + 3); for (let i = 0; i < players.length; i++) await db.update(werewolfPlayers).set({ role: deck[i], nightAction: null, voteFor: null }).where(eq(werewolfPlayers.id, players[i].id)); await db.update(werewolfRooms).set({ status: 'playing', phase: 'reveal', centerRoles: deck.slice(players.length), updatedAt: new Date() }).where(eq(werewolfRooms.id, room.id)); return NextResponse.json({ ok: true }) }
  if (body.action === 'advance') { if (!player.isHost) return NextResponse.json({ error: 'Only the host can advance the phase.' }, { status: 403 }); const next = room.phase === 'reveal' ? 'night' : room.phase === 'night' ? 'discussion' : room.phase === 'discussion' ? 'vote' : 'results'; await db.update(werewolfRooms).set({ phase: next, updatedAt: new Date() }).where(eq(werewolfRooms.id, room.id)); return NextResponse.json({ ok: true }) }
  if (body.action === 'night') { if (room.phase !== 'night') return NextResponse.json({ error: 'Night actions are closed.' }, { status: 400 }); await db.update(werewolfPlayers).set({ nightAction: body.target ? { type: player.role, target: String(body.target) } : { type: player.role, target: 'pass' } }).where(eq(werewolfPlayers.id, player.id)); return NextResponse.json({ ok: true }) }
  if (body.action === 'vote') { if (room.phase !== 'vote') return NextResponse.json({ error: 'Voting is closed.' }, { status: 400 }); await db.update(werewolfPlayers).set({ voteFor: String(body.target) }).where(eq(werewolfPlayers.id, player.id)); return NextResponse.json({ ok: true }) }
  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
}
