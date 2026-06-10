import { z } from 'zod'

const isoInstant = z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'invalid ISO datetime')
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'invalid ISO date')
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'invalid color')
const id = z.string().min(1)

export const personCreateSchema = z.object({
  name: z.string().trim().min(1).max(60),
  color: hexColor,
  role: z.enum(['parent', 'child'])
})

export const personUpdateSchema = z.object({
  id,
  name: z.string().trim().min(1).max(60).optional(),
  color: hexColor.optional(),
  role: z.enum(['parent', 'child']).optional(),
  sortOrder: z.number().int().optional()
})

export const calendarCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  color: hexColor
})

export const calendarUpdateSchema = z.object({
  id,
  name: z.string().trim().min(1).max(80).optional(),
  color: hexColor.optional(),
  visible: z.boolean().optional()
})

export const recurrenceSchema = z.object({
  freq: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  interval: z.number().int().min(1).max(99).optional(),
  byWeekdays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  untilDate: isoDate.optional(),
  count: z.number().int().min(1).max(999).optional()
})

export const eventCreateSchema = z.object({
  calendarId: id,
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2000).nullish(),
  location: z.string().max(300).nullish(),
  start: isoInstant,
  end: isoInstant,
  tz: z.string().min(1),
  allDay: z.boolean(),
  personIds: z.array(id).max(20),
  recurrence: recurrenceSchema.nullish()
})

export const eventPatchSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  location: z.string().max(300).nullable().optional(),
  start: isoInstant.optional(),
  end: isoInstant.optional(),
  tz: z.string().min(1).optional(),
  allDay: z.boolean().optional(),
  personIds: z.array(id).max(20).optional(),
  recurrence: recurrenceSchema.nullable().optional()
})

export const eventUpdateSchema = z.object({
  id,
  scope: z.enum(['this', 'following', 'all']),
  occurrenceStart: isoInstant.optional(),
  changes: eventPatchSchema
})

export const eventDeleteSchema = z.object({
  id,
  scope: z.enum(['this', 'following', 'all']),
  occurrenceStart: isoInstant.optional()
})

export const occurrenceQuerySchema = z.object({
  start: isoInstant,
  end: isoInstant
})

export const settingsPatchSchema = z.object({
  patch: z
    .object({
      weekStartsOn: z.union([z.literal(0), z.literal(1)]).optional(),
      defaultView: z.enum(['day', 'week', 'month', 'agenda']).optional(),
      timeFormat: z.enum(['12h', '24h']).optional(),
      weather: z.object({ lat: z.number(), lon: z.number(), label: z.string() }).nullable().optional(),
      sleep: z.object({ enabled: z.boolean(), start: z.string(), end: z.string() }).optional(),
      screensaver: z.object({ folder: z.string().nullable(), idleMinutes: z.number().int().min(1).max(120) }).optional()
    })
    .strict()
})

export const idSchema = z.object({ id })
export const voidSchema = z.void().or(z.undefined()).or(z.null())
