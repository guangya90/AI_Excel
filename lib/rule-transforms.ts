// ============================================================
// 规则变换处理器 — 英文key引擎 + HEADER_ALIAS_MAP归一化
// ============================================================

import type {
  ParsedTable, RegionConfig, ColumnMapping, DefaultValues,
  FooterRule, TextBlock, CardConfig, MatrixTransposeConfig,
  CompositeCellConfig, TextParseConfig, OrderGroupResult,
} from "./rule-types";
import { HEADER_ALIAS_MAP, DETAIL_ALIAS_MAP, HEADER_EN_KEYS, DETAIL_EN_KEYS, REQUIRED_DETAIL_FIELDS } from "./order-types";

function normalizeKey(raw: string, map: Record<string, string>): string {
  const t = raw.trim();
  if (map[t]) return map[t];
  const clean = t.replace(/[【】\[\]（）()_\s：:]/g, "");
  for (const [alias, target] of Object.entries(map)) {
    const a = alias.replace(/[【】\[\]（）()_\s：:]/g, "");
    if (clean === a || clean.includes(a) || a.includes(clean)) return target;
  }
  return t;
}

export function extractFlatRows(
  table: ParsedTable, columns: ColumnMapping, defaults?: DefaultValues, _region?: RegionConfig,
): Record<string, string>[] {
  const hi = buildHeaderIndex(table.headers);
  const cim = new Map<string, number>();
  for (const [k, v] of Object.entries(columns)) {
    const idx = hi.get(v);
    if (idx !== undefined) cim.set(k, idx);
  }
  const results: Record<string, string>[] = [];
  for (let i = 0; i < table.rows.length; i++) {
    const row = table.rows[i];
    const r: Record<string, string> = {};
    for (const [f, ci] of cim) {
      r[f] = row[ci] ? String(row[ci].value).trim() : "";
    }
    if (Object.values(r).every((v) => v === "")) continue;
    const fv = Object.values(r)[0] || "";
    if (fv.includes("合计") || fv === "小计") continue;
    results.push(r);
  }
  return results;
}

export function groupRowsByHeaderKey(
  flatRows: Record<string, string>[], groupKey: string,
  _hc: ColumnMapping, _dc: ColumnMapping,
): OrderGroupResult[] {
  const gm = new Map<string, { header: Record<string, string>; details: Record<string, string>[] }>();

  for (const row of flatRows) {
    const code = row["externalCode"] || "";
    const store = row["receiverStore"] || "";
    const name = row["receiverName"] || "";
    const key = [code, store, name].filter(Boolean).join("|") || "__nogroup__";

    if (!gm.has(key)) {
      const h: Record<string, string> = {};
      for (const f of HEADER_EN_KEYS) h[f] = row[f] || "";
      gm.set(key, { header: h, details: [] });
    } else {
      const g = gm.get(key)!;
      for (const f of HEADER_EN_KEYS) if (!g.header[f] && row[f]) g.header[f] = row[f];
    }
    const d: Record<string, string> = {};
    for (const f of DETAIL_EN_KEYS) d[f] = row[f] || "";
    if (Object.values(d).every((v) => v === "")) continue;
    gm.get(key)!.details.push(d);
  }
  return Array.from(gm.values()).map((g) => ({ header: g.header, details: g.details }));
}

export function applyMatrixTranspose(
  table: ParsedTable, columns: ColumnMapping, config?: unknown, defaults?: DefaultValues, region?: RegionConfig,
): Record<string, string>[] {
  const c = config as MatrixTransposeConfig;
  const ps = c?.pivotColumnStart ?? 1;
  const hr = table.rawMatrix?.[region?.headerRow ?? 0] || [];
  const stores: string[] = [];
  for (let i = ps; i < hr.length; i++) { const v = String(hr[i] ?? "").trim(); if (v) stores.push(v); }
  const hi = buildHeaderIndex(table.headers);
  const ds = region?.dataStartRow ?? ((region?.headerRow ?? 0) + 1);
  const de = region?.dataEndRow ?? table.rows.length;
  const pf = "receiverStore";
  const rs: Record<string, string>[] = [];
  for (let r = ds; r < de && r < table.rows.length; r++) {
    const row = table.rows[r];
    const ff: Record<string, string> = {};
    for (const [sf, sc] of Object.entries(columns)) {
      const idx = hi.get(sc);
      if (idx !== undefined && idx < ps) ff[sf] = row[idx] ? String(row[idx].value).trim() : "";
    }
    for (let si = 0; si < stores.length; si++) {
      const ci = ps + si;
      if (ci >= row.length) continue;
      const v = row[ci] ? String(row[ci].value).trim() : "";
      if (!v || v === "0" || v === "-") continue;
      rs.push({ ...ff, [pf]: stores[si], skuQty: v });
    }
  }
  return rs;
}

