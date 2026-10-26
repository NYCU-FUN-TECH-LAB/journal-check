"""Fetch the public lists the journal checker compares against and write data/lists.json.

Sources
  Beall's List, Publishers and Standalone Journals and Hijacked Journals  (beallslist.net)
  Wikipedia, "Mega journal", List of mega journals
  Wikipedia, "List of MDPI academic journals", plus the section headings of "MDPI > Controversies"
  CAS Early Warning Journal List: data/cas_ewl.json, written by make_cas_ewl.py

Run:  python build_data.py            (needs requests and beautifulsoup4)
The GitHub Actions workflow in .github/workflows runs it every week and commits the result.
"""
import json
import os
import re
import sys
import time
from datetime import datetime, timezone

import requests
from bs4 import BeautifulSoup

HERE = os.path.dirname(os.path.abspath(__file__))
UA = {"User-Agent": "csh-journal-check/1.0 (lab tool; list builder)"}
WIKI = "https://en.wikipedia.org/w/api.php"

BEALL = {
    "beall_publishers": ("https://beallslist.net/", "Beall's List: Publishers"),
    "beall_standalone": ("https://beallslist.net/standalone-journals/", "Beall's List: Standalone Journals"),
    "beall_hijacked": ("https://beallslist.net/hijacked-journals/", "Beall's List: Hijacked Journals"),
}


def get(url, **kw):
    """GET with a few retries; Wikipedia answers 429 when the same address asks too often."""
    for attempt in range(5):
        r = requests.get(url, headers=UA, timeout=60, **kw)
        if r.status_code == 429 or r.status_code >= 500:
            time.sleep(min(int(r.headers.get("Retry-After", 0) or 0) or 10 * (attempt + 1), 60))
            continue
        r.raise_for_status()
        return r
    r.raise_for_status()
    return r


def clean(t):
    return re.sub(r"\s+", " ", (t or "").replace("​", "")).strip()


def beall_lists(url):
    """Return (items, last_updated). Items come from the 'Original list' and 'Update' sections."""
    soup = BeautifulSoup(get(url).text, "html.parser")
    items = []
    for ul in soup.find_all("ul"):
        h2 = ul.find_previous("h2")
        title = clean(h2.get_text()).lower() if h2 else ""
        if title not in ("original list", "update") or ul.find_parent("ul"):
            continue
        section = "original" if title == "original list" else "update"
        for li in ul.find_all("li"):
            a = li.find("a")
            text = clean(li.get_text(" "))
            if not text:
                continue
            items.append({"name": clean(a.get_text()) if a and clean(a.get_text()) else text,
                          "text": text, "url": a.get("href") if a else None, "section": section})
    upd = re.findall(r"Last updated ([A-Z][a-z]+ \d{1,2}, \d{4})", soup.get_text(" "))
    return items, upd


def beall_hijacked(url):
    soup = BeautifulSoup(get(url).text, "html.parser")
    items = []
    for tr in soup.find_all("tr"):
        tds = tr.find_all("td")
        if len(tds) != 2 or "Hijacker" in tds[0].get_text():
            continue
        a, b = tds[0].find("a"), tds[1].find("a")
        items.append({"name": clean(tds[0].get_text()), "url": a.get("href") if a else None,
                      "authentic": clean(tds[1].get_text()), "authentic_url": b.get("href") if b else None})
    upd = re.findall(r"Last updated ([A-Z][a-z]+ \d{1,2}, \d{4})", soup.get_text(" "))
    return items, upd


def wikitext(page):
    j = get(WIKI, params={"action": "parse", "page": page, "prop": "wikitext", "format": "json", "formatversion": 2}).json()
    return j["parse"]["wikitext"]


def wiki_revision(page):
    j = get(WIKI, params={"action": "query", "prop": "revisions", "titles": page, "rvprop": "ids|timestamp",
                          "format": "json", "formatversion": 2}).json()
    rev = j["query"]["pages"][0]["revisions"][0]
    return rev["revid"], rev["timestamp"]


