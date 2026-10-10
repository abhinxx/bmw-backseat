#!/usr/bin/env python3
"""F: generic option extraction for F70/G60/G70 price-list PDFs.
Matrix pages: rows grouped by top (+-2.5pt); name = upright words left of first
option column; variant columns recovered from rotated header words (reversed).
Package pages: regex on 'SA-Nr. ... price [net]' lines. Writes F_options.csv."""
import csv, os, re, sys, json
import pdfplumber

ROOT = "/Users/abhinavsingh/Documents/codes/ehl-hackathon"
OUT = f"{ROOT}/research/data"
MODELS = ["F70", "G60", "G70"]
MARK2AV = {"\u25a0": "standard", "\u25a1": "optional", "\u2013": "optional_no_charge"}
PRICE_RE = re.compile(r"^\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?(?:,–|,\d{1,2}|–)$")
CODE_RE = re.compile(r"^(?:[0-9A-Z]{3}|[0-9]{3}[A-Z]?)$")
CAT_RULES = [
    ("packages", r"PAKET|EXECUTIVE|INNOVATION|TECHNIK|ADVANTAGE|AUSSTATTUNGSPAKETE"),
    ("exterior colour", r"FARBWELT EXTERIEUR|LACKIERUNG|LACKIERUNG|FERNBEDIENUNG|AUSSENFARB|UNI\b|METALLIC|Individual"),
    ("wheels", r"RÄDER|REIFEN|LEICHTMETALL|Felge|Bereifung|Runflat"),
    ("seats/climate", r"SITZ|Sitz|Polster|Klimaanlage|Klima|Sitzheizung|Sitzbelüftung|Massage|Lendenwirbel|Durchstieg| Fond"),
    ("digital/infotainment", r"DISPLAY|Display|iDrive|CARPLAY|CarPlay|ANDROID|Apple|Head.?Up|HEAD.?UP|Navigation|LIVE COCKPIT|ConnectedDrive|SIM|eSIM|HOTSPOT|Hotspot|Sprachassistent|Entertainment|Theatre|Bildsch|My BMW|DAB|Radio|HiFi|HIFI|SOUND|Sound|TV|Instrument"),
    ("driver assistance", r"ASSISTENT|Assistent|ASSISTENZ|Driving|PARKING|Parking|Einparkhilfe|RÜCKFAHR|Rückfahr|Notruf|Warndreieck|Reifendruck|Verkehrsschild|Fernlicht|Nachtsicht|DrivingAssistant"),
    ("lighting", r"LEUCHTEN|Leuchten|LICHT|Licht|Laser|Scheinwerfer|Ambiente"),
    ("interior trim", r"INTERIEUR|Interieur|Dekor|LEISTEN|Holz|Leiste|HIMMEL|Dachhimmel|TRIM"),
    ("comfort", r"KOMFORT|Komfort|TÜREN|Türen|SCHLIESS|Schließ|Access|KEYLESS|Keyless|AUTOMATIK|Standheizung|STANDHEIZUNG|LUFTRAUM|Panorama|GLASDACH|Glasdach|VERGLASUNG|Anhängerkupplung|ANHÄNGER|Wärmedämm|Akustik|Lenkrad|Beheizbar|Armlehne|Ablage|Fond"),
    ("other", r"."),
]
def categorize(name, section):
    s = (name + " " + (section or ""))
    for cat, rx in CAT_RULES:
        if re.search(rx, s): return cat
    return "other"

def rows_of(page):
    ws = [w for w in page.extract_words() if w["text"].strip()]
    ws.sort(key=lambda w: (round(w["top"], 1), w["x0"]))
    out = []
    for w in ws:
        if out and abs(w["top"] - out[-1][-1]["top"]) <= 2.5:
            out[-1].append(w)
        else:
            out.append([w])
    return out

def parse_matrix_page(page, model, pageno):
    """returns (options, notes). options: dict per line-block."""
    wr = rows_of(page)
    marks = [w for w in sum(wr, []) if w["text"] in MARK2AV and (w["x0"] + w["x1"]) / 2 > 200]
    if not marks: return [], "no-mark-columns"
    # column x-centers
    cx = sorted({round((w["x0"] + w["x1"]) / 2) for w in marks})
    merged = []
    for c in cx:
        if merged and c - merged[-1] < 12: continue
        merged.append(c)
    cols = merged
    # section title
    section = next((r[0]["text"] for r in wr if r and r[0]["x0"] < 60 and r[0]["top"] < 60 and r[0]["upright"]), "")
    # variant headers: rotated words grouped by x-cluster
    rot = [w for w in sum(wr, []) if not w["upright"]]
    # find rotated cluster whose words look like the EUR header fragment -> price col
    variants = {}
    clus = {}
    for w in rot:
        c = round((w["x0"] + w["x1"]) / 2)
        k = min(cols, key=lambda x: abs(x - c)) if cols else c
        clus.setdefault(k, []).append(w)
    for k, wsx in clus.items():
        wsx.sort(key=lambda w: w["top"])
        name = "".join(reversed(w["text"]) for w in wsx)
        if "EUR" in name or " MwSt" in name or "SANr" in name.replace(".", "").replace(" ", "") or name.replace(" ", "").startswith("91%"):
            continue  # price-header text
        variants[k] = name.strip()
    first_col = min(cols) if cols else 300
    opts = []
    cur = None
    def flush():
        nonlocal cur
        if cur and cur.get("name"):
            opts.append(cur)
        cur = None
    body = [r for r in wr if r and r[0]["top"] > 110]
    for r in body:
        up = [w for w in r if w["upright"]]
        if not up: continue
        name_w = [w for w in up if w["x1"] < first_col - 8]
        mark_w = [w for w in up if w["text"] in MARK2AV and (w["x0"] + w["x1"]) / 2 > 200]
        code_w = [w for w in up if CODE_RE.match(w["text"]) and w["x0"] >= first_col - 60 and w["x0"] < (max([m["x0"] for m in mark_w], default=first_col))]
        price_w = [w for w in up if PRICE_RE.match(w["text"]) and w["x0"] > first_col - 20 and (w["x0"] + w["x1"]) / 2 not in [c for c in cols if False]]
        if mark_w:
            flush()
            codes = " ".join(w["text"] for w in code_w)
            price = None
            for w in sorted(price_w, key=lambda w: w["x0"]):
                t = w["text"].replace("–", "0")
                try:
                    price = float(t.replace(".", "").replace(",", "."))
                except ValueError:
                    continue
                break
            marks = {}
            for m in mark_w:
                c = min(cols, key=lambda x: abs(x - (m["x0"] + m["x1"]) / 2))
                marks[variants.get(c, f"col{c}")] = MARK2AV[m["text"]]
            cur = {"name": " ".join(w["text"] for w in name_w).strip(),
                   "code": codes or None, "price": price, "marks": marks,
                   "section": section, "page": pageno}
        elif price_w and not name_w and cur is None:
            continue
        elif (price_w or code_w) and cur is None and not name_w:
            continue
        elif cur is not None and not price_w:
            extra = " ".join(w["text"] for w in up)
            if re.match(r"^[A-ZÄÖÜ/ ]{4,}$", extra) and len(up) <= 3 and not mark_w and not code_w:
                flush(); section_new = extra; 
                cur = None
                opts.append  # section headings just break rows
            else:
                cur["name"] += " " + extra
                cur["source_extra"] = cur.get("source_extra", "") + " | " + extra
        elif cur is not None:
            flush()
    flush()
    # remove empty
    opts = [o for o in opts if o["name"]]
    return opts, f"cols={cols} variants={variants}"

