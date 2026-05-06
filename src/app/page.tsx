'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import {
  Plus, Trash2, Search, CalendarDays, Trophy, FileText, TrendingUp, Database,
  Download, X, RefreshCw, Link, Loader2, Printer, Copy, Save, BookmarkPlus,
  Star, Sparkles, Target, Award, Users, Banknote, CalendarRange, Zap, Gift,
  UserCheck, Percent, Image as ImageIcon, ChevronDown, ChevronUp, Upload,
  FileSpreadsheet, UserPlus, ListChecks, UserCog,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { toBlob } from 'html-to-image';

// ─── Interfaces ────────────────────────────────────────────────────────────────

interface Contract {
  id: string; contractNumber: string; agentCode: string; agentName: string;
  position: string; ban: string; nhom: string; maNhom: string;
  leaderAgentCode: string; recruiterCode: string; startDate: string | null;
  effectiveDate: string; issueDate: string; fyp: number; afyp: number;
  tinhLuot: number;
}

interface BonusTier {
  id: string; minFYP: number; maxFYP: number | null; bonusAmount: number;
  bonusType: 'money' | 'gift' | 'percent' | 'money_per_round'; bonusText: string; bonusPercent: number;
}

interface GroupData {
  nhom: string; leaderName: string; leaderCode: string; totalFYP: number;
  contractCount: number; activityRounds: number; contracts: Contract[];
}

interface NYDData {
  agentCode: string; agentName: string; nhom: string; position: string;
  recruitCount: number; recruitFYP: number; recruitedContracts: Contract[];
  ownFYP?: number; ownActivity?: number;
}

interface Participant {
  id: string; nhom: string; maSo: string; hoTen: string;
}

interface SavedContest {
  id: string; title: string; startDate: string; endDate: string;
  issueDate: string | null; conditionType: string; targetType: string;
  bonusTiers: string; participants: string; createdAt: string; updatedAt: string;
}

type ConditionType = 'per_contract' | 'total_fyp' | 'activity_round' | 'activity_round_standard' | 'nyd_activity' | 'nyd_fyp';
type TargetType = 'tvv' | 'nhom' | 'nyd';

function isActivityRoundMode(ct: ConditionType): boolean {
  return ct === 'activity_round' || ct === 'activity_round_standard';
}
function isNYDMode(ct: ConditionType): boolean {
  return ct === 'nyd_activity' || ct === 'nyd_fyp';
}

const DEFAULT_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vStQqbaHb_1aP-hMzZCiVoeaSobXV5gwqw6iZBoQ0MgpsXiobO1GdCM5zoCoCxVBtxT_Nujjll_MJmC/pub?output=csv';

// ─── Formatters ────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(amount);
}
function formatNumber(amount: number): string { return new Intl.NumberFormat('vi-VN').format(amount); }
function formatDate(dateStr: string): string { return new Date(dateStr).toLocaleDateString('vi-VN'); }
function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function nganToVnd(val: number): number { return val * 1_000; }
function vndToNgan(val: number): number { return val / 1_000; }
function trieuToVnd(val: number): number { return val * 1_000_000; }
function vndToTrieu(val: number): number { return val / 1_000_000; }

function isTVVm(contract: Contract): boolean {
  if (!contract.startDate) return false;
  const start = new Date(contract.startDate);
  const now = new Date();
  const monthsDiff = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  return monthsDiff <= 12;
}

function formatBonus(tier: BonusTier, fyp?: number, rounds?: number): string {
  if (tier.bonusType === 'gift' && tier.bonusText) return tier.bonusText;
  if (tier.bonusType === 'percent' && tier.bonusPercent > 0) {
    const calculated = fyp ? tier.bonusPercent / 100 * fyp : 0;
    return fyp ? formatCurrency(calculated) : `${tier.bonusPercent}% IP`;
  }
  if (tier.bonusType === 'money_per_round') {
    const r = rounds || 0;
    const calculated = tier.bonusAmount * r;
    return r > 0 ? formatCurrency(calculated) : formatCurrency(0);
  }
  return formatCurrency(tier.bonusAmount);
}

function getConditionLabel(ct: ConditionType): string {
  switch (ct) {
    case 'per_contract': return 'Theo HĐ';
    case 'total_fyp': return 'Tổng IP';
    case 'activity_round': return 'Lượt HĐ';
    case 'activity_round_standard': return 'Lượt HĐ Chuẩn';
    case 'nyd_activity': return 'Lượt TVVm HĐ';
    case 'nyd_fyp': return 'FYP TVVm';
    default: return '';
  }
}

// ─── ContestPoster Component ───────────────────────────────────────────────────

