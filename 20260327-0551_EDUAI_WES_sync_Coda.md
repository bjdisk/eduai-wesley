# 20260327-0551 | EDUAI_WES | sync | Coda

**專案**：EduAI Wesley
**分支**：`claude/review-index-file-pMFWl`
**寫入者**：Coda（Claude Code, claude-opus-4-6）
**Session 範圍**：2026-03-27
**最終 merge commit**：本地 main 已 merge，遠端 push 待人工執行（403 限制）

---

## Commit 紀錄

| Commit | 類型 | 摘要 |
|---|---|---|
| `d82b81a` | feat | Dark Shield v3 — 深層安全與創傷防護協議（system prompt） |
| `cd317da` | feat | Dark Shield v3 — `[PARENT_REVIEW]` 前端淨化；alertEmail 初版（後移除） |
| `240d3ff` | feat | Prompt Caching TTL 1hr + `cache_hit_tokens` telemetry |
| `adf5505` | refactor | 移除 alertEmail / IMMEDIATE_ATTENTION（暫緩，待偵測機制一併實作） |
| `2d86802` | fix | Integrity 修復批次（見下方詳細） |

---

## 本次 Session 修改詳情

### 1. Dark Shield v3 — 前端淨化 `api/chat.js`

- Claude 回傳的 raw text 在送回前端前，先以 regex 剝除所有 `[PARENT_REVIEW:...]` 標籤
- Wesley 看到乾淨的 Wes 回應，系統標記不外洩
- **狀態**：已上線

```js
// api/chat.js
const sanitizedText = rawText
  ? rawText.replace(/\s*\[PARENT_REVIEW:[^\]]*\]/gi, '').trim()
  : null;
```

---

### 2. Prompt Caching 升級 `api/chat.js`

| 項目 | 前 | 後 |
|---|---|---|
| `cache_control` TTL | 預設 5 分鐘 | `ttl: 3600`（1 小時） |
| telemetry cache 命中 | 未記錄 | `cache_hit_tokens` 欄位加入 payload |

- GAS 端可用 `cache_hit_tokens / tokens_used` 計算月命中率，驗算 ~$3–5/月成本估算

---

### 3. alertEmail 暫緩移除 `api/chat.js`

- `sendTelemetry` 移除 `alertEmail` 參數及 `IMMEDIATE_ATTENTION` block
- handler 移除 `hasAlert` / `alertEmail` 暫存變數
- **後續計畫**：與危機偵測分級機制（structured outputs）一併設計，再接回通報流程

---

### 4. Integrity 修復批次 `api/chat.js` + `index.html` + `sw.js`

#### P0 — 父端 PARENT_REVIEW 旗標恢復（功能斷裂修復）

**問題根因**：backend 淨化後前端 `checkForFlags()` 的 regex 永遠 match 不到。
**修復方式**：後端在淨化前提取 flags 陣列，API 回傳 `{ text, flags[] }`；前端直接消費。

```js
// api/chat.js — 淨化前先提取
const flagMatches = rawText
  ? [...rawText.matchAll(/\[PARENT_REVIEW:([^\]]*)\]/gi)].map(m => m[1].trim()).filter(Boolean)
  : [];
return res.status(200).json({ text: sanitizedText, flags: flagMatches });

// index.html — callClaude 回傳物件
if (data.text) return { text: data.text, flags: data.flags || [] };

// index.html — checkForFlags 改接陣列
function checkForFlags(flags, userMsg) {
  if (!flags || flags.length === 0) return;
  ...
}
```

#### P1-2 — 開場問候推入 `messages[]`

**問題**：`sendOpeningGreeting()` 用獨立陣列呼叫 API，不推入全域 `messages[]`，Claude 後續看不到自己的開場白。
**修復**：將 `greetingMsg` + assistant response 推入全域 `messages[]`。

#### P1-6 — Service Worker POST 快取過濾

**問題**：`sw.js` 對所有請求呼叫 `cache.put()`，POST 請求（spec 限制）會產生靜默 unhandled rejection。
**修復**：加 `if (e.request.method === 'GET')` 條件。

#### P2-7 — 移除前端重複 `[PARENT_REVIEW]` 剝除

Backend 已保證淨化，以下兩處變為冗餘，一併清除：
- `stripSystemTags()` 中的 PARENT_REVIEW regex
- `speakText()` 內部的 PARENT_REVIEW replace

#### P2-8 — 移除 `getBestVoice()` dead code

函式定義存在（`index.html:1627`）但從未被呼叫，實際 voice selection 在 `speakText()` 內 inline 完成。

#### Security — 移除 `wes2025` hardcoded admin key

**問題**：`wes2025` 明文寫在 `index.html`，View Source 即可取得。
**修復**：移除整個 `wes2025` 分支；admin 開啟統一透過 `leonpapa` 登入觸發。
**保留**：logo 5 連點可「關閉」admin 模式（不需輸入 key）。

---

## 架構現況 API Contract

```
POST /api/chat
  Request:  { messages: Array, accessCode: string }
  Response: { text: string, flags: string[] }
            flags = [] 正常對話
            flags = ["深層情緒與人際邊界探索"] 等 安全警報觸發
  Error:    { error: string }
```

---

## 待辦事項（後續 Session）

| 優先 | 項目 | 說明 |
|---|---|---|
| 🔴 | 緊急通報機制 | alertEmail + IMMEDIATE_ATTENTION 與危機偵測分級（structured outputs）一併設計 |
| 🟡 | Liferry structured outputs | 危機偵測 green/yellow/orange/red 分級評估（需 Sonnet 4.5+，beta header required） |
| 🟡 | `messages[]` sliding window | Admin 長 session 可能撞 context limit，建議加最近 N 輪上限 |
| 🟢 | Context Compaction | 追蹤 GA，評估是否簡化 system prompt 架構 |
| 🟢 | Files API（Liferry） | 危機紀錄快照非同步存取，確認台灣資料主權相容性 |

---

## 環境變數現況（Vercel）

| 變數 | 用途 | 狀態 |
|---|---|---|
| `ANTHROPIC_API_KEY` | Claude API 金鑰 | ✅ 必要 |
| `SHEET_WEBHOOK_URL` | Google Sheet 遙測 webhook | ✅ 選用 |
| `EMERGENCY_EMAIL` | 緊急通報 email | ⏳ 暫緩設定，待偵測機制完成 |
