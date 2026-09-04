import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { BrowserWindow, dialog } from "electron";
import * as XLSX from "xlsx";
import { getDb, transaction } from "../db";
import { normalizePhone, serviceDates, toISO } from "../../shared/domain";
import { buildSampleWorkbook } from "../make-sample";
import type { Customer, ExcelInspection, ImportField, ServiceKey } from "../../shared/types";

type Row = {
  id: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  product: string;
  serial_no: string;
  selling_date: string;
  amount: number;
  notes: string;
  service1_done: number;
  service2_done: number;
  service3_done: number;
  service1_done_at: string | null;
  service2_done_at: string | null;
  service3_done_at: string | null;
  created_at: string;
  updated_at: string;
};

function toCustomer(r: Row): Customer {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    address: r.address,
    city: r.city,
    product: r.product,
    serialNo: r.serial_no,
    sellingDate: r.selling_date,
    amount: r.amount,
    notes: r.notes,
    done: {
      service1: !!r.service1_done,
      service2: !!r.service2_done,
      service3: !!r.service3_done,
    },
    doneAt: {
      service1: r.service1_done_at,
      service2: r.service2_done_at,
      service3: r.service3_done_at,
    },
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function listCustomers(): Customer[] {
  const rows = getDb()
    .prepare("SELECT * FROM customers ORDER BY datetime(created_at) DESC")
    .all() as Row[];
  return rows.map(toCustomer);
}

export function getCustomer(id: string): Customer | null {
  const row = getDb().prepare("SELECT * FROM customers WHERE id = ?").get(id) as Row | undefined;
  return row ? toCustomer(row) : null;
}

const UPSERT = `
  INSERT INTO customers
    (id, name, phone, address, city, product, serial_no, selling_date, amount, notes,
     service1_done, service2_done, service3_done,
     service1_done_at, service2_done_at, service3_done_at, updated_at)
  VALUES
    (@id, @name, @phone, @address, @city, @product, @serial_no, @selling_date, @amount, @notes,
     @service1_done, @service2_done, @service3_done,
     @service1_done_at, @service2_done_at, @service3_done_at, datetime('now'))
  ON CONFLICT(id) DO UPDATE SET
    name=excluded.name, phone=excluded.phone, address=excluded.address, city=excluded.city,
    product=excluded.product, serial_no=excluded.serial_no, selling_date=excluded.selling_date,
    amount=excluded.amount, notes=excluded.notes,
    service1_done=excluded.service1_done, service2_done=excluded.service2_done, service3_done=excluded.service3_done,
    service1_done_at=excluded.service1_done_at, service2_done_at=excluded.service2_done_at,
    service3_done_at=excluded.service3_done_at, updated_at=datetime('now')
`;

function toParams(c: Customer) {
  const now = new Date().toISOString().slice(0, 10);
  return {
    id: c.id || randomUUID(),
    name: c.name ?? "",
    phone: c.phone ?? "",
    address: c.address ?? "",
    city: c.city ?? "",
    product: c.product ?? "",
    serial_no: c.serialNo ?? "",
    selling_date: c.sellingDate || now,
    amount: Number(c.amount) || 0,
    notes: c.notes ?? "",
    service1_done: c.done?.service1 ? 1 : 0,
    service2_done: c.done?.service2 ? 1 : 0,
    service3_done: c.done?.service3 ? 1 : 0,
    service1_done_at: c.doneAt?.service1 ?? (c.done?.service1 ? now : null),
    service2_done_at: c.doneAt?.service2 ?? (c.done?.service2 ? now : null),
    service3_done_at: c.doneAt?.service3 ?? (c.done?.service3 ? now : null),
  };
}

export function saveCustomer(c: Customer): Customer {
  // A fresh record (no createdAt) that reuses an existing ID would silently
  // overwrite that customer — reject it instead.
  if (c.id && !c.createdAt && getCustomer(c.id)) {
    throw new Error(`A customer with ID "${c.id}" already exists.`);
  }
  const params = toParams(c);
  getDb().prepare(UPSERT).run(params);
  return getCustomer(params.id)!;
}

export function removeCustomer(id: string): void {
  getDb().prepare("DELETE FROM customers WHERE id = ?").run(id);
}

export function setServiceDone(id: string, key: ServiceKey, done: boolean): Customer | null {
  const col = `${key}_done`;
  const at = `${key}_done_at`;
  getDb()
    .prepare(
      `UPDATE customers SET ${col} = ?, ${at} = ?, updated_at = datetime('now') WHERE id = ?`,
    )
    .run(done ? 1 : 0, done ? new Date().toISOString().slice(0, 10) : null, id);
  return getCustomer(id);
}

export function importRows(rows: Customer[]): number {
  const stmt = getDb().prepare(UPSERT);
  transaction(() => {
    for (const c of rows) stmt.run(toParams({ ...c, id: c.id || randomUUID() }));
  });
  return rows.length;
}

/* ---------------- Excel import / export (moved from src/lib/excel.ts) ---------------- */

const HEADER_MAP: Record<string, keyof Customer | "serialNo"> = {
  id: "id",
  customerid: "id",
  custid: "id",
  cid: "id",
  code: "id",
  customercode: "id",
  custcode: "id",
  name: "name",
  customer: "name",
  customername: "name",
  phone: "phone",
  mobile: "phone",
  mobileno: "phone",
  contact: "phone",
  whatsapp: "phone",
  address: "address",
  city: "city",
  area: "city",
  product: "product",
  model: "product",
  item: "product",
  serial: "serialNo",
  serialno: "serialNo",
  slno: "serialNo",
  amount: "amount",
  price: "amount",
  total: "amount",
  sellingdate: "sellingDate",
  saledate: "sellingDate",
  date: "sellingDate",
  purchasedate: "sellingDate",
  installationdate: "sellingDate",
  notes: "notes",
  remark: "notes",
  remarks: "notes",
};

function normalise(key: string) {
  return key.toLowerCase().replace(/[^a-z]/g, "");
}

function parseDate(value: unknown): string {
  if (value instanceof Date) return toISO(value);
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return toISO(new Date(parsed.y, parsed.m - 1, parsed.d));
  }
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const dmy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dmy) {
    const year = Number(dmy[3]!.length === 2 ? `20${dmy[3]}` : dmy[3]);
    return toISO(new Date(year, Number(dmy[2]) - 1, Number(dmy[1])));
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? "" : toISO(d);
}

