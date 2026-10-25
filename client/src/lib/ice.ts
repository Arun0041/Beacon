/**
 * In Case of Emergency card — stored only on this device, attached to every
 * SOS broadcast so responders see blood type, allergies and next of kin even
 * when the victim cannot speak.
 */

export type ICE = {
  blood: string;
  allergies: string;
  conditions: string;
  contact: string;
  phone: string;
};

const KEY = "beacon.ice";

export const BLOOD_TYPES = ["—", "A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

export function getICE(): ICE {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { blood: "", allergies: "", conditions: "", contact: "", phone: "", ...JSON.parse(raw) };
  } catch {
    /* corrupt */
  }
  return { blood: "", allergies: "", conditions: "", contact: "", phone: "" };
}

export function saveICE(ice: ICE) {
  localStorage.setItem(KEY, JSON.stringify(ice));
}

export function iceSummary(ice?: ICE | null): string {
  if (!ice) return "";
  const parts = [
    ice.blood && ice.blood !== "—" ? `Blood ${ice.blood}` : "",
    ice.allergies ? `Allergies: ${ice.allergies}` : "",
    ice.conditions ? `${ice.conditions}` : "",
    ice.contact ? `Contact: ${ice.contact}${ice.phone ? ` · ${ice.phone}` : ""}` : "",
  ].filter(Boolean);
  return parts.join(" · ");
}
