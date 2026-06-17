#!/usr/bin/env python3
"""Apply parsed .docx enrichment (flags, links, images) to bioreactorRequirements.js."""

import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
DOCX = Path.home() / "Downloads" / "Centralized Living Hardware Doc.docx"
DATA = REPO / "src/data/bioreactorRequirements.js"
OUT_DIR = REPO / "static/hardware-notebook/requirements"
PARSED_CACHE = REPO / "scripts/.docx-requirements-parsed.json"

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
R = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
A = "{http://schemas.openxmlformats.org/drawingml/2006/main}blip"

SECTION_MAP = [
    ("culturing", ["culturing bacteria"]),
    ("measurements", ["taking measurements", "measurements/readings"]),
    ("ergonomics", ["operation ergonomics", "user friendliness"]),
    ("assembly-maintenance", ["ease of assembly", "assembly/maintenance"]),
    ("power", ["power distribution"]),
    ("overarching", ["overarching requirements", "other overarching"]),
    ("parking-lot", ["parking lot", "additional ideas"]),
]

ROW_ID_MAP = {
    "heating": "heating",
    "aeration for vials": "aeration",
    "mixing fluid (even concentration)": "mixing",
    "pumping fluid (in and out)": "pumping",
    "vial volume": "vial-volume",
    "runtime": "runtime",
    "optical density readings": "optical-density",
    "temperature control": "temperature-control",
    "separation of undesired final products and product": "separation",
    "ph control": "ph-control",
    "stirring control": "stirring-control",
    "control systems": "control-systems",
    "status queues": "status-queues",
    "vessel transparency": "vessel-transparency",
    "data displays": "data-displays",
    "ordered component organization": "ordered-organization",
    "textured knobs for touch": "textured-knobs",
    "single handed-operability": "single-handed",
    "spill/damage safe stability": "spill-stability",
    "glove optimized tactility": "glove-tactility",
    "autoclave/sanitization compatibility": "autoclave-compat",
    "tool-less modularity": "tool-less-modularity",
    "0 cross-connection possibility": "no-cross-connection",
    "checklist-list operation": "checklist-operation",
    "accurate screw tolerance": "screw-tolerance",
    "autoclavable": "autoclavable",
    "ability to disassemble and clean": "disassemble-clean",
    "complexity of pins, connectors, hat pcbs, mcu together": "electronics-complexity",
    "adheres to power consumption limits in donnelly centre": "power-limits",
    "efficient power distribution and cable routing": "power-distribution",
    "ensure electrical and thermal safety in a wetlab": "electrical-safety",
    "lower cost": "lower-cost",
    "component accessibility": "component-accessibility",
    "instructions accessibility": "instructions",
    "physical size & compactness (for multi-reactor setups)": "size-compactness",
    "adheres to network limitations (when scaled up to 96)": "network-limits",
    "safety?": "safety",
    "sizing": "sizing",
}


def norm(s):
    return re.sub(r"\s+", " ", (s or "").strip().lower())


def map_color(v):
    v = (v or "").lower()
    if v in ("yellow", "fff2cc", "ffff00"):
        return "important"
    if v in ("green", "d9ead3", "c6efce", "00ff00"):
        return "needs-quantify"
    if v in ("magenta", "pink", "ead1dc", "ffc0cb", "f4cccc"):
        return "difficult"
    return None


def flags_in_element(el):
    flags = []
    for rpr in el.iter(f"{W}rPr"):
        hl = rpr.find(f"{W}highlight")
        if hl is not None:
            f = map_color(hl.get(f"{W}val"))
            if f:
                flags.append(f)
        shd = rpr.find(f"{W}shd")
        if shd is not None:
            f = map_color(shd.get(f"{W}fill"))
            if f:
                flags.append(f)
    tcPr = el.find(f"{W}tcPr")
    if tcPr is not None:
        shd = tcPr.find(f"{W}shd")
        if shd is not None:
            f = map_color(shd.get(f"{W}fill"))
            if f:
                flags.append(f)
    return flags


def dominant_flag(flags):
    if not flags:
        return None
    priority = {"important": 0, "difficult": 1, "needs-quantify": 2}
    return sorted(set(flags), key=lambda f: priority.get(f, 9))[0]


def parse_cell(tc, rels):
    texts, links, images = [], [], []
    for hl in tc.iter(f"{W}hyperlink"):
        rid = hl.get(R + "id")
        url = rels.get(rid, "")
        if url.startswith("http"):
            label = "".join(t.text or "" for t in hl.iter(f"{W}t")).strip()
            if label:
                links.append({"label": label, "url": url})
    for t in tc.iter(f"{W}t"):
        if t.text:
            texts.append(t.text)
    for blip in tc.iter(A):
        embed = blip.get(f"{R}embed")
        if embed and rels.get(embed, "").startswith("media/"):
            images.append(rels[embed])
    return "".join(texts).strip(), links, list(dict.fromkeys(images))


def detect_section(text):
    t = norm(text)
    for sid, keys in SECTION_MAP:
        if any(k in t for k in keys):
            return sid
    return None


