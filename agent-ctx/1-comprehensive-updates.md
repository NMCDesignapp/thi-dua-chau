# Task: Comprehensive Updates to page.tsx and Backend

## Summary
Made comprehensive updates to the Next.js contest bonus calculator application, including adding the `tinhLuot` field, fixing Lượt calculations, restructuring the result table, and implementing TVVm filtering for NYD.

## Changes Made

### 1. Added `tinhLuot` field (column 27) to all layers
- **Contract interface** (page.tsx): Added `tinhLuot: number;`
- **Prisma schema** (schema.prisma): Added `tinhLuot Float @default(0)` + switched from PostgreSQL to SQLite
- **Setup migration** (api/setup/route.ts): Added ALTER TABLE for tinhLuot, updated SQL for SQLite compatibility
- **Seed route** (api/seed/route.ts): Parse column 27 as tinhLuotStr, add to contracts.push
- **Contracts API** (api/contracts/route.ts): Added tinhLuot to POST handler

### 2. Fixed Lượt Calculation
- Changed from computing activity rounds by summing FYP per agent to using `tinhLuot` value (column 27)
- For each agent in a group, takes max tinhLuot and checks against threshold (3M or 12M)
- If tinhLuot >= threshold, counts as 1 lượt

### 3. Added leaderCode to GroupData and fixed leader detection
- Leader detection now includes both "trưởng ban" and "trưởng nhóm"
- `leaderCode` field added and populated with the leader's agent code

### 4. Completely rewrote result table
- **NHÓM mode**: Columns STT | Nhóm | Mã Số | Họ tên TN/TB | Metric (LƯỢT HĐ/TỔNG IP) | Tiền Thưởng | Ghi chú
- **TVV mode**: Columns STT | Nhóm | Mã Số | Họ Tên | Chức Vụ | [Số HĐ] | Metric | Tiền Thưởng | Ghi chú
- **NYD mode**: Columns STT | Nhóm | Mã Số | Họ Tên | Chức Vụ | Metric | Tiền Thưởng | Ghi chú
- Headers UPPERCASE, BOLD, CENTER-ALIGNED with dark emerald/teal gradient
- Date range subtitle in italic small under metric columns

### 5. Participant List - Shows ALL participants even without data
- TVV: Shows all participants from the list, with empty values for those without matching data
- NYD: Shows all participants, with empty values for those not found as NYD
- NHÓM: Added `groupedDataFiltered` that includes groups from participant list even without data

### 6. Per-contract mode for TVV
- When conditionType is 'per_contract': each row is a single contract, includes Số HĐ column
- When not per_contract: aggregates by agent, shows Tổng IP per agent, no Số HĐ column

### 7. Updated exports (CSV/Excel/Copy)
- All export functions now match the new table column structure
- Includes Mã Số, Chức Vụ, Số HĐ (when applicable), and Ghi chú columns

### 8. TVVm definition for NYD
- Added `isTVVm()` function: TVV whose startDate is within 12 months of current date
- NYD data computation now filters recruits by TVVm only
- Stored recruitedContracts as TVVm-only contracts

### 9. Other improvements
- Added `formatShortDate()` for DD/MM format in date range subtitles
- Added `tinhLuot` field to new contract dialog
- Added "Tính Lượt" column to source data table
- Updated import dialog to mention TÍNH LƯỢT column
