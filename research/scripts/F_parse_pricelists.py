#!/usr/bin/env python3
"""F: parse the three BMW Germany price lists (JULI 2026) into structured tables.

Layout (verified visually on G60 p6/p15/p18):
  - Grid pages: rotated column headers = 'SA-Nr.' (option code), 'EUR inkl. 19% MwSt. [EUR ohne MwSt.]'
    (price, gross with net in brackets), then one column per engine variant.
    Marks: '■' standard, '□' optional, blank = not offered (on standard-equipment pages blank = not standard).
  - Standard-equipment grid pages ('AUSGEWÄHLTE SERIENAUSSTATTUNGEN') have variant columns but no code/price.
  - Item = a row with a code and/or marks. Rows starting 'In Verbindung mit ...' that carry a price/marks are a
    conditional price of the item above. 'Nur/Nicht in Verbindung mit ...' rows are constraints. Colour blocks list
    several name+code rows sharing one price/marks row.
  - Price pages ('FAHRZEUGPREISE.'): variants with power and base price.
Rotated header text is read char-by-char bottom-to-top (pdfplumber words come out reversed).

Run:  .venv/bin/python research/scripts/F_parse_pricelists.py
Out:  research/data/F_options.csv   one row per (item, variant) with availability
      research/data/F_items.json    one record per item with marks per variant, constraints, description
      research/data/F_variants.json variants with fuel type, power, base price
      research/data/F_parse_log.json per-page parse result (page type, item count, problems)
"""
import collections
import csv
import json
import os
import re

import pdfplumber

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "research", "data")
MODELS = {"F70": "BMW 1 Series", "G60": "BMW 5 Series Limousine", "G70": "BMW 7 Series Limousine"}
MARKS = {"\u25a0": "standard", "\u25a1": "optional"}
PRICE_RE = re.compile(r"^(\d{1,3}(?:\.\d{3})*),(–|-|\d{2})$")
NET_RE = re.compile(r"^\[(\d{1,3}(?:\.\d{3})*),(\d{2})\]$")
CODE_RE = re.compile(r"^[0-9A-Z]{3,4}$")


def euro(tok):
    if tok in ("–,–", "-,-", "–,-", "-,–"):          # 'Sonderausstattung ohne Mehr-/Minderpreis'
        return 0.0
    m = PRICE_RE.match(tok)
    if not m:
        return None
    cents = 0 if m.group(2) in "–-" else int(m.group(2))
    return int(m.group(1).replace(".", "")) + cents / 100


def rows_of(words, tol=None):
    """Group words into visual rows by vertical overlap: a word joins the current row when it overlaps the row's
    span by >= 40% of the smaller height. (A bigger heading font and its ■ mark have different tops/centres but
    overlap; normal body lines are ~7pt apart and never overlap.) `tol` kept for call compatibility."""
    rows = []
    for w in sorted(words, key=lambda w: (w["top"], w["x0"])):
        if rows:
            top, bot = min(x["top"] for x in rows[-1]), max(x["bottom"] for x in rows[-1])
            ov = min(bot, w["bottom"]) - max(top, w["top"])
            if ov >= 0.4 * min(bot - top, w["bottom"] - w["top"]):
                rows[-1].append(w)
                continue
        rows.append([w])
    return [sorted(r, key=lambda w: w["x0"]) for r in rows]


def header_columns(page):
    """Rotated header -> list of (label, x_center). Empty if the page has no rotated header."""
    rot = [c for c in page.chars if not c.get("upright", True) and c["top"] < 260]
    groups = collections.defaultdict(list)
    for c in rot:
        groups[round(c["x0"] / 4)].append(c)
    cols = []
    for _, cs in sorted(groups.items()):
        cs.sort(key=lambda c: -c["top"])
        label = re.sub(r"\s+", " ", "".join(c["text"] for c in cs)).strip()
        if label:
            cols.append({"label": label, "x": sum((c["x0"] + c["x1"]) / 2 for c in cs) / len(cs),
                         "bottom": max(c["bottom"] for c in cs)})
    return cols


def split_header(cols):
    code_x = next((c["x"] for c in cols if c["label"].startswith("SA-Nr")), None)
    price_cols = [c for c in cols if re.search(r"EUR|MwSt", c["label"])]
    price_x = (min(c["x"] for c in price_cols), max(c["x"] for c in price_cols)) if price_cols else None
    variants = [c for c in cols if not c["label"].startswith("SA-Nr") and c not in price_cols]
    return code_x, price_x, variants


