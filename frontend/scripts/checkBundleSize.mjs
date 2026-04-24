import { readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const GATE_STATUS = Object.freeze({ PASS: "PASS", FAIL: "FAIL" });

const BUDGETS = Object.freeze({
  totalBytes: 1_100_000,
  jsBytes: 1_030_000,
  cssBytes: 70_000
});

const here = dirname(fileURLToPath(import.meta.url));
const distAssets = join(here, "..", "dist", "assets");

function collectAssets() {
  let entries;
  try {
    entries = readdirSync(distAssets);
  } catch (err) {
    console.error(
      `BUNDLE_BUDGET: dist/assets not found at ${distAssets}. Run \`yarn build\` first.`
    );
    console.error(err);
    process.exit(2);
  }
  const out = { js: 0, css: 0, total: 0, files: [] };
  for (const name of entries) {
    const full = join(distAssets, name);
    const size = statSync(full).size;
    out.total += size;
    out.files.push({ name, size });
    if (name.endsWith(".js")) out.js += size;
    else if (name.endsWith(".css")) out.css += size;
  }
  return out;
}

function format(bytes) {
  return `${(bytes / 1024).toFixed(1)}KiB`;
}

const summary = collectAssets();
const totalStatus = summary.total <= BUDGETS.totalBytes ? GATE_STATUS.PASS : GATE_STATUS.FAIL;
const jsStatus = summary.js <= BUDGETS.jsBytes ? GATE_STATUS.PASS : GATE_STATUS.FAIL;
const cssStatus = summary.css <= BUDGETS.cssBytes ? GATE_STATUS.PASS : GATE_STATUS.FAIL;

console.log(
  `BUNDLE_BUDGET: total=${format(summary.total)} budget=${format(BUDGETS.totalBytes)} ${totalStatus}`
);
console.log(
  `BUNDLE_BUDGET: js=${format(summary.js)} budget=${format(BUDGETS.jsBytes)} ${jsStatus}`
);
console.log(
  `BUNDLE_BUDGET: css=${format(summary.css)} budget=${format(BUDGETS.cssBytes)} ${cssStatus}`
);
for (const f of summary.files) {
  console.log(`BUNDLE_FILE: ${f.name} ${format(f.size)}`);
}

if (totalStatus === GATE_STATUS.FAIL || jsStatus === GATE_STATUS.FAIL || cssStatus === GATE_STATUS.FAIL) {
  process.exit(1);
}
