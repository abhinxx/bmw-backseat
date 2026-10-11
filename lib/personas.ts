// The 9 G60 personas in personas/*.json (evidence-backed, see each file's audit_trail).
// shortcut: static imports, fine for 9 files; read from Supabase once personas are loaded there.
import AM1 from "@/personas/AM-1.json"
import AM2 from "@/personas/AM-2.json"
import AM3 from "@/personas/AM-3.json"
import AS1 from "@/personas/AS-1.json"
import AS2 from "@/personas/AS-2.json"
import AS3 from "@/personas/AS-3.json"
import EU1 from "@/personas/EU-1.json"
import EU2 from "@/personas/EU-2.json"
import EU3 from "@/personas/EU-3.json"
import aAM1 from "@/personas/avatars/AM-1.svg"
import aAM2 from "@/personas/avatars/AM-2.svg"
import aAM3 from "@/personas/avatars/AM-3.svg"
import aAS1 from "@/personas/avatars/AS-1.svg"
import aAS2 from "@/personas/avatars/AS-2.svg"
import aAS3 from "@/personas/avatars/AS-3.svg"
import aEU1 from "@/personas/avatars/EU-1.svg"
import aEU2 from "@/personas/avatars/EU-2.svg"
import aEU3 from "@/personas/avatars/EU-3.svg"

const RAW = [
  [AM1, aAM1],
  [AM2, aAM2],
  [AM3, aAM3],
  [EU1, aEU1],
  [EU2, aEU2],
  [EU3, aEU3],
  [AS1, aAS1],
  [AS2, aAS2],
  [AS3, aAS3],
] as const

export type Persona = {
  id: string
  name: string
  label: string
  blurb: string // two-word descriptor (pitch deck); shown as the card subtitle
  basis: string
  region: string
  market: string
  tier: string
  tierNote: string
  light: EvidenceLight
  avatar: string
}

// Evidence traffic light (Ampel): the tier code translated to green/yellow/red.
// green  = A    own BMW feedback rows carry the persona, no external help needed
// yellow = A-/A/B real rows, but a thin cohort
// red    = B/C  no feedback rows; built from studies + named external sources
export type EvidenceLight = "green" | "yellow" | "red"
export const EVIDENCE_LIGHT: Record<EvidenceLight, { label: string; dot: string; meaning: string }> = {
  green: { label: "Strong evidence", dot: "bg-emerald-500", meaning: "Backed by BMW's own customer feedback rows." },
  yellow: { label: "Solid, smaller cohort", dot: "bg-amber-400", meaning: "Real feedback rows, but few of them — read with care." },
  red: { label: "Inferred", dot: "bg-red-500", meaning: "No feedback rows; built from studies and named external sources." },
}

// Two-word descriptors, as agreed in the pitch-deck session (AM-1/AM-2 are the revised labels).
// Card shows the person's name as title and this as the one-line characterisation.
const BLURBS: Record<string, string> = {
  "AM-1": "Tech frustrated",
  "AM-2": "Classic driver",
  "AM-3": "Comfort buyer",
  "EU-1": "Anxious pioneer",
  "EU-2": "Quiet majority",
  "EU-3": "Legacy driver",
  "AS-1": "Status buyer",
  "AS-2": "Cost calculator",
  "AS-3": "Waiting skeptic",
}

export const PERSONAS: Persona[] = RAW.map(([p, avatar]) => {
  const [label, basis = ""] = p.label.split(/ \((.*)\)$/)
  const tierNote = String(p.evidence_tier)
  return {
    id: p.persona_id,
    name: p.name,
    label,
    blurb: BLURBS[p.persona_id] ?? label,
    basis,
    region: p.region,
    market: String(p.market),
    tier: tierNote.match(/^[ABC][-+]?(\/[ABC])?/)?.[0] ?? "?",
    light: lightOf(tierNote),
    tierNote,
    avatar: avatar.src,
  }
})

// Ampel rule, matching the pitch-deck matrix: A = green, A- / A/B = yellow, B/C = red.
function lightOf(note: string): EvidenceLight {
  const code = note.match(/^[ABC][-+]?(\/[ABC])?/)?.[0] ?? ""
  if (code === "A") return "green"
  if (code === "A-" || code === "A+" || code === "A/B") return "yellow"
  return "red"
}

export const REGIONS = ["Americas", "Europe", "Asia"] as const
