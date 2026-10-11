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
  basis: string
  region: string
  market: string
  tier: string
  tierNote: string
  avatar: string
}

export const PERSONAS: Persona[] = RAW.map(([p, avatar]) => {
  const [label, basis = ""] = p.label.split(/ \((.*)\)$/)
  const tierNote = String(p.evidence_tier)
  return {
    id: p.persona_id,
    name: p.name,
    label,
    basis,
    region: p.region,
    market: String(p.market),
    tier: tierNote.match(/^[ABC][-+]?(\/[ABC])?/)?.[0] ?? "?",
    tierNote,
    avatar: avatar.src,
  }
})

export const REGIONS = ["Americas", "Europe", "Asia"] as const
