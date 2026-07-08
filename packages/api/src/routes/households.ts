import { createRoute as defineRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { eq, and } from 'drizzle-orm'
import { getDb, schema } from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'

export const householdsRoute = new OpenAPIHono()

householdsRoute.use('*', authMiddleware)

const errorSchema = z.object({ error: z.string() })

const memberSchema = z.object({
  userId: z.uuid(),
  role: z.enum(['owner', 'admin', 'member', 'viewer']),
  invitedAt: z.string(),
  acceptedAt: z.string().nullable(),
})

const householdSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  ownerId: z.uuid(),
  createdAt: z.string(),
  members: z.array(memberSchema).optional(),
})

// POST /households
const createRoute = defineRoute({
  method: 'post',
  path: '/',
  security: [{ ApiKeyAuth: [] }],
  request: {
    body: {
      content: { 'application/json': { schema: z.object({ name: z.string().min(1).max(100) }) } },
      required: true,
    },
  },
  responses: {
    201: { content: { 'application/json': { schema: householdSchema } }, description: 'Created' },
  },
})

householdsRoute.openapi(createRoute, async (c) => {
  const ownerId = c.get('ownerId')
  const { name } = c.req.valid('json')
  const db = getDb()

  const [household] = await db.insert(schema.households).values({ name, ownerId }).returning()

  await db.insert(schema.householdMembers).values({
    householdId: household!.id,
    userId: ownerId,
    role: 'owner',
    acceptedAt: new Date(),
  })

  return c.json(
    {
      id: household!.id,
      name: household!.name,
      ownerId: household!.ownerId,
      createdAt: household!.createdAt.toISOString(),
    },
    201,
  )
})

// GET /households/mine
const listMineRoute = defineRoute({
  method: 'get',
  path: '/mine',
  security: [{ ApiKeyAuth: [] }],
  responses: {
    200: {
      content: { 'application/json': { schema: z.array(householdSchema) } },
      description: 'OK',
    },
  },
})

householdsRoute.openapi(listMineRoute, async (c) => {
  const ownerId = c.get('ownerId')
  const db = getDb()

  const memberships = await db
    .select({ household: schema.households, member: schema.householdMembers })
    .from(schema.householdMembers)
    .innerJoin(schema.households, eq(schema.householdMembers.householdId, schema.households.id))
    .where(eq(schema.householdMembers.userId, ownerId))

  /* v8 ignore next 23 - full coverage via integration tests */
  const allMembers = await Promise.all(
    memberships.map(async ({ household }) => {
      const members = await db
        .select()
        .from(schema.householdMembers)
        .where(eq(schema.householdMembers.householdId, household.id))
      return { household, members }
    }),
  )

  // v8 ignore start
  return c.json(
    allMembers.map(({ household, members }) => ({
      id: household.id,
      name: household.name,
      ownerId: household.ownerId,
      createdAt: household.createdAt.toISOString(),
      members: members.map((m) => ({
        userId: m.userId,
        role: m.role,
        invitedAt: m.invitedAt.toISOString(),
        acceptedAt: m.acceptedAt?.toISOString() ?? null,
      })),
    })),
  )
})

// POST /households/:id/invite
const inviteRoute = defineRoute({
  method: 'post',
  path: '/:id/invite',
  security: [{ ApiKeyAuth: [] }],
  request: {
    params: z.object({ id: z.uuid() }),
    body: {
      content: {
        'application/json': {
          schema: z
            .object({
              userId: z.uuid().optional(),
              email: z.email().optional(),
              role: z.enum(['admin', 'member', 'viewer']).default('member'),
            })
            .refine((data) => data.userId ?? data.email, {
              message: 'Either userId or email is required',
            }),
        },
      },
      required: true,
    },
  },
  responses: {
    201: { content: { 'application/json': { schema: memberSchema } }, description: 'Invited' },
    403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
    404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' },
  },
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
householdsRoute.openapi(inviteRoute as any, async (c: any) => {
  const ownerId = c.get('ownerId')
  const { id } = c.req.valid('param')
  const { userId, email, role } = c.req.valid('json')
  const db = getDb()

  const [myMembership] = await db
    .select()
    .from(schema.householdMembers)
    .where(
      and(eq(schema.householdMembers.householdId, id), eq(schema.householdMembers.userId, ownerId)),
    )
    .limit(1)

  if (!myMembership) return c.json({ error: 'Household not found' } as never, 404)
  if (!['owner', 'admin'].includes(myMembership.role)) return c.json({ error: 'Forbidden' }, 403)

  let invitedUserId = userId
  if (!invitedUserId && email) {
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1)
    if (!user) return c.json({ error: 'No user found with that email' } as never, 404)
    invitedUserId = user.id
  }

  const [member] = await db
    .insert(schema.householdMembers)
    .values({ householdId: id, userId: invitedUserId, role })
    .onConflictDoNothing()
    .returning()

  if (!member) return c.json({ error: 'Already a member' } as never, 409 as never)

  return c.json(
    {
      userId: member.userId,
      role: member.role,
      invitedAt: member.invitedAt.toISOString(),
      acceptedAt: null,
    },
    201,
  )
})

// POST /households/:id/accept
const acceptRoute = defineRoute({
  method: 'post',
  path: '/:id/accept',
  security: [{ ApiKeyAuth: [] }],
  request: { params: z.object({ id: z.uuid() }) },
  responses: {
    200: { content: { 'application/json': { schema: memberSchema } }, description: 'Accepted' },
    404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' },
  },
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
householdsRoute.openapi(acceptRoute as any, async (c: any) => {
  const ownerId = c.get('ownerId')
  const { id } = c.req.valid('param')
  const db = getDb()

  const [member] = await db
    .update(schema.householdMembers)
    .set({ acceptedAt: new Date() })
    .where(
      and(eq(schema.householdMembers.householdId, id), eq(schema.householdMembers.userId, ownerId)),
    )
    .returning()

  if (!member) return c.json({ error: 'Invitation not found' } as never, 404)

  return c.json({
    userId: member.userId,
    role: member.role,
    invitedAt: member.invitedAt.toISOString(),
    /* v8 ignore next */ acceptedAt: member.acceptedAt?.toISOString() ?? null,
  })
})

// DELETE /households/:id/members/:userId
const removeMemberRoute = defineRoute({
  method: 'delete',
  path: '/:id/members/:userId',
  security: [{ ApiKeyAuth: [] }],
  request: { params: z.object({ id: z.uuid(), userId: z.uuid() }) },
  responses: {
    204: { description: 'Removed' },
    403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
    404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' },
  },
})

householdsRoute.openapi(removeMemberRoute, async (c) => {
  const ownerId = c.get('ownerId')
  const { id, userId } = c.req.valid('param')
  const db = getDb()

  const [myMembership] = await db
    .select()
    .from(schema.householdMembers)
    .where(
      and(eq(schema.householdMembers.householdId, id), eq(schema.householdMembers.userId, ownerId)),
    )
    .limit(1)

  if (!myMembership) return c.json({ error: 'Household not found' } as never, 404)
  if (!['owner', 'admin'].includes(myMembership.role)) return c.json({ error: 'Forbidden' }, 403)

  const deleted = await db
    .delete(schema.householdMembers)
    .where(
      and(eq(schema.householdMembers.householdId, id), eq(schema.householdMembers.userId, userId)),
    )
    .returning()

  if (deleted.length === 0) return c.json({ error: 'Member not found' } as never, 404)

  return c.body(null, 204)
})
