// Feature ↔ evidence map (PLAN §5.3). The glue that makes a what-if find its evidence the same way every time.
// For each feature: the BMW feedback taxonomy classes (feedback_label.level2), a text pattern for comments the
// taxonomy missed, the customer-study attributes that measure it, and the G60 price-list option codes that sell it.
// Hand-curated from the actual taxonomy (222 G60 level2 classes), the US_2025 / CN_EU_2025 study attributes and
// the July 2026 German G60 price list. Version this file; every simulation stores FEATURE_MAP_VERSION.

export const FEATURE_MAP_VERSION = "2026-10-11.1"

export type Feature = {
  id: string
  name: string
  description: string
  level2: string[]
  pattern: string | null // Postgres case-insensitive regex on the comment text
  studyUS: string[] // US_2025 attributes (metric top2box)
  studyCNEU: string[] // CN_EU_2025 attributes (metric mean)
  options: string[] // G60 option codes
}

export const FEATURES: Feature[] = [
  {
    id: "rear_comfort",
    name: "Rear-seat heating and rear comfort",
    description: "Heated rear seats, rear climate zones, comfort and space for rear passengers.",
    level2: ["Seating, ventilate / heat", "Space / spatial impression"],
    pattern: "(rear|back|2nd|second)[ -]?(seat|row|passenger)|heated rear|kids in the back",
    studyUS: ["Comfort of 2nd row seat", "2nd row seat roominess", "Ease of 2nd row seat entry", "Heater performance"],
    studyCNEU: ["Rear interior roominess", "Overall seating comfort", "Heating/ ventilation/ air conditioning "],
    options: ["7VB"],
  },
  {
    id: "controls",
    name: "iDrive, touchscreen and controls",
    description: "Operating concept, touchscreen, menus, physical buttons, climate controls in the screen.",
    level2: [
      "Touch screen, operation",
      "Operating concept, operating system",
      "ConnectedDrive and Infotainment, overall technology",
      "Air conditioning control panel",
      "Instrument cluster",
      "Center console, front",
      "Gesture control",
    ],
    pattern: "idrive|touch ?screen|touch screen|menu|physical button|knob|too many screens|controller",
    studyUS: [
      "Intuitiveness of controls",
      "Ease of reading and using screen interface",
      "Menu structure of infotainment system",
      "Operation of heater/ AC controls",
      "Placement/ ease of reading and using controls",
      "Overall driver-vehicle interaction (HMI)",
    ],
    studyCNEU: [
      "Easy to read and use instruments/ controls/ displays",
      "Easy to use information and entertainment system including in-car apps",
    ],
    options: ["7EW"],
  },
  {
    id: "ev_range_charging",
    name: "Electric range and charging",
    description: "Real-world range, public and home charging, charging speed, recuperation.",
    level2: [
      "Electric Range",
      "Public charging / external providers",
      "Charge high-voltage battery",
      "Wallbox, charging / home charging",
      "High voltage battery",
      "Opening/closing charging socket cover",
      "Brake Energy Regeneration / recuperation",
    ],
    pattern: "\\mrange\\M|charging|charger|kwh|supercharg",
    studyUS: ["Gas or electric mileage (fuel economy)"],
    studyCNEU: ["Fuel economy/ energy efficiency"],
    options: [],
  },
  {
    id: "driving_dynamics",
    name: "Driving dynamics and ride",
    description: "Handling, ride comfort, steering, acceleration, drive modes.",
    level2: [
      "Handling / Riding",
      "Drive, driving dynamics and chassis, overall technology",
      "Drivetrain",
      "Steering",
      "Cushioning / damping vehicle",
      "My Modes / driving experience",
    ],
    pattern: "handling|ride quality|acceleration|steering|suspension",
    studyUS: ["Handling/Maneuverability", "Riding comfort", "Overall driving performance", "Overall power and pickup"],
    studyCNEU: ["Quality of ride", "Roadholding", "Acceleration", "Sportiness"],
    options: ["2VV"],
  },
  {
    id: "driver_assist",
    name: "Driver assistance and automated driving",
    description: "Highway assistant, adaptive cruise, lane keeping, parking assistant, cameras.",
    level2: [
      "Highway assistant",
      "(Active) cruise control",
      "Driver assistance, automated driving, overall technology",
      "Lane departure warning",
      "Parking Assistant",
      "Surround View",
      "Rear view camera",
    ],
    pattern: "cruise control|lane keep|hands[- ]free|self[- ]driving|parking assist|highway assist",
    studyUS: [
      "Adaptive driving assists (lane keeping, cruise, braking)",
      "Overall driver assist features",
      "Safety monitoring features (blid spot warning, lane departure warning, etc)",
    ],
    studyCNEU: ["Safety"],
    options: ["5AT", "5AU", "5AX", "5DW"],
  },
  {
    id: "smartphone_app",
    name: "Smartphone, app and digital key",
    description: "Apple CarPlay, My BMW App, digital key, phone pairing and charging.",
    level2: [
      "Apple CarPlay",
      "My BMW App / MINI App",
      "Digital Key",
      "Mobile device, wireless charging",
      "Manage / pair mobile device (Bluetooth)",
      "Vehicle key",
      "Comfort Access",
    ],
    pattern: "carplay|android auto|bmw app|digital key|phone",
    studyUS: ["Mirroring of smartphone content on vehicle display", "Bluetooth/ smartphone pairing", "Vehicle's Mobile App", "Phone charging"],
    studyCNEU: ["Smartphone integration/ connectivity", "Connected services"],
    options: [],
  },
  {
    id: "voice_assistant",
    name: "Voice assistant",
    description: "BMW Intelligent Personal Assistant, speech recognition.",
    level2: ["Intelligent Personal Assistant", "Voice control / speech recognition"],
    pattern: "voice|hey bmw|speech",
    studyUS: ["Performance of voice recognition"],
    studyCNEU: [],
    options: [],
  },
  {
    id: "exterior_design",
    name: "Exterior design",
    description: "Styling, proportions, lighting signature, wheels.",
    level2: ["Exterior design", "Exterior", "Exterior lighting", "Wheels / tires"],
    pattern: "styling|looks|grille|design",
    studyUS: ["Overall exterior styling", "Headlight/ taillight design", "Appearance of tires/ wheels", "Size/ proportions"],
    studyCNEU: ["Exterior styling"],
    options: [],
  },
  {
    id: "interior_quality",
    name: "Interior design and materials",
    description: "Interior design, materials, ambient light, workmanship.",
    level2: ["Interior design", "Ambient light", "Instrument panel", "Interior", "Vehicle interior, lighting", "Door, finisher panel, front"],
    pattern: "interior|materials|cheap plastic|ambient",
    studyUS: ["Overall interior design / layout", "Quality of interior materials", "Interior trim and finish", "Overall interior styling/ aesthetics"],
    studyCNEU: ["Interior styling", "Quality of interior and materials used"],
    options: [],
  },
  {
    id: "front_seats",
    name: "Front seats and seat comfort",
    description: "Front seat comfort, ventilation, massage, memory, heated steering wheel.",
    level2: ["Seats", "Seat massage", "Seat memory", "Heated steering wheel"],
    pattern: "seat (comfort|massage|ventilat)|lumbar|heated steering",
    studyUS: ["Comfort of front seat", "Overall comfort of the seats", "Driver seat adjustability"],
    studyCNEU: ["Overall seating comfort", "Driving position"],
    options: ["456", "248"],
  },
  {
    id: "climate",
    name: "Climate control",
    description: "Heating, air conditioning, climate operation, auxiliary heating.",
    level2: ["Vehicle, climatization", "Air conditioning, setting", "Air conditioning control panel", "Blower function"],
    pattern: "climate|air condition|\\mac\\M|heater|defrost",
    studyUS: ["Overall performance of climate control system", "Heater performance", "Air conditioner performance", "Operation of heater/ AC controls"],
    studyCNEU: ["Heating/ ventilation/ air conditioning "],
    options: ["7VB", "536"],
  },
  {
    id: "space_practicality",
    name: "Space and practicality",
    description: "Interior space, trunk, storage, cupholders, trunk opening.",
    level2: ["Luggage compartment", "Storage compartments", "Cupholder", "Trunk lid, open / close", "non-contact trunk lid opening"],
    pattern: "trunk|storage|cupholder|cargo",
    studyUS: ["Interior roominess", "Cargo capacity/usefulness", "Interior storage", "Cupholders"],
    studyCNEU: ["Luggage capacity", "Interior storage for small items", "Interior versatility"],
    options: [],
  },
  {
    id: "audio",
    name: "Audio and sound",
    description: "Sound system, radio, cabin acoustics.",
    level2: ["Audio mode, sound", "Radio function", "Interior acoustics"],
    pattern: "sound system|speaker|bowers|harman|audio",
    studyUS: ["Overall performance of sound system", "Audio clarity", "Bass performance"],
    studyCNEU: ["Quietness when driving"],
    options: ["6F4"],
  },
  {
    id: "head_up_display",
    name: "Head-up display and displays",
    description: "Head-up display, instrument cluster, display integration.",
    level2: ["Head-Up Display", "Instrument cluster"],
    pattern: "head[- ]?up|hud",
    studyUS: ["Head-up Display", "Position/ integration of displays in dashboard"],
    studyCNEU: [],
    options: ["7EW"],
  },
  {
    id: "price_value",
    name: "Price and standard equipment",
    description: "Price, value for money, what comes as standard vs. paid options.",
    level2: [],
    pattern: "price|expensive|value for money|overpriced|\\$[0-9]|cost|standard equipment|option package",
    studyUS: ["Overall value for money", "Affordable to buy", "Level of standard equipment", "Price/deal offered"],
    studyCNEU: ["Value for money", "Level of equipment"],
    options: [],
  },
  {
    id: "reliability",
    name: "Reliability and software quality",
    description: "Defects, electrical problems, software bugs, rattles.",
    level2: ["Remote Software Upgrade/RSU", "Vehicle battery"],
    pattern: "bug|glitch|reboot|defect|broke|recall|dealer|warranty|rattle",
    studyUS: ["Freedom from electrical problems", "Overall impression of durability/reliability", "Freedom from squeaks and rattles"],
    studyCNEU: ["Reliability", "Freedom from faults/ squeaks/ rattles", "Overall build quality"],
    options: [],
  },
]

export const featureOf = (id: string) => FEATURES.find((f) => f.id === id)