export function applyCardSplit(
  table: ParsedTable, columns: ColumnMapping, config?: unknown, defaults?: DefaultValues, region?: RegionConfig,
): Record<string, string>[] {
  const c = config as CardConfig; const mk = c?.startMarker ?? ""; const fm = c?.fieldsBeforeTable ?? {};
  const hi = buildHeaderIndex(table.headers); const rs: Record<string, string>[] = [];
  let card: { f: Record<string, string>; r: Record<string, string>[] } | null = null;
  for (let i = 0; i < table.rows.length; i++) {
    const row = table.rows[i]; const fc = row[0] ? String(row[0].value).trim() : "";
    if (fc && mk && fc.includes(mk)) {
      if (card) { for (const it of card.r) rs.push({ ...card.f, ...it }); }
      card = { f: {}, r: [] };
      if (fm) for (const [field, off] of Object.entries(fm)) {
        const t = i + (typeof off === "number" ? off : 0);
        if (t < table.rows.length) for (const cell of table.rows[t]) {
          const cv = String(cell.value).trim();
          if (cv && !cv.includes(mk)) { card.f[field] = cv; break; }
        }
      }
      continue;
    }
    if (card && !row.every((ce) => !String(ce.value).trim())) {
      const r: Record<string, string> = {};
      for (const [sf, sc] of Object.entries(columns)) {
        const idx = hi.get(sc);
        if (idx !== undefined) r[sf] = row[idx] ? String(row[idx].value).trim() : "";
      }
      if (Object.values(r).some((v) => v)) card.r.push(r);
    }
  }
  if (card) { for (const it of card.r) rs.push({ ...card.f, ...it }); }
  return rs;
}

export function applyCompositeCellSplit(
  table: ParsedTable, columns: ColumnMapping, config?: unknown, defaults?: DefaultValues, region?: RegionConfig,
): Record<string, string>[] {
  const c = config as CompositeCellConfig; const sep = c?.separator ?? "\n"; const mode = c?.mode ?? "split";
  const hi = buildHeaderIndex(table.headers); const ds = region?.dataStartRow ?? 0; const de = region?.dataEndRow ?? table.rows.length;
  const rs: Record<string, string>[] = [];
  for (let r = ds; r < de && r < table.rows.length; r++) {
    const row = table.rows[r]; const bf: Record<string, string> = {};
    const cc: { ci: number; f: string; v: string }[] = [];
    for (const [sf, sc] of Object.entries(columns)) {
      const idx = hi.get(sc); if (idx === undefined) continue;
      const raw = row[idx] ? String(row[idx].value).trim() : "";
      if (!raw || raw === "0" || raw === "-") continue;
      raw.includes(sep) ? cc.push({ ci: idx, f: sf, v: raw }) : (bf[sf] = raw);
    }
    if (!cc.length) { if (Object.values(bf).some((v) => v)) rs.push(bf); continue; }
    if (mode === "split") {
      const sa = cc.map((x) => x.v.split(sep).map((s) => s.trim()).filter(Boolean));
      for (let si = 0; si < Math.max(...sa.map((a) => a.length)); si++) {
        const res = { ...bf }; for (let ci = 0; ci < cc.length; ci++) res[cc[ci].f] = sa[ci][si] ?? ""; rs.push(res);
      }
    } else {
      for (const x of cc) for (const p of x.v.split(sep).map((s) => s.trim()).filter(Boolean)) rs.push({ ...bf, [x.f]: p });
    }
  }
  return rs;
}

export function applyTextParse(tb: TextBlock[], config?: unknown): Record<string, string>[] {
  const c = config as TextParseConfig; const sep = c?.recordSeparator ?? "━"; const fp = c?.fieldPatterns ?? {};
  const ip = c?.itemPattern ?? ""; const rs: Record<string, string>[] = [];
  const full = tb.map((b) => b.text).join("\n");
  for (const rec of full.split(sep).filter((r) => r.trim())) {
    const fields: Record<string, string> = {};
    const lines = rec.split("\n").map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      let matched = false;
      for (const [f, p] of Object.entries(fp)) { const m = line.match(new RegExp(p, "i")); if (m?.[1]) { fields[f] = m[1].trim(); matched = true; break; } }
      if (!matched && ip) {
        const m = line.match(new RegExp(ip, "i"));
        if (m) {
          if (m.groups) for (const [k, v] of Object.entries(m.groups)) fields[k] = v?.trim() ?? "";
          if (m.length > 1 && !m.groups) { fields.skuCode = m[1]?.trim() ?? ""; fields.skuName = m[2]?.trim() ?? ""; fields.skuSpec = m[3]?.trim() ?? ""; fields.skuQty = m[4]?.trim() ?? ""; }
        }
      }
    }
    if (Object.keys(fields).length) rs.push(fields);
  }
  return rs;
}

export function extractFooterFields(
  table: ParsedTable, rules: FooterRule[], region?: RegionConfig,
): { extracted: boolean; fields: Record<string, string> } {
  const f: Record<string, string> = {}; let e = false;
  const sr = region?.dataEndRow ?? Math.max(0, table.rows.length - 10);
  const er = Math.min(table.rows.length, sr + 20);
  for (const rule of rules) {
    for (let r = sr; r < er && r < table.rows.length; r++) {
      const rt = table.rows[r].map((c) => String(c?.value ?? "")).join(" ");
      const m = rt.match(new RegExp(rule.pattern, "i"));
      if (m?.[1]) { f[rule.field] = m[1].trim(); e = true; break; }
      if (rule.offset) {
        const or = r + rule.offset;
        if (or >= 0 && or < table.rows.length) { const ot = table.rows[or].map((c) => String(c?.value ?? "")).join(" ").trim(); if (ot) { f[rule.field] = ot; e = true; } }
        break;
      }
    }
  }
  return { extracted: e, fields: f };
}

function buildHeaderIndex(headers: string[]): Map<string, number> {
  const m = new Map<string, number>();
  headers.forEach((h, i) => { if (!m.has(h)) m.set(h, i); });
  return m;
}
