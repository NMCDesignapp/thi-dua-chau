# Worklog: Insurance Sales Competition Bonus Calculation App - Critical Fixes

## Date: 2025-03-04

### Summary of All Changes Made to `/home/z/my-project/src/app/page.tsx`

---

### 1. Fix Lượt Hoạt Động Calculation Logic (CRITICAL)

**Problem:** The lượt calculation for nhóm scope was wrong - it only used `filteredContracts` and didn't count all members including the leader.

**Fix:** Replaced the groupedData calculation block (lines ~377-391) to:
- Use ALL `contracts` (not just `filteredContracts`) to find all unique agents in each nhóm
- Iterate over `contracts` filtered by `c.nhom !== g.nhom` to find all members in each group
- Count all agents (including leader) where `maxTinhLuot >= ipThreshold`
- Added `startDate` tracking per agent for TVVm filtering
- Applied TVVm filter (`useTVVm`) when the checkbox is checked

**Code change:** The `agentTinhLuotMap` now stores `{ maxTinhLuot: number; startDate: string | null }` per agent, uses ALL contracts instead of just the group's filtered contracts, and applies the TVVm filter.

---

### 2. Add TVVm Checkbox Toggle (HIGH PRIORITY)

**What was added:**
- New state: `const [useTVVm, setUseTVVm] = useState(false);` (after line 219)
- Checkbox UI component shown when:
  - `targetType === 'tvv'` AND `isActivityRoundMode(conditionType)`
  - `targetType === 'nhom'` AND `isActivityRoundMode(conditionType)`
- Styled with orange theme (`border-orange-200 bg-orange-50/50`) to match the activity round styling
- Label: "Chỉ tính TVVm (TVV mới ≤ 12 tháng)"

**TVVm filter behavior:**
- When checked for **nhóm**: only counts TVVm members toward the lượt count (in groupedData calculation)
- When checked for **TVV**: only shows TVVm agents in the results (in tvvRows calculation)

---

### 3. Fix NHÓM Column Color in Detail Table

**Problem:** The Nhóm column cells had `text-emerald-700 font-semibold` which looked different from other columns.

**Fix:** Changed all three occurrences to `text-gray-700 font-medium`:
- NHÓM rows: line ~1235
- NYD rows: line ~1257
- TVV rows: line ~1279

---

### 4. Remove dateRangeStr from Content Rows

**Problem:** Content rows showed `dateRangeStr` in italic gray text (`<br /><span className="text-[8px] italic text-gray-400">{dateRangeStr}</span>`).

**Fix:** Removed the dateRangeStr span from all three content row types:
- NHÓM rows (was line ~1240)
- NYD rows (was line ~1263)
- TVV rows (was line ~1290)

The date range still appears in the table header (lines ~1218, ~1222) as intended.

---

### 5. Add Visual Distinction for Detail Table

**Changes made to the detail table card:**
- Stronger shadow: `shadow-[0_8px_30px_rgba(0,0,0,0.12)]` (was `0.08`)
- Thicker border: `border-[3px] border-emerald-300` (was `border-2 border-emerald-200`)
- Subtle gradient background: `from-emerald-50 via-white to-teal-50` (was `from-emerald-50 to-teal-50`)

---

### 6. Shrink/Hide Preview Poster at Top

**Problem:** The standalone ContestPoster preview at the top of the results was not used much.

**Fix:** Changed it to only show when there are no results (`!hasResults`). When results are computed, the preview poster is hidden since the ContestPoster is already rendered inside the results block. This makes the page cleaner and shows results faster.

---

### 7. Fixed Table Header on Scroll

**Changes:**
- Added `max-h-[70vh] overflow-y-auto` to the table container div
- Added `sticky top-0 z-10` to the `<thead>` element

This ensures table headers stay visible while scrolling through many rows.

---

### 8. Input Units Already in Ngàn Đồng (VERIFIED)

**Status:** Already correctly implemented. Labels say:
- "IP từ (ngàn)" / "IP đến (ngàn)"
- "Thưởng (ngàn)" / "Tiền/lượt (ngàn)"
- `vndToNgan()` and `nganToVnd()` conversion functions are properly used

No changes needed.

---

### Lint Status
All changes pass ESLint with no errors.
