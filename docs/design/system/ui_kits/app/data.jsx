// data.js — mock invoice & vendor data
const INVOICES = [
  { id: "i1", status: "needs_review", severity: "critical", vendor: "Tata Consultancy Services", number: "INV-241208-9145", date: "12-Apr-2026", gstin: "27AAACR0123A1Z5", section: "194J", rate: 10, gross: 47200000, tds: 4720000, tcs: 0, net: 42480000, age: 2, hint: "PAN absent · 206AA penalty" },
  { id: "i2", status: "needs_review", severity: "warning", vendor: "Mahalakshmi Power Loom", number: "MPL/2526/0412", date: "10-Apr-2026", gstin: "33AABCM4521J1ZX", section: "194C", rate: 1, gross: 11520000, tds: 115200, tcs: 0, net: 11404800, age: 3, hint: "IRN missing · over threshold" },
  { id: "i3", status: "awaiting_approval", severity: "info", vendor: "Reliance Jio Infocomm", number: "RJIL-92834", date: "08-Apr-2026", gstin: "27AAACR5055K1ZA", section: "194J", rate: 10, gross: 92840000, tds: 9284000, tcs: 0, net: 83556000, age: 5, hint: "Step 2 / 3 · CA sign-off" },
  { id: "i4", status: "awaiting_approval", severity: "warning", vendor: "Sundaram Stationers", number: "SS/26/0093", date: "07-Apr-2026", gstin: "33ABCDE2345F1Z9", section: "194C", rate: 2, gross: 4080000, tds: 81600, tcs: 0, net: 3998400, age: 6, hint: "Step 1 / 2 · vendor bank changed" },
  { id: "i5", status: "needs_review", severity: "critical", vendor: "Anonymous Trader (no GSTIN)", number: "AT-0006", date: "06-Apr-2026", gstin: "—", section: "—", rate: 0, gross: 1820000, tds: 0, tcs: 0, net: 1820000, age: 7, hint: "Multi-match GSTIN · triage" },
  { id: "i6", status: "approved", severity: "info", vendor: "Asian Paints Ltd", number: "AP-INV-22041", date: "05-Apr-2026", gstin: "27AAACA6666D1Z7", section: "194Q", rate: 0.1, gross: 122400000, tds: 122400, tcs: 0, net: 122277600, age: 8, hint: "Approved · ready to export" },
  { id: "i7", status: "exported", severity: "info", vendor: "Infosys Ltd", number: "INF-2526-9912", date: "02-Apr-2026", gstin: "29AAACI4741P1ZP", section: "194J", rate: 10, gross: 354000000, tds: 35400000, tcs: 0, net: 318600000, age: 12, hint: "Voucher #V-2604-0012" },
];

function inrFmt(minor) {
  // amounts stored as paise (×100). Format as Indian grouping.
  const rupees = minor / 100;
  const negative = rupees < 0;
  const abs = Math.abs(rupees);
  const [intp, fp] = abs.toFixed(2).split(".");
  let result = "";
  const last3 = intp.slice(-3);
  const rest = intp.slice(0, -3);
  if (rest.length > 0) {
    result = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3;
  } else {
    result = last3;
  }
  return (negative ? "− " : "") + "₹ " + result + "." + fp;
}

const VENDORS = [
  { name: "Tata Consultancy Services", pan: "AAACR0123A", gstin: "27AAACR0123A1Z5", section: "194J", fyTds: 14720000, msme: false, tally: "synced", bills: 23, lastInvoice: "12-Apr-2026" },
  { name: "Reliance Jio Infocomm", pan: "AAACR5055K", gstin: "27AAACR5055K1ZA", section: "194J", fyTds: 9284000, msme: false, tally: "synced", bills: 4, lastInvoice: "08-Apr-2026" },
  { name: "Mahalakshmi Power Loom", pan: "AABCM4521J", gstin: "33AABCM4521J1ZX", section: "194C", fyTds: 815200, msme: true, tally: "drift", bills: 11, lastInvoice: "10-Apr-2026" },
  { name: "Sundaram Stationers", pan: "ABCDE2345F", gstin: "33ABCDE2345F1Z9", section: "194C", fyTds: 281600, msme: true, tally: "synced", bills: 6, lastInvoice: "07-Apr-2026" },
  { name: "Asian Paints Ltd", pan: "AAACA6666D", gstin: "27AAACA6666D1Z7", section: "194Q", fyTds: 122400, msme: false, tally: "pending", bills: 2, lastInvoice: "05-Apr-2026" },
  { name: "Anonymous Trader", pan: "—", gstin: "—", section: "—", fyTds: 0, msme: false, tally: "missing", bills: 1, lastInvoice: "06-Apr-2026" },
];

const REALMS = [
  { id: "r1", name: "Sundaram Textiles Pvt Ltd", recent: 1 },
  { id: "r2", name: "Hari Vishnu Industries", recent: 2 },
  { id: "r3", name: "Coastal Aqua Exports LLP", recent: 3 },
  { id: "r4", name: "Patel & Patel Logistics", recent: 4 },
  { id: "r5", name: "Madurai Sweets & Snacks", recent: 5 },
  { id: "r6", name: "Innova Software Solutions" },
  { id: "r7", name: "BlueOcean Marine Pvt Ltd" },
  { id: "r8", name: "Greenleaf Organics" },
];

window.INVOICES = INVOICES;
window.VENDORS = VENDORS;
window.REALMS = REALMS;
window.inrFmt = inrFmt;
