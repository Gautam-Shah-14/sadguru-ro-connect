import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rmSync } from "node:fs";
import { BrowserWindow } from "electron";
import * as XLSX from "xlsx";
import {
  importExcelMapped,
  importRows,
  listCustomers,
  removeCustomer,
  saveCustomer,
} from "./services/customers";
import { getSettings, saveSettings } from "./services/settings";
import { dueList } from "./services/reminders";
import {
  clearFestivalYearDate,
  listFestivals,
  listFestivalsForYear,
  removeFestival,
  setFestivalYearDate,
  upsertFestival,
} from "./services/festivals";
import { festivalSendCount, listMessageLog, logMessage } from "./services/messages";
import { listProviders, saveProviderKey } from "./services/ai/config";
import { clearSecret, getSecret, hasSecret } from "./services/secrets";
import {
  generateFestivalMessage,
  listFestivalMessages,
  resetFestivalMessage,
  resolveFestivalBody,
  saveFestivalMessage,
} from "./services/festivalMessages";
import {
  autoSyncFestivals,
  listHolidayProviders,
  previewFestivalSync,
  saveHolidayKey,
} from "./services/holidays";
import { buildSampleWorkbook } from "./make-sample";
import { normalizePhone, sendFestivalGreeting, sendServiceReminder } from "./services/whatsapp";
import { missedFestivals, runSchedulerTick } from "./services/scheduler";
import type { Customer } from "../shared/types";

/**
 * Headless smoke test of the backend, run with `electron . --self-test`.
 * Exercises every service against the real SQLite database and exits 0/1.
 */
