import { z } from "zod";

export const SeveritySchema = z.enum(["critical", "high", "medium", "low"]);
export const SosStatusSchema = z.enum(["open", "acknowledged", "dispatched", "rescued"]);
export const RequestKindSchema = z.enum(["emergency", "help"]);
export const HazardKindSchema = z.enum(["flood", "fire", "rubble", "other"]);
export const ChannelSchema = z.enum(["general", "rescue"]);

export const IceCardSchema = z.object({
  blood: z.string().default("—"),
  allergies: z.string().default(""),
  conditions: z.string().default(""),
  contact: z.string().default(""),
  phone: z.string().default(""),
});

export const SosRecordSchema = z.object({
  id: z.string(),
  kind: RequestKindSchema,
  lat: z.number(),
  lng: z.number(),
  severity: SeveritySchema,
  tags: z.array(z.string()),
  note: z.string().default(""),
  origin: z.string(),
  status: SosStatusSchema,
  ts: z.number(),
  ice: IceCardSchema.nullable().optional(),
});

export const HazardRecordSchema = z.object({
  id: z.string(),
  kind: HazardKindSchema,
  lat: z.number(),
  lng: z.number(),
  note: z.string().default(""),
  origin: z.string(),
  ts: z.number(),
});

export const CheckinRecordSchema = z.object({
  deviceId: z.string(),
  name: z.string(),
  lat: z.number(),
  lng: z.number(),
  ts: z.number(),
});

export const ShelterRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  capacity: z.number().int().nonnegative(),
  lat: z.number(),
  lng: z.number(),
  contact: z.string().default(""),
});

export const ChatMessageSchema = z.object({
  id: z.string(),
  ch: ChannelSchema,
  from: z.string(),
  text: z.string(),
  ts: z.number(),
});

export const PeerInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export type Severity = z.infer<typeof SeveritySchema>;
export type SosStatus = z.infer<typeof SosStatusSchema>;
export type RequestKind = z.infer<typeof RequestKindSchema>;
export type HazardKind = z.infer<typeof HazardKindSchema>;
export type Channel = z.infer<typeof ChannelSchema>;
export type IceCard = z.infer<typeof IceCardSchema>;
export type SosRecord = z.infer<typeof SosRecordSchema>;
export type HazardRecord = z.infer<typeof HazardRecordSchema>;
export type CheckinRecord = z.infer<typeof CheckinRecordSchema>;
export type ShelterRecord = z.infer<typeof ShelterRecordSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type PeerInfo = z.infer<typeof PeerInfoSchema>;

export function canonicalJson(value: unknown): string {
  const normalized = typeof value === "object" && value !== null ? sortObject(value) : value;
  return JSON.stringify(normalized);
}

function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortObject);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, sortObject(item)]),
    );
  }
  return value;
}

export function makeHlc(timestamp = Date.now()): string {
  const now = new Date(timestamp);
  return `${now.toISOString()}Z`;
}
