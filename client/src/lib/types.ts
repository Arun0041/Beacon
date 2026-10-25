export type Severity = "critical" | "high" | "medium" | "low";
export type SosStatus = "open" | "acknowledged" | "dispatched" | "rescued";
export type RequestKind = "emergency" | "help";
export type HazardKind = "flood" | "fire" | "rubble" | "other";
export type Channel = "general" | "rescue";

export type ICECard = {
  blood: string;
  allergies: string;
  conditions: string;
  contact: string;
  phone: string;
};

export type SosRecord = {
  id: string;
  kind: RequestKind;
  lat: number;
  lng: number;
  severity: Severity;
  tags: string[];
  note: string;
  origin: string;
  status: SosStatus;
  ts: number;
  ice?: ICECard | null;
};

export type HazardRecord = {
  id: string;
  kind: HazardKind;
  lat: number;
  lng: number;
  note: string;
  origin: string;
  ts: number;
};

export type ChatMessage = {
  id: string;
  ch: Channel;
  from: string;
  text: string;
  ts: number;
};

export type CheckinRecord = {
  deviceId: string;
  name: string;
  lat: number;
  lng: number;
  ts: number;
};

export type ShelterRecord = {
  id: string;
  name: string;
  capacity: number;
  lat: number;
  lng: number;
  contact: string;
};

export type PeerInfo = { id: string; name: string };

export const SEVERITIES: Severity[] = ["critical", "high", "medium", "low"];
export const SOS_TAGS = [
  "trapped",
  "injured",
  "medical",
  "water",
  "shelter",
  "fire",
  "elderly",
  "child",
];
export const HELP_CATEGORIES = [
  { id: "water", label: "Drinking water" },
  { id: "food", label: "Food" },
  { id: "shelter", label: "Shelter" },
  { id: "medical", label: "Medical supplies" },
  { id: "transport", label: "Transport" },
  { id: "other", label: "Other help" },
] as const;
export const STATUSES: SosStatus[] = ["open", "acknowledged", "dispatched", "rescued"];