def mega_journals():
    w = wikitext("Mega_journal")
    a, b = w.find("== List of mega journals =="), w.find("== Notes ==")
    items = []
    for line in w[a:b].splitlines():
        if not line.startswith("* "):
            continue
        links = re.findall(r"\[\[([^\]|]+)(?:\|([^\]]+))?\]\]", line.split("<ref")[0].split("{{efn")[0])
        if not links:
            continue
        target, shown = links[0]
        name = clean(shown or target)
        name = re.sub(r"\s*\((?:Lippincott[^)]*|Elsevier|[^)]*journal)\)\s*$", "", name).strip() or name
        # "''[[Heliyon]] ([[Elsevier]])''" keeps the journal; "[[De Gruyter Open]] imprint" is a publisher imprint
        kind = "imprint" if "imprint" in line.split("<ref")[0] else "journal"
        items.append({"name": name, "wiki": "https://en.wikipedia.org/wiki/" + target.replace(" ", "_"),
                      "self_declared": "Self-declared" in line, "kind": kind})
    seen, out = set(), []
    for it in items:
        if it["name"].lower() not in seen:
            seen.add(it["name"].lower()); out.append(it)
    return out


def mdpi_journals():
    w = wikitext("List_of_MDPI_academic_journals")
    items = []
    for row in w.split("\n|-\n")[1:]:
        cells = re.split(r"\n\|", "\n" + row.strip())[1:]
        if not cells:
            continue
        first = re.sub(r"\[\[(?:[^\]|]*\|)?([^\]]+)\]\]", r"\1", cells[0])
        first = re.sub(r"<ref[^>]*?/>|<ref.*?</ref>|\{\{anchor\|[^}]*\}\}", "", first, flags=re.S)
        names = [clean(n) for n in re.findall(r"''([^']+)''", first)]
        issn = re.findall(r"\d{4}-\d{3}[\dXx]", " ".join(cells[1:]))
        if names:
            items.append({"name": names[0], "former": names[1:], "issn": issn})
    return items


def mdpi_controversies():
    w = wikitext("MDPI")
    a, b = w.find("== Controversies =="), w.find("==Proliferation of special issues==")
    return [clean(h) for h in re.findall(r"^===\s*(.+?)\s*===\s*$", w[a:b], re.M)]


def main():
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    sources = {}
    for key, (url, label) in BEALL.items():
        items, upd = beall_hijacked(url) if key == "beall_hijacked" else beall_lists(url)
        sources[key] = {"label": label, "url": url, "kind": "predatory", "count": len(items), "items": items,
                        "page_dates": upd, "fetched": now}
        print(key, len(items), upd, file=sys.stderr)
    rev, ts = wiki_revision("Mega_journal")
    mega = mega_journals()
    sources["wiki_mega"] = {"label": "Wikipedia: Mega journal (List of mega journals)", "url": "https://en.wikipedia.org/wiki/Mega_journal",
                            "kind": "mega", "count": len(mega), "items": mega, "revision": rev, "revision_time": ts, "fetched": now}
    rev2, ts2 = wiki_revision("List_of_MDPI_academic_journals")
    md = mdpi_journals()
    sources["wiki_mdpi_journals"] = {"label": "Wikipedia: List of MDPI academic journals", "url": "https://en.wikipedia.org/wiki/List_of_MDPI_academic_journals",
                                     "kind": "mdpi", "count": len(md), "items": md, "revision": rev2, "revision_time": ts2, "fetched": now}
    rev3, ts3 = wiki_revision("MDPI")
    sources["wiki_mdpi"] = {"label": "Wikipedia: MDPI (Controversies)", "url": "https://en.wikipedia.org/wiki/MDPI#Controversies",
                            "kind": "mdpi", "count": 0, "items": [], "controversies": mdpi_controversies(),
                            "revision": rev3, "revision_time": ts3, "fetched": now,
                            "publisher_names": ["MDPI", "MDPI AG", "Multidisciplinary Digital Publishing Institute", "Molecular Diversity Preservation International"]}
    print("mega", len(mega), "mdpi", len(md), "controversies", len(sources["wiki_mdpi"]["controversies"]), file=sys.stderr)
    cas_path = os.path.join(HERE, "data", "cas_ewl.json")
    if os.path.exists(cas_path):
        cas = json.load(open(cas_path, encoding="utf-8"))
        sources["cas_ewl"] = {"label": cas["label"], "url": cas["url"], "kind": "aux", "count": len(cas["items"]), "items": cas["items"],
                              "editions": cas["editions"], "note": cas["note"], "provenance": cas["provenance"], "fetched": now}
        print("cas ewl", len(cas["items"]), file=sys.stderr)
    out = {"generated": now, "sources": sources}
    path = os.path.join(HERE, "data", "lists.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print("wrote", path, file=sys.stderr)


if __name__ == "__main__":
    main()
