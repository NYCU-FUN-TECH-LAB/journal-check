/* Matching logic of the journal checker. Runs in the browser and in Node (tests). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.JCMatch = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const GENERIC_HOSTS = /(blogspot|wordpress|wixsite|weebly|sites\.google|github\.io|webs\.com|jimdo|yolasite)\./i;

  function norm(s) {
    return String(s || "")
      .normalize("NFKD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().replace(/&/g, " and ")
      .replace(/[^a-z0-9一-鿿]+/g, " ").trim()
      .replace(/^the /, "").replace(/\s+/g, " ");
  }

  /* Names an entry can be known by: the name, the text, the text without parentheses.
     Only publisher entries are also split on commas, semicolons, "also" and "formerly" (a journal name may contain a comma). */
  function variants(item, split) {
    const raw = [item.name, item.text, item.authentic].filter(Boolean);
    const out = new Set();
    raw.forEach((r) => {
      out.add(norm(r));
      out.add(norm(r.replace(/\([^)]*\)/g, " ")));
      if (split) r.split(/[;,\/]|\balso\b|\baka\b|\bformerly\b|\(|\)/i).forEach((p) => { if (norm(p).length >= 4) out.add(norm(p)); });
    });
    out.delete("");
    return [...out];
  }

  function containsPhrase(big, small) {
    return (" " + big + " ").indexOf(" " + small + " ") >= 0;
  }

  function lev(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      let rowMin = i;
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (cur[j] < rowMin) rowMin = cur[j];
      }
      if (rowMin > max) return max + 1;
      prev = cur;
    }
    return prev[b.length];
  }

  /* "exact" | "possible" | null.
     exact    = same normalized name.
     possible = nearly the same (a typo or a one-word difference in a long name), or, with opts.series, the listed name is the
                first words of the candidate (a journal series) , or, with opts.within, the listed name is a whole-word part of the
                candidate (a publisher with a suffix such as "Inc"). A short name inside a longer one is never a match. */
  function nameMatch(candNames, item, opts) {
    opts = opts || {};
    const vs = variants(item, opts.split);
    let best = null;
    for (const c of candNames) {
      if (!c) continue;
      for (const v of vs) {
        if (c === v) return "exact";
        const max = Math.floor(Math.min(c.length, v.length) * 0.06);
        if (Math.min(c.length, v.length) >= 14 && max >= 1 && lev(c, v, max) <= max) best = "possible";
        if (opts.series) { const base = v.replace(/ journals$/, ""); if (base.length >= 5 && c.startsWith(base + " ")) best = "possible"; }
        if (opts.within && v.split(" ").length >= 2 && v.length >= 12 && containsPhrase(c, v)) best = "possible";
      }
    }
    return best;
  }

  function hostOf(url) {
    try {
      const u = new URL(/^https?:\/\//i.test(url) ? url : "http://" + url);
      return u.hostname.toLowerCase().replace(/^www\./, "");
    } catch (e) { return ""; }
  }

  /* domain relation: "same" | "inside" (candidate site is a subdomain of the listed site) | null */
  function hostMatch(candHost, listedUrl) {
    const lh = hostOf(listedUrl || "");
    if (!candHost || !lh) return null;
    if (candHost === lh) return "same";
    if (!GENERIC_HOSTS.test(lh) && candHost.endsWith("." + lh) && lh.split(".").length >= 2) return "inside";
    return null;
  }

  function issnNorm(s) { return String(s || "").toUpperCase().replace(/[^0-9X]/g, ""); }

  /* cand: {name, altNames[], issns[], publisher, homepage} ; data: contents of data/lists.json */
  function check(cand, data) {
    const S = data.sources;
    const names = [cand.name].concat(cand.altNames || []).map(norm).filter(Boolean);
    const pub = norm(cand.publisher);
    const host = hostOf(cand.homepage || "");
    const issns = (cand.issns || []).map(issnNorm).filter(Boolean);
    const res = { sources: {}, rules: {} };

    // Rule 1: mega journal
    const hitsMega = [];
    S.wiki_mega.items.forEach((it) => {
      const m = nameMatch(names, it, { series: /journals$|imprint/i.test(it.name) || it.kind === "imprint" }) || (it.kind === "imprint" && pub && (pub === norm(it.name)) ? "possible" : null);
      if (m) hitsMega.push({ level: m, entry: it.name, text: it.name, note: (it.kind === "imprint" ? "（列的是出版社品牌）" : "") + (it.self_declared ? "（自稱巨錄）" : ""), url: it.wiki });
    });
    res.sources.wiki_mega = hitsMega;

    // Rule 2: predatory (Beall)
    const pubHits = [], saHits = [], hjHits = [];
    S.beall_publishers.items.forEach((it) => {
      const hm = hostMatch(host, it.url);
      const nm = pub ? nameMatch([pub], it, { split: true, within: true }) : null;
      if (hm || nm) pubHits.push({ level: hm ? "exact" : nm, entry: it.name, text: it.text, url: it.url, how: hm ? "網址相同或隸屬" : "出版者名稱", section: it.section });
    });
    S.beall_standalone.items.forEach((it) => {
      const hm = hostMatch(host, it.url);
      const nm = nameMatch(names, it);
      if (hm || nm) saHits.push({ level: hm ? "exact" : nm, entry: it.name, text: it.text, url: it.url, how: hm ? "網址相同或隸屬" : "期刊名稱", section: it.section });
    });
    S.beall_hijacked.items.forEach((it) => {
      const nm = nameMatch(names, { name: it.name });
      const hm = hostMatch(host, it.url);
      const am = hostMatch(host, it.authentic_url);
      if (hm) hjHits.push({ level: "exact", entry: it.name, url: it.url, how: "網址與冒名網站相同", authentic: it.authentic, authentic_url: it.authentic_url });
      else if (nm && !am) hjHits.push({ level: "possible", entry: it.name, url: it.url, how: "名稱與冒名名單相同，請核對網址", authentic: it.authentic, authentic_url: it.authentic_url });
    });
    res.sources.beall_publishers = pubHits;
    res.sources.beall_standalone = saHits;
    res.sources.beall_hijacked = hjHits;

    // Rule 3: MDPI
    const mdHits = [];
    const mp = S.wiki_mdpi.publisher_names.map(norm);
    if (pub && mp.some((p) => pub === p || containsPhrase(pub, p))) mdHits.push({ level: "exact", entry: cand.publisher, how: "出版者是 MDPI", url: S.wiki_mdpi.url });
    if (host && /(^|\.)mdpi\.com$/.test(host)) mdHits.push({ level: "exact", entry: host, how: "網址在 mdpi.com", url: S.wiki_mdpi.url });
    S.wiki_mdpi_journals.items.forEach((it) => {
      const isIssn = it.issn.some((x) => issns.includes(issnNorm(x)));
      const nm = nameMatch(names, { name: it.name, text: [it.name].concat(it.former || []).join(", ") });
      if (isIssn) mdHits.push({ level: "exact", entry: it.name, how: "ISSN 在 MDPI 期刊名單中", url: S.wiki_mdpi_journals.url });
      else if (nm) mdHits.push({ level: "possible", entry: it.name, how: "期刊名稱與 MDPI 名單相同，請確認出版者", url: S.wiki_mdpi_journals.url });
    });
    const seen = new Set();
    res.sources.wiki_mdpi = mdHits.filter((h) => { const k = h.how + h.entry; if (seen.has(k)) return false; seen.add(k); return true; });

    // Reference only (not one of the three rules): CAS early warning list, DOAJ withdrawal log
    const casHits = [], doajHits = [];
    ((S.cas_ewl && S.cas_ewl.items) || []).forEach((it) => {
      const isIssn = (it.issn || []).some((x) => issns.includes(issnNorm(x)));
      const nm = nameMatch(names, { name: it.name, text: [it.name].concat(it.aliases || []).join(" / ") }, {});
      const al = (it.aliases || []).some((a) => names.includes(norm(a)));
      const generic = !isIssn && norm(it.name).split(" ").length <= 2;   // one or two words: many journals share such a title
      if (isIssn || nm === "exact" || al) casHits.push({ level: generic ? "possible" : "exact", entry: it.name, year: it.year, reason: it.reason, grade: it.level, how: isIssn ? "ISSN 相同" : generic ? "期刊名稱相同，名稱很短，請核對是不是同一本" : "期刊名稱相同" });
      else if (nm) casHits.push({ level: "possible", entry: it.name, year: it.year, reason: it.reason, grade: it.level, how: "名稱相似" });
    });
    ((S.doaj_withdrawn && S.doaj_withdrawn.items) || []).forEach((it) => {
      const isIssn = (it.issn || []).some((x) => issns.includes(issnNorm(x)));
      const nm = nameMatch(names, { name: it.name });
      if (isIssn || nm === "exact") doajHits.push({ level: "exact", entry: it.name, date: it.date, reason: it.reason, how: isIssn ? "ISSN 相同" : "期刊名稱相同" });
      else if (nm) doajHits.push({ level: "possible", entry: it.name, date: it.date, reason: it.reason, how: "名稱相似" });
    });
    res.sources.cas_ewl = casHits;
    res.sources.doaj_withdrawn = doajHits;

    const worst = (arrs) => {
      const all = [].concat(...arrs);
      return all.some((h) => h.level === "exact") ? "fail" : all.length ? "check" : "clear";
    };
    res.rules.mega = worst([res.sources.wiki_mega]);
    res.rules.predatory = worst([pubHits, saHits, hjHits]);
    res.rules.mdpi = worst([res.sources.wiki_mdpi]);
    res.extra = worst([casHits, doajHits]);
    res.overall = Object.values(res.rules).includes("fail") ? "fail" : Object.values(res.rules).includes("check") ? "check" : "clear";
    return res;
  }

  /* Dice coefficient on character bigrams of the normalized names: tolerant of typos and swapped letters. */
  function bigrams(s) {
    const t = " " + s + " ", out = new Map();
    for (let i = 0; i < t.length - 1; i++) { const g = t.slice(i, i + 2); out.set(g, (out.get(g) || 0) + 1); }
    return out;
  }
  function similarity(a, b) {
    a = norm(a); b = norm(b);
    if (!a || !b) return 0;
    if (a === b) return 1;
    const A = bigrams(a), B = bigrams(b);
    let inter = 0, na = 0, nb = 0;
    A.forEach((v, k) => { na += v; if (B.has(k)) inter += Math.min(v, B.get(k)); });
    B.forEach((v) => { nb += v; });
    return (2 * inter) / (na + nb);
  }

  /* Names on the lists that look like what was typed ("IEEE Acecce" -> "IEEE Access"). */
  let POOL = null;
  function pool(data) {
    if (POOL && POOL.data === data) return POOL.items;
    const S = data.sources, items = [], seen = new Set();
    const add = (name, label) => { const k = norm(name); if (k.length >= 4 && !seen.has(k + label)) { seen.add(k + label); items.push({ name, label, key: k, grams: bigrams(k) }); } };
    S.wiki_mega.items.forEach((x) => add(x.name, "Wikipedia 巨錄名單"));
    S.wiki_mdpi_journals.items.forEach((x) => add(x.name, "MDPI 期刊"));
    S.beall_standalone.items.forEach((x) => add(x.name, "Beall's List 獨立期刊"));
    S.beall_publishers.items.forEach((x) => add(x.name, "Beall's List 出版者"));
    ((S.cas_ewl && S.cas_ewl.items) || []).forEach((x) => add(x.name.replace(/-(basel|us)$/i, ""), "中科院預警名單"));
    ((S.doaj_withdrawn && S.doaj_withdrawn.items) || []).forEach((x) => add(x.name, "DOAJ 除名紀錄"));
    POOL = { data, items };
    return items;
  }
  function suggest(query, data, n, min) {
    const q = norm(query), G = bigrams(q), nq = [...G.values()].reduce((a, b) => a + b, 0);
    const scored = [];
    pool(data).forEach((it) => {
      let inter = 0, ni = 0;
      it.grams.forEach((v, k) => { ni += v; if (G.has(k)) inter += Math.min(v, G.get(k)); });
      const d = (2 * inter) / (nq + ni);
      if (d >= (min || 0.6)) scored.push({ name: it.name, label: it.label, score: d });
    });
    scored.sort((a, b) => b.score - a.score);
    const out = [], seen = new Set();
    for (const x of scored) { const k = norm(x.name); if (seen.has(k)) continue; seen.add(k); out.push(x); if (out.length >= (n || 3)) break; }
    return out;
  }

  return { norm, check, hostOf, nameMatch, variants, similarity, suggest };
});