function emptyCustomer(): Customer {
  return {
    id: randomUUID(),
    name: "",
    phone: "",
    address: "",
    city: "",
    product: "",
    serialNo: "",
    sellingDate: "",
    amount: 0,
    notes: "",
    done: { service1: false, service2: false, service3: false },
    doneAt: { service1: null, service2: null, service3: null },
  };
}

function parseWorkbook(buffer: Buffer): Customer[] {
  const wb = XLSX.read(buffer, { cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  return rows
    .map((row) => {
      const customer = emptyCustomer();
      for (const [rawKey, value] of Object.entries(row)) {
        const field = HEADER_MAP[normalise(rawKey)];
        if (!field) continue;
        if (field === "amount") {
          customer.amount = Number(String(value).replace(/[^\d.]/g, "")) || 0;
        } else if (field === "sellingDate") {
          customer.sellingDate = parseDate(value);
        } else {
          (customer[field] as string) = String(value ?? "").trim();
        }
      }
      if (!customer.sellingDate) customer.sellingDate = toISO(new Date());
      return customer;
    })
    .filter((c) => c.name || c.phone);
}

export async function importExcelViaDialog(win: BrowserWindow | null): Promise<{
  imported: number;
  fileName: string | null;
  canceled: boolean;
}> {
  const opts = {
    title: "Import customer sheet",
    filters: [{ name: "Spreadsheets", extensions: ["xlsx", "xls", "csv"] }],
    properties: ["openFile" as const],
  };
  const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts);
  if (res.canceled || !res.filePaths[0]) return { imported: 0, fileName: null, canceled: true };
  const path = res.filePaths[0];
  const buffer = readFileSync(path);
  const parsed = parseWorkbook(buffer);
  const imported = importRows(parsed);
  return { imported, fileName: path.split(/[\\/]/).pop() ?? path, canceled: false };
}

/* --------------- guided import: inspect columns, then import with a mapping --------------- */

function autoMapColumns(columns: string[]): Record<string, ImportField | ""> {
  const out: Record<string, ImportField | ""> = {};
  for (const col of columns) {
    const f = HEADER_MAP[normalise(col)];
    out[col] = (f as ImportField) ?? "";
  }
  return out;
}

export async function inspectExcelViaDialog(win: BrowserWindow | null): Promise<ExcelInspection> {
  const opts = {
    title: "Import customer sheet",
    filters: [{ name: "Spreadsheets", extensions: ["xlsx", "xls", "csv"] }],
    properties: ["openFile" as const],
  };
  const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts);
  if (res.canceled || !res.filePaths[0]) {
    return { canceled: true, filePath: null, fileName: null, sheets: [], autoMap: {} };
  }
  const filePath = res.filePaths[0];
  const wb = XLSX.read(readFileSync(filePath), { cellDates: true });

  const sheets = wb.SheetNames.map((name) => {
    const sheet = wb.Sheets[name];
    const json = sheet
      ? XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" })
      : [];
    const columns = json.length ? Object.keys(json[0]!) : [];
    const sample = json.slice(0, 3).map((r) => {
      const o: Record<string, string> = {};
      for (const c of columns) o[c] = String(r[c] ?? "").trim();
      return o;
    });
    return { name, columns, sample };
  });

  return {
    canceled: false,
    filePath,
    fileName: filePath.split(/[\\/]/).pop() ?? filePath,
    sheets,
    autoMap: autoMapColumns(sheets[0]?.columns ?? []),
  };
}

