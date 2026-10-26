"""Write data/cas_ewl.json: the Chinese Academy of Sciences (CAS) Early Warning Journal List, editions 2020, 2021, 2023, 2024 and 2025.

The official site (ewl.fenqubiao.com) could not be reached from the machine that built this file, so the names were
transcribed from the copy forwarded on a Chinese college's research office page (2020-2024) and from several secondary
pages (2025). Check any hit against the official site before relying on it. Edit this file when a new edition appears,
then run:  python make_cas_ewl.py
"""
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
LEVEL = {"高": "high", "中": "medium", "低": "low"}

E2020 = """Metals|低
Coatings|低
Materials|低
Journal Of Nanoscience And Nanotechnology|低
Minerals|低
Atmosphere|低
Artificial Cells Nanomedicine And Biotechnology|高
Advances In Civil Engineering|中
International Journal Of Energy Research|中
Mathematical Problems In Engineering|中
Sensors|低
Energies|低
Applied Sciences-Basel|低
Polymers|低
Electronics|低
Processes|低
Complexity|低
Desalination And Water Treatment|低
International Journal Of Electrochemical Science|中
Catalysts|低
Molecules|低
Natural Product Research|低
Zeitschrift Fur Kristallographie-New Crystal Structures|低
Sustainability|中
Water|低
Ieee Access|中
Agronomy-Basel|低
Journal Of Cellular Biochemistry|高
Journal Of Cellular Physiology|中
Bioscience Reports|中
Biomed Research International|中
Biofactors|低
Plants-Basel|低
Cells|低
Boundary Value Problems|高
Advances In Difference Equations|高
Journal Of Inequalities And Applications|中
Mathematics|低
European Review For Medical And Pharmacological Sciences|高
International Journal Of Clinical And Experimental Pathology|高
Medicine|高
International Journal Of Clinical And Experimental Medicine|高
Biomedicine & Pharmacotherapy|中
Experimental And Molecular Pathology|中
Brazilian Journal Of Medical And Biological Research|中
Cancer Biomarkers|中
International Journal Of Immunopathology And Pharmacology|中
Oncology Research|中
American Journal Of Cancer Research|中
Medical Science Monitor|中
Oncology Letters|中
Experimental And Therapeutic Medicine|中
Oncotargets And Therapy|中
Oncology Reports|中
Molecular Medicine Reports|中
International Journal Of Molecular Medicine|中
Journal Of International Medical Research|中
American Journal Of Translational Research|中
Journal Of Biomaterials And Tissue Engineering|中
Aging-Us|中
Life Sciences|低
Journal Of Clinical Medicine|低
International Journal Of Environmental Research And Public Health|低
Acta Medica Mediterranea|低
Symmetry-Basel|低"""

E2021 = """Complexity|中
Shock and Vibration|中
Advances in Civil Engineering|中
Biomedicines|低
Microprocessors and Microsystems|高
Scientific Programming|低
BioFactors|高
Mitochondrial DNA Part B-Resources|中
Frontiers in Molecular Biosciences|低
Frontiers in Cell and Developmental Biology|低
Life-Basel|低
Biology-Basel|低
Discrete Dynamics in Nature and Society|中
AIMS Mathematics|低
Journal of Mathematics|低
Pharmazie|高
Molecular Therapy-Nucleic Acids|高
Experimental and Molecular Pathology|高
Journal of Cellular and Molecular Medicine|中
Molecular Medicine Reports|中
Journal of International Medical Research|中
Journal of Cancer|中
Medical Science Monitor|中
Aging-US|中
OncoTargets and Therapy|中
Cancer Management and Research|中
Cancer Cell International|中
World Journal of Clinical Cases|中
Annals of Palliative Medicine|低
International Journal of General Medicine|低
Frontiers in Medicine|低
Journal of Personalized Medicine|低
Healthcare|低
Diagnostics|低
Vaccines|低"""

E2023 = """Textile Research Journal|中
Geofluids|中
Frontiers In Earth Science|低
Journal Of Industrial And Management Optimization|中
Mathematical Problems In Engineering|中
Aerospace|低
Buildings|低
Computational And Mathematical Methods In Medicine|低
Energy Reports|低
Machines|低
Inorganic And Nano-Metal Chemistry|高
Journal Of Structural Chemistry|高
International Journal Of Electrochemical Science|中
Frontiers In Environmental Science|低
Microprocessors And Microsystems|高
International Journal Of Control Automation And Systems|中
Mobile Information Systems|低
Economic Research-Ekonomska Istrazivanja|低
Food Science And Technology|低
Journal Of Environmental And Public Health|高
Pharmazie|高
Psychiatria Danubina|高
Acta Medica Mediterranea|中
American Journal Of Translational Research|中
Journal Of Biomaterials And Tissue Engineering|中
Journal Of Clinical Laboratory Analysis|中
World Journal Of Clinical Cases|中
Frontiers In Surgery|低"""