function ContestPoster({ contestTitle, startDate, endDate, conditionType, targetType, sortedTiers, filteredContracts, groupedData, nydData, totalFYP, totalBonus, achievedCount, notAchievedCount, formatCurrency: fc, formatNumber: fn, formatDate: fd, isPreview = false }: {
  contestTitle: string; startDate: string; endDate: string; conditionType: ConditionType;
  targetType: TargetType; sortedTiers: BonusTier[]; filteredContracts: Contract[];
  groupedData: GroupData[]; nydData: NYDData[]; totalFYP: number; totalBonus: number;
  achievedCount: number; notAchievedCount: number;
  formatCurrency: (n: number) => string; formatNumber: (n: number) => string;
  formatDate: (d: string) => string; isPreview?: boolean;
}) {
  const rowCount = targetType === 'nhom' ? groupedData.length : targetType === 'nyd' ? nydData.length : filteredContracts.length;
  const hasData = rowCount > 0;
  const achievementPercent = hasData ? Math.round((achievedCount / rowCount) * 100) : 0;
  const tierColors = ['from-amber-400 to-orange-500','from-emerald-400 to-teal-500','from-sky-400 to-cyan-500','from-violet-400 to-purple-500','from-rose-400 to-pink-500','from-lime-400 to-green-500'];

  const targetLabel = targetType === 'tvv' ? (<><Users className="w-3 h-3" /> TVV</>) : targetType === 'nyd' ? (<><UserCog className="w-3 h-3" /> NYD</>) : (<><UserCheck className="w-3 h-3" /> Nhóm</>);
  const rowLabel = targetType === 'nhom' ? 'Nhóm' : targetType === 'nyd' ? 'NYD' : 'HĐ';

  return (
    <div className={`relative overflow-hidden rounded-2xl ${isPreview ? 'border-2 border-emerald-200' : ''}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-700 via-teal-700 to-emerald-900" />
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.15) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.1) 0%, transparent 40%)' }} />
      <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-amber-400/20 to-transparent rounded-bl-full" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-teal-300/15 to-transparent rounded-tr-full" />
      <div className="relative z-10 p-4 sm:p-5">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg flex-shrink-0">
            <Trophy className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base sm:text-lg font-extrabold text-white tracking-wide leading-tight break-words">{contestTitle || 'CHƯƠNG TRÌNH THI ĐUA'}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <div className="flex items-center gap-1 text-emerald-200 text-xs"><CalendarRange className="w-3 h-3" /><span>{startDate ? fd(startDate) : '...'} — {endDate ? fd(endDate) : '...'}</span></div>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-white/15 text-emerald-100"><Target className="w-3 h-3" />{getConditionLabel(conditionType)}</span>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-white/15 text-sky-100">{targetLabel}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 mb-3 scrollbar-none">
          {sortedTiers.map((tier, i) => (
            <div key={tier.id} className={`flex-shrink-0 rounded-lg px-2.5 py-1.5 bg-gradient-to-br ${tierColors[i % tierColors.length]} text-white min-w-[100px] shadow-md`}>
              <div className="flex items-center gap-1 mb-0.5">{tier.bonusType === 'gift' ? <Gift className="w-3 h-3 opacity-80" /> : tier.bonusType === 'percent' ? <Percent className="w-3 h-3 opacity-80" /> : tier.bonusType === 'money_per_round' ? <Zap className="w-3 h-3 opacity-80" /> : <Sparkles className="w-3 h-3 opacity-80" />}<span className="text-[9px] font-bold uppercase opacity-90">Mức {i + 1}</span></div>
              <div className="text-[10px] font-semibold leading-tight">{isActivityRoundMode(conditionType) || conditionType === 'nyd_activity' ? `${tier.minFYP}${tier.maxFYP ? ` - ${tier.maxFYP}` : ' ↑'} lượt` : `${fc(tier.minFYP)}${tier.maxFYP ? ` - ${fc(tier.maxFYP)}` : ' ↑'}`}</div>
              <div className="text-xs font-extrabold mt-0.5 truncate" title={formatBonus(tier)}>{formatBonus(tier)}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2 text-center border border-white/10"><div className="flex items-center justify-center gap-1 mb-0.5"><FileText className="w-3 h-3 text-emerald-300" /><span className="text-[9px] text-emerald-300 uppercase">{rowLabel}</span></div><p className="text-lg font-extrabold text-white">{hasData ? rowCount : '—'}</p></div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2 text-center border border-white/10"><div className="flex items-center justify-center gap-1 mb-0.5"><Banknote className="w-3 h-3 text-amber-300" /><span className="text-[9px] text-amber-300 uppercase">Tổng IP</span></div><p className="text-sm font-extrabold text-amber-200">{hasData ? fc(totalFYP) : '—'}</p></div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2 text-center border border-white/10"><div className="flex items-center justify-center gap-1 mb-0.5"><Users className="w-3 h-3 text-sky-300" /><span className="text-[9px] text-sky-300 uppercase">Đạt/Chưa</span></div><p className="text-lg font-extrabold">{hasData ? <><span className="text-emerald-300">{achievedCount}</span><span className="text-white/40 mx-0.5">/</span><span className="text-red-300">{notAchievedCount}</span></> : <span className="text-white/40">—</span>}</p></div>
          <div className="bg-gradient-to-br from-amber-500/30 to-orange-500/20 backdrop-blur-sm rounded-lg p-2 text-center border border-amber-400/30"><div className="flex items-center justify-center gap-1 mb-0.5"><Award className="w-3 h-3 text-amber-200" /><span className="text-[9px] text-amber-200 uppercase">Tổng Thưởng</span></div><p className="text-sm font-extrabold text-amber-100">{hasData ? fc(totalBonus) : '—'}</p></div>
        </div>
        {hasData && (<div className="space-y-1"><div className="flex items-center justify-between text-xs"><span className="text-emerald-200 font-medium">Tỷ lệ đạt</span><span className="text-white font-bold">{achievementPercent}%</span></div><div className="relative h-2.5 bg-white/10 rounded-full overflow-hidden"><div className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-400 to-amber-400 rounded-full transition-all duration-700" style={{ width: `${achievementPercent}%` }} /><div className="absolute inset-0 flex items-center justify-center"><span className="text-[8px] font-bold text-white drop-shadow-sm">{achievedCount}/{rowCount}</span></div></div></div>)}
        {!hasData && isPreview && (<div className="text-center py-1"><p className="text-emerald-200/60 text-xs italic">Nhấn &ldquo;Tính kết quả&rdquo; để xem</p></div>)}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function Home() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [contestTitle, setContestTitle] = useState('CHƯƠNG TRÌNH THI ĐUA');
  const [conditionType, setConditionType] = useState<ConditionType>('per_contract');
  const [targetType, setTargetType] = useState<TargetType>('tvv');
  const [bonusTiers, setBonusTiers] = useState<BonusTier[]>([
    { id: crypto.randomUUID(), minFYP: 0, maxFYP: 20000000, bonusAmount: 500000, bonusType: 'money', bonusText: '', bonusPercent: 0 },
    { id: crypto.randomUUID(), minFYP: 20000000, maxFYP: 50000000, bonusAmount: 1500000, bonusType: 'money', bonusText: '', bonusPercent: 0 },
    { id: crypto.randomUUID(), minFYP: 50000000, maxFYP: 100000000, bonusAmount: 3000000, bonusType: 'money', bonusText: '', bonusPercent: 0 },
    { id: crypto.randomUUID(), minFYP: 100000000, maxFYP: null, bonusAmount: 5000000, bonusType: 'money', bonusText: '', bonusPercent: 0 },
  ]);
  // NOTE: Input displays in ngàn đồng (thousands). Internal storage in VND.
  // Default: 0-20tr, 20-50tr, 50-100tr, 100tr+ → displayed as 0-20000, 20000-50000, etc.
  const [posterUrl, setPosterUrl] = useState<string>('');
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [filteredContracts, setFilteredContracts] = useState<Contract[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [csvUrl, setCsvUrl] = useState(DEFAULT_CSV_URL);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newContract, setNewContract] = useState({ contractNumber: '', agentCode: '', agentName: '', position: '', ban: '', nhom: '', maNhom: '', leaderAgentCode: '', recruiterCode: '', startDate: '', effectiveDate: '', issueDate: '', fyp: '', afyp: '', tinhLuot: '' });
  const [savedContests, setSavedContests] = useState<SavedContest[]>([]);
  const [selectedContestId, setSelectedContestId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [showSourceData, setShowSourceData] = useState(false);
  // Participant list
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [useParticipantFilter, setUseParticipantFilter] = useState(false);
  const [showParticipantList, setShowParticipantList] = useState(false);
  // NYD
  const [includeOwnNYD, setIncludeOwnNYD] = useState(false);
  // TVVm filter
  const [useTVVm, setUseTVVm] = useState(false);
  // Hide not-achieved rows
  const [hideNotAchieved, setHideNotAchieved] = useState(false);
  // Exporting image flag (hide UI controls in export)
  const [isExporting, setIsExporting] = useState(false);
  // Refs
  const printRef = useRef<HTMLDivElement>(null);
  const shareRef = useRef<HTMLDivElement>(null);

  // ─── Poster Upload ─────────────────────────────────────────────────────────

  const handlePosterUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setPosterUrl(ev.target?.result as string); };
    reader.readAsDataURL(file);
  };

  // ─── Data Fetching ─────────────────────────────────────────────────────────

  const fetchContracts = useCallback(async () => {
    setIsLoading(true);
    try { const res = await fetch('/api/contracts'); if (res.ok) { const data = await res.json(); setContracts(data); } }
    catch { toast({ title: 'Lỗi', description: 'Không thể tải danh sách hợp đồng', variant: 'destructive' }); }
    finally { setIsLoading(false); }
  }, []);

  // Auto-setup DB schema on first load
  useEffect(() => { fetch('/api/setup').catch(() => {}); }, []);
  useEffect(() => { fetchContracts(); }, [fetchContracts]);

  const fetchSavedContests = useCallback(async () => {
    try { const res = await fetch('/api/contests'); if (res.ok) { const data = await res.json(); setSavedContests(data); } } catch { /* silent */ }
  }, []);
  useEffect(() => { fetchSavedContests(); }, [fetchSavedContests]);

  // ─── Search / Filter ───────────────────────────────────────────────────────

  const handleSearch = useCallback(() => {
    if (!startDate && !endDate) { setFilteredContracts([]); toast({ title: 'Thông báo', description: 'Vui lòng nhập ít nhất Ngày hiệu lực từ hoặc đến' }); return; }
    let results = [...contracts];
    if (startDate) { const start = new Date(startDate); results = results.filter((c) => new Date(c.effectiveDate) >= start); }
    if (endDate) { const end = new Date(endDate); end.setHours(23, 59, 59, 999); results = results.filter((c) => new Date(c.effectiveDate) <= end); }
    if (issueDate) { const issue = new Date(issueDate); issue.setHours(23, 59, 59, 999); results = results.filter((c) => new Date(c.issueDate) <= issue); }

    // Apply participant filter
    if (useParticipantFilter && participants.length > 0) {
      const allowedCodes = new Set(participants.map(p => p.maSo));
      results = results.filter((c) => allowedCodes.has(c.agentCode));
    }

    results.sort((a, b) => new Date(a.effectiveDate).getTime() - new Date(b.effectiveDate).getTime());
    setFilteredContracts(results);
    if (results.length === 0) toast({ title: 'Thông báo', description: 'Không tìm thấy hợp đồng nào phù hợp' });
    else toast({ title: 'Thành công', description: `Tìm thấy ${results.length} hợp đồng` });
  }, [startDate, endDate, issueDate, contracts, useParticipantFilter, participants]);

  const handleSearchRef = useRef(handleSearch);
  handleSearchRef.current = handleSearch;

  // ─── Bonus Calculations ────────────────────────────────────────────────────

  const calculateBonus = useCallback((fyp: number): { tier: BonusTier | null; tierIndex: number } => {
    const sortedTiers = [...bonusTiers].sort((a, b) => a.minFYP - b.minFYP);
    for (let i = sortedTiers.length - 1; i >= 0; i--) { const tier = sortedTiers[i]; if (fyp >= tier.minFYP) return { tier, tierIndex: i }; }
    return { tier: null, tierIndex: -1 };
  }, [bonusTiers]);

  const getBonusAmount = useCallback((fyp: number, rounds?: number): number => {
    const { tier } = calculateBonus(fyp); if (!tier) return 0;
    if (tier.bonusType === 'percent') return tier.bonusPercent / 100 * fyp;
    if (tier.bonusType === 'money_per_round') return tier.bonusAmount * (rounds || 0);
    return tier.bonusAmount;
  }, [calculateBonus]);

  const getRemainingToNextTier = useCallback((fyp: number): number | null => {
    const sortedTiers = [...bonusTiers].sort((a, b) => a.minFYP - b.minFYP);
    for (const tier of sortedTiers) { if (tier.minFYP > fyp) return tier.minFYP - fyp; }
    return null;
  }, [bonusTiers]);

  const calculateActivityRoundBonus = useCallback((activityRounds: number): { tier: BonusTier | null; tierIndex: number } => {
    const sortedTiers = [...bonusTiers].sort((a, b) => a.minFYP - b.minFYP);
    for (let i = sortedTiers.length - 1; i >= 0; i--) { const tier = sortedTiers[i]; if (activityRounds >= tier.minFYP) return { tier, tierIndex: i }; }
    return { tier: null, tierIndex: -1 };
  }, [bonusTiers]);

  const getActivityRoundBonusAmount = useCallback((activityRounds: number, groupTotalFYP?: number): number => {
    const { tier } = calculateActivityRoundBonus(activityRounds); if (!tier) return 0;
    if (tier.bonusType === 'money_per_round') return tier.bonusAmount * activityRounds;
    if (tier.bonusType === 'percent' && groupTotalFYP) return tier.bonusPercent / 100 * groupTotalFYP;
    return tier.bonusAmount;
  }, [calculateActivityRoundBonus]);

  const getRemainingToNextActivityRoundTier = useCallback((activityRounds: number): number | null => {
    const sortedTiers = [...bonusTiers].sort((a, b) => a.minFYP - b.minFYP);
    for (const tier of sortedTiers) { if (tier.minFYP > activityRounds) return tier.minFYP - activityRounds; }
    return null;
  }, [bonusTiers]);

  // ─── Grouped Data (Nhóm) ──────────────────────────────────────────────────

  const groupedData: GroupData[] = (() => {
    if (targetType !== 'nhom') return [];

    // Build leader lookup from ALL contracts (not just filtered) so we always find TN/TB
    // Priority: 1) leaderAgentCode from column 5, 2) position matching from column 30
    const leaderLookup = new Map<string, { leaderName: string; leaderCode: string }>();

    // Method 1: Use leaderAgentCode (column 5) - most reliable
    const nhomLeaderCodeMap = new Map<string, string>(); // nhom -> leader agent code
    for (const c of contracts) {
      if (c.leaderAgentCode && c.nhom) {
        if (!nhomLeaderCodeMap.has(c.nhom)) {
          nhomLeaderCodeMap.set(c.nhom, c.leaderAgentCode);
        }
      }
    }
    // Now look up leader name from ALL contracts using their agent code
    const agentNameLookup = new Map<string, string>();
    for (const c of contracts) {
      if (!agentNameLookup.has(c.agentCode)) {
        agentNameLookup.set(c.agentCode, c.agentName);
      }
    }
    for (const [nhom, leaderCode] of nhomLeaderCodeMap) {
      const leaderName = agentNameLookup.get(leaderCode) || '';
      leaderLookup.set(nhom, { leaderName, leaderCode });
    }

    // Method 2: Use position matching as fallback - search ALL contracts
    for (const c of contracts) {
      const pos = (c.position || '').toLowerCase();
      if (pos.includes('trưởng ban') || pos.includes('trưởng nhóm')) {
        if (!leaderLookup.has(c.nhom)) {
          leaderLookup.set(c.nhom, { leaderName: c.agentName, leaderCode: c.agentCode });
        }
      }
    }

    // Build group data from filtered contracts
    const map = new Map<string, GroupData>();
    for (const c of filteredContracts) {
      const key = c.nhom;  // Nhóm theo MC NHÓM (column 22)
      if (!map.has(key)) {
        const leader = leaderLookup.get(key) || { leaderName: '', leaderCode: '' };
        map.set(key, { nhom: key, leaderName: leader.leaderName, leaderCode: leader.leaderCode, totalFYP: 0, contractCount: 0, activityRounds: 0, contracts: [] });
      }
      const g = map.get(key)!; g.totalFYP += c.fyp; g.contractCount += 1; g.contracts.push(c);
      // Update leader info from filtered contracts if not yet found
      if (!g.leaderName || !g.leaderCode) {
        const pos = (c.position || '').toLowerCase();
        if (pos.includes('trưởng ban') || pos.includes('trưởng nhóm')) {
          g.leaderName = c.agentName;
          g.leaderCode = c.agentCode;
        }
      }
    }

    // Also add groups that have no contracts in the date range but are in leaderLookup
    // (this ensures groups with leaders but no filtered contracts still show up if needed)

    // Fix Lượt Calculation: Use tinhLuot from column 27 instead of computing from FYP
    // For nhóm scope: count DISTINCT TVV in that nhóm where max tinhLuot >= ipThreshold
    // Each TVV counts as 1 lượt (regardless of how many contracts they have)
    // Only TVV with contracts in the selected date range are considered
    if (isActivityRoundMode(conditionType)) {
      const ipThreshold = conditionType === 'activity_round_standard' ? 12_000_000 : 3_000_000;
      for (const g of Array.from(map.values())) {
        // Use g.contracts which already contains only this nhóm's contracts from filteredContracts
        const agentTinhLuotMap = new Map<string, { maxTinhLuot: number; startDate: string | null }>();
        for (const c of g.contracts) {
          const existing = agentTinhLuotMap.get(c.agentCode);
          if (existing) {
            existing.maxTinhLuot = Math.max(existing.maxTinhLuot, c.tinhLuot);
            // Keep the most recent startDate
            if (c.startDate && (!existing.startDate || new Date(c.startDate) > new Date(existing.startDate))) {
              existing.startDate = c.startDate;
            }
          } else {
            agentTinhLuotMap.set(c.agentCode, { maxTinhLuot: c.tinhLuot, startDate: c.startDate });
          }
        }
        // Count distinct agents where max tinhLuot >= threshold → each = 1 lượt
        let rounds = 0;
        for (const [, data] of agentTinhLuotMap) {
          // Apply TVVm filter if checked
          if (useTVVm) {
            if (!data.startDate) continue;
            const start = new Date(data.startDate);
            const monthsDiff = (new Date().getFullYear() - start.getFullYear()) * 12 + (new Date().getMonth() - start.getMonth());
            if (monthsDiff > 12) continue;
          }
          if (data.maxTinhLuot >= ipThreshold) rounds++;
        }
        g.activityRounds = rounds;
      }
    }
    return Array.from(map.values());
  })();

  // ─── NHÓM with participant filter ─────────────────────────────────────────
  const groupedDataFiltered: GroupData[] = (() => {
    if (!useParticipantFilter || participants.length === 0) return groupedData;
    // Filter groupedData to only include groups that have participants from the list
    // But also include groups from the participant list even if they have no data
    const participantNhoms = new Set(participants.map(p => p.nhom).filter(n => n));
    const participantCodes = new Set(participants.map(p => p.maSo));
    
    const result: GroupData[] = [];
    const existingNhoms = new Set<string>();
    
    // First, add groups that have matching participants
    for (const g of groupedData) {
      const hasParticipant = g.contracts.some(c => participantCodes.has(c.agentCode));
      if (hasParticipant) {
        result.push(g);
        existingNhoms.add(g.nhom);
      }
    }
    
    // Then, add empty groups for participants whose nhóm doesn't have data
    for (const nhom of participantNhoms) {
      if (!existingNhoms.has(nhom)) {
        // Find leader info from participants
        const leaderP = participants.find(p => p.nhom === nhom);
        result.push({ nhom, leaderName: leaderP?.hoTen || '', leaderCode: leaderP?.maSo || '', totalFYP: 0, contractCount: 0, activityRounds: 0, contracts: [] });
      }
    }
    
    return result;
  })();

  // ─── NYD Data ─────────────────────────────────────────────────────────────

  const nydData: NYDData[] = (() => {
    if (targetType !== 'nyd') return [];
    const recruiterMap = new Map<string, NYDData>();

    // Find all NYD candidates from ALL contracts (not just filtered)
    // so we always have the NYD info even if they have no contracts in the date range
    const nydCandidates = new Map<string, { name: string; code: string; nhom: string; position: string }>();
    for (const c of contracts) {
      const pos = (c.position || '').toLowerCase();
      if (pos.includes('trưởng ban') || pos.includes('trưởng nhóm') || pos.includes('tiền trưởng nhóm')) {
        if (!nydCandidates.has(c.agentCode)) {
          nydCandidates.set(c.agentCode, { name: c.agentName, code: c.agentCode, nhom: c.nhom, position: c.position });
        }
      }
    }

    const ipThreshold = 3_000_000; // threshold for "active" TVVm

    // For each NYD, find their recruited TVVm (only TVVm = new within 12 months)
    for (const [nydCode, nydInfo] of nydCandidates) {
      const recruitedContracts = filteredContracts.filter(c => c.recruiterCode === nydCode);

      // Filter for TVVm only (TVV whose startDate is within 12 months)
      const tvvmContracts = recruitedContracts.filter(c => isTVVm(c));

      // Calculate per-agent IP (only TVVm)
      const agentIPMap = new Map<string, { totalIP: number; totalTinhLuot: number; startDate: string | null }>();
      for (const rc of tvvmContracts) {
        const existing = agentIPMap.get(rc.agentCode) || { totalIP: 0, totalTinhLuot: 0, startDate: rc.startDate };
        agentIPMap.set(rc.agentCode, { totalIP: existing.totalIP + rc.fyp, totalTinhLuot: Math.max(existing.totalTinhLuot, rc.tinhLuot), startDate: rc.startDate || existing.startDate });
      }

      let recruitCount = 0;
      let recruitFYP = 0;
      let activeRecruitCount = 0;

      for (const [, data] of agentIPMap) {
        recruitCount++;
        recruitFYP += data.totalIP;
        if (data.totalIP >= ipThreshold) activeRecruitCount++;
      }

      // If includeOwn toggle is on, add NYD's own contracts
      let ownFYP = 0;
      if (includeOwnNYD) {
        const ownContracts = filteredContracts.filter(c => c.agentCode === nydCode);
        ownFYP = ownContracts.reduce((s, c) => s + c.fyp, 0);
        recruitFYP += ownFYP;
      }

      recruiterMap.set(nydCode, {
        agentCode: nydCode,
        agentName: nydInfo.name,
        nhom: nydInfo.nhom,
        position: nydInfo.position,
        recruitCount,
        recruitFYP,
        recruitedContracts: tvvmContracts,
        ownFYP,
        ownActivity: includeOwnNYD ? 1 : 0,
      });
    }

    // Apply participant filter to NYD data - show ALL participants even without data
    let result = Array.from(recruiterMap.values());
    if (useParticipantFilter && participants.length > 0) {
      const resultWithParticipants: NYDData[] = [];
      for (const p of participants) {
        const existing = result.find(n => n.agentCode === p.maSo);
        if (existing) {
          resultWithParticipants.push(existing);
        } else {
          // Show participant with empty values
          resultWithParticipants.push({
            agentCode: p.maSo,
            agentName: p.hoTen,
            nhom: p.nhom,
            position: '',
            recruitCount: 0,
            recruitFYP: 0,
            recruitedContracts: [],
            ownFYP: 0,
            ownActivity: 0,
          });
        }
      }
      result = resultWithParticipants;
    }

    return result;
  })();

  // ─── Total FYP Bonus ──────────────────────────────────────────────────────

  const getTotalFYPBonus = useCallback((): { totalFYP: number; bonus: number; tier: BonusTier | null; remaining: number | null } => {
    const totalFYP = filteredContracts.reduce((sum, c) => sum + c.fyp, 0);
    const { tier } = calculateBonus(totalFYP); const remaining = getRemainingToNextTier(totalFYP);
    const bonus = tier ? (tier.bonusType === 'percent' ? tier.bonusPercent / 100 * totalFYP : tier.bonusAmount) : 0;
    return { totalFYP, bonus, tier, remaining };
  }, [filteredContracts, calculateBonus, getRemainingToNextTier]);

  // ─── Bonus Tier CRUD ──────────────────────────────────────────────────────

  const addBonusTier = () => setBonusTiers([...bonusTiers, { id: crypto.randomUUID(), minFYP: 0, maxFYP: null, bonusAmount: 0, bonusType: 'money', bonusText: '', bonusPercent: 0 }]);
  const removeBonusTier = (id: string) => { if (bonusTiers.length <= 1) { toast({ title: 'Thông báo', description: 'Phải có ít nhất một mức thưởng' }); return; } setBonusTiers(bonusTiers.filter((t) => t.id !== id)); };
  const updateBonusTier = (id: string, field: keyof BonusTier, value: string | number | null) => setBonusTiers(bonusTiers.map((t) => (t.id === id ? { ...t, [field]: value } : t)));

  // ─── Save/Load Contest ────────────────────────────────────────────────────

  const handleSaveContest = async () => {
    if (!contestTitle) { toast({ title: 'Lỗi', description: 'Nhập tên chương trình' }); return; }
    setIsSaving(true);
    try {
      const res = await fetch('/api/contests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: contestTitle, startDate, endDate, issueDate: issueDate || undefined, conditionType, targetType, bonusTiers: JSON.stringify(bonusTiers), participants: JSON.stringify(participants) }) });
      if (res.ok) { const data = await res.json(); toast({ title: 'Thành công', description: data.message }); fetchSavedContests(); }
      else toast({ title: 'Lỗi', description: 'Không thể lưu', variant: 'destructive' });
    } catch { toast({ title: 'Lỗi', description: 'Không thể lưu', variant: 'destructive' }); }
    finally { setIsSaving(false); }
  };

  const handleLoadContest = (contestId: string) => {
    setSelectedContestId(contestId); const contest = savedContests.find(c => c.id === contestId); if (!contest) return;
    setContestTitle(contest.title); setStartDate(new Date(contest.startDate).toISOString().slice(0, 10)); setEndDate(new Date(contest.endDate).toISOString().slice(0, 10));
    const ct = contest.conditionType as ConditionType;
    setConditionType(ct);
    const tt = (contest.targetType || 'tvv') as TargetType;
    if (isActivityRoundMode(ct)) { setTargetType('nhom'); } else if (isNYDMode(ct)) { setTargetType('nyd'); } else { setTargetType(tt); }
    if (contest.issueDate) setIssueDate(new Date(contest.issueDate).toISOString().slice(0, 10)); else setIssueDate('');
    try { const tiers = JSON.parse(contest.bonusTiers); if (Array.isArray(tiers)) setBonusTiers(tiers); } catch { /* ignore */ }
    // Restore participants
    try { const p = JSON.parse(contest.participants || '[]'); if (Array.isArray(p) && p.length > 0) { setParticipants(p); setUseParticipantFilter(true); } else { setParticipants([]); setUseParticipantFilter(false); } } catch { setParticipants([]); setUseParticipantFilter(false); }
    setTimeout(() => handleSearchRef.current(), 100);
  };

  const handleDeleteContest = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try { const res = await fetch(`/api/contests?id=${id}`, { method: 'DELETE' }); if (res.ok) { toast({ title: 'Thành công', description: 'Đã xóa' }); fetchSavedContests(); if (selectedContestId === id) setSelectedContestId(''); } }
    catch { toast({ title: 'Lỗi', description: 'Không thể xóa', variant: 'destructive' }); }
  };

  // ─── Import CSV ────────────────────────────────────────────────────────────

  const handleImportFromUrl = async () => {
    setIsImporting(true);
    try {
      const fetchRes = await fetch(`/api/import-csv?url=${encodeURIComponent(csvUrl)}`); if (!fetchRes.ok) { const errData = await fetchRes.json(); throw new Error(errData.error || 'Không thể tải CSV'); }
      const { csvData } = await fetchRes.json();
      const importRes = await fetch('/api/seed', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ csvData }) });
      if (!importRes.ok) { const errData = await importRes.json(); throw new Error(errData.error || 'Không thể nhập'); }
      const data = await importRes.json(); toast({ title: 'Thành công', description: data.message }); setIsImportDialogOpen(false); fetchContracts();
    } catch (err: unknown) { const msg = err instanceof Error ? err.message : 'Lỗi không xác định'; toast({ title: 'Lỗi nhập', description: msg, variant: 'destructive' }); }
    finally { setIsImporting(false); }
  };

  // ─── Contract CRUD ─────────────────────────────────────────────────────────

  const handleCreateContract = async () => {
    try {
      const res = await fetch('/api/contracts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...newContract, fyp: parseFloat(newContract.fyp) || 0, afyp: parseFloat(newContract.afyp) || 0, tinhLuot: parseFloat(newContract.tinhLuot) || 0, effectiveDate: newContract.effectiveDate, issueDate: newContract.issueDate || newContract.effectiveDate }) });
      if (res.ok) { toast({ title: 'Thành công', description: 'Đã tạo hợp đồng mới' }); setIsAddDialogOpen(false); setNewContract({ contractNumber: '', agentCode: '', agentName: '', position: '', ban: '', nhom: '', maNhom: '', leaderAgentCode: '', recruiterCode: '', startDate: '', effectiveDate: '', issueDate: '', fyp: '', afyp: '', tinhLuot: '' }); fetchContracts(); }
      else { const data = await res.json(); toast({ title: 'Lỗi', description: data.error || 'Không thể tạo', variant: 'destructive' }); }
    } catch { toast({ title: 'Lỗi', description: 'Không thể kết nối', variant: 'destructive' }); }
  };

  const handleDeleteContract = async (id: string) => {
    try { const res = await fetch(`/api/contracts?id=${id}`, { method: 'DELETE' }); if (res.ok) { toast({ title: 'Thành công', description: 'Đã xóa' }); fetchContracts(); setFilteredContracts((prev) => prev.filter((c) => c.id !== id)); } }
    catch { toast({ title: 'Lỗi', description: 'Không thể xóa', variant: 'destructive' }); }
  };

  // ─── Participant List ─────────────────────────────────────────────────────

  const addParticipant = () => {
    setParticipants([...participants, { id: crypto.randomUUID(), nhom: '', maSo: '', hoTen: '' }]);
  };
  const removeParticipant = (id: string) => {
    setParticipants(participants.filter(p => p.id !== id));
  };
  const updateParticipant = (id: string, field: keyof Participant, value: string) => {
    setParticipants(participants.map(p => p.id === id ? { ...p, [field]: value } : p));
  };
  const handlePasteParticipants = () => {
    navigator.clipboard.readText().then(text => {
      const lines = text.split('\n').filter(l => l.trim());
      const newParticipants: Participant[] = [];
      for (const line of lines) {
        const parts = line.split(/[\t,;]+/);
        if (parts.length >= 3) {
          newParticipants.push({ id: crypto.randomUUID(), nhom: parts[0]?.trim() || '', maSo: parts[1]?.trim() || '', hoTen: parts.slice(2).join(' ').trim() });
        } else if (parts.length >= 1 && parts[0]?.trim()) {
          newParticipants.push({ id: crypto.randomUUID(), nhom: '', maSo: parts[0]?.trim() || '', hoTen: parts[1]?.trim() || '' });
        }
      }
      if (newParticipants.length > 0) {
        setParticipants([...participants, ...newParticipants]);
        toast({ title: 'Thành công', description: `Đã thêm ${newParticipants.length} dòng` });
      } else {
        toast({ title: 'Thông báo', description: 'Không tìm thấy dữ liệu hợp lệ. Dùng định dạng: Nhóm, Mã số, Họ tên' });
      }
    }).catch(() => {
      toast({ title: 'Lỗi', description: 'Không thể đọc clipboard', variant: 'destructive' });
    });
  };

  // ─── TVV rows helper: aggregate by agent or per-contract ─────────────────

  const tvvRows: { agentCode: string; agentName: string; nhom: string; position: string; totalFYP: number; tinhLuot: number; contractCount: number; contractNumber?: string; fyp?: number; contractId?: string }[] = (() => {
    if (targetType !== 'tvv') return [];

    if (conditionType === 'per_contract') {
      // Each row is a single contract
      return filteredContracts.map(c => ({
        agentCode: c.agentCode,
        agentName: c.agentName,
        nhom: c.nhom,
        position: c.position,
        totalFYP: c.fyp,
        tinhLuot: c.tinhLuot,
        contractCount: 1,
        contractNumber: c.contractNumber,
        fyp: c.fyp,
        contractId: c.id,
      }));
    }

    // Aggregate by agent
    const agentMap = new Map<string, { agentCode: string; agentName: string; nhom: string; position: string; totalFYP: number; tinhLuot: number; contractCount: number }>();
    for (const c of filteredContracts) {
      const existing = agentMap.get(c.agentCode);
      if (existing) {
        existing.totalFYP += c.fyp;
        existing.tinhLuot = Math.max(existing.tinhLuot, c.tinhLuot);
        existing.contractCount += 1;
      } else {
        agentMap.set(c.agentCode, { agentCode: c.agentCode, agentName: c.agentName, nhom: c.nhom, position: c.position, totalFYP: c.fyp, tinhLuot: c.tinhLuot, contractCount: 1 });
      }
    }

    let result = Array.from(agentMap.values());

    // Apply TVVm filter if checked
    if (useTVVm && isActivityRoundMode(conditionType)) {
      result = result.filter(r => {
        // Find any contract for this agent to check startDate
        const agentContract = filteredContracts.find(c => c.agentCode === r.agentCode);
        return agentContract ? isTVVm(agentContract) : false;
      });
    }

    // Show ALL participants even without data when participant filter is on
    if (useParticipantFilter && participants.length > 0) {
      const resultWithParticipants: typeof result = [];
      for (const p of participants) {
        const existing = result.find(r => r.agentCode === p.maSo);
        if (existing) {
          resultWithParticipants.push(existing);
        } else {
          resultWithParticipants.push({
            agentCode: p.maSo,
            agentName: p.hoTen,
            nhom: p.nhom,
            position: '',
            totalFYP: 0,
            tinhLuot: 0,
            contractCount: 0,
          });
        }
      }
      result = resultWithParticipants;
    }

    return result;
  })();

  // ─── Print / Copy / Export ────────────────────────────────────────────────

  const handlePrint = () => {
    if (!printRef.current) return; const printWindow = window.open('', '_blank'); if (!printWindow) return;
    const styles = `<style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');@page{size:landscape;margin:10mm}*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Inter',Arial,sans-serif;padding:20px;background:white;color:#1a1a1a}table{width:100%;border-collapse:collapse;font-size:11px}th{background:#064e3b;color:white;padding:8px 6px;text-align:left;font-weight:600;font-size:11px;border-bottom:2px solid #047857}td{padding:7px 6px;border-bottom:1px solid #e5e7eb;white-space:nowrap;font-size:11px}tr:nth-child(even){background:#f9fafb}@media print{body{padding:10px}}</style>`;
    printWindow.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">${styles}</head><body>${printRef.current.innerHTML}</body></html>`);
    printWindow.document.close(); setTimeout(() => { printWindow.print(); }, 500);
  };

  const dateRangeStr = startDate && endDate ? `từ ${formatShortDate(startDate)} - đến ${formatShortDate(endDate)}` : '';

  const handleCopyText = () => {
    if (filteredContracts.length === 0 && nydData.length === 0 && groupedData.length === 0) return;
    const sortedTiers = [...bonusTiers].sort((a, b) => a.minFYP - b.minFYP);
    let text = `\u{1F3C6} ${contestTitle}\n\u{1F4C5} ${dateRangeStr || 'Từ ... đến ...'}\n\u{1F3AF} ${targetType === 'tvv' ? 'TVV' : targetType === 'nyd' ? 'NYD' : 'Nhóm'}\n━━━━━━━━━━━━━━━━━━━━\n📊 Mức thưởng:\n`;
    sortedTiers.forEach((t, i) => { text += `  Mức ${i + 1}: ${isActivityRoundMode(conditionType) || conditionType === 'nyd_activity' ? `${t.minFYP}${t.maxFYP ? ` - ${t.maxFYP}` : ' ↑'} lượt` : `${formatCurrency(t.minFYP)}${t.maxFYP ? ` - ${formatCurrency(t.maxFYP)}` : ' ↑'}`} → ${formatBonus(t)}\n`; });
    text += `━━━━━━━━━━━━━━━━━━━━\n`;

    if (targetType === 'nyd') {
      const nydBonusCalcFn = conditionType === 'nyd_activity'
        ? (n: NYDData) => calculateActivityRoundBonus(n.recruitCount).tier
        : (n: NYDData) => calculateBonus(n.recruitFYP).tier;
      [...nydData].map(n => ({ nyd: n, tier: nydBonusCalcFn(n) })).sort((a, b) => (b.tier?.bonusAmount || 0) - (a.tier?.bonusAmount || 0)).forEach(({ nyd: n, tier }, idx) => {
        const metricLabel = conditionType === 'nyd_activity' ? 'Lượt TVVm HĐ' : 'FYP TVVm';
        const metricValue = conditionType === 'nyd_activity' ? `${n.recruitCount} lượt` : formatNumber(n.recruitFYP);
        text += `${idx + 1}. ${n.nhom} | ${n.agentCode} | ${n.agentName} | ${n.position} | ${metricLabel}: ${metricValue} | ${tier ? `Thưởng: ${formatBonus(tier, n.recruitFYP, n.recruitCount)}` : 'Chưa đạt'}\n`;
      });
    } else if (targetType === 'nhom') {
      const nhomSortFn = isActivityRoundMode(conditionType)
        ? (g: GroupData) => ({ tier: calculateActivityRoundBonus(g.activityRounds).tier, sortKey: g.activityRounds })
        : (g: GroupData) => ({ tier: calculateBonus(g.totalFYP).tier, sortKey: g.totalFYP });
      [...groupedDataFiltered].map(g => ({ group: g, ...nhomSortFn(g) })).sort((a, b) => (b.tier?.bonusAmount || 0) - (a.tier?.bonusAmount || 0)).forEach(({ group: g, tier }, idx) => {
        const metricLabel = isActivityRoundMode(conditionType) ? (conditionType === 'activity_round_standard' ? 'Lượt HĐ Chuẩn' : 'Lượt HĐ') : 'Tổng IP';
        const metricValue = isActivityRoundMode(conditionType) ? `${g.activityRounds} lượt` : formatNumber(g.totalFYP);
        text += `${idx + 1}. ${g.nhom} | ${g.leaderCode} | ${g.leaderName || g.nhom} | ${metricLabel}: ${metricValue} | ${tier ? `Thưởng: ${formatBonus(tier, g.totalFYP, g.activityRounds)}` : 'Chưa đạt'}\n`;
      });
    } else {
      // TVV
      tvvRows.forEach((row, idx) => {
        const metricLabel = conditionType === 'per_contract' ? 'IP' : conditionType === 'total_fyp' ? 'Tổng IP' : isActivityRoundMode(conditionType) ? 'Lượt HĐ' : 'IP';
        const metricValue = conditionType === 'per_contract' ? formatNumber(row.totalFYP) : conditionType === 'total_fyp' ? formatNumber(row.totalFYP) : isActivityRoundMode(conditionType) ? `${row.tinhLuot >= 3000000 ? 1 : 0} lượt` : formatNumber(row.totalFYP);
        const soHD = conditionType === 'per_contract' ? ` | Số HĐ: ${row.contractNumber}` : '';
        const tier = conditionType === 'per_contract' ? calculateBonus(row.totalFYP).tier : calculateBonus(row.totalFYP).tier;
        text += `${idx + 1}. ${row.nhom} | ${row.agentCode} | ${row.agentName} | ${row.position}${soHD} | ${metricLabel}: ${metricValue} | ${tier ? `Thưởng: ${formatBonus(tier, row.totalFYP)}` : 'Chưa đạt'}\n`;
      });
    }
    navigator.clipboard.writeText(text).then(() => toast({ title: 'Đã sao chép!', description: 'Dán vào Zalo/Telegram' })).catch(() => toast({ title: 'Lỗi', description: 'Không thể sao chép', variant: 'destructive' }));
  };

  const handleExportCSV = () => {
    if (filteredContracts.length === 0 && nydData.length === 0 && groupedData.length === 0) { toast({ title: 'Thông báo', description: 'Không có dữ liệu' }); return; }
    let headers: string[];
    let rows: (string | number)[][];

    if (targetType === 'nyd') {
      headers = ['STT', 'Nhóm', 'Mã Số', 'Họ Tên', 'Chức Vụ', conditionType === 'nyd_activity' ? 'Lượt TVVm HĐ' : 'FYP TVVm', 'Tiền Thưởng', 'Ghi chú'];
      const nydBonusCalcFn = conditionType === 'nyd_activity'
        ? (n: NYDData) => calculateActivityRoundBonus(n.recruitCount).tier
        : (n: NYDData) => calculateBonus(n.recruitFYP).tier;
      rows = [...nydData].map(n => ({ nyd: n, tier: nydBonusCalcFn(n) })).sort((a, b) => (b.tier?.bonusAmount || 0) - (a.tier?.bonusAmount || 0)).map(({ nyd: n, tier }, idx) => [
        idx + 1, n.nhom, n.agentCode, n.agentName, n.position, conditionType === 'nyd_activity' ? n.recruitCount : n.recruitFYP, tier ? formatBonus(tier, n.recruitFYP, n.recruitCount) : '', tier ? '' : 'Chưa đạt mức'
      ]);
    } else if (targetType === 'nhom') {
      headers = ['STT', 'Nhóm', 'Mã Số', 'Họ tên TN/TB', isActivityRoundMode(conditionType) ? (conditionType === 'activity_round_standard' ? 'LƯỢT HĐ CHUẨN' : 'LƯỢT HĐ') : 'TỔNG IP', 'Tiền Thưởng', 'Ghi chú'];
      rows = [...groupedDataFiltered].map((g) => { const { tier } = isActivityRoundMode(conditionType) ? calculateActivityRoundBonus(g.activityRounds) : calculateBonus(g.totalFYP); return { g, tier }; }).sort((a, b) => (b.tier?.bonusAmount || 0) - (a.tier?.bonusAmount || 0)).map(({ g, tier }, idx) => [
        idx + 1, g.nhom, g.leaderCode, g.leaderName || g.nhom, isActivityRoundMode(conditionType) ? g.activityRounds : g.totalFYP, tier ? formatBonus(tier, g.totalFYP, g.activityRounds) : '', tier ? '' : 'Chưa đạt mức'
      ]);
    } else {
      // TVV
      const isPerContract = conditionType === 'per_contract';
      headers = ['STT', 'Nhóm', 'Mã Số', 'Họ Tên', 'Chức Vụ', ...(isPerContract ? ['Số HĐ'] : []), isPerContract ? 'IP' : conditionType === 'total_fyp' ? 'TỔNG IP' : 'IP', 'Tiền Thưởng', 'Ghi chú'];
      rows = tvvRows.map((row) => {
        const tier = calculateBonus(row.totalFYP).tier;
        return { row, tier };
      }).sort((a, b) => (b.tier?.bonusAmount || 0) - (a.tier?.bonusAmount || 0)).map(({ row, tier }, idx) => {
        const base: (string | number)[] = [idx + 1, row.nhom, row.agentCode, row.agentName, row.position];
        if (isPerContract) base.push(row.contractNumber || '');
        base.push(row.totalFYP);
        base.push(tier ? formatBonus(tier, row.totalFYP) : '');
        base.push(tier ? '' : 'Chưa đạt mức');
        return base;
      });
    }
    const csvContent = [headers.join(','), ...rows.map((r) => r.map((v) => `"${v}"`).join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement('a');
    link.href = URL.createObjectURL(blob); link.download = `ket_qua_thi_dua_${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(link.href);
  };

  const handleExportExcel = () => {
    if (filteredContracts.length === 0 && nydData.length === 0 && groupedData.length === 0) { toast({ title: 'Thông báo', description: 'Không có dữ liệu' }); return; }
    let headers: string[];
    let rows: (string | number)[][];

    if (targetType === 'nyd') {
      headers = ['STT', 'Nhóm', 'Mã Số', 'Họ Tên', 'Chức Vụ', conditionType === 'nyd_activity' ? 'Lượt TVVm HĐ' : 'FYP TVVm', 'Tiền Thưởng', 'Ghi chú'];
      const nydBonusCalcFn = conditionType === 'nyd_activity'
        ? (n: NYDData) => calculateActivityRoundBonus(n.recruitCount).tier
        : (n: NYDData) => calculateBonus(n.recruitFYP).tier;
      rows = [...nydData].map(n => ({ nyd: n, tier: nydBonusCalcFn(n) })).sort((a, b) => (b.tier?.bonusAmount || 0) - (a.tier?.bonusAmount || 0)).map(({ nyd: n, tier }, idx) => [
        idx + 1, n.nhom, n.agentCode, n.agentName, n.position, conditionType === 'nyd_activity' ? n.recruitCount : n.recruitFYP, tier ? formatBonus(tier, n.recruitFYP, n.recruitCount) : '', tier ? '' : 'Chưa đạt mức'
      ]);
    } else if (targetType === 'nhom') {
      headers = ['STT', 'Nhóm', 'Mã Số', 'Họ tên TN/TB', isActivityRoundMode(conditionType) ? (conditionType === 'activity_round_standard' ? 'LƯỢT HĐ CHUẨN' : 'LƯỢT HĐ') : 'TỔNG IP', 'Tiền Thưởng', 'Ghi chú'];
      rows = [...groupedDataFiltered].map((g) => { const { tier } = isActivityRoundMode(conditionType) ? calculateActivityRoundBonus(g.activityRounds) : calculateBonus(g.totalFYP); return { g, tier }; }).sort((a, b) => (b.tier?.bonusAmount || 0) - (a.tier?.bonusAmount || 0)).map(({ g, tier }, idx) => [
        idx + 1, g.nhom, g.leaderCode, g.leaderName || g.nhom, isActivityRoundMode(conditionType) ? g.activityRounds : g.totalFYP, tier ? formatBonus(tier, g.totalFYP, g.activityRounds) : '', tier ? '' : 'Chưa đạt mức'
      ]);
    } else {
      // TVV
      const isPerContract = conditionType === 'per_contract';
      headers = ['STT', 'Nhóm', 'Mã Số', 'Họ Tên', 'Chức Vụ', ...(isPerContract ? ['Số HĐ'] : []), isPerContract ? 'IP' : conditionType === 'total_fyp' ? 'TỔNG IP' : 'IP', 'Tiền Thưởng', 'Ghi chú'];
      rows = tvvRows.map((row) => {
        const tier = calculateBonus(row.totalFYP).tier;
        return { row, tier };
      }).sort((a, b) => (b.tier?.bonusAmount || 0) - (a.tier?.bonusAmount || 0)).map(({ row, tier }, idx) => {
        const base: (string | number)[] = [idx + 1, row.nhom, row.agentCode, row.agentName, row.position];
        if (isPerContract) base.push(row.contractNumber || '');
        base.push(row.totalFYP);
        base.push(tier ? formatBonus(tier, row.totalFYP) : '');
        base.push(tier ? '' : 'Chưa đạt mức');
        return base;
      });
    }

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    // Set column widths
    ws['!cols'] = headers.map((_, i) => ({ wch: i === 0 ? 6 : i === headers.length - 1 ? 15 : 20 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Kết quả thi đua');
    XLSX.writeFile(wb, `ket_qua_thi_dua_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast({ title: 'Thành công', description: 'Đã xuất file Excel' });
  };

  const handleExportImage = async () => {
    if (!shareRef.current) return;
    try {
      // Set exporting flag to hide UI controls in image
      setIsExporting(true);
      // Wait for React re-render
      await new Promise(r => setTimeout(r, 100));

      const el = shareRef.current;

      // Wait for fonts to be ready
      await document.fonts.ready;

      // 1. Temporarily expand container so all content is visible (no scroll clipping)
      const savedStyles: { el: HTMLElement; props: Record<string, string> }[] = [];
      const saveAndModify = (element: HTMLElement, props: Record<string, string>) => {
        const saved: Record<string, string> = {};
        for (const [key, value] of Object.entries(props)) {
          saved[key] = element.style.getPropertyValue(key);
          element.style.setProperty(key, value);
        }
        savedStyles.push({ el: element, props: saved });
      };

      // Expand main wrapper to show all content
      const fullHeight = el.scrollHeight;
      const fullWidth = el.scrollWidth;
      saveAndModify(el, {
        width: Math.max(fullWidth, 900) + 'px',
        height: fullHeight + 'px',
        overflow: 'visible',
      });

      // Remove all overflow/scroll/max-height constraints inside
      el.querySelectorAll('*').forEach(child => {
        const c = child as HTMLElement;
        if (!c.style) return;
        const cs = window.getComputedStyle(c);
        if (
          cs.overflow === 'auto' || cs.overflow === 'scroll' ||
          cs.overflowX === 'auto' || cs.overflowX === 'scroll' ||
          cs.overflowY === 'auto' || cs.overflowY === 'scroll' ||
          (cs.maxHeight && cs.maxHeight !== 'none' && cs.maxHeight !== 'none')
        ) {
          saveAndModify(c, {
            overflow: 'visible',
            'overflow-x': 'visible',
            'overflow-y': 'visible',
            'max-height': 'none',
          });
        }
      });

      // Wait for layout recalc + images to load
      await new Promise(r => setTimeout(r, 500));

      // 2. Capture using html-to-image (toBlob)
      const blob = await toBlob(el, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        width: el.scrollWidth,
        height: el.scrollHeight,
        style: {
          overflow: 'visible',
        },
        filter: (node: HTMLElement) => {
          // Skip delete buttons
          if (node.tagName === 'BUTTON' && node.textContent?.includes('Xóa')) return false;
          return true;
        },
      });

      // 3. Restore all modified styles (reverse order)
      for (const { el: modEl, props } of savedStyles.reverse()) {
        for (const [key, value] of Object.entries(props)) {
          if (value) {
            modEl.style.setProperty(key, value);
          } else {
            modEl.style.removeProperty(key);
          }
        }
      }

      // Clear exporting flag
      setIsExporting(false);

      if (!blob) {
        throw new Error('Failed to generate image');
      }

      // 4. Download as PNG
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `thi_dua_${new Date().toISOString().slice(0, 10)}.png`;
      link.click();
      URL.revokeObjectURL(link.href);
      toast({ title: 'Thành công', description: 'Đã xuất ảnh thành công' });
    } catch (error) {
      console.error('Export image error:', error);
      setIsExporting(false);
      toast({ title: 'Lỗi', description: 'Không thể xuất ảnh. Thử lại hoặc dùng In PDF.', variant: 'destructive' });
    }
  };

  // ─── Computed Values ──────────────────────────────────────────────────────

  const totalFYP = filteredContracts.reduce((sum, c) => sum + c.fyp, 0);
  const tvvAchievedCount = tvvRows.filter((r) => calculateBonus(r.totalFYP).tier !== null).length;
  const tvvTotalBonus = tvvRows.reduce((sum, r) => sum + getBonusAmount(r.totalFYP), 0);
  const nhomAchievedCount = groupedData.filter((g) => calculateBonus(g.totalFYP).tier !== null).length;
  const nhomTotalFYP = groupedData.reduce((s, g) => s + g.totalFYP, 0);
  const nhomTotalBonus = groupedData.reduce((s, g) => s + getBonusAmount(g.totalFYP, g.activityRounds), 0);
  const arAchievedCount = isActivityRoundMode(conditionType) ? groupedData.filter((g) => calculateActivityRoundBonus(g.activityRounds).tier !== null).length : 0;
  const arNotAchievedCount = isActivityRoundMode(conditionType) ? groupedData.length - arAchievedCount : 0;
  const arTotalBonus = isActivityRoundMode(conditionType) ? groupedData.reduce((s, g) => s + getActivityRoundBonusAmount(g.activityRounds, g.totalFYP), 0) : 0;

  // NYD computed
  const nydBonusCalc = conditionType === 'nyd_activity'
    ? (n: NYDData) => calculateActivityRoundBonus(n.recruitCount).tier
    : (n: NYDData) => calculateBonus(n.recruitFYP).tier;
  const nydAchievedCount = targetType === 'nyd' ? nydData.filter(n => nydBonusCalc(n) !== null).length : 0;
  const nydNotAchievedCount = targetType === 'nyd' ? nydData.length - nydAchievedCount : 0;
  const nydTotalFYP = nydData.reduce((s, n) => s + n.recruitFYP, 0);
  const nydTotalBonus = targetType === 'nyd' ? nydData.reduce((s, n) => {
    const tier = nydBonusCalc(n);
    if (!tier) return s;
    if (tier.bonusType === 'percent') return s + tier.bonusPercent / 100 * n.recruitFYP;
    if (tier.bonusType === 'money_per_round') return s + tier.bonusAmount * n.recruitCount;
    return s + tier.bonusAmount;
  }, 0) : 0;

  const achievedCount = targetType === 'nyd' ? nydAchievedCount : isActivityRoundMode(conditionType) ? arAchievedCount : targetType === 'nhom' ? nhomAchievedCount : tvvAchievedCount;
  const notAchievedCount = targetType === 'nyd' ? nydNotAchievedCount : isActivityRoundMode(conditionType) ? arNotAchievedCount : targetType === 'nhom' ? groupedData.length - nhomAchievedCount : tvvRows.length - tvvAchievedCount;
  const totalBonusDisplay = targetType === 'nyd' ? nydTotalBonus : isActivityRoundMode(conditionType) ? arTotalBonus : targetType === 'nhom' ? nhomTotalBonus : (conditionType === 'total_fyp' ? getTotalFYPBonus().bonus : tvvTotalBonus);
  const displayTotalFYP = targetType === 'nyd' ? nydTotalFYP : targetType === 'nhom' ? nhomTotalFYP : totalFYP;
  const { totalFYP: totalFYPValue, tier: matchedTotalTier, remaining: totalRemaining } = getTotalFYPBonus();
  const sortedTiers = [...bonusTiers].sort((a, b) => a.minFYP - b.minFYP);

  const hasResults = filteredContracts.length > 0 || nydData.length > 0 || groupedData.length > 0;

  // ─── Table Column Helpers ──────────────────────────────────────────────────

  const getMetricHeaderLabel = (): string => {
    if (targetType === 'nhom') {
      if (isActivityRoundMode(conditionType)) return conditionType === 'activity_round_standard' ? 'LƯỢT HĐ CHUẨN' : 'LƯỢT HĐ';
      return 'TỔNG IP';
    }
    if (targetType === 'nyd') {
      return conditionType === 'nyd_activity' ? 'LƯỢT TVVm HĐ' : 'FYP TVVm';
    }
    // TVV
    if (conditionType === 'per_contract') return 'IP';
    if (conditionType === 'total_fyp') return 'TỔNG IP';
    if (isActivityRoundMode(conditionType)) return conditionType === 'activity_round_standard' ? 'LƯỢT HĐ CHUẨN' : 'LƯỢT HĐ';
    return 'TỔNG IP';
  };

  // Compute missing amount/rounds to reach next tier
  const getMissingLabel = (metricValue: number, isRoundMode: boolean): string => {
    if (isRoundMode) {
      const nextTier = sortedTiers.find(t => t.minFYP > metricValue);
      if (nextTier) {
        const diff = nextTier.minFYP - metricValue;
        return `thiếu ${diff} lượt`;
      }
      return '';
    }
    // FYP/IP mode
    const nextTier = sortedTiers.find(t => t.minFYP > metricValue);
    if (nextTier) {
      const diff = nextTier.minFYP - metricValue;
      return `thiếu ${formatCurrency(diff)}`;
    }
    return '';
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-3 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center"><Trophy className="w-4 h-4 text-white" /></div>
            <div><h1 className="text-base font-bold text-gray-900">Tính Thưởng Thi Đua</h1><p className="text-[10px] text-gray-500">Quản lý & tính thưởng IP</p></div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 h-8 text-xs" onClick={() => setIsImportDialogOpen(true)}>
              <Link className="w-3.5 h-3.5 mr-1" /> Nhập Google Sheets
            </Button>
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-8 text-xs" onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Thêm HĐ
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-3 py-4 space-y-4">
        {/* STEP 1: Info */}
        <Card className="border-emerald-200 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold">1</div>
                <CardTitle className="text-sm">Thông tin chương trình</CardTitle>
              </div>
              <div className="flex items-center gap-1.5">
                <Select value={selectedContestId} onValueChange={handleLoadContest}>
                  <SelectTrigger className="w-[180px] h-7 text-xs"><BookmarkPlus className="w-3 h-3 mr-1 text-emerald-600" /><SelectValue placeholder="Chương trình đã lưu..." /></SelectTrigger>
                  <SelectContent>{savedContests.length === 0 ? <SelectItem value="_none" disabled>Chưa có</SelectItem> : savedContests.map((sc) => (<SelectItem key={sc.id} value={sc.id}><div className="flex items-center gap-2"><span className="truncate">{sc.title}</span><Button variant="ghost" size="sm" className="h-4 w-4 p-0 text-red-400 hover:text-red-600" onClick={(e) => handleDeleteContest(sc.id, e)}><Trash2 className="w-2.5 h-2.5" /></Button></div></SelectItem>))}</SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={handleSaveContest} disabled={isSaving} className="border-amber-300 text-amber-700 hover:bg-amber-50 h-7 text-xs">{isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}Lưu</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <div className="space-y-2">
              <Label className="text-xs font-medium">Tên chương trình thi đua</Label>
              <Input value={contestTitle} onChange={(e) => setContestTitle(e.target.value)} className="font-semibold border-emerald-200 h-9 text-sm" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1"><Label className="text-xs">Hiệu lực từ</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-8 text-xs border-emerald-200" /></div>
              <div className="space-y-1"><Label className="text-xs">Hiệu lực đến</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-8 text-xs border-emerald-200" /></div>
              <div className="space-y-1"><Label className="text-xs">Ngày phát hành</Label><Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="h-8 text-xs border-emerald-200" /></div>
            </div>
          </CardContent>
        </Card>

        {/* STEP 2: Config */}
        <Card className="border-amber-200 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center text-sm font-bold">2</div>
              <CardTitle className="text-sm">Cấu hình thi đua & Thưởng</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Target */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Đối tượng</Label>
                <RadioGroup value={targetType} onValueChange={(v) => { setTargetType(v as TargetType); if (v === 'nyd') { setConditionType('nyd_activity'); setBonusTiers([ { id: crypto.randomUUID(), minFYP: 0, maxFYP: 2, bonusAmount: 0, bonusType: 'money_per_round', bonusText: '', bonusPercent: 0 }, { id: crypto.randomUUID(), minFYP: 3, maxFYP: 5, bonusAmount: 0, bonusType: 'money_per_round', bonusText: '', bonusPercent: 0 }, { id: crypto.randomUUID(), minFYP: 6, maxFYP: null, bonusAmount: 0, bonusType: 'money_per_round', bonusText: '', bonusPercent: 0 }, ]); } }} className="space-y-1.5">
                  <div className={`flex items-center space-x-2 rounded-lg border p-2 cursor-pointer hover:bg-emerald-50 ${isActivityRoundMode(conditionType) && targetType !== 'nhom' ? 'opacity-50 pointer-events-none' : ''}`}>
                    <RadioGroupItem value="tvv" id="tvv" disabled={isActivityRoundMode(conditionType) && targetType !== 'nhom'} />
                    <Label htmlFor="tvv" className="cursor-pointer flex-1"><div className="text-xs font-medium flex items-center gap-1"><Users className="w-3.5 h-3.5 text-emerald-600" /> TVV (cá nhân)</div></Label>
                  </div>
                  <div className={`flex items-center space-x-2 rounded-lg border p-2 cursor-pointer hover:bg-emerald-50 ${isActivityRoundMode(conditionType) && targetType !== 'nhom' ? 'opacity-50 pointer-events-none' : ''}`}>
                    <RadioGroupItem value="nhom" id="nhom" disabled={isActivityRoundMode(conditionType) && targetType !== 'nhom'} />
                    <Label htmlFor="nhom" className="cursor-pointer flex-1"><div className="text-xs font-medium flex items-center gap-1"><UserCheck className="w-3.5 h-3.5 text-sky-600" /> Theo nhóm (MC NHÓM)</div></Label>
                  </div>
                  <div className="flex items-center space-x-2 rounded-lg border p-2 cursor-pointer hover:bg-violet-50 border-violet-200">
                    <RadioGroupItem value="nyd" id="nyd" />
                    <Label htmlFor="nyd" className="cursor-pointer flex-1"><div className="text-xs font-medium flex items-center gap-1"><UserCog className="w-3.5 h-3.5 text-violet-600" /> Người tuyển dụng (NYD)</div></Label>
                  </div>
                </RadioGroup>
              </div>
              {/* Condition */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Điều kiện</Label>
                {targetType === 'nyd' ? (
                  <RadioGroup value={conditionType} onValueChange={(v) => setConditionType(v as ConditionType)} className="space-y-1.5">
                    <div className="flex items-center space-x-2 rounded-lg border p-2 cursor-pointer hover:bg-violet-50"><RadioGroupItem value="nyd_activity" id="nyd_ar" /><Label htmlFor="nyd_ar" className="cursor-pointer flex-1"><div className="text-xs font-medium">Số lượt TVVm hoạt động</div></Label></div>
                    <div className="flex items-center space-x-2 rounded-lg border p-2 cursor-pointer hover:bg-violet-50"><RadioGroupItem value="nyd_fyp" id="nyd_fyp" /><Label htmlFor="nyd_fyp" className="cursor-pointer flex-1"><div className="text-xs font-medium">Doanh số FYP TVVm</div></Label></div>
                  </RadioGroup>
                ) : (
                  <RadioGroup value={conditionType} onValueChange={(v) => {
                  const newCt = v as ConditionType;
                  setConditionType(newCt);
                  // Reset bonusTiers to appropriate defaults when switching mode
                  if (isActivityRoundMode(newCt)) {
                    setTargetType('nhom');
                    setBonusTiers([
                      { id: crypto.randomUUID(), minFYP: 0, maxFYP: 2, bonusAmount: 0, bonusType: 'money_per_round', bonusText: '', bonusPercent: 0 },
                      { id: crypto.randomUUID(), minFYP: 3, maxFYP: 5, bonusAmount: 0, bonusType: 'money_per_round', bonusText: '', bonusPercent: 0 },
                      { id: crypto.randomUUID(), minFYP: 6, maxFYP: 9, bonusAmount: 0, bonusType: 'money_per_round', bonusText: '', bonusPercent: 0 },
                      { id: crypto.randomUUID(), minFYP: 10, maxFYP: null, bonusAmount: 0, bonusType: 'money_per_round', bonusText: '', bonusPercent: 0 },
                    ]);
                  } else if (newCt === 'nyd_activity') {
                    setBonusTiers([
                      { id: crypto.randomUUID(), minFYP: 0, maxFYP: 2, bonusAmount: 0, bonusType: 'money_per_round', bonusText: '', bonusPercent: 0 },
                      { id: crypto.randomUUID(), minFYP: 3, maxFYP: 5, bonusAmount: 0, bonusType: 'money_per_round', bonusText: '', bonusPercent: 0 },
                      { id: crypto.randomUUID(), minFYP: 6, maxFYP: null, bonusAmount: 0, bonusType: 'money_per_round', bonusText: '', bonusPercent: 0 },
                    ]);
                  } else {
                    // IP/per_contract/total_fyp mode - reset to VND defaults
                    setBonusTiers([
                      { id: crypto.randomUUID(), minFYP: 0, maxFYP: 20000000, bonusAmount: 500000, bonusType: 'money', bonusText: '', bonusPercent: 0 },
                      { id: crypto.randomUUID(), minFYP: 20000000, maxFYP: 50000000, bonusAmount: 1500000, bonusType: 'money', bonusText: '', bonusPercent: 0 },
                      { id: crypto.randomUUID(), minFYP: 50000000, maxFYP: 100000000, bonusAmount: 3000000, bonusType: 'money', bonusText: '', bonusPercent: 0 },
                      { id: crypto.randomUUID(), minFYP: 100000000, maxFYP: null, bonusAmount: 5000000, bonusType: 'money', bonusText: '', bonusPercent: 0 },
                    ]);
                  }
                }} className="space-y-1.5">
                    <div className="flex items-center space-x-2 rounded-lg border p-2 cursor-pointer hover:bg-amber-50"><RadioGroupItem value="per_contract" id="pc" /><Label htmlFor="pc" className="cursor-pointer flex-1"><div className="text-xs font-medium">Theo HĐ (IP/HĐ)</div></Label></div>
                    <div className="flex items-center space-x-2 rounded-lg border p-2 cursor-pointer hover:bg-amber-50"><RadioGroupItem value="total_fyp" id="tf" /><Label htmlFor="tf" className="cursor-pointer flex-1"><div className="text-xs font-medium">Tổng IP</div></Label></div>
                    <div className="flex items-center space-x-2 rounded-lg border p-2 cursor-pointer hover:bg-amber-50"><RadioGroupItem value="activity_round" id="ar" /><Label htmlFor="ar" className="cursor-pointer flex-1"><div className="text-xs font-medium">Lượt HĐ (IP ≥ 3tr)</div></Label></div>
                    <div className="flex items-center space-x-2 rounded-lg border p-2 cursor-pointer hover:bg-amber-50"><RadioGroupItem value="activity_round_standard" id="ars" /><Label htmlFor="ars" className="cursor-pointer flex-1"><div className="text-xs font-medium">Lượt HĐ Chuẩn (IP ≥ 12tr)</div></Label></div>
                  </RadioGroup>
                )}
              </div>
            </div>

            {/* Include NYD own data toggle */}
            {targetType === 'nyd' && (
              <div className="flex items-center space-x-2 rounded-lg border border-violet-200 bg-violet-50/50 p-2">
                <Checkbox id="includeOwn" checked={includeOwnNYD} onCheckedChange={(v) => setIncludeOwnNYD(v === true)} />
                <Label htmlFor="includeOwn" className="cursor-pointer text-xs font-medium text-violet-800">Tính luôn cá nhân NYD (FYP + hoạt động riêng)</Label>
              </div>
            )}

            {/* TVVm filter toggle */}
            {(targetType === 'tvv' || targetType === 'nhom') && isActivityRoundMode(conditionType) && (
              <div className="flex items-center space-x-2 rounded-lg border border-orange-200 bg-orange-50/50 p-2">
                <Checkbox id="useTVVm" checked={useTVVm} onCheckedChange={(v) => setUseTVVm(v === true)} />
                <Label htmlFor="useTVVm" className="cursor-pointer text-xs font-medium text-orange-800">Chỉ tính TVVm (TVV mới ≤ 12 tháng)</Label>
              </div>
            )}

            <Separator />

            {/* Bonus Tiers */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Bảng mức thưởng</Label>
                <Button variant="ghost" size="sm" onClick={addBonusTier} className="text-amber-600 hover:text-amber-700 h-6 text-xs"><Plus className="w-3 h-3 mr-0.5" /> Thêm mức</Button>
              </div>
              <div className="space-y-2">
                {bonusTiers.map((tier, index) => (
                  <div key={tier.id} className="p-2 rounded-lg bg-amber-50/50 border border-amber-100">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">Mức {index + 1}</span>
                      <div className="flex items-center gap-0.5 ml-auto">
                        {([['money', 'Tiền', Banknote, 'bg-emerald-600'], ['money_per_round', 'Tiền×Lượt', Zap, 'bg-orange-600'], ['gift', 'Quà', Gift, 'bg-pink-600'], ['percent', '% IP', Percent, 'bg-violet-600']] as const).map(([type, label, Icon, activeCls]) => (
                          <Button key={type} variant={tier.bonusType === type ? 'default' : 'outline'} size="sm" className={`h-5 px-1.5 text-[9px] ${tier.bonusType === type ? activeCls + ' hover:opacity-90' : ''}`} onClick={() => updateBonusTier(tier.id, 'bonusType', type)}><Icon className="w-2.5 h-2.5 mr-0.5" />{label}</Button>
                        ))}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => removeBonusTier(tier.id)} className="h-5 w-5 p-0 text-red-400 hover:text-red-600"><Trash2 className="w-2.5 h-2.5" /></Button>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {isActivityRoundMode(conditionType) || conditionType === 'nyd_activity' ? (
                        <>
                          <div><Label className="text-[9px] text-muted-foreground">Lượt từ</Label><Input type="number" placeholder="0" value={tier.minFYP || ''} onChange={(e) => updateBonusTier(tier.id, 'minFYP', parseInt(e.target.value) || 0)} className="h-7 text-xs border-amber-200" /></div>
                          <div><Label className="text-[9px] text-muted-foreground">Lượt đến</Label><Input type="number" placeholder="∞" value={tier.maxFYP || ''} onChange={(e) => updateBonusTier(tier.id, 'maxFYP', e.target.value ? parseInt(e.target.value) : null)} className="h-7 text-xs border-amber-200" /></div>
                        </>
                      ) : (
                        <>
                          <div><Label className="text-[9px] text-muted-foreground">IP từ (ngàn)</Label><Input type="number" placeholder="0" value={vndToNgan(tier.minFYP) || ''} onChange={(e) => updateBonusTier(tier.id, 'minFYP', nganToVnd(parseFloat(e.target.value) || 0))} className="h-7 text-xs border-amber-200" /></div>
                          <div><Label className="text-[9px] text-muted-foreground">IP đến (ngàn)</Label><Input type="number" placeholder="∞" value={tier.maxFYP ? vndToNgan(tier.maxFYP) : ''} onChange={(e) => updateBonusTier(tier.id, 'maxFYP', e.target.value ? nganToVnd(parseFloat(e.target.value)) : null)} className="h-7 text-xs border-amber-200" /></div>
                        </>
                      )}
                      <div>
                        <Label className="text-[9px] text-muted-foreground">{tier.bonusType === 'money' ? 'Thưởng (ngàn)' : tier.bonusType === 'money_per_round' ? 'Tiền/lượt (ngàn)' : tier.bonusType === 'percent' ? '% IP' : 'Quà tặng'}</Label>
                        {tier.bonusType === 'money' || tier.bonusType === 'money_per_round' ? <Input type="number" placeholder="0" value={vndToNgan(tier.bonusAmount) || ''} onChange={(e) => updateBonusTier(tier.id, 'bonusAmount', nganToVnd(parseFloat(e.target.value) || 0))} className={`h-7 text-xs ${tier.bonusType === 'money_per_round' ? 'border-orange-200' : 'border-amber-200'}`} />
                        : tier.bonusType === 'percent' ? <Input type="number" placeholder="7" value={tier.bonusPercent || ''} onChange={(e) => updateBonusTier(tier.id, 'bonusPercent', parseFloat(e.target.value) || 0)} className="h-7 text-xs border-violet-200" />
                        : <Input type="text" placeholder="VD: iPhone 15" value={tier.bonusText} onChange={(e) => updateBonusTier(tier.id, 'bonusText', e.target.value)} className="h-7 text-xs border-pink-200" />}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Poster + Action */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition-colors">
                  <ImageIcon className="w-3.5 h-3.5" /> Ảnh poster
                  <input type="file" accept="image/*" onChange={handlePosterUpload} className="hidden" />
                </label>
                {posterUrl && <Button variant="outline" size="sm" onClick={() => setPosterUrl('')} className="text-red-600 h-7 text-xs"><X className="w-3 h-3 mr-0.5" />Xóa</Button>}
                {posterUrl && <img src={posterUrl} alt="Preview" className="h-8 rounded border" />}
              </div>
              <div className="flex gap-2 sm:ml-auto">
                <Button onClick={handleSearch} className="bg-emerald-600 hover:bg-emerald-700 h-9 text-sm"><Search className="w-4 h-4 mr-1.5" /> Tính kết quả thi đua</Button>
                <Button variant="outline" onClick={() => { setStartDate(''); setEndDate(''); setIssueDate(''); setFilteredContracts([]); setSelectedContestId(''); }} className="h-9"><X className="w-4 h-4" /></Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* STEP 3: Participant List */}
        <Card className="border-violet-200 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <button className="flex items-center justify-between w-full" onClick={() => setShowParticipantList(!showParticipantList)}>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-violet-500 text-white flex items-center justify-center text-sm font-bold">3</div>
                <CardTitle className="text-sm">Danh sách đối tượng</CardTitle>
                {useParticipantFilter && participants.length > 0 && <Badge variant="secondary" className="text-[10px] bg-violet-100 text-violet-700">{participants.length} người</Badge>}
              </div>
              {showParticipantList ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
          </CardHeader>
          {showParticipantList && (
            <CardContent className="px-4 pb-4 space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox id="useFilter" checked={useParticipantFilter} onCheckedChange={(v) => setUseParticipantFilter(v === true)} />
                <Label htmlFor="useFilter" className="text-xs font-medium">Giới hạn danh sách (chỉ tính cho những người trong danh sách)</Label>
              </div>

              {useParticipantFilter && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={addParticipant} className="h-7 text-xs border-violet-300 text-violet-700 hover:bg-violet-50"><UserPlus className="w-3 h-3 mr-1" /> Thêm dòng</Button>
                    <Button variant="outline" size="sm" onClick={handlePasteParticipants} className="h-7 text-xs border-violet-300 text-violet-700 hover:bg-violet-50"><Copy className="w-3 h-3 mr-1" /> Dán từ clipboard</Button>
                    {participants.length > 0 && <Button variant="outline" size="sm" onClick={() => setParticipants([])} className="h-7 text-xs text-red-600 hover:text-red-700"><Trash2 className="w-3 h-3 mr-1" /> Xóa hết</Button>}
                  </div>

                  {participants.length > 0 && (
                    <div className="rounded-lg border border-violet-200 overflow-x-auto max-h-48 overflow-y-auto">
                      <Table>
                        <TableHeader><TableRow className="bg-violet-50"><TableHead className="text-[10px] w-[35px] text-center">STT</TableHead><TableHead className="text-[10px]">Nhóm</TableHead><TableHead className="text-[10px]">Mã Số</TableHead><TableHead className="text-[10px]">Họ Tên</TableHead><TableHead className="w-[30px]"></TableHead></TableRow></TableHeader>
                        <TableBody>
                          {participants.map((p, idx) => (
                            <TableRow key={p.id}>
                              <TableCell className="text-center text-gray-500 text-[10px]">{idx + 1}</TableCell>
                              <TableCell><Input value={p.nhom} onChange={(e) => updateParticipant(p.id, 'nhom', e.target.value)} className="h-6 text-[10px] border-violet-200 min-w-[60px]" /></TableCell>
                              <TableCell><Input value={p.maSo} onChange={(e) => updateParticipant(p.id, 'maSo', e.target.value)} className="h-6 text-[10px] border-violet-200 min-w-[80px]" placeholder="Mã ĐL" /></TableCell>
                              <TableCell><Input value={p.hoTen} onChange={(e) => updateParticipant(p.id, 'hoTen', e.target.value)} className="h-6 text-[10px] border-violet-200 min-w-[120px]" placeholder="Họ tên" /></TableCell>
                              <TableCell><Button variant="ghost" size="sm" onClick={() => removeParticipant(p.id)} className="h-5 w-5 p-0 text-red-400 hover:text-red-600"><Trash2 className="w-2.5 h-2.5" /></Button></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* Preview Poster - hidden when results are shown, shown as compact when no results */}
        {!hasResults && (
          <ContestPoster contestTitle={contestTitle} startDate={startDate} endDate={endDate} conditionType={conditionType} targetType={targetType} sortedTiers={sortedTiers} filteredContracts={filteredContracts} groupedData={groupedData} nydData={nydData} totalFYP={displayTotalFYP} totalBonus={totalBonusDisplay} achievedCount={achievedCount} notAchievedCount={notAchievedCount} formatCurrency={formatCurrency} formatNumber={formatNumber} formatDate={formatDate} isPreview />
        )}

        {/* Results */}
        {hasResults && (
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 justify-end flex-wrap">
              <Button variant="outline" size="sm" onClick={handleCopyText} className="border-teal-300 text-teal-700 h-7 text-xs"><Copy className="w-3 h-3 mr-1" />Copy</Button>
              <Button variant="outline" size="sm" onClick={handlePrint} className="border-emerald-300 text-emerald-700 h-7 text-xs"><Printer className="w-3 h-3 mr-1" />In PDF</Button>
              <Button variant="outline" size="sm" onClick={handleExportImage} className="border-amber-300 text-amber-700 h-7 text-xs"><ImageIcon className="w-3 h-3 mr-1" />Ảnh</Button>
              <Button variant="outline" size="sm" onClick={handleExportCSV} className="h-7 text-xs"><Download className="w-3 h-3 mr-1" />CSV</Button>
              <Button variant="outline" size="sm" onClick={handleExportExcel} className="h-7 text-xs border-emerald-400 text-emerald-700"><FileSpreadsheet className="w-3 h-3 mr-1" />Excel</Button>
            </div>

            <div ref={printRef}>
              <div ref={shareRef}>
                {/* Vivid table block - poster + detail table for export */}
                <div className="rounded-xl bg-white border-2 border-emerald-400 shadow-[0_8px_32px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden">
                  {/* Poster: show uploaded image OR ContestPoster */}
                  {posterUrl ? (
                    <div className="flex justify-center">
                      <img src={posterUrl} alt="Poster" className="w-full max-h-[400px] object-contain" />
                    </div>
                  ) : (
                    <ContestPoster contestTitle={contestTitle} startDate={startDate} endDate={endDate} conditionType={conditionType} targetType={targetType} sortedTiers={sortedTiers} filteredContracts={filteredContracts} groupedData={groupedData} nydData={nydData} totalFYP={displayTotalFYP} totalBonus={totalBonusDisplay} achievedCount={achievedCount} notAchievedCount={notAchievedCount} formatCurrency={formatCurrency} formatNumber={formatNumber} formatDate={formatDate} />
                  )}

                  {isActivityRoundMode(conditionType) && targetType === 'nhom' && groupedData.length > 0 && (
                    <div className="mx-3 mt-2 rounded-lg bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 p-2">
                      <div className="flex items-center gap-2"><Users className="w-4 h-4 text-orange-600" /><div className="flex-1"><p className="text-xs font-bold text-orange-800">{conditionType === 'activity_round' ? 'Lượt HĐ' : 'Lượt HĐ Chuẩn'}: đếm TVV có TÍNH LƯỢT ≥ {conditionType === 'activity_round' ? '3tr' : '12tr'} VND</p><p className="text-[10px] text-orange-600">Mỗi TVV tính 1 lượt/tháng · Dựa trên cột TÍNH LƯỢT (27) · Chỉ tính trong khoảng ngày đã chọn</p></div><div className="text-right"><p className="text-[10px] text-orange-600">Tổng thưởng</p><p className="text-base font-extrabold text-orange-700">{formatCurrency(arTotalBonus)}</p></div></div>
                    </div>
                  )}
                  {conditionType === 'total_fyp' && matchedTotalTier && (
                    <div className="mx-3 mt-2 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 p-2">
                      <div className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-amber-600" /><div className="flex-1"><p className="text-xs font-bold text-amber-800">Tổng IP: {formatCurrency(totalFYPValue)}</p></div><div className="text-right"><p className="text-base font-extrabold text-amber-700">{formatBonus(matchedTotalTier, totalFYPValue)}</p></div>{totalRemaining !== null && <div className="text-right border-l pl-2"><p className="text-[10px] text-orange-600">Cần thêm</p><p className="text-sm font-bold text-orange-700">{formatCurrency(totalRemaining)}</p></div>}</div>
                    </div>
                  )}

                  {targetType === 'nyd' && nydData.length > 0 && (
                    <div className="mx-3 mt-2 rounded-lg bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 p-2">
                      <div className="flex items-center gap-2"><UserCog className="w-4 h-4 text-violet-600" /><div className="flex-1"><p className="text-xs font-bold text-violet-800">Người tuyển dụng: {conditionType === 'nyd_activity' ? 'Số TVVm hoạt động' : 'FYP TVVm'}{includeOwnNYD ? ' + cá nhân NYD' : ''}</p></div><div className="text-right"><p className="text-[10px] text-violet-600">Tổng thưởng</p><p className="text-base font-extrabold text-violet-700">{formatCurrency(nydTotalBonus)}</p></div></div>
                    </div>
                  )}

                  {!posterUrl && !isExporting && <div className="text-center mb-2"><h2 className="text-base font-extrabold text-emerald-800">{contestTitle || 'CHƯƠNG TRÌNH THI ĐUA'}</h2><p className="text-xs text-gray-500">Từ {startDate ? formatDate(startDate) : '...'} đến {endDate ? formatDate(endDate) : '...'}</p></div>}

                  {/* ─── Results Table ──────────────────────────────────────────── */}
                  <div className="px-3 pb-3">
                    {/* Toggle: hide non-achieved rows (hidden in image export) */}
                    {!isExporting && <div className="flex items-center justify-between mb-1.5">
                      <button
                        onClick={() => setHideNotAchieved(!hideNotAchieved)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-all ${hideNotAchieved ? 'bg-emerald-100 border-emerald-300 text-emerald-700' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'}`}
                      >
                        {hideNotAchieved ? <ListChecks className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                        {hideNotAchieved ? 'Hiện tất cả' : 'Ẩn chưa đạt'}
                      </button>
                      <span className="text-[10px] text-gray-400">{hideNotAchieved ? 'Chỉ hiện hàng đạt thưởng' : `Sắp xếp: ${getMetricHeaderLabel()} ↓`}</span>
                    </div>}
                    <div className="overflow-x-auto max-h-[70vh] overflow-y-auto rounded-lg border-2 border-emerald-300 shadow-[inset_0_2px_6px_rgba(0,0,0,0.06)]">
                      <table className="w-full border-collapse" style={{ minWidth: '100%' }}>
                        <thead className="sticky top-0 z-10">
                          <tr className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-600">
                            <th className="text-[12px] font-bold text-white text-center py-2.5 px-3 whitespace-nowrap uppercase border-b-2 border-emerald-400 shadow-sm">STT</th>
                            <th className="text-[12px] font-bold text-white text-center py-2.5 px-3 whitespace-nowrap uppercase border-b-2 border-emerald-400 shadow-sm">Nhóm</th>

                            {targetType === 'nhom' && (
                              <>
                                <th className="text-[12px] font-bold text-white text-center py-2.5 px-3 whitespace-nowrap uppercase border-b-2 border-emerald-400 shadow-sm">Mã Số</th>
                                <th className="text-[12px] font-bold text-white text-center py-2.5 px-3 whitespace-nowrap uppercase border-b-2 border-emerald-400 shadow-sm">Họ tên TN/TB</th>
                              </>
                            )}

                            {targetType === 'tvv' && (
                              <>
                                <th className="text-[12px] font-bold text-white text-center py-2.5 px-3 whitespace-nowrap uppercase border-b-2 border-emerald-400 shadow-sm">Mã Số</th>
                                <th className="text-[12px] font-bold text-white text-center py-2.5 px-3 whitespace-nowrap uppercase border-b-2 border-emerald-400 shadow-sm">Họ Tên</th>
                                <th className="text-[12px] font-bold text-white text-center py-2.5 px-3 whitespace-nowrap uppercase border-b-2 border-emerald-400 shadow-sm">Chức Vụ</th>
                                {conditionType === 'per_contract' && (
                                  <th className="text-[12px] font-bold text-white text-center py-2.5 px-3 whitespace-nowrap uppercase border-b-2 border-emerald-400 shadow-sm">Số HĐ</th>
                                )}
                              </>
                            )}

                            {targetType === 'nyd' && (
                              <>
                                <th className="text-[12px] font-bold text-white text-center py-2.5 px-3 whitespace-nowrap uppercase border-b-2 border-emerald-400 shadow-sm">Mã Số</th>
                                <th className="text-[12px] font-bold text-white text-center py-2.5 px-3 whitespace-nowrap uppercase border-b-2 border-emerald-400 shadow-sm">Họ Tên</th>
                                <th className="text-[12px] font-bold text-white text-center py-2.5 px-3 whitespace-nowrap uppercase border-b-2 border-emerald-400 shadow-sm">Chức Vụ</th>
                              </>
                            )}

                            <th className="text-[12px] font-bold text-white text-center py-2.5 px-3 whitespace-nowrap uppercase border-b-2 border-emerald-400 shadow-sm">
                              <span>{getMetricHeaderLabel()}</span>
                            </th>
                            <th className="text-[12px] font-bold text-white text-center py-2.5 px-3 whitespace-nowrap uppercase border-b-2 border-emerald-400 shadow-sm">
                              <span>Thưởng</span>
                            </th>
                            <th className="text-[12px] font-bold text-white text-center py-2.5 px-3 whitespace-nowrap uppercase border-b-2 border-emerald-400 shadow-sm">Ghi chú</th>
                          </tr>
                        </thead>
                        <tbody>
                          {/* ─── NHÓM rows ─── */}
                          {targetType === 'nhom' && [...groupedDataFiltered].map((g) => {
                            const { tier } = isActivityRoundMode(conditionType) ? calculateActivityRoundBonus(g.activityRounds) : calculateBonus(g.totalFYP);
                            const metric = isActivityRoundMode(conditionType) ? g.activityRounds : g.totalFYP;
                            return { group: g, tier, metric };
                          }).sort((a, b) => b.metric - a.metric).filter(({ tier }) => !hideNotAchieved || tier !== null).map(({ group, tier, metric }, idx) => (
                            <tr key={group.nhom} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-emerald-50/60'} hover:bg-emerald-100/80 border-b border-emerald-200/60 transition-colors`}>
                              <td className="text-[12px] text-center text-black font-medium py-2 px-3 whitespace-nowrap">{idx + 1}</td>
                              <td className="text-[12px] text-left text-black font-semibold py-2 px-3 whitespace-nowrap">{group.nhom}</td>
                              <td className="text-[12px] text-center text-black font-medium py-2 px-3 whitespace-nowrap">{group.leaderCode || '—'}</td>
                              <td className="text-[12px] text-left text-black font-semibold py-2 px-3 whitespace-nowrap">{group.leaderName || group.nhom}</td>
                              <td className="text-[12px] text-center font-bold text-blue-700 py-2 px-3 whitespace-nowrap">
                                {isActivityRoundMode(conditionType) ? `${group.activityRounds} lượt` : formatNumber(group.totalFYP)}
                              </td>
                              <td className="text-[14px] text-center font-bold text-amber-700 py-2 px-3 whitespace-nowrap bg-amber-50/60">
                                {tier ? <span className="inline-flex items-center gap-1"><Banknote className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />{formatBonus(tier, group.totalFYP, group.activityRounds)}</span> : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="text-[12px] text-center py-2 px-3 whitespace-nowrap">{tier ? <span className="text-emerald-600 font-medium">✓</span> : <span className="text-gray-400 italic text-[10px]">{getMissingLabel(metric, isActivityRoundMode(conditionType))}</span>}</td>
                            </tr>
                          ))}

                          {/* ─── NYD rows ─── */}
                          {targetType === 'nyd' && [...nydData].map(n => {
                            const tier = nydBonusCalc(n);
                            const metricValue = conditionType === 'nyd_activity' ? n.recruitCount : n.recruitFYP;
                            return { nyd: n, tier, metricValue };
                          }).sort((a, b) => b.metricValue - a.metricValue).filter(({ tier }) => !hideNotAchieved || tier !== null).map(({ nyd: n, tier, metricValue }, idx) => (
                            <tr key={n.agentCode} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-emerald-50/60'} hover:bg-emerald-100/80 border-b border-emerald-200/60 transition-colors`}>
                              <td className="text-[12px] text-center text-black font-medium py-2 px-3 whitespace-nowrap">{idx + 1}</td>
                              <td className="text-[12px] text-left text-black font-semibold py-2 px-3 whitespace-nowrap">{n.nhom}</td>
                              <td className="text-[12px] text-center text-black font-medium py-2 px-3 whitespace-nowrap">{n.agentCode}</td>
                              <td className="text-[12px] text-left text-black font-semibold py-2 px-3 whitespace-nowrap">{n.agentName}</td>
                              <td className="text-[12px] text-center text-black font-medium py-2 px-3 whitespace-nowrap">{n.position}</td>
                              <td className="text-[12px] text-center font-bold text-blue-700 py-2 px-3 whitespace-nowrap">
                                {conditionType === 'nyd_activity' ? `${metricValue} lượt` : formatNumber(metricValue)}
                              </td>
                              <td className="text-[14px] text-center font-bold text-amber-700 py-2 px-3 whitespace-nowrap bg-amber-50/60">
                                {tier ? <span className="inline-flex items-center gap-1"><Banknote className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />{formatBonus(tier, n.recruitFYP, n.recruitCount)}</span> : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="text-[12px] text-center py-2 px-3 whitespace-nowrap">{tier ? <span className="text-emerald-600 font-medium">✓</span> : <span className="text-gray-400 italic text-[10px]">{getMissingLabel(metricValue, conditionType === 'nyd_activity')}</span>}</td>
                            </tr>
                          ))}

                          {/* ─── TVV rows ─── */}
                          {targetType === 'tvv' && tvvRows.map((row) => {
                            const tier = calculateBonus(row.totalFYP).tier;
                            const metric = isActivityRoundMode(conditionType)
                              ? (Math.max(row.tinhLuot, 0) >= (conditionType === 'activity_round_standard' ? 12000000 : 3000000) ? 1 : 0)
                              : row.totalFYP;
                            return { row, tier, metric };
                          }).sort((a, b) => b.metric - a.metric).filter(({ tier }) => !hideNotAchieved || tier !== null).map(({ row, tier, metric }, idx) => (
                            <tr key={row.contractId || row.agentCode + idx} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-emerald-50/60'} hover:bg-emerald-100/80 border-b border-emerald-200/60 transition-colors`}>
                              <td className="text-[12px] text-center text-black font-medium py-2 px-3 whitespace-nowrap">{idx + 1}</td>
                              <td className="text-[12px] text-left text-black font-semibold py-2 px-3 whitespace-nowrap">{row.nhom}</td>
                              <td className="text-[12px] text-center text-black font-medium py-2 px-3 whitespace-nowrap">{row.agentCode}</td>
                              <td className="text-[12px] text-left text-black font-semibold py-2 px-3 whitespace-nowrap">{row.agentName}</td>
                              <td className="text-[12px] text-center text-black font-medium py-2 px-3 whitespace-nowrap">{row.position}</td>
                              {conditionType === 'per_contract' && (
                                <td className="text-[12px] text-center text-black font-medium py-2 px-3 whitespace-nowrap">{row.contractNumber || ''}</td>
                              )}
                              <td className="text-[12px] text-center font-bold text-blue-700 py-2 px-3 whitespace-nowrap">
                                {isActivityRoundMode(conditionType)
                                  ? `${Math.max(row.tinhLuot, 0) >= (conditionType === 'activity_round_standard' ? 12000000 : 3000000) ? 1 : 0} lượt`
                                  : formatNumber(row.totalFYP)}
                              </td>
                              <td className="text-[14px] text-center font-bold text-amber-700 py-2 px-3 whitespace-nowrap bg-amber-50/60">
                                {tier ? <span className="inline-flex items-center gap-1"><Banknote className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />{formatBonus(tier, row.totalFYP)}</span> : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="text-[12px] text-center py-2 px-3 whitespace-nowrap">{tier ? <span className="text-emerald-600 font-medium">✓</span> : <span className="text-gray-400 italic text-[10px]">{getMissingLabel(metric, isActivityRoundMode(conditionType))}</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Empty */}
        {!hasResults && (
          <Card className="border-gray-200"><CardContent className="py-10 text-center text-gray-400"><Trophy className="w-12 h-12 mx-auto mb-3 opacity-20" /><p className="text-sm font-medium text-gray-500">Thiết lập thi đua & nhấn &ldquo;Tính kết quả&rdquo;</p></CardContent></Card>
        )}

        {/* Source Data - collapsible */}
        <Card className="border-gray-200 shadow-sm">
          <CardHeader className="pb-2 pt-3 px-4">
            <button className="flex items-center justify-between w-full" onClick={() => setShowSourceData(!showSourceData)}>
              <div className="flex items-center gap-2"><Database className="w-4 h-4 text-gray-600" /><CardTitle className="text-sm">Dữ liệu nguồn</CardTitle><Badge variant="secondary" className="text-[10px]">{contracts.length} HĐ</Badge></div>
              {showSourceData ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
          </CardHeader>
          {showSourceData && (
            <CardContent className="px-4 pb-3">
              {contracts.length === 0 ? (
                <div className="text-center py-6 text-gray-400"><Database className="w-8 h-8 mx-auto mb-2 opacity-30" /><p className="text-sm font-medium">Chưa có dữ liệu</p><p className="text-xs">Nhấn &ldquo;Nhập Google Sheets&rdquo; để tải</p></div>
              ) : (
                <div className="rounded-lg border overflow-x-auto max-h-48 overflow-y-auto">
                  <Table><TableHeader><TableRow className="bg-gray-50 sticky top-0"><TableHead className="w-[35px] text-center text-xs">STT</TableHead><TableHead className="text-xs">Nhóm</TableHead><TableHead className="text-xs">Mã</TableHead><TableHead className="text-xs">Họ tên</TableHead><TableHead className="text-xs">Chức vụ</TableHead><TableHead className="text-xs">Mã TN</TableHead><TableHead className="text-xs">Ngày HL</TableHead><TableHead className="text-xs">IP</TableHead><TableHead className="text-xs">Tính Lượt</TableHead><TableHead className="w-[30px]"></TableHead></TableRow></TableHeader>
                    <TableBody>{contracts.map((c, idx) => (
                      <TableRow key={c.id} className="hover:bg-gray-50"><TableCell className="text-center text-gray-500 text-xs">{idx + 1}</TableCell><TableCell className="font-mono text-[10px] text-emerald-700 whitespace-nowrap">{c.nhom}</TableCell><TableCell className="font-mono text-[10px] whitespace-nowrap">{c.agentCode}</TableCell><TableCell className="text-xs whitespace-nowrap">{c.agentName}</TableCell><TableCell className="text-[10px] whitespace-nowrap">{c.position}</TableCell><TableCell className="text-[10px] text-blue-600 whitespace-nowrap">{c.leaderAgentCode || '—'}</TableCell><TableCell className="text-[10px] text-gray-600 whitespace-nowrap">{formatDate(c.effectiveDate)}</TableCell><TableCell className="font-semibold text-emerald-700 text-xs whitespace-nowrap">{formatNumber(c.fyp)}</TableCell><TableCell className="text-[10px] text-gray-600 whitespace-nowrap">{c.tinhLuot ? formatNumber(c.tinhLuot) : '—'}</TableCell><TableCell><Button variant="ghost" size="sm" onClick={() => handleDeleteContract(c.id)} className="h-5 w-5 p-0 text-red-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></Button></TableCell></TableRow>
                    ))}</TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      </main>

      {/* Import Dialog */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Nhập dữ liệu từ Google Sheets</DialogTitle><DialogDescription>Dán liên kết CSV để nhập dữ liệu hợp đồng</DialogDescription></DialogHeader>
          <div className="space-y-3 py-3">
            <div className="space-y-1"><Label className="text-xs">Liên kết CSV</Label><Input value={csvUrl} onChange={(e) => setCsvUrl(e.target.value)} className="font-mono text-xs h-8" /></div>
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-2 text-xs text-amber-800"><p className="font-medium mb-1">Cột sử dụng:</p><ul className="space-y-0.5 ml-3 list-disc"><li><b>Ngày hiệu lực</b> → Ngày bắt đầu thi đua</li><li><b>PĐT + 10% ĐT</b> → IP</li><li><b>TÍNH LƯỢT</b> → Cột 27</li></ul></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setIsImportDialogOpen(false)} className="h-8">Hủy</Button><Button onClick={handleImportFromUrl} disabled={isImporting} className="bg-emerald-600 hover:bg-emerald-700 h-8">{isImporting ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Đang nhập...</> : <><RefreshCw className="w-3 h-3 mr-1" /> Nhập dữ liệu</>}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Contract Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>Thêm hợp đồng mới</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-3">
            <div className="grid grid-cols-2 gap-3"><div className="space-y-1"><Label className="text-xs">Số HĐ</Label><Input placeholder="10000017624818" value={newContract.contractNumber} onChange={(e) => setNewContract({ ...newContract, contractNumber: e.target.value })} className="h-8 text-xs" /></div><div className="space-y-1"><Label className="text-xs">Mã đại lý</Label><Input placeholder="D104142435" value={newContract.agentCode} onChange={(e) => setNewContract({ ...newContract, agentCode: e.target.value })} className="h-8 text-xs" /></div></div>
            <div className="grid grid-cols-2 gap-3"><div className="space-y-1"><Label className="text-xs">Tên TVV</Label><Input placeholder="Nguyễn Văn A" value={newContract.agentName} onChange={(e) => setNewContract({ ...newContract, agentName: e.target.value })} className="h-8 text-xs" /></div><div className="space-y-1"><Label className="text-xs">Chức vụ</Label><Select value={newContract.position} onValueChange={(v) => setNewContract({ ...newContract, position: v })}><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Chọn" /></SelectTrigger><SelectContent><SelectItem value="Tư vấn tài chính">TVV</SelectItem><SelectItem value="Trưởng nhóm">Trưởng nhóm</SelectItem><SelectItem value="Tiền trưởng nhóm">Tiền trưởng nhóm</SelectItem><SelectItem value="Trưởng ban">Trưởng ban</SelectItem></SelectContent></Select></div></div>
            <div className="grid grid-cols-3 gap-3"><div className="space-y-1"><Label className="text-xs">Ban</Label><Input value={newContract.ban} onChange={(e) => setNewContract({ ...newContract, ban: e.target.value })} className="h-8 text-xs" /></div><div className="space-y-1"><Label className="text-xs">Nhóm</Label><Input value={newContract.nhom} onChange={(e) => setNewContract({ ...newContract, nhom: e.target.value })} className="h-8 text-xs" /></div><div className="space-y-1"><Label className="text-xs">Mã nhóm</Label><Input value={newContract.maNhom} onChange={(e) => setNewContract({ ...newContract, maNhom: e.target.value })} className="h-8 text-xs" /></div></div>
            <div className="grid grid-cols-2 gap-3"><div className="space-y-1"><Label className="text-xs">Mã NYD tuyển dụng</Label><Input placeholder="Mã đại lý tuyển dụng" value={newContract.recruiterCode} onChange={(e) => setNewContract({ ...newContract, recruiterCode: e.target.value })} className="h-8 text-xs" /></div><div className="space-y-1"><Label className="text-xs">Ngày bắt đầu LV</Label><Input type="date" value={newContract.startDate} onChange={(e) => setNewContract({ ...newContract, startDate: e.target.value })} className="h-8 text-xs" /></div></div>
            <div className="grid grid-cols-2 gap-3"><div className="space-y-1"><Label className="text-xs">Ngày hiệu lực</Label><Input type="date" value={newContract.effectiveDate} onChange={(e) => setNewContract({ ...newContract, effectiveDate: e.target.value })} className="h-8 text-xs" /></div><div className="space-y-1"><Label className="text-xs">Ngày phát hành</Label><Input type="date" value={newContract.issueDate} onChange={(e) => setNewContract({ ...newContract, issueDate: e.target.value })} className="h-8 text-xs" /></div></div>
            <div className="grid grid-cols-3 gap-3"><div className="space-y-1"><Label className="text-xs">IP (VNĐ)</Label><Input type="number" value={newContract.fyp} onChange={(e) => setNewContract({ ...newContract, fyp: e.target.value })} className="h-8 text-xs" /></div><div className="space-y-1"><Label className="text-xs">AFYP (VNĐ)</Label><Input type="number" value={newContract.afyp} onChange={(e) => setNewContract({ ...newContract, afyp: e.target.value })} className="h-8 text-xs" /></div><div className="space-y-1"><Label className="text-xs">Tính Lượt</Label><Input type="number" value={newContract.tinhLuot} onChange={(e) => setNewContract({ ...newContract, tinhLuot: e.target.value })} className="h-8 text-xs" /></div></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setIsAddDialogOpen(false)} className="h-8">Hủy</Button><Button onClick={handleCreateContract} className="bg-emerald-600 hover:bg-emerald-700 h-8">Tạo hợp đồng</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