function rowsFromMapping(
  filePath: string,
  sheetName: string,
  mapping: Record<string, ImportField | "">,
): Customer[] {
  const wb = XLSX.read(readFileSync(filePath), { cellDates: true });
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return [];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  return json
    .map((row) => {
      const c = emptyCustomer();
      for (const [col, field] of Object.entries(mapping)) {
        if (!field) continue;
        const value = row[col];
        if (field === "amount") c.amount = Number(String(value).replace(/[^\d.]/g, "")) || 0;
        else if (field === "sellingDate") c.sellingDate = parseDate(value);
        else (c[field] as string) = String(value ?? "").trim();
      }
      if (!c.sellingDate) c.sellingDate = toISO(new Date());
      return c;
    })
    .filter((c) => c.name || c.phone);
}

export function importExcelMapped(input: {
  filePath: string;
  sheet: string;
  mapping: Record<string, ImportField | "">;
  skipDuplicates: boolean;
}): { imported: number; skipped: number; total: number } {
  let rows = rowsFromMapping(input.filePath, input.sheet, input.mapping);
  const total = rows.length;
  let skipped = 0;

  const idMapped = Object.values(input.mapping).includes("id");

  if (input.skipDuplicates) {
    const existing = listCustomers();
    const ids = new Set(existing.map((c) => c.id));
    const phones = new Set(
      existing.map((c) => normalizePhone(c.phone)).filter((p): p is string => !!p),
    );
    const serials = new Set(existing.map((c) => c.serialNo.trim().toLowerCase()).filter(Boolean));
    rows = rows.filter((c) => {
      const p = normalizePhone(c.phone);
      const s = c.serialNo.trim().toLowerCase();
      const hasId = idMapped && !!c.id;
      if ((hasId && ids.has(c.id)) || (p && phones.has(p)) || (s && serials.has(s))) {
        skipped++;
        return false;
      }
      if (hasId) ids.add(c.id);
      if (p) phones.add(p);
      if (s) serials.add(s);
      return true;
    });
  }

  const imported = importRows(rows);
  return { imported, skipped, total };
}

export async function sampleExcelViaDialog(win: BrowserWindow | null): Promise<{
  saved: boolean;
  path: string | null;
}> {
  const opts = {
    title: "Save sample customer sheet",
    defaultPath: "Sample-Customers.xlsx",
    filters: [{ name: "Excel workbook", extensions: ["xlsx"] }],
  };
  const res = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts);
  if (res.canceled || !res.filePath) return { saved: false, path: null };
  XLSX.writeFile(buildSampleWorkbook(), res.filePath);
  return { saved: true, path: res.filePath };
}

export async function exportExcelViaDialog(win: BrowserWindow | null): Promise<{
  saved: boolean;
  path: string | null;
}> {
  const customers = listCustomers();
  const saveOpts = {
    title: "Export customers",
    defaultPath: "sadguru-customers.xlsx",
    filters: [{ name: "Excel workbook", extensions: ["xlsx"] }],
  };
  const res = win
    ? await dialog.showSaveDialog(win, saveOpts)
    : await dialog.showSaveDialog(saveOpts);
  if (res.canceled || !res.filePath) return { saved: false, path: null };

  const rows = customers.map((c) => {
    const d = serviceDates(c);
    return {
      "Customer ID": c.id,
      Name: c.name,
      Phone: c.phone,
      Address: c.address,
      City: c.city,
      Product: c.product,
      "Serial No": c.serialNo,
      "Selling Date": c.sellingDate,
      Amount: c.amount,
      "Service 1": d.service1,
      "Service 2": d.service2,
      "Service 3": d.service3,
      Notes: c.notes,
    };
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Customers");
  XLSX.writeFile(wb, res.filePath);
  return { saved: true, path: res.filePath };
}
