import * as XLSX from "xlsx";
import { join } from "node:path";

/** The columns the importer understands, with a few example rows. */
export const SAMPLE_ROWS = [
  {
    "Customer ID": "SG-001",
    Name: "Ramesh Patel",
    Phone: "9825012345",
    City: "Rajkot",
    Address: "12 Kalawad Road",
    "Product / Model": "Aqua RO Elite",
    "Serial No": "ARE-2024-0012",
    "Selling Date": "2025-01-15",
    Amount: 12500,
    Notes: "Paid cash",
  },
  {
    "Customer ID": "SG-002",
    Name: "Sunita Shah",
    Phone: "+91 98240 55667",
    City: "Jamnagar",
    Address: "Flat 4, Green Residency",
    "Product / Model": "Aqua RO Max",
    "Serial No": "ARM-2024-0187",
    "Selling Date": "15/03/2025",
    Amount: 15900,
    Notes: "",
  },
  {
    "Customer ID": "SG-003",
    Name: "Imran Sheikh",
    Phone: "9601122334",
    City: "Rajkot",
    Address: "Nr. Bus Stand, Gondal Road",
    "Product / Model": "Aqua RO Elite",
    "Serial No": "ARE-2025-0004",
    "Selling Date": "2025-06-02",
    Amount: 12500,
    Notes: "EMI - 3 months",
  },
];

export function buildSampleWorkbook(): XLSX.WorkBook {
  const ws = XLSX.utils.json_to_sheet(SAMPLE_ROWS);
  ws["!cols"] = [
    { wch: 12 },
    { wch: 18 },
    { wch: 16 },
    { wch: 12 },
    { wch: 26 },
    { wch: 16 },
    { wch: 16 },
    { wch: 13 },
    { wch: 9 },
    { wch: 18 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Customers");
  return wb;
}

export function makeSample(projectRoot: string): void {
  const out = join(projectRoot, "Sample-Customers.xlsx");
  XLSX.writeFile(buildSampleWorkbook(), out);
  console.log("wrote " + out);
}
