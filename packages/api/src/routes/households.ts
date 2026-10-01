import { createRouter } from './router.js'
import { createRoute as defineRoute, z } from '@hono/zod-openapi'
import { HouseholdMemberSchema, HouseholdSchema } from '@recetario/shared'
import { accountRepository } from '../db/account-repository.js'
import { householdRepository } from '../db/household-repository.js'
import { authMiddleware } from '../middleware/auth.js'

export const householdsRoute = createRouter()

householdsRoute.use('*', authMiddleware)

const errorSchema = z.object({ error: z.string() })

const memberSchema = HouseholdMemberSchema

const householdSchema = HouseholdSchema

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
  return c.json(await householdRepository.create(ownerId, name), 201)
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
  return c.json(await householdRepository.listForUser(c.get('ownerId')), 200)
})

// POST /households/:id/invite
const inviteRoute = defineRoute({
  method: 'post',
  path: '/{id}/invite',
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
    409: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'Already a member',
    },
  },
})

householdsRoute.openapi(inviteRoute, async (c) => {
  const ownerId = c.get('ownerId')
  const { id } = c.req.valid('param')
  const { userId, email, role } = c.req.valid('json')

  const access = await householdRepository.canManage(id, ownerId)
  if (access === 'not_member') return c.json({ error: 'Household not found' }, 404)
  if (access === 'no') return c.json({ error: 'Forbidden' }, 403)

  let invitedUserId = userId
  if (!invitedUserId) {
    // The body schema's refine guarantees an email whenever userId is absent
    const user = await accountRepository.findUserByEmail(email!)
    if (!user) return c.json({ error: 'No user found with that email' }, 404)
    invitedUserId = user.id
  }

  const member = await householdRepository.invite(id, invitedUserId, role)
  if (!member) return c.json({ error: 'Already a member' }, 409)
  return c.json(member, 201)
})

// POST /households/:id/accept
const acceptRoute = defineRoute({
  method: 'post',
  path: '/{id}/accept',
  security: [{ ApiKeyAuth: [] }],
  request: { params: z.object({ id: z.uuid() }) },
  responses: {
    200: { content: { 'application/json': { schema: memberSchema } }, description: 'Accepted' },
    404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' },
  },
})

householdsRoute.openapi(acceptRoute, async (c) => {
  const ownerId = c.get('ownerId')
  const { id } = c.req.valid('param')
  const member = await householdRepository.accept(id, ownerId)
  if (!member) return c.json({ error: 'Invitation not found' }, 404)
  return c.json(member, 200)
})

// DELETE /households/:id/members/:userId
const removeMemberRoute = defineRoute({
  method: 'delete',
  path: '/{id}/members/{userId}',
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

  const access = await householdRepository.canManage(id, ownerId)
  if (access === 'not_member') return c.json({ error: 'Household not found' }, 404)
  if (access === 'no') return c.json({ error: 'Forbidden' }, 403)

  if (!(await householdRepository.removeMember(id, userId))) {
    return c.json({ error: 'Member not found' }, 404)
  }
  return c.body(null, 204)
})

// POST /households/:id/decline — the invitee turns down a pending invitation
const declineRoute = defineRoute({
  method: 'post',
  path: '/{id}/decline',
  security: [{ ApiKeyAuth: [] }],
  request: { params: z.object({ id: z.uuid() }) },
  responses: {
    204: { description: 'Declined' },
    404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' },
  },
})

householdsRoute.openapi(declineRoute, async (c) => {
  const ownerId = c.get('ownerId')
  const { id } = c.req.valid('param')
  if (!(await householdRepository.decline(id, ownerId))) {
    return c.json({ error: 'Invitation not found' }, 404)
  }
  return c.body(null, 204)
})

// PATCH /households/:id/members/:userId — owner/admin changes a member's role
const changeRoleRoute = defineRoute({
  method: 'patch',
  path: '/{id}/members/{userId}',
  security: [{ ApiKeyAuth: [] }],
  request: {
    params: z.object({ id: z.uuid(), userId: z.uuid() }),
    body: {
      content: {
        'application/json': {
          schema: z.object({ role: z.enum(['admin', 'member', 'viewer']) }),
        },
      },
      required: true,
    },
  },
  responses: {
    200: { content: { 'application/json': { schema: memberSchema } }, description: 'Updated' },
    403: { content: { 'application/json': { schema: errorSchema } }, description: 'Forbidden' },
    404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' },
  },
})

householdsRoute.openapi(changeRoleRoute, async (c) => {
  const ownerId = c.get('ownerId')
  const { id, userId } = c.req.valid('param')
  const { role } = c.req.valid('json')

  const access = await householdRepository.canManage(id, ownerId)
  if (access === 'not_member') return c.json({ error: 'Household not found' }, 404)
  if (access === 'no') return c.json({ error: 'Forbidden' }, 403)

  // The owner's role can't change: they are not matched, so it reads as 404
  const member = await householdRepository.changeRole(id, userId, role)
  if (!member) return c.json({ error: 'Member not found' }, 404)
  return c.json(member, 200)
})

// POST /households/:id/leave — a member leaves a household they joined
const leaveRoute = defineRoute({
  method: 'post',
  path: '/{id}/leave',
  security: [{ ApiKeyAuth: [] }],
  request: { params: z.object({ id: z.uuid() }) },
  responses: {
    204: { description: 'Left' },
    404: { content: { 'application/json': { schema: errorSchema } }, description: 'Not found' },
    409: {
      content: { 'application/json': { schema: errorSchema } },
      description: 'The owner cannot leave',
    },
  },
})

householdsRoute.openapi(leaveRoute, async (c) => {
  const ownerId = c.get('ownerId')
  const { id } = c.req.valid('param')
  const result = await householdRepository.leave(id, ownerId)
  if (result === 'not_member') return c.json({ error: 'Household not found' }, 404)
  if (result === 'owner') {
    return c.json({ error: 'The owner cannot leave the household' }, 409)
  }
  return c.body(null, 204)
})
