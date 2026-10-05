import { z } from 'zod'
import { DietaryTagSchema, NutritionTargetsSchema } from './schema.js'

// Response contracts for accounts, households, pantry and profile, shared by
// the API (OpenAPI responses), the MCP server and the app client so the three
// can't drift (2026-10-01 audit: these lived only inside API route files and
// were re-typed by hand in the app).

export const UserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable().optional(),
  createdAt: z.string(),
})
export type User = z.infer<typeof UserSchema>

export const HouseholdRoleSchema = z.enum(['owner', 'admin', 'member', 'viewer'])
export type HouseholdRole = z.infer<typeof HouseholdRoleSchema>

export const HouseholdMemberSchema = z.object({
  userId: z.uuid(),
  role: HouseholdRoleSchema,
  invitedAt: z.string(),
  /** null while the invitation is pending. */
  acceptedAt: z.string().nullable(),
  displayName: z.string().nullable().optional(),
  email: z.string().optional(),
})
export type HouseholdMember = z.infer<typeof HouseholdMemberSchema>

/**
 * Someone who eats at the household's table, with or without an account (a
 * kid, a grandparent): their allergens and diets warn every member.
 */
export const HouseholdDinerSchema = z.object({
  id: z.uuid(),
  householdId: z.uuid(),
  name: z.string(),
  allergens: z.array(z.string()),
  dietaryRestrictions: z.array(z.string()),
})
export type HouseholdDiner = z.infer<typeof HouseholdDinerSchema>

export const HouseholdDinerInputSchema = z.object({
  name: z.string().trim().min(1).max(60),
  allergens: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  dietaryRestrictions: z.array(DietaryTagSchema).max(10).default([]),
})
export type HouseholdDinerInput = z.input<typeof HouseholdDinerInputSchema>

export const HouseholdSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  ownerId: z.uuid(),
  createdAt: z.string(),
  members: z.array(HouseholdMemberSchema).optional(),
  diners: z.array(HouseholdDinerSchema).optional(),
})
export type Household = z.infer<typeof HouseholdSchema>

export const PantryItemSchema = z.object({
  id: z.uuid(),
  ownerId: z.string(),
  name: z.string(),
  quantity: z.string().nullable(),
  unit: z.string().nullable(),
  /** YYYY-MM-DD */
  expiryDate: z.string().nullable(),
  inStock: z.boolean(),
})
export type PantryItem = z.infer<typeof PantryItemSchema>

export const ProfileSchema = z.object({
  preferredServings: z.number().int().min(1).max(20).nullable(),
  dietaryRestrictions: z.array(z.string()),
  allergens: z.array(z.string()),
  goals: z.array(z.string()),
  timezone: z.string().nullable(),
  nutritionTargets: NutritionTargetsSchema.nullable(),
})
export type Profile = z.infer<typeof ProfileSchema>