# name | ISSN | reason (Chinese as published)
E2024 = """CANCERS|2072-6694|引用操纵
DIAGNOSTICS|2075-4418|引用操纵
ENVIRONMENTAL SCIENCE AND POLLUTION RESEARCH|0944-1344|引用操纵、论文工厂
FUEL|0016-2361|引用操纵
JOURNAL OF CLINICAL MEDICINE|2077-0383|引用操纵
JOURNAL OF PERSONALIZED MEDICINE|2075-4426|引用操纵
RADIOLOGIA MEDICA|0033-8362|引用操纵
BIOENGINEERED|2165-5979|论文工厂
CONNECTION SCIENCE|0954-0091|论文工厂
MULTIMEDIA TOOLS AND APPLICATIONS|1380-7501|论文工厂
PSYCHIATRIA DANUBINA|0353-5053|论文工厂
JOURNAL OF BIOBASED MATERIALS AND BIOENERGY|1556-6560|论文工厂、中国作者占比畸高
JOURNAL OF BIOMATERIALS AND TISSUE ENGINEERING|2157-9083|论文工厂、中国作者占比畸高
JOURNAL OF BIOMEDICAL NANOTECHNOLOGY|1550-7033|论文工厂、中国作者占比畸高
JOURNAL OF NANOELECTRONICS AND OPTOELECTRONICS|1555-130X|论文工厂、中国作者占比畸高
JOURNAL OF SENSORS|1687-725X|论文工厂、中国作者占比畸高
MATERIALS EXPRESS|2158-5849|论文工厂、中国作者占比畸高
SCIENCE OF ADVANCED MATERIALS|1947-2935|论文工厂、中国作者占比畸高
ALTERNATIVE THERAPIES IN HEALTH AND MEDICINE|1078-6791|中国作者占比畸高
CMES-COMPUTER MODELING IN ENGINEERING & SCIENCES|1526-1492|中国作者占比畸高
EXPERIMENTAL AND THERAPEUTIC MEDICINE|1792-0981|中国作者占比畸高
FRONTIERS IN ENERGY RESEARCH|2296-598X|中国作者占比畸高
MATHEMATICAL BIOSCIENCES AND ENGINEERING|1547-1063|中国作者占比畸高
TROPICAL JOURNAL OF PHARMACEUTICAL RESEARCH|1596-5996|中国作者占比畸高"""

# name | ISSN (where the sources give one) | reason
E2025 = """Wireless Personal Communications|0929-6212|论文工厂
Natural Resources Forum|0165-0203|论文工厂
Computers & Electrical Engineering||论文工厂
Numerical Heat Transfer Part A-Applications||论文工厂
Scalable Computing-Practice and Experience|1895-1767|论文工厂"""


def aliases(name):
    """Web of Science style suffixes (-Basel, -US, -Resources) are not part of the journal's own title."""
    out = []
    m = re.match(r"^(.*?)-(basel|us|resources)$", name, re.I)
    if m:
        out.append(m.group(1))
    return out


def entries(year, text, level=False, issn=False):
    out = []
    for line in text.splitlines():
        p = line.split("|")
        e = {"name": p[0].strip(), "year": year}
        if level:
            e["level"] = LEVEL[p[1].strip()]
        elif issn:
            e["issn"] = [p[1].strip()] if p[1].strip() else []
            e["reason"] = p[2].strip()
        a = aliases(e["name"])
        if a:
            e["aliases"] = a
        out.append(e)
    return out


items = (entries(2020, E2020, level=True) + entries(2021, E2021, level=True) + entries(2023, E2023, level=True)
         + entries(2024, E2024, issn=True) + entries(2025, E2025, issn=True))
doc = {
    "label": "中科院文獻情報中心：國際期刊預警名單（2020、2021、2023、2024、2025 版）",
    "url": "https://ewl.fenqubiao.com/#/en/early-warning-journal-list-2025",
    "editions": {"2020": 65, "2021": 35, "2023": 28, "2024": 24, "2025": 5},
    "note": "2022 年沒有發布。2020、2021 版名單標示高、中、低三級；2024 版起列出預警原因，2025 版不再分級。",
    "provenance": "名稱轉錄自轉載頁面與二手來源，官方網站當時連不上；使用前請到官方網站核對。",
    "items": items,
}
assert [len([i for i in items if i["year"] == y]) for y in (2020, 2021, 2023, 2024, 2025)] == [65, 35, 28, 24, 5]
with open(os.path.join(HERE, "data", "cas_ewl.json"), "w", encoding="utf-8") as f:
    json.dump(doc, f, ensure_ascii=False, indent=1)
print("wrote data/cas_ewl.json", len(items), "entries")
