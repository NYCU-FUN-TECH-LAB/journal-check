# journal-check：期刊三不原則比對器

Check a journal against the lab's three rules: not a mega journal, not predatory, not MDPI.
輸入期刊名稱、ISSN 或網址，比對它是否為**巨錄期刊**、**掠奪期刊**，或 **MDPI** 出版，報告會列出是在哪一份名單被查到。

網頁：https://（你的組織名）.github.io/journal-check/

## 三不原則與比對的名單

| 原則 | 比對的名單 |
|---|---|
| 1. 不是巨錄 | Wikipedia「Mega journal」條目的 List of mega journals |
| 2. 不是掠奪 | Beall's List 的 Publishers、Standalone Journals、Hijacked Journals |
| 3. 不是爭議（MDPI） | 出版者是否為 MDPI、網址是否在 mdpi.com、ISSN 或名稱是否在 Wikipedia 的 List of MDPI academic journals；報告附 Wikipedia MDPI 條目「Controversies」的小節標題 |
| 輔助參考（不列入判定） | 中科院國際期刊預警名單（2020、2021、2023、2024、2025 版）；DOAJ 除名紀錄（2024 年 2 月起）；DOAJ 目前收錄狀態（即時查詢） |

期刊的出版者與 ISSN 取自 OpenAlex；OpenAlex 免費額度用完時自動改用 Crossref。

## 結果的意思

- **被列入**：名稱、ISSN 或網址和名單上的條目相同。
- **需確認**：名稱很像、或名稱太短無法確定是同一本，要點連結核對。
- **未列出**：這幾份名單裡沒有找到。**這不等於通過**：Wikipedia 的巨錄名單只列代表性例子，Beall's List 是封存名單，最後仍需人工判斷。

## 架構

```
index.html        頁面（純靜態，沒有後端）
match.js          比對邏輯（瀏覽器與 Node 共用）
data/lists.json   名單資料（由 build_data.py 產生，每週自動更新）
data/cas_ewl.json 中科院預警名單（由 make_cas_ewl.py 產生，新版本出來時手動更新）
build_data.py     抓取名單並寫出 lists.json
make_cas_ewl.py   寫出 cas_ewl.json
tests/            比對邏輯的測試（node tests/test_match.js）
.github/workflows/update-lists.yml   每週一自動更新名單並重跑測試
```

Beall's List 網站不允許跨網站直接讀取，所以名單由 GitHub Actions 定期抓成 `data/lists.json`，頁面只讀這個檔案。

## 發布到 GitHub Pages

1. 在實驗室的 GitHub 組織建立公開儲存庫 `journal-check`，把這個資料夾的內容推上去（包含隱藏的 `.github` 資料夾）。
2. Settings → Pages → Source 選 `Deploy from a branch`，Branch 選 `main`、資料夾 `/ (root)`。
3. Settings → Actions → General → Workflow permissions 選 `Read and write permissions`（讓每週更新能存檔）。
4. Actions 分頁手動執行一次 `Update journal lists`，確認成功。

## 本機試用

```bash
python -m http.server 8765
# 瀏覽器開 http://127.0.0.1:8765/
```

直接用檔案方式（file://）開啟讀不到 `data/lists.json`，要用上面的小伺服器或 GitHub Pages。

## 更新名單

```bash
pip install requests beautifulsoup4 openpyxl
python build_data.py
node tests/test_match.js
```

## 已知限制

- **OpenAlex 免費額度**是同一個網路位址共用，每天約 100 次查詢，學校網路很容易用完。用完時工具自動改用 Crossref（沒有網址與論文數，網址比對會少一種）。查很多本時，到 openalex.org/settings/api 申請免費金鑰，貼在頁面的「進階」欄位。
- 名稱比對只認「相同」和很接近的拼法；縮寫（如 J. Technol. Transf.）要先查出全名。
- 中科院預警名單是依轉載頁面轉錄的（官方網站 ewl.fenqubiao.com 當時連不上），使用前請到官方網站核對。2026 年起中科院的預警機制是否仍以名單形式發布，請自行確認。
- DOAJ 的除名紀錄是事件紀錄，只涵蓋 2024 年 2 月之後，不一定反映期刊現況。
- 還沒納入的名單：Cabells、2024 年 2 月以前的 DOAJ 除名紀錄。

## 資料來源與授權

- Wikipedia 的條目與清單：CC BY-SA 4.0。
- DOAJ 的變更紀錄：CC BY-SA 4.0（DOAJ 使用條款）。
- Beall's List（beallslist.net）：只收錄名單上的名稱與網址，連結回原站；該網站未見明確授權條款，請勿視為本專案授權的一部分。
- 中科院國際期刊預警名單：只收錄期刊名稱、等級與原因。
- 程式碼的授權請由建立儲存庫時選擇（建議與 TACIT 一致，用 MIT）。