def parse_grid(page, model, pageno):
    cols = header_columns(page)
    code_x, price_x, variants = split_header(cols)
    if len(variants) < 2:                               # technical drawings etc. carry stray rotated text
        return None
    hdr_bottom = max(c["bottom"] for c in cols) + 2
    vx = [v["x"] for v in variants]
    left_edge = (code_x - 12) if code_x else (min(vx) - 14)
    words = [w for w in page.extract_words(extra_attrs=["upright", "size"]) if w["upright"] and w["top"] > hdr_bottom]
    words = [w for w in words if not re.match(r"^(Serienausstattung|Sonderausstattung)", w["text"])]
    sizes = collections.Counter(round(w["size"], 1) for w in words)
    body_size = sizes.most_common(1)[0][0] if sizes else 0
    title = page_title(page)
    kind = "standard_equipment" if code_x is None else "options"
    items, section, problems = [], title, []
    cur = None
    for r in rows_of(words):
        if r[0]["top"] > page.height - 40:            # legend / page footer
            continue
        # footnote block: a row that starts with a superscript number at the left margin; everything below is notes
        if r[0]["text"].isdigit() and r[0]["size"] < body_size * 0.8 and r[0]["x1"] <= left_edge:
            break
        name_w = [w for w in r if w["x1"] <= left_edge and w["size"] >= body_size * 0.8]   # drop footnote markers
        rest = [w for w in r if w["x1"] > left_edge]
        marks = {}
        for w in rest:
            if w["text"] in MARKS:
                cx = (w["x0"] + w["x1"]) / 2
                j = min(range(len(vx)), key=lambda i: abs(vx[i] - cx))
                if abs(vx[j] - cx) < 9:
                    marks[variants[j]["label"]] = MARKS[w["text"]]
                else:
                    problems.append("mark off-column at x=%.0f top=%.0f" % (cx, w["top"]))
        code = [w["text"] for w in rest if code_x and abs((w["x0"] + w["x1"]) / 2 - code_x) < 14 and CODE_RE.match(w["text"])]
        ptxt = [w["text"] for w in rest if price_x and price_x[0] - 22 <= (w["x0"] + w["x1"]) / 2 <= price_x[1] + 22]
        gross = next((euro(t) for t in ptxt if euro(t) is not None), None)
        net = next((float(NET_RE.match(t).group(1).replace(".", "") + "." + NET_RE.match(t).group(2))
                    for t in ptxt if NET_RE.match(t)), None)
        serie = any(t == "Serie" for t in ptxt)
        name = " ".join(w["text"] for w in name_w).strip()
        is_section = (not marks and not code and not ptxt and name and name_w
                      and max(w["size"] for w in name_w) > body_size + 0.6)
        if is_section:
            section = name
            cur = None
            continue
        if marks or code:
            conditional = (bool(re.match(r"^(In Verbindung mit|Mit |Bei |Für |– |- )", name))
                           or (not name and not code))
            if conditional and cur:
                rec = dict(cur, name=cur["name"], condition=name or "variant-specific price", code=cur["code"],
                           price_gross=gross, price_net=net, marks=marks or cur["marks"],
                           description="", constraints=[], top=round(r[0]["top"]))
                items.append(rec)
                continue
            if not marks and cur and cur.get("group_marks"):
                marks = cur["group_marks"]                # colour block: later names share the first row's marks
                gross = gross if gross is not None else cur["price_gross"]
                net = net if net is not None else cur["price_net"]
            cur = {"model": model, "page": pageno, "page_title": title, "kind": kind, "section": section,
                   "name": name, "code": " ".join(code) or None, "condition": None,
                   "price_gross": gross, "price_net": net, "price_note": "Serie" if serie else None,
                   "marks": marks, "description": "", "constraints": [], "top": round(r[0]["top"]),
                   "group_marks": marks if (marks and code) else (cur.get("group_marks") if cur and not marks else None)}
            items.append(cur)
            continue
        if cur is None or not name:
            continue
        if re.match(r"^(Nur|Nicht) in Verbindung mit", name) or re.match(r"^(Nur|Nicht) ", name):
            cur["constraints"].append(name)
        elif gross is not None and cur.get("price_gross") is None:
            cur["price_gross"], cur["price_net"] = gross, net
        else:
            cur["description"] = (cur["description"] + " " + name).strip()
    for it in items:
        it.pop("group_marks", None)
    return {"kind": kind, "title": title, "variants": [v["label"] for v in variants], "items": items,
            "problems": problems}