export async function runSelfTest(): Promise<boolean> {
  const results: string[] = [];
  const fail = (msg: string) => {
    console.error("  ✗ " + msg);
    results.push("FAIL");
  };
  const pass = (msg: string) => console.log("  ✓ " + msg);

  try {
    // settings
    const s0 = getSettings();
    if (s0.shopName !== "Sadguru Enterprise") fail(`default shopName was ${s0.shopName}`);
    else pass("settings defaults load");
    const s1 = saveSettings({ reminderDays: 21, theme: "dark" });
    if (s1.reminderDays !== 21 || s1.theme !== "dark") fail("settings save did not round-trip");
    else pass("settings save round-trips");
    saveSettings({ reminderDays: 15, theme: "light" });

    // festivals seeded
    const fests = listFestivals();
    if (fests.length < 15) fail(`expected seeded festivals, got ${fests.length}`);
    else pass(`festivals seeded (${fests.length})`);

    // customer CRUD
    const c: Customer = {
      id: randomUUID(),
      name: "Self Test",
      phone: "+91 90000 00000",
      address: "1 Test Rd",
      city: "Rajkot",
      product: "RO Elite",
      serialNo: "ST-1",
      sellingDate: "2025-01-15",
      amount: 12000,
      notes: "",
      done: { service1: false, service2: false, service3: false },
      doneAt: { service1: null, service2: null, service3: null },
    };
    const saved = saveCustomer(c);
    if (saved.name !== "Self Test") fail("saveCustomer did not return the row");
    else pass("customer create");

    const found = listCustomers().find((x) => x.id === c.id);
    if (!found) fail("created customer not in list");
    else pass("customer list");

    const n = importRows([
      { ...c, id: randomUUID(), name: "Bulk A" },
      { ...c, id: randomUUID(), name: "Bulk B" },
    ]);
    if (n !== 2) fail(`importRows returned ${n}`);
    else pass("customer bulk import (transaction)");

    // reminders computed
    const due = dueList();
    if (!Array.isArray(due) || due.length === 0) fail("dueList empty after adding customers");
    else pass(`reminders due list computed (${due.length} items)`);

    // message log
    logMessage({ kind: "service", body: "self-test message", status: "dry-run" });
    if (listMessageLog({ limit: 5 }).length === 0) fail("message log empty after insert");
    else pass("message log write + read");

    // ---- Phase 2: AI + festival messages ----
    const providers = listProviders();
    if (providers.length === 4 && providers.every((p) => p.models.length > 0)) {
      pass(`AI provider registry (${providers.map((p) => p.id).join(", ")})`);
    } else fail("AI provider registry malformed");

    saveProviderKey("groq", "sk-selftest-fake-key");
    if (hasSecret("ai.groq.key") && getSecret("ai.groq.key") === "sk-selftest-fake-key") {
      pass("secret store encrypt/decrypt round-trip");
    } else fail("secret store did not round-trip");
    clearSecret("ai.groq.key");
    if (hasSecret("ai.groq.key")) fail("clearSecret left a value");

    const fest = listFestivals()[0]!;
    const YEAR = 2099;
    const manual = saveFestivalMessage({
      festivalId: fest.id,
      year: YEAR,
      language: "gu",
      body: "પરીક્ષણ સંદેશ {name}",
    });
    if (manual.source === "manual" && manual.festivalName === fest.name) {
      pass("festival message manual save + join");
    } else fail("festival message save wrong");

    if (listFestivalMessages(YEAR).some((m) => m.id === manual.id)) {
      pass("festival message list by year");
    } else fail("festival message not listed");

    const resolved = resolveFestivalBody(fest.id, fest.name, YEAR, "gu");
    if (resolved.body.includes("પરીક્ષણ")) pass("resolveFestivalBody returns saved message");
    else fail("resolveFestivalBody wrong");
    const resolvedFallback = resolveFestivalBody(fest.id, fest.name, YEAR, "en");
    if (resolvedFallback.source === "template" && resolvedFallback.body.includes(fest.name)) {
      pass("resolveFestivalBody falls back to template");
    } else fail("template fallback wrong");

    let threwNoKey = false;
    try {
      await generateFestivalMessage({ festivalId: fest.id, year: YEAR, language: "en" });
    } catch (err) {
      threwNoKey = err instanceof Error && /API key/i.test(err.message);
    }
    if (threwNoKey) pass("generate without key fails with a clear message");
    else fail("generate without key did not error as expected");

    resetFestivalMessage({ festivalId: fest.id, year: YEAR, language: "gu" });
    if (!listFestivalMessages(YEAR).length) pass("festival message reset/delete");
    else fail("festival message reset left rows");

    // ---- Phase 3: WhatsApp send + scheduler ----
    const phones: [string, string | null][] = [
      ["98250 12345", "919825012345"],
      ["+91 98765 43210", "919876543210"],
      ["09825012345", "919825012345"],
      ["12345", null],
    ];
    if (phones.every(([raw, want]) => normalizePhone(raw) === want)) {
      pass("phone normalisation (India)");
    } else fail("phone normalisation wrong");

    // Dry-run is the default → sends are logged, not transmitted.
    saveSettings({ waDryRun: true });
    const custForSend = saveCustomer({
      id: randomUUID(),
      name: "Send Target",
      phone: "9825099999",
      address: "",
      city: "",
      product: "RO",
      serialNo: "",
      sellingDate: "2024-06-01",
      amount: 9000,
      notes: "",
      done: { service1: false, service2: false, service3: false },
      doneAt: { service1: null, service2: null, service3: null },
    });
    const svc = await sendServiceReminder({ customerId: custForSend.id, key: "service1" });
    if (svc.status === "dry-run") pass("service reminder honours dry-run");
    else fail(`service reminder status was ${svc.status}`);

    const before = festivalSendCount(fest.id, YEAR);
    const fres = await sendFestivalGreeting({ festivalId: fest.id, year: YEAR, language: "en" });
    if (fres.dryRun >= 1 && festivalSendCount(fest.id, YEAR) > before) {
      pass(`festival greeting dry-run to all customers (${fres.dryRun} logged)`);
    } else fail(`festival greeting counts wrong ${JSON.stringify(fres)}`);

    // Scheduler: point a spare festival at today and run a tick.
    const t = new Date();
    const sched = upsertFestival({
      name: "SelfTest Festival",
      month: t.getMonth() + 1,
      day: t.getDate(),
      emoji: "🧪",
      active: true,
    });
    saveSettings({ autoFestival: true });
    await runSchedulerTick();
    const afterFirst = festivalSendCount(sched.id, t.getFullYear());
    if (t.getHours() >= 9) {
      if (afterFirst > 0) pass(`scheduler auto-sends a festival due today (${afterFirst})`);
      else fail("scheduler did not send a festival due today (hour >= 9)");
      await runSchedulerTick();
      if (festivalSendCount(sched.id, t.getFullYear()) === afterFirst) {
        pass("scheduler does not duplicate a send");
      } else fail("scheduler duplicated a send on the second tick");
    } else {
      pass("scheduler tick ran without error (before 9am, nothing sent — expected)");
    }

    if (Array.isArray(missedFestivals())) pass("missedFestivals() returns a list");
    else fail("missedFestivals() malformed");

    // ---- Phase 5: per-year festival dates + holiday sync + guided import ----
    const SY = 2098;
    const anyFest = listFestivals()[0]!;
    const beforeYearList = listFestivalsForYear(SY);
    if (beforeYearList.every((f) => f.dateSource === "default")) {
      pass("listFestivalsForYear defaults with no overrides");
    } else fail("listFestivalsForYear dateSource wrong");

    setFestivalYearDate(anyFest.id, SY, 7, 15, "calendarific");
    const withOverride = listFestivalsForYear(SY).find((f) => f.id === anyFest.id)!;
    if (
      withOverride.month === 7 &&
      withOverride.day === 15 &&
      withOverride.dateSource === "calendarific"
    ) {
      pass("setFestivalYearDate override applied");
    } else fail("year override not applied");
    clearFestivalYearDate(anyFest.id, SY);
    if (listFestivalsForYear(SY).find((f) => f.id === anyFest.id)!.dateSource === "default") {
      pass("clearFestivalYearDate removes override");
    } else fail("year override not cleared");

    const hprov = listHolidayProviders();
    if (
      hprov.length === 2 &&
      hprov
        .map((p) => p.id)
        .sort()
        .join() === "apininjas,calendarific"
    ) {
      pass("holiday provider registry");
    } else fail("holiday provider registry wrong");
    saveHolidayKey("calendarific", "selftest-fake");
    if (hasSecret("holiday.calendarific.key")) pass("holiday key stored");
    else fail("holiday key not stored");
    clearSecret("holiday.calendarific.key");
    let hThrew = false;
    try {
      await previewFestivalSync(SY);
    } catch (err) {
      hThrew = err instanceof Error && /API key/i.test(err.message);
    }
    if (hThrew) pass("previewFestivalSync without key fails clearly");
    else fail("previewFestivalSync did not error without key");

    // guided Excel import: different column names + order + a duplicate + the shop's own ID
    const xlsxPath = join(tmpdir(), `sadguru-selftest-${Date.now()}.xlsx`);
    const ws = XLSX.utils.json_to_sheet([
      {
        "Cust Code": "SGT-1",
        "Client Name": "Import One",
        "Mobile No": "9820011111",
        Machine: "RO A",
      },
      {
        "Cust Code": "SGT-2",
        "Client Name": "Import Two",
        "Mobile No": "9820022222",
        Machine: "RO B",
      },
      {
        "Cust Code": "SGT-2",
        "Client Name": "Import Two Dup",
        "Mobile No": "9820099999",
        Machine: "RO B",
      },
    ]);
    const wbx = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wbx, ws, "Data");
    XLSX.writeFile(wbx, xlsxPath);

    const impRes = importExcelMapped({
      filePath: xlsxPath,
      sheet: "Data",
      mapping: {
        "Cust Code": "id",
        "Client Name": "name",
        "Mobile No": "phone",
        Machine: "product",
      },
      skipDuplicates: true,
    });
    if (impRes.imported === 2 && impRes.skipped === 1 && impRes.total === 3) {
      pass("guided import: mapped columns, skipped a duplicate ID");
    } else fail(`guided import counts wrong ${JSON.stringify(impRes)}`);
    const importedById = listCustomers().find((r) => r.id === "SGT-1");
    if (importedById && importedById.name === "Import One") {
      pass("guided import keeps the shop's Customer ID");
    } else fail("Customer ID column was not carried over");
    for (const row of listCustomers()) {
      if (row.name.startsWith("Import ")) removeCustomer(row.id);
    }
    rmSync(xlsxPath, { force: true });

    // manual add: reusing an existing ID is rejected (a fresh record has no createdAt)
    const fresh = (id: string, name: string): Customer => ({
      id,
      name,
      phone: "9811111111",
      address: "",
      city: "",
      product: "",
      serialNo: "",
      sellingDate: "2025-02-02",
      amount: 0,
      notes: "",
      done: { service1: false, service2: false, service3: false },
      doneAt: { service1: null, service2: null, service3: null },
    });
    saveCustomer(fresh("DUP-1", "First"));
    let dupRejected = false;
    try {
      saveCustomer(fresh("DUP-1", "Second"));
    } catch (e) {
      dupRejected = e instanceof Error && /already exists/i.test(e.message);
    }
    if (dupRejected) pass("manual add rejects a duplicate Customer ID");
    else fail("duplicate Customer ID was not rejected");
    removeCustomer("DUP-1");

    // sample workbook has every importable column
    const sampleWs = buildSampleWorkbook().Sheets["Customers"]!;
    const sampleCols = Object.keys(XLSX.utils.sheet_to_json(sampleWs)[0] as object);
    if (
      ["Customer ID", "Name", "Phone", "Selling Date", "Serial No", "Amount", "Notes"].every((c) =>
        sampleCols.includes(c),
      )
    ) {
      pass("sample sheet has the expected columns");
    } else fail(`sample columns wrong: ${sampleCols.join(", ")}`);

    // auto-sync is a no-op without a holiday key
    saveSettings({ autoSyncFestivals: true });
    if ((await autoSyncFestivals()) === null) pass("autoSyncFestivals no-op without a key");
    else fail("autoSyncFestivals ran without a key");

    // cleanup phase-3 fixtures
    removeCustomer(custForSend.id);
    removeFestival(sched.id);
    resetFestivalMessage({ festivalId: fest.id, year: YEAR, language: "en" });
    saveSettings({ autoFestival: true, waDryRun: true });

    // cleanup test rows
    for (const row of listCustomers()) {
      if (["Self Test", "Bulk A", "Bulk B"].includes(row.name)) removeCustomer(row.id);
    }
    pass("cleanup");
  } catch (err) {
    fail(`threw: ${err instanceof Error ? err.stack : String(err)}`);
  }

  const ok = !results.includes("FAIL");
  console.log(ok ? "\nSELF-TEST PASSED" : "\nSELF-TEST FAILED");
  return ok;
}

