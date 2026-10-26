const assert = require("assert");
const M = require("../match.js");
const data = require("../data/lists.json");
const C = (o) => M.check(Object.assign({ altNames: [], issns: [], publisher: "", homepage: "" }, o), data);
const t = [];
const test = (n, f) => t.push([n, f]);

test("ACS Omega is on the mega journal list", () => { const r = C({ name: "ACS Omega", publisher: "American Chemical Society" }); assert.equal(r.rules.mega, "fail"); assert.equal(r.rules.predatory, "clear"); });
test("PLOS ONE is mega", () => assert.equal(C({ name: "PLOS ONE" }).rules.mega, "fail"));
test("Scientific Reports is mega", () => assert.equal(C({ name: "Scientific Reports" }).rules.mega, "fail"));
test("Research Policy passes all three", () => { const r = C({ name: "Research Policy", publisher: "Elsevier", issns: ["0048-7333"] }); assert.equal(r.overall, "clear"); });
test("Technological Forecasting and Social Change passes", () => assert.equal(C({ name: "Technological Forecasting and Social Change", publisher: "Elsevier" }).overall, "clear"));
test("MDPI publisher fails rule 3", () => assert.equal(C({ name: "Sustainability", publisher: "MDPI AG", issns: ["2071-1050"] }).rules.mdpi, "fail"));
test("MDPI by ISSN alone", () => assert.equal(C({ name: "Unknown", issns: ["2071-1050"] }).rules.mdpi, "fail"));
test("MDPI by website", () => assert.equal(C({ name: "x", homepage: "https://www.mdpi.com/journal/sensors" }).rules.mdpi, "fail"));
test("a generic journal name that equals an MDPI title is only 'check'", () => assert.equal(C({ name: "Sensors", publisher: "Elsevier" }).rules.mdpi, "check"));
test("Beall standalone: first entry by name", () => {
  const first = data.sources.beall_standalone.items[0];
  assert.equal(C({ name: first.name }).rules.predatory, "fail");
});
test("Beall publisher: by publisher name", () => {
  const first = data.sources.beall_publishers.items[0];
  assert.equal(C({ name: "A Journal", publisher: first.name }).rules.predatory, "fail");
});
test("Beall publisher: by website", () => {
  const it = data.sources.beall_publishers.items.find((x) => x.url && /^https?:\/\/(www\.)?[a-z0-9-]+\.(org|com|net)\/?$/.test(x.url));
  assert.equal(C({ name: "Some Journal", homepage: it.url + "/journal/1" }).rules.predatory, "fail");
});
test("a subdomain of a generic host is not matched by the parent host", () => assert.equal(C({ name: "Z", homepage: "https://blogspot.com/" }).rules.predatory, "clear"));
test("hijacked: same name, authentic site -> not flagged", () => {
  const it = data.sources.beall_hijacked.items.find((x) => x.authentic_url && /^https?:/.test(x.authentic_url) && !/worldcat/.test(x.authentic_url));
  const r = C({ name: it.name, homepage: it.authentic_url });
  assert.ok(!r.sources.beall_hijacked.length || r.sources.beall_hijacked[0].level !== "exact");
});
test("hijacked: fake site -> exact", () => {
  const it = data.sources.beall_hijacked.items.find((x) => x.url && /^https?:/.test(x.url));
  assert.equal(C({ name: it.name, homepage: it.url }).sources.beall_hijacked[0].level, "exact");
});
test("accents and punctuation do not matter", () => assert.equal(M.norm("The  Journal of  Café—Science!"), "journal of cafe science"));
test("short names never match by containment", () => { assert.equal(M.nameMatch([M.norm("Medicine and Health")], { name: "Medicine" }), null); assert.equal(M.nameMatch([M.norm("Applied Sciences")], { name: "International Journal of Applied Sciences and Engineering" }), null); assert.equal(M.nameMatch([M.norm("Journal of Knowledge Management")], { name: "Journal of Knowledge Management, Economics and Information Technology" }), null); });

test("CAS list: a one-word name is only 'check' (Sustainability 2020)", () => { const r = C({ name: "Sustainability", issns: ["2071-1050"] }); assert.ok(r.sources.cas_ewl.every((x) => x.level === "possible") && r.sources.cas_ewl.length); });
test("CAS list: -Basel suffix is dropped (Applied Sciences)", () => assert.ok(C({ name: "Applied Sciences" }).sources.cas_ewl.some((x) => x.year === 2020)));
test("CAS list: a longer name is exact", () => assert.equal(C({ name: "International Journal of Electrochemical Science" }).sources.cas_ewl[0].level, "exact"));
test("CAS list: by ISSN (2024 Fuel)", () => assert.ok(C({ name: "Unknown", issns: ["0016-2361"] }).sources.cas_ewl.some((x) => x.year === 2024 && x.level === "exact")));
test("CAS list: punctuation differences (Scalable Computing: Practice and Experience)", () => assert.ok(C({ name: "Scalable Computing: Practice and Experience" }).sources.cas_ewl.some((x) => x.year === 2025)));
test("CAS list does not change the three-rule verdict", () => assert.equal(C({ name: "Fuel", issns: ["0016-2361"], publisher: "Elsevier" }).overall, "clear"));
test("CAS list: Research Policy not listed", () => assert.equal(C({ name: "Research Policy", issns: ["0048-7333"] }).extra, "clear"));
test("typo: IEEE Acecce is suggested as IEEE Access", () => assert.equal(M.suggest("IEEE Acecce", data, 3, 0.6)[0].name, "IEEE Access"));
test("typo: Scientfic Reports -> Scientific Reports", () => assert.equal(M.suggest("Scientfic Reports", data, 3, 0.6)[0].name, "Scientific Reports"));
test("similarity: same name is 1, unrelated is low", () => { assert.equal(M.similarity("Research Policy", "research  policy"), 1); assert.ok(M.similarity("Research Policy", "Nature") < 0.3); });

let bad = 0;
for (const [n, f] of t) { try { f(); console.log("ok  ", n); } catch (e) { bad++; console.log("FAIL", n, "\n    ", e.message); } }
console.log(bad ? bad + " failed" : "all " + t.length + " passed");
process.exit(bad ? 1 : 0);