def parse_package_page(page, model, pageno):
    txt = page.extract_text() or ""
    section = txt.splitlines()[0] if txt else ""
    if "SA-Nr" not in txt: return []
    rows = []
    lines = txt.splitlines()
    for i, ln in enumerate(lines):
        m = re.search(r"\s([0-9][0-9A-Z]{2}|[0-9A-Z]{3})\s+(\d{1,3}(?:\.\d{3})*(?:,\d{2})?)\s*\[", ln)
        m2 = re.search(r"\s([0-9][0-9A-Z]{2}|[0-9A-Z]{3})\s*$", ln)
        if m:
            name = ln[:m.start()].strip()
            if not name:
                name = lines[i - 1].strip() if i else ""
            rows.append({"name": name, "code": m.group(1), "price": float(m.group(2).replace(".", "").replace(",", ".")),
                         "marks": {}, "section": section, "page": pageno})
        elif m2 and not PRICE_RE.match(ln.split()[-1] if ln.split() else ""):
            name = ln[:m2.start()].strip()
            if name and len(name) > 3:
                rows.append({"name": name, "code": m2.group(1), "price": None,
                             "marks": {}, "section": section, "page": pageno})
    return rows

EN = {
    "Sitzheizung": "Seat heating", "Sitzbelüftung": "Seat ventilation", "Massage": "Massage",
    "Lenkradheizung": "Heated steering wheel", "Head-Up Display": "Head-up display",
    "Panorama": "Panorama", "harman/kardon": "Harman Kardon", "Bowers & Wilkins": "Bowers & Wilkins",
    "Driving Assistant": "Driving Assistant", "Parking Assistant": "Parking Assistant",
    "M Sportpaket": "M Sport package", "Apple CarPlay": "Apple CarPlay", "Android": "Android",
}
def tr(name):
    for de, en in EN.items():
        if de.lower() in name.lower():
            return en
    return ""

def main():
    all_rows = []
    notes = {}
    for model in MODELS:
        pdf = pdfplumber.open(f"{ROOT}/BMW-Data/{model}_OptionList.PDF")
        for i, page in enumerate(pdf.pages, 1):
            if i <= 3 or i >= len(pdf.pages) - 2: continue
            txt = page.extract_text() or ""
            if re.match(r"TECHNISCHE WERTE", txt.strip().splitlines()[0] if txt.strip() else ""): continue
            if "FAHRZEUGPREISE" in txt: continue
            m_opts, note = parse_matrix_page(page, model, i)
            p_opts = [] if m_opts else parse_package_page(page, model, i)
            notes[f"{model} p{i}"] = note if m_opts else ("package-rows" if p_opts else "no parse")
            for o in m_opts + p_opts:
                av = o["marks"]
                rowsrc = o["name"] + (" | " + o.get("source_extra", "") if o.get("source_extra") else "") + \
                    (" | " + " ".join(o["code"] or "") if o["code"] else "")
                if av:
                    for var, a in av.items():
                        all_rows.append([model, o["page"], o["code"], o["name"], tr(o["name"]),
                                         categorize(o["name"], o["section"]), a, var,
                                         o["price"], rowsrc[:400]])
                else:
                    all_rows.append([model, o["page"], o["code"], o["name"], tr(o["name"]),
                                     categorize(o["name"], o["section"]),
                                     "package-content" if "PAKET" in o["section"].upper() or "enthalten" in o["section"].lower() else "optional",
                                     "", o["price"], rowsrc[:400]])
    with open(f"{OUT}/F_options.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["model", "page", "option_code", "name_de", "name_en", "category",
                    "availability", "variant", "price_eur", "source_text"])
        w.writerows(all_rows)
    json.dump(notes, open(f"{OUT}/F_parse_notes.json", "w"), indent=1)
    print("rows:", len(all_rows))
    from collections import Counter
    print(Counter(r[0] for r in all_rows))

if __name__ == "__main__":
    main()