def page_title(page):
    """Largest upright text line near the top of the page (rotated headers can come first in extract_text)."""
    ws = [w for w in page.extract_words(extra_attrs=["upright", "size"]) if w["upright"] and w["top"] < 90]
    if not ws:
        return ""
    big = max(w["size"] for w in ws)
    return " ".join(w["text"] for w in ws if w["size"] >= big - 0.5).strip().rstrip(".")


def parse_price_page(page, model, pageno):
    """Price pages: per fuel block, header row of variant names (above 'Getriebe'), a 'Leistung
    Gesamtfahrzeugantrieb' row, and gross base prices printed ~2pt above the 'FAHRZEUGGRUNDPREIS' label."""
    words = [w for w in page.extract_words(extra_attrs=["upright", "size"]) if w["upright"]]
    body = collections.Counter(round(w["size"], 1) for w in words).most_common(1)[0][0]
    words = [w for w in words if w["size"] >= body * 0.8]          # drop superscript footnote markers
    rows = rows_of(words, tol=1.0)
    out, fuel = [], None
    for i, r in enumerate(rows):
        text = " ".join(w["text"] for w in r)
        if re.match(r"^(VOLLELEKTRISCH|PLUG-IN-HYBRID|BENZINER|DIESEL|MILD-HYBRID)\b", text):
            fuel = r[0]["text"]
            continue
        if not text.startswith("FAHRZEUGGRUNDPREIS"):
            continue
        label_top = r[0]["top"]
        prices = sorted(((euro(w["text"]), (w["x0"] + w["x1"]) / 2) for w in words
                         if abs(w["top"] - label_top) <= 8 and euro(w["text"]) is not None), key=lambda p: p[1])
        if not prices:
            continue
        xs = [x for _, x in prices]

        def nearest(w):
            cx = (w["x0"] + w["x1"]) / 2
            j = min(range(len(xs)), key=lambda k: abs(xs[k] - cx))
            return j if abs(xs[j] - cx) < 45 else None

        header, power = None, None
        for back in range(i - 1, max(-1, i - 40), -1):
            rt = " ".join(w["text"] for w in rows[back])
            if power is None and rt.startswith("Leistung Gesamtfahrzeugantrieb"):
                power = rows[back]
            if rt.startswith("Getriebe"):
                # gearbox text can wrap onto the line above ('8-Gang Steptronic'); skip such lines
                k = back - 1
                while k >= 0 and re.search(r"Gang|Steptronic|automatisch|Sport$", " ".join(w["text"] for w in rows[k])):
                    k -= 1
                header = rows[k] if k >= 0 else None
                break
        names = collections.defaultdict(list)
        for w in header or []:
            j = nearest(w)
            if j is not None:
                names[j].append(w["text"])
        kw = collections.defaultdict(list)
        for w in power or []:
            j = nearest(w)
            if j is not None and re.match(r"^\(?\d+\)?$", w["text"]):
                kw[j].append(w["text"])
        for j, (p, _) in enumerate(prices):
            pw = " ".join(kw[j])
            m = re.match(r"(\d+)\D+(\d+)", pw)
            out.append({"model": model, "page": pageno, "fuel": fuel, "variant": " ".join(names[j]) or None,
                        "power_kw": int(m.group(1)) if m else None, "power_ps": int(m.group(2)) if m else None,
                        "power_raw": pw or None, "base_price_eur_gross": p})
    return out