/**
 * Loads the built renderer in a hidden window and verifies it mounts and can
 * round-trip an IPC call through the preload bridge. Run with `--smoke-ui`.
 */
export async function runUiSmoke(indexHtml: string): Promise<boolean> {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: indexHtml.replace(/renderer[\\/]index\.html$/, "preload/index.cjs"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  let ok = true;
  const consoleErrors: string[] = [];
  win.webContents.on("console-message", (event: unknown, ...rest: unknown[]) => {
    // Electron ≥ 35 passes a single event object; older passes (event, level, message).
    const e = event as { level?: string | number; message?: string };
    const level = e?.level ?? (rest[0] as string | number);
    const message = e?.message ?? (rest[1] as string);
    const isError = level === "error" || level === 3;
    if (isError && message) consoleErrors.push(message);
  });

  const bad = (msg: string) => {
    ok = false;
    console.error("  ✗ " + msg);
  };

  try {
    await win.loadFile(indexHtml);
    await new Promise((r) => setTimeout(r, 1500));

    const base = (await win.webContents.executeJavaScript(`(async () => {
      const out = { mounted: false, nav: 0, apiOk: false, error: null };
      try {
        out.mounted = !!document.querySelector('aside');
        out.nav = document.querySelectorAll('aside a').length;
        const s = await window.api.settings.get();
        out.apiOk = !!s && s.shopName === 'Sadguru Enterprise';
      } catch (e) { out.error = String(e && e.message || e); }
      return out;
    })()`)) as { mounted: boolean; nav: number; apiOk: boolean; error: string | null };

    if (base.error) bad("renderer threw: " + base.error);
    if (base.mounted) console.log("  ✓ AppShell mounted");
    else bad("AppShell did not mount");
    if (base.nav >= 6) console.log(`  ✓ sidebar nav rendered (${base.nav} links)`);
    else bad(`sidebar nav missing (${base.nav} links)`);
    if (base.apiOk) console.log("  ✓ renderer → preload → IPC → settings round-trip");
    else bad("settings IPC round-trip failed");

    // Visit every route and confirm it renders a heading.
    for (const path of ["/customers", "/reminders", "/festivals", "/activity", "/settings", "/"]) {
      const heading = (await win.webContents.executeJavaScript(`(async () => {
        location.hash = ${JSON.stringify("#" + path)};
        await new Promise(r => setTimeout(r, 700));
        const h = document.querySelector('main h1, h1');
        return h ? h.textContent : null;
      })()`)) as string | null;
      if (heading) console.log(`  ✓ route ${path} → "${heading}"`);
      else bad(`route ${path} rendered no heading`);
    }

    // Write path: create + delete a customer through the real IPC bridge.
    const crud = (await win.webContents.executeJavaScript(`(async () => {
      const id = crypto.randomUUID();
      await window.api.customers.save({
        id, name: "UI Smoke", phone: "1", address: "", city: "", product: "",
        serialNo: "", sellingDate: "2025-03-01", amount: 5000, notes: "",
        done: { service1:false, service2:false, service3:false },
        doneAt: { service1:null, service2:null, service3:null },
      });
      const listed = (await window.api.customers.list()).some(c => c.id === id);
      await window.api.customers.remove(id);
      const gone = !(await window.api.customers.list()).some(c => c.id === id);
      return { listed, gone };
    })()`)) as { listed: boolean; gone: boolean };
    if (crud.listed && crud.gone) console.log("  ✓ customer create + delete via IPC");
    else bad("customer CRUD via IPC failed " + JSON.stringify(crud));

    // Phase 2: AI settings panel + festival message editor render.
    const p2 = (await win.webContents.executeJavaScript(`(async () => {
      const out = { aiPanel:false, providerOpts:0, festivalRows:0, editorAfterExpand:false, err:null };
      try {
        location.hash = '#/settings';
        await new Promise(r => setTimeout(r, 800));
        out.aiPanel = [...document.querySelectorAll('h2')].some(h => /AI assistant/i.test(h.textContent||''));
        const provs = await window.api.ai.providers();
        out.providerOpts = provs.length;

        location.hash = '#/festivals';
        await new Promise(r => setTimeout(r, 900));
        const rows = document.querySelectorAll('main ul li button');
        out.festivalRows = rows.length;
        if (rows[0]) {
          rows[0].click();
          await new Promise(r => setTimeout(r, 300));
          out.editorAfterExpand = !!document.querySelector('main textarea');
        }
      } catch (e) { out.err = String(e && e.message || e); }
      return out;
    })()`)) as {
      aiPanel: boolean;
      providerOpts: number;
      festivalRows: number;
      editorAfterExpand: boolean;
      err: string | null;
    };
    if (p2.err) bad("phase-2 UI threw: " + p2.err);
    if (p2.aiPanel) console.log("  ✓ Settings shows AI assistant panel");
    else bad("AI assistant panel missing");
    if (p2.providerOpts === 4) console.log("  ✓ ai.providers() → 4 providers");
    else bad(`ai.providers() returned ${p2.providerOpts}`);
    if (p2.festivalRows >= 15) console.log(`  ✓ festival rows rendered (${p2.festivalRows})`);
    else bad(`festival rows missing (${p2.festivalRows})`);
    if (p2.editorAfterExpand) console.log("  ✓ festival message editor opens on click");
    else bad("festival editor did not open");

    // Phase 3: Activity screen + WhatsApp panel + dry-run send via IPC.
    const p3 = (await win.webContents.executeJavaScript(`(async () => {
      const out = { activityHeading:null, waPanel:false, dryRunToggle:false, logGrew:false, err:null };
      try {
        location.hash = '#/settings';
        await new Promise(r => setTimeout(r, 700));
        out.waPanel = [...document.querySelectorAll('h2')].some(h => /WhatsApp Cloud API/i.test(h.textContent||''));
        out.dryRunToggle = !!document.getElementById('dry');

        const before = (await window.api.messages.log({ limit: 1 })).length >= 0
          ? (await window.api.messages.log({ limit: 999 })).length : 0;
        await window.api.settings.save({ waDryRun: true });
        const fests = await window.api.festivals.list();
        const r = await window.api.whatsapp.sendFestival({ festivalId: fests[0].id, year: 2097, language: 'en' });
        const after = (await window.api.messages.log({ limit: 999 })).length;
        out.logGrew = after >= before; // dry-run with 0 customers still returns cleanly

        location.hash = '#/activity';
        await new Promise(r => setTimeout(r, 900));
        const h = document.querySelector('h1');
        out.activityHeading = h ? h.textContent : null;
      } catch (e) { out.err = String(e && e.message || e); }
      return out;
    })()`)) as {
      activityHeading: string | null;
      waPanel: boolean;
      dryRunToggle: boolean;
      logGrew: boolean;
      err: string | null;
    };
    if (p3.err) bad("phase-3 UI threw: " + p3.err);
    if (p3.waPanel) console.log("  ✓ Settings shows WhatsApp Cloud API panel");
    else bad("WhatsApp panel missing");
    if (p3.dryRunToggle) console.log("  ✓ dry-run toggle present");
    else bad("dry-run toggle missing");
    if (p3.activityHeading === "Activity") console.log("  ✓ Activity route renders");
    else bad(`Activity route heading was ${JSON.stringify(p3.activityHeading)}`);
    if (p3.logGrew) console.log("  ✓ whatsapp.sendFestival via IPC returns cleanly (dry-run)");
    else bad("whatsapp.sendFestival via IPC failed");

    // Phase 5: festival manager + holiday sync panel + guided import dialog.
    const p5 = (await win.webContents.executeJavaScript(`(async () => {
      const out = { titleBar:false, syncPanel:false, holidayProviders:0, listForYear:0, manageDialog:false, err:null };
      try {
        const tb = [...document.querySelectorAll('div')].find(d =>
          getComputedStyle(d).webkitAppRegion === 'drag' && /Sadguru RO Connect/.test(d.textContent||''));
        out.titleBar = !!tb;

        location.hash = '#/settings';
        await new Promise(r => setTimeout(r, 700));
        out.syncPanel = [...document.querySelectorAll('h2')].some(h => /Festival calendar sync/i.test(h.textContent||''));
        out.holidayProviders = (await window.api.holidays.providers()).length;
        out.listForYear = (await window.api.festivals.listForYear(2027)).length;

        location.hash = '#/festivals';
        await new Promise(r => setTimeout(r, 800));
        const manageBtn = [...document.querySelectorAll('button')].find(b => /Manage/.test(b.textContent||''));
        if (manageBtn) {
          manageBtn.click();
          await new Promise(r => setTimeout(r, 350));
          out.manageDialog = [...document.querySelectorAll('[role=dialog] h2, [role=dialog] [id]')].some(
            () => true) && /Manage festivals/.test(document.body.textContent||'');
          const closeBtn = [...document.querySelectorAll('[role=dialog] button')].find(b => /Done/.test(b.textContent||''));
          closeBtn && closeBtn.click();
          await new Promise(r => setTimeout(r, 200));
        }
      } catch (e) { out.err = String(e && e.message || e); }
      return out;
    })()`)) as {
      titleBar: boolean;
      syncPanel: boolean;
      holidayProviders: number;
      listForYear: number;
      manageDialog: boolean;
      err: string | null;
    };
    if (p5.err) bad("phase-5 UI threw: " + p5.err);
    if (p5.titleBar) console.log("  ✓ custom draggable title bar present");
    else bad("custom title bar missing");
    if (p5.syncPanel) console.log("  ✓ Settings shows Festival calendar sync panel");
    else bad("Festival calendar sync panel missing");
    if (p5.holidayProviders === 2) console.log("  ✓ holidays.providers() → 2");
    else bad(`holidays.providers() returned ${p5.holidayProviders}`);
    if (p5.listForYear >= 15) console.log(`  ✓ festivals.listForYear via IPC (${p5.listForYear})`);
    else bad(`festivals.listForYear returned ${p5.listForYear}`);
    if (p5.manageDialog) console.log("  ✓ Festival manager dialog opens");
    else bad("Festival manager dialog did not open");

    if (consoleErrors.length) {
      ok = false;
      console.error("  ✗ renderer console errors:\n    " + consoleErrors.join("\n    "));
    } else {
      console.log("  ✓ no renderer console errors");
    }

    console.log(ok ? "\nUI SMOKE PASSED" : "\nUI SMOKE FAILED");
    return ok;
  } catch (err) {
    console.error("UI SMOKE threw:", err instanceof Error ? err.stack : err);
    return false;
  } finally {
    win.destroy();
  }
}
