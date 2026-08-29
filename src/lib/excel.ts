import * as XLSX from "xlsx";
import { emptyCustomer, serviceDates, toISO, type Customer } from "./store";

const HEADER_MAP: Record<string, keyof Customer> = {
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

export async function parseWorkbook(file: File): Promise<Customer[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]!];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  return rows
    .map((row) => {
      const customer = emptyCustomer();
      customer.sellingDate = "";
      for (const [rawKey, value] of Object.entries(row)) {
        const field = HEADER_MAP[normalise(rawKey)];
        if (!field) continue;
        if (field === "amount") customer.amount = Number(String(value).replace(/[^\d.]/g, "")) || 0;
        else if (field === "sellingDate") customer.sellingDate = parseDate(value);
        else if (field !== "done" && field !== "id")
          (customer[field] as string) = String(value ?? "").trim();
      }
      if (!customer.sellingDate) customer.sellingDate = toISO(new Date());
      return customer;
    })
    .filter((c) => c.name || c.phone);
}

export function exportCustomers(customers: Customer[]) {
  const rows = customers.map((c) => {
    const d = serviceDates(c);
    return {
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
  XLSX.writeFile(wb, "sadguru-customers.xlsx");
}