def parse_package_page(page, model, pageno):
    """Package pages (M Sportpaket, M Sportpaket Pro, M-model pages): upright 'SA-Nr.' / 'EUR inkl.' header,
    package price lines first, then the contents with their own codes (and sometimes prices)."""
    words = [w for w in page.extract_words(extra_attrs=["upright", "size"]) if w["upright"]]
    sa = [w for w in words if w["text"] == "SA-Nr."]
    if not sa:
        return None
    code_x = (sa[0]["x0"] + sa[0]["x1"]) / 2
    eur = [w for w in words if w["text"] == "EUR" and w["x0"] > code_x]
    price_x0 = eur[0]["x0"] - 4 if eur else code_x + 20
    body = collections.Counter(round(w["size"], 1) for w in words).most_common(1)[0][0]
    hdr_tops = sorted(w["top"] for w in sa)
    title = page_title(page)
    pkg = {"model": model, "page": pageno, "package": title, "prices": [], "contents": []}
    section, cur = None, None
    for r in rows_of([w for w in words if w["top"] > hdr_tops[0] + 3 and w["top"] < page.height - 40]):
        if any(w["text"] in ("SA-Nr.", "EUR") for w in r):
            continue
        name_w = [w for w in r if w["x1"] < code_x - 15]
        code = [w["text"] for w in r if abs((w["x0"] + w["x1"]) / 2 - code_x) < 18 and CODE_RE.match(w["text"])]
        ptoks = [w["text"] for w in r if w["x0"] >= price_x0 - 2]
        gross = next((euro(t) for t in ptoks if euro(t) is not None), None)
        net = next((float(NET_RE.match(t).group(1).replace(".", "") + "." + NET_RE.match(t).group(2))
                    for t in ptoks if NET_RE.match(t)), None)
        name = " ".join(w["text"] for w in name_w).strip()
        in_price_block = len(hdr_tops) > 1 and r[0]["top"] < hdr_tops[1]
        if in_price_block:
            if gross is not None:
                pkg["prices"].append({"label": name, "code": " ".join(code) or None,
                                      "price_eur_gross": gross, "price_eur_net": net})
            continue
        if name and not code and gross is None and max(w["size"] for w in name_w) > body + 0.6:
            section = name
            continue
        if code:
            cur = {"section": section, "name": name, "code": " ".join(code), "price_eur_gross": gross,
                   "price_eur_net": net, "notes": []}
            pkg["contents"].append(cur)
        elif cur and name:
            cur["notes"].append(name)
    return pkg


def main():
    all_items, variants, packages, log = [], [], [], {}
    for model in MODELS:
        pdf = pdfplumber.open(os.path.join(ROOT, "BMW-Data", "%s_OptionList.PDF" % model))
        for pageno, page in enumerate(pdf.pages, 1):
            page = page.dedupe_chars()      # fake-bold text is printed twice ('C31' -> 'CC3311')
            text = (page.extract_text() or "").strip()
            key = "%s p%d" % (model, pageno)
            if text.startswith("FAHRZEUGPREISE."):
                v = parse_price_page(page, model, pageno)
                variants += v
                log[key] = {"type": "prices", "variants": len(v)}
                continue
            g = parse_grid(page, model, pageno)
            if g:
                all_items += g["items"]
                log[key] = {"type": g["kind"], "title": g["title"], "variants": g["variants"],
                            "items": len(g["items"]), "problems": g["problems"][:5]}
                continue
            p = parse_package_page(page, model, pageno)
            if p and (p["prices"] or p["contents"]):
                packages.append(p)
                log[key] = {"type": "package", "title": p["package"], "price_lines": len(p["prices"]),
                            "contents": len(p["contents"])}
            else:
                log[key] = {"type": "text-only (not parsed)", "head": text[:60].replace("\n", " | ")}
    with open(os.path.join(OUT, "F_packages.json"), "w") as f:
        json.dump(packages, f, ensure_ascii=False, indent=1)
    with open(os.path.join(OUT, "F_items.json"), "w") as f:
        json.dump(all_items, f, ensure_ascii=False, indent=1)
    with open(os.path.join(OUT, "F_variants.json"), "w") as f:
        json.dump(variants, f, ensure_ascii=False, indent=1)
    with open(os.path.join(OUT, "F_parse_log.json"), "w") as f:
        json.dump(log, f, ensure_ascii=False, indent=1)
    with open(os.path.join(OUT, "F_options.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["model", "page", "kind", "section", "code", "name_de", "condition", "variant",
                    "availability", "price_eur_gross", "price_eur_net", "constraints", "description"])
        for it in all_items:
            for var, av in sorted(it["marks"].items()):
                w.writerow([it["model"], it["page"], it["kind"], it["section"], it["code"], it["name"],
                            it["condition"], var, av, it["price_gross"], it["price_net"],
                            " | ".join(it["constraints"]), it["description"][:300]])
    c = collections.Counter((i["model"], i["kind"]) for i in all_items)
    print("items:", dict(c))
    print("variants:", collections.Counter(v["model"] for v in variants))
    print("pages:", collections.Counter(v["type"] for v in log.values()))


if __name__ == "__main__":
    main()