def parse_docx():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    parsed = {}
    with zipfile.ZipFile(DOCX) as z:
        rels = {
            rel.get("Id"): rel.get("Target")
            for rel in ET.fromstring(z.read("word/_rels/document.xml.rels"))
        }
        img_map = {}
        for name in z.namelist():
            if name.startswith("word/media/"):
                fname = Path(name).name
                (OUT_DIR / fname).write_bytes(z.read(name))
                img_map[name.replace("word/", "")] = f"/hardware-notebook/requirements/{fname}"

        tbl = ET.fromstring(z.read("word/document.xml")).find(f".//{W}tbl")
        current_section = None
        for tr in tbl.findall(f"{W}tr"):
            cells = tr.findall(f"{W}tc")
            if len(cells) < 2:
                continue
            c1, _, _ = parse_cell(cells[1], rels)
            sec = detect_section(c1)
            if sec:
                current_section = sec
                continue
            if len(cells) < 5 or not c1 or c1.lower().startswith("objective"):
                continue
            if "try to be power efficient" in norm(c1):
                continue
            row_id = ROW_ID_MAP.get(norm(c1))
            if not row_id:
                row_id = (
                    "sustainability"
                    if "environmental sustainability" in norm(c1)
                    else re.sub(r"[^a-z0-9]+", "-", norm(c1)).strip("-")[:40]
                )
            links_cell = cells[5] if len(cells) > 5 else cells[-1]
            _, links, images = parse_cell(links_cell, rels)
            all_flags = []
            for cell in cells:
                all_flags.extend(flags_in_element(cell))
            flag = dominant_flag(all_flags)
            imgs = [{"src": img_map[p], "alt": c1} for p in images if p in img_map]
            parsed[f"{current_section}:{row_id}"] = {
                "flag": flag,
                "links": links,
                "images": imgs,
            }
    return parsed


def js_str(s):
    return json.dumps(s, ensure_ascii=False)


def format_links(links):
    if not links:
        return "[]"
    items = []
    for link in links:
        items.append(f'{{ label: {js_str(link["label"])}, url: {js_str(link["url"])} }}')
    return "[\n              " + ",\n              ".join(items) + ",\n            ]"


def format_images(images):
    if not images:
        return None
    items = []
    for img in images:
        alt = js_str(img.get("alt", ""))
        src = js_str(img["src"])
        items.append(f'{{ src: {src}, alt: {alt} }}')
    return "[\n              " + ",\n              ".join(items) + ",\n            ]"


def merge_links(existing_block, doc_links):
    """Keep doc links with URLs; preserve plain-string entries from existing data not in doc."""
    if doc_links:
        return doc_links
    return None


def patch_data_file(parsed):
    text = DATA.read_text(encoding="utf-8")
    current_section = None
    section_re = re.compile(r'^\s+id: "([a-z-]+)",\s*$')
    row_re = re.compile(r'^\s+id: "([a-z0-9-]+)",\s*$')
    in_rows = False
    lines = text.splitlines(keepends=True)
    out = []
    i = 0
    while i < len(lines):
        line = lines[i]
        m_sec = section_re.match(line)
        if m_sec and any("title:" in lines[j] for j in range(i + 1, min(i + 4, len(lines)))):
            current_section = m_sec.group(1)
            out.append(line)
            i += 1
            continue

        m_row = row_re.match(line)
        if m_row and any("objective:" in lines[j] for j in range(i + 1, min(i + 6, len(lines)))):
            row_id = m_row.group(1)
            key = f"{current_section}:{row_id}"
            enrichment = parsed.get(key)
            # copy lines until end of row object (matching closing `},`)
            block = [line]
            i += 1
            depth = 1
            while i < len(lines) and depth > 0:
                block.append(lines[i])
                if "{" in lines[i]:
                    depth += lines[i].count("{")
                if "}" in lines[i]:
                    depth -= lines[i].count("}")
                i += 1
            block_text = "".join(block)
            if enrichment:
                block_text = re.sub(
                    r"flag: (?:null|\"[^\"]*\"|'[^']*'),?",
                    f'flag: {js_str(enrichment["flag"]) if enrichment["flag"] else "null"},',
                    block_text,
                    count=1,
                )
                if enrichment["links"]:
                    block_text = re.sub(
                        r"links: \[[\s\S]*?\],",
                        f"links: {format_links(enrichment['links'])},",
                        block_text,
                        count=1,
                    )
                if enrichment["images"]:
                    if "images:" in block_text:
                        block_text = re.sub(
                            r"images: \[[\s\S]*?\],",
                            f"images: {format_images(enrichment['images'])},",
                            block_text,
                            count=1,
                        )
                    else:
                        block_text = re.sub(
                            r"(flag: (?:null|\"[^\"]*\"|'[^']*'),)",
                            f"images: {format_images(enrichment['images'])},\n            \\1",
                            block_text,
                            count=1,
                        )
            out.append(block_text)
            continue

        out.append(line)
        i += 1

    DATA.write_text("".join(out), encoding="utf-8")


def main():
    if not DOCX.exists():
        print(f"Missing docx: {DOCX}", file=sys.stderr)
        sys.exit(1)
    parsed = parse_docx()
    PARSED_CACHE.write_text(json.dumps(parsed, indent=2), encoding="utf-8")
    patch_data_file(parsed)
    enriched = sum(1 for v in parsed.values() if v["flag"] or v["links"] or v["images"])
    print(f"Patched {DATA.name}: {len(parsed)} rows, {enriched} enriched from docx")


if __name__ == "__main__":
    main()
