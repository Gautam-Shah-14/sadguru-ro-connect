import { BrowserWindow } from "electron";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Renders the non-technical setup guide to a PDF next to the project.
 * Run with `electron . --make-guide`.
 */
export async function makeGuide(projectRoot: string): Promise<void> {
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } });
  await win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(GUIDE_HTML));
  await new Promise((r) => setTimeout(r, 300));

  const pdf = await win.webContents.printToPDF({
    pageSize: "A4",
    printBackground: true,
    margins: { top: 0.6, bottom: 0.6, left: 0.7, right: 0.7 },
  });
  const out = join(projectRoot, "Sadguru-RO-Connect-Setup-Guide.pdf");
  writeFileSync(out, pdf);
  win.destroy();
  console.log("wrote " + out);
}

const GUIDE_HTML = String.raw`<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  body {
    font-family: "Segoe UI", Calibri, Arial, sans-serif;
    color: #1f2937; font-size: 11.5pt; line-height: 1.55; margin: 0;
  }
  h1 { font-size: 24pt; margin: 0 0 4pt; color: #0f766e; }
  h2 { font-size: 15pt; margin: 22pt 0 6pt; color: #0f766e; border-bottom: 2px solid #99f6e4; padding-bottom: 3pt; }
  h3 { font-size: 12.5pt; margin: 14pt 0 4pt; color: #115e59; }
  h4 { font-size: 11pt; margin: 10pt 0 2pt; color: #334155; }
  p { margin: 6pt 0; }
  ol, ul { margin: 6pt 0 6pt 0; padding-left: 22pt; }
  li { margin: 4pt 0; }
  code { background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 4px; padding: 1px 5px; font-family: Consolas, monospace; font-size: 10pt; }
  .lead { color: #475569; font-size: 12pt; }
  .box { border: 1px solid #cbd5e1; border-left: 4px solid #0f766e; background: #f8fafc; border-radius: 6px; padding: 10pt 14pt; margin: 10pt 0; page-break-inside: avoid; }
  .warn { border-left-color: #d97706; background: #fffbeb; }
  .tip { border-left-color: #0ea5e9; background: #f0f9ff; }
  .page { page-break-before: always; }
  .cover { text-align: left; padding-top: 40pt; }
  .cover .drop { font-size: 40pt; }
  table { border-collapse: collapse; width: 100%; margin: 8pt 0; font-size: 10.5pt; }
  th, td { border: 1px solid #cbd5e1; padding: 5pt 8pt; text-align: left; vertical-align: top; }
  th { background: #f1f5f9; }
  .muted { color: #64748b; font-size: 10pt; }
  .step { font-weight: 600; color: #115e59; }
</style></head><body>

<div class="cover">
  <div class="drop">💧</div>
  <h1>Sadguru RO Connect</h1>
  <p class="lead">Setup &amp; User Guide for Sadguru Enterprise</p>
  <p class="muted">Desktop app for RO customer records, 4 / 8 / 12-month service reminders,
  AI-written festival greetings, and automated WhatsApp messaging. Windows 10 / 11.</p>
  <div class="box">
    <b>In a hurry?</b> You can start using the app for customer records and service
    reminders <b>immediately</b> after installing — no accounts needed.
    The AI greetings (Section&nbsp;4) and WhatsApp sending (Section&nbsp;5) each need a
    free online account; follow those sections when you are ready.
  </div>
</div>

<h2>1. Installing the app</h2>
<ol>
  <li>Copy <code>Sadguru RO Connect-Setup-1.1.0.exe</code> to the shop computer (pen drive, email, or WhatsApp to yourself and download on the PC).</li>
  <li>Double-click it.</li>
  <li><span class="step">Windows may show a blue screen</span> saying <i>“Windows protected your PC”</i>.
      This is normal for new apps that are not from the Microsoft Store.
      Click <b>More info</b>, then <b>Run anyway</b>.</li>
  <li>Choose an install folder (the default is fine) and finish. A <b>Sadguru RO Connect</b>
      icon appears on the desktop.</li>
</ol>
<div class="box tip">
  <b>Portable version:</b> <code>Sadguru RO Connect-Portable-1.1.0.exe</code> runs without
  installing — handy for a second computer or a USB drive.
</div>

<h3>Where your data is kept</h3>
<p>Everything is stored in <b>one file on this PC</b> — there is no internet server, no login.
The file lives at:</p>
<p><code>C:\Users\&lt;your-name&gt;\AppData\Roaming\Sadguru RO Connect\sadguru.db</code></p>
<div class="box warn">
  <b>Make backups.</b> Open <b>Settings → Data → Backup</b> once a week and save the file to
  a pen drive or Google Drive. To move to a new PC: install the app there, then
  <b>Settings → Data → Restore</b> and pick your backup.
</div>

<div class="page"></div>
<h2>2. First run — your customers</h2>
<ol>
  <li>Open the app. Click <b>Customers</b> in the left menu.</li>
  <li><span class="step">Get the template:</span> click <b>Sample sheet</b> and save it. It
      shows the exact columns the app understands — including a <b>Customer ID</b> column for
      your own numbering (SG-001, etc.).</li>
  <li><span class="step">If you already have an Excel sheet:</span> click <b>Import Excel</b>
      and choose your <code>.xlsx</code> / <code>.csv</code> file. A window opens showing your
      columns with a sample value from each. For every column pick what it is —
      <i>Customer ID, Customer name, Phone, City, Product, Serial number, Selling date, Amount,
      Notes</i> — or leave it as <b>Ignore</b>. Column order does not matter and extra columns
      are fine. If you map a <b>Customer ID</b> column, the app keeps your IDs; otherwise it
      assigns its own. Tick <b>“Skip rows whose Customer ID, phone or serial already exists”</b>
      to avoid duplicates when re-importing. Then click <b>Import</b>.</li>
  <li><span class="step">To add one customer:</span> click <b>New entry</b>, fill the form
      (put your own number in <b>Customer ID</b>, or leave it blank to let the app assign one),
      then <b>Save customer</b>. The app won't let you reuse an ID that already exists.</li>
  <li>The three service dates (after 4, 8 and 12 months) are calculated for you from the
      selling date. Tick a service box once it is done.</li>
  <li><b>Export</b> saves everything back to an Excel file whenever you want.</li>
</ol>

<h2>3. Service reminders</h2>
<ul>
  <li><b>Dashboard</b> shows how many services are <b>due soon</b> or <b>overdue</b>, plus a chart of the next 6 months.</li>
  <li><b>Service Reminders</b> lists every visit. Use the tabs <b>Due soon / Overdue / Upcoming / Completed</b>.</li>
  <li>Change the warning window in <b>Settings → Shop → “Remind me this many days before a service”</b> (default 15).</li>
  <li><b>Send</b> / <b>Send all in this list</b> send a WhatsApp reminder (see Section&nbsp;5). <b>Done</b> marks a service complete.</li>
</ul>

<div class="page"></div>
<h2>4. Setting up the AI assistant (festival messages)</h2>
<p class="lead">This lets the app write a warm, personal greeting for every festival, in
English and Gujarati. You need a free “API key” from one AI company. Pick <b>one</b>.</p>

<table>
  <tr><th>Provider</th><th>Cost</th><th>Best for you</th></tr>
  <tr><td><b>Google Gemini</b></td><td>Free tier is generous</td><td>✅ Easiest to start — recommended</td></tr>
  <tr><td><b>Groq</b></td><td>Free</td><td>✅ Also very easy, very fast</td></tr>
  <tr><td>OpenAI (ChatGPT)</td><td>Paid — needs a card, ~₹400 min credit</td><td>Optional</td></tr>
  <tr><td>Claude (Anthropic)</td><td>Paid — needs a card, ~₹400 min credit</td><td>Optional</td></tr>
</table>

<h3>Option A — Google Gemini (recommended)</h3>
<ol>
  <li>On any browser go to <code>https://aistudio.google.com/app/apikey</code></li>
  <li>Sign in with a Google account (your normal Gmail is fine).</li>
  <li>Click <b>Create API key</b> → <b>Create API key in new project</b>.</li>
  <li>A long code appears (starts with <code>AIza…</code>). Click the copy icon.</li>
  <li>In the app: <b>Settings → AI assistant</b>. Set <b>Provider</b> = <i>Google Gemini</i>.</li>
  <li>Paste the code into <b>API key</b> and click <b>Save</b> (next to the box).</li>
  <li>Click <b>Test connection</b>. You should see <i>“Connection OK”.</i></li>
  <li>Leave <b>Model</b> on the default. Choose a <b>Tone</b> (Warm is good). Tick the
      <b>languages</b> you want (English, Gujarati).</li>
  <li>Click <b>Save changes</b> at the top right of the Settings page.</li>
</ol>

<h3>Option B — Groq</h3>
<ol>
  <li>Go to <code>https://console.groq.com/keys</code> and sign in (Google login works).</li>
  <li>Click <b>Create API Key</b>, give it any name, <b>Submit</b>, then copy the key (starts with <code>gsk_…</code>).</li>
  <li>In the app: <b>Settings → AI assistant</b>, Provider = <i>Groq</i>, paste the key, <b>Save</b>, <b>Test connection</b>, then <b>Save changes</b>.</li>
</ol>

<div class="box tip">
  <b>The other two</b> (OpenAI, Claude) work the same way — their key pages are
  <code>platform.openai.com/api-keys</code> and <code>console.anthropic.com/settings/keys</code> —
  but they ask for a credit/debit card and a small prepaid amount first.
</div>

<h3>Getting each year's festival dates right (holiday calendar key)</h3>
<p>Diwali, Holi, Raksha Bandhan and most festivals fall on a different date every year. Add
one free key and the app keeps the dates correct by itself. This is optional — you can also
just type the dates each year under <b>Festival Messages → Manage</b>.</p>

<div class="box tip">
  <b>Recommended: Calendarific.</b> Its free plan covers <i>future</i> years, which is what you
  need. API Ninjas' free plan only returns the current year.
</div>

<h4>Calendarific — get the key</h4>
<ol>
  <li>On any browser open <code>https://calendarific.com/signup</code>.</li>
  <li>Enter your name, email and a password, and confirm your email if asked.</li>
  <li>You land on the dashboard at <code>https://calendarific.com/account</code>. Copy the
      <b>API key</b> shown there (a long line of letters and numbers).</li>
</ol>

<h4>API Ninjas — get the key (alternative)</h4>
<ol>
  <li>Open <code>https://api-ninjas.com/register</code> and sign up (Google login works).</li>
  <li>Go to <code>https://api-ninjas.com/profile</code> and copy the <b>API Key</b>
      (starts with a short code). Note: on the free plan it only fills the current year.</li>
</ol>

<h4>Put the key in the app</h4>
<ol>
  <li><b>Settings → Festival calendar sync</b>.</li>
  <li>Set <b>Provider</b> to the one you chose (Calendarific or API Ninjas).</li>
  <li>Paste the key into the <b>API key</b> box and click <b>Save</b> (it is stored encrypted
      on this PC).</li>
  <li>Click <b>Test</b> — you should see <i>“Holiday API OK”.</i></li>
  <li>Leave <b>“Keep festival dates updated automatically”</b> switched <b>on</b>.</li>
  <li>Click <b>Save changes</b> at the top right.</li>
</ol>

<div class="box">
  <b>What happens now:</b> once a day the app quietly refreshes this year and next year's
  festival dates and adds any new festivals it finds in the calendar. You can also do it on
  demand: <b>Festival Messages</b> → pick the year → <b>Sync dates</b> → review the list →
  <b>Apply</b>. Tick <i>“also add N new festivals”</i> to grow the list.
</div>

<div class="box tip">
  Once at the start of each year: open Festival Messages, choose the new year, click
  <b>Sync dates → Apply</b>, then <b>Generate all</b> for the messages.
</div>

<h3>Writing the festival messages</h3>
<ol>
  <li>Open <b>Festival Messages</b>. Pick the <b>year</b> at the top right.</li>
  <li>Click <b>Generate all for {year}</b> — the app writes a message for every festival in
      each language you ticked. This takes about a minute.</li>
  <li>Click any festival row to open it. Read the message, edit the wording if you like, and
      click <b>Save</b>. Use the <b>English / ગુજરાતી</b> tabs to switch language.</li>
  <li><b>{name}</b> in the text is a placeholder — each customer sees their own name there.</li>
  <li>Messages are stored in the app, so they keep working even with no internet later.</li>
</ol>

<div class="page"></div>
<h2>5. Setting up WhatsApp</h2>
<p class="lead">This is the longest setup. The app uses the official
<b>WhatsApp Cloud API</b> from Meta (Facebook). Do it once, calmly, on a computer.</p>

<div class="box warn">
  <b>Keep “Dry-run” ON until the very end.</b> While Dry-run is on, the app records every
  message on the <b>Activity</b> screen but sends nothing. This protects you from mistakes.
</div>

<h3>Step 1 — Create the Meta app</h3>
<ol>
  <li>Go to <code>https://developers.facebook.com/</code> and log in with a Facebook account.
      (Create a plain Facebook account if you don’t have one.)</li>
  <li>Top-right menu → <b>My Apps</b> → <b>Create App</b>.</li>
  <li>Use case: choose <b>Other</b> → <b>Next</b>. App type: <b>Business</b> → <b>Next</b>.</li>
  <li>App name: <code>Sadguru RO Connect</code>. Enter your email. <b>Create app</b>.</li>
  <li>On the app dashboard find <b>WhatsApp</b> and click <b>Set up</b>.</li>
  <li>If asked, create or select a <b>Meta Business Account</b> (name it “Sadguru Enterprise”).</li>
</ol>

<h3>Step 2 — Get the three values the app needs</h3>
<p>Open <b>WhatsApp → API Setup</b> in the left menu. You will see:</p>
<ol>
  <li><b>Temporary access token</b> — a long code. It works for <b>24 hours</b> (fine for testing). Copy it.</li>
  <li><b>Phone number ID</b> — a number under the test phone number. Copy it.</li>
  <li>A test <b>“From” number</b> provided by Meta, and a box to add <b>“To” numbers</b> —
      add your own mobile number here so you can receive the test.</li>
</ol>

<h3>Step 3 — Put them in the app</h3>
<ol>
  <li><b>Settings → WhatsApp Cloud API</b>.</li>
  <li><b>Dry-run</b> switch: leave it <b>ON</b> for now.</li>
  <li><b>Phone number ID</b>: paste the number from Step&nbsp;2.</li>
  <li><b>Access token</b>: paste the temporary token, click <b>Save</b> (it is stored encrypted).</li>
  <li>Click <b>Save changes</b> at the top right.</li>
  <li>In the <b>Test number</b> box type your own mobile (10 digits, e.g. <code>9825012345</code>)
      and click <b>Send test message</b>. Because Dry-run is on, it only appears on the
      <b>Activity</b> screen as <i>“dry-run”</i>.</li>
  <li>Now turn <b>Dry-run OFF</b>, click <b>Save changes</b>, and press <b>Send test message</b> again.
      A WhatsApp message should arrive on your phone within a few seconds.</li>
</ol>
<div class="box">
  If it fails, the exact reason from WhatsApp is shown on the <b>Activity</b> screen
  (for example “Invalid OAuth access token” = the token expired — get a fresh one from API Setup).
</div>

<h3>Step 4 — For everyday use (do this within a day or two)</h3>
<p>The temporary token dies after 24 hours and the test number can only message a few
saved numbers. To send to all your customers you need two more things:</p>
<ul>
  <li><b>A permanent token.</b> In the Meta app: <b>Business Settings → Users → System users</b> →
      add a system user → <b>Generate token</b> for your app with the
      <code>whatsapp_business_messaging</code> permission. Paste this token into the app’s
      <b>Access token</b> box and <b>Save</b>. It does not expire.</li>
  <li><b>A real phone number</b> added and verified under <b>WhatsApp → API Setup →
      Add phone number</b> (a number not already on the normal WhatsApp app).</li>
  <li><b>Approved message templates.</b> To message customers who have <i>not</i> messaged you
      first (i.e. reminders and festival greetings), Meta requires a pre-approved template.
      Under <b>WhatsApp → Message Templates</b> create one, e.g. name
      <code>service_reminder</code>, category <b>Utility</b>, body:
      <code>{{1}}</code> (one variable = the customer’s name). Submit for review — approval
      is usually a few minutes to a day.</li>
  <li>In the app: <b>Settings → WhatsApp</b> → put the template name in
      <b>Approved template name</b> and the language code (<code>en</code> or <code>gu</code>)
      in <b>Template language code</b>, then <b>Save changes</b>.</li>
</ul>
<div class="box tip">
  Without an approved template you can still reply to customers who messaged you in the
  last 24&nbsp;hours, and all test messages to your own saved numbers work.
</div>

<div class="page"></div>
<h2>6. Everyday use</h2>
<h3>Service reminders</h3>
<ol>
  <li>Open <b>Service Reminders</b>, tab <b>Due soon</b>.</li>
  <li>Check each message preview, then <b>Send</b> per customer or <b>Send all in this list</b>.</li>
  <li>After the visit, click <b>Done</b>.</li>
</ol>

<h3>Festival greetings</h3>
<ul>
  <li>Turn on <b>Settings → (festival panel) → “Send automatically at 9:00 AM”</b> — the app will
      send each festival’s greeting to every customer on the day, by itself, as long as the
      computer is on.</li>
  <li>If the PC was off on the festival day, <b>Festival Messages</b> shows a
      <b>“missed festival greetings”</b> box with a <b>Send now</b> button.</li>
  <li>You can also open any festival and press <b>Send now</b> manually.</li>
</ul>

<h3>Activity screen</h3>
<p>Every message the app sent (or logged in dry-run) is listed here with its status —
<b>sent</b>, <b>failed</b> (with the reason), or <b>dry-run</b>. Check it after any bulk send.</p>

<h2>7. Troubleshooting</h2>
<table>
  <tr><th>What you see</th><th>What to do</th></tr>
  <tr><td>“Windows protected your PC” on install</td><td>Click <b>More info → Run anyway</b>. It is safe; the warning is only because the app is new and not code-signed.</td></tr>
  <tr><td>Festival page says “No AI provider is configured”</td><td>Finish Section&nbsp;4 — provider, key, <b>Save</b>, then <b>Save changes</b>.</td></tr>
  <tr><td>“Test connection” fails</td><td>The key was mistyped or the account has no free quota left. Create a fresh key.</td></tr>
  <tr><td>WhatsApp says “Invalid OAuth access token”</td><td>The token expired. Get a new one from <b>WhatsApp → API Setup</b>, or set up the permanent token (Section&nbsp;5, Step&nbsp;4).</td></tr>
  <tr><td>Message “sent” but not delivered</td><td>The customer’s number isn’t on your test list, or you need an approved template for that number. See Section&nbsp;5, Step&nbsp;4.</td></tr>
  <tr><td>Moving to a new computer</td><td>Backup on the old PC (<b>Settings → Data → Backup</b>), install the app on the new PC, then <b>Restore</b> and pick the backup file.</td></tr>
  <tr><td>App won’t open / data looks wrong</td><td>Use <b>Settings → Data → Restore</b> with your latest backup.</td></tr>
</table>

<h2>8. Quick reference</h2>
<table>
  <tr><th>Setting</th><th>Where</th></tr>
  <tr><td>Reminder lead time</td><td>Settings → Shop</td></tr>
  <tr><td>AI provider &amp; key</td><td>Settings → AI assistant</td></tr>
  <tr><td>Festival languages / tone</td><td>Settings → AI assistant</td></tr>
  <tr><td>Holiday API key (auto festival dates)</td><td>Settings → Festival calendar sync</td></tr>
  <tr><td>Edit / add / remove festivals</td><td>Festival Messages → Manage</td></tr>
  <tr><td>Fetch this year's festival dates</td><td>Festival Messages → Sync dates</td></tr>
  <tr><td>Auto-send festival greetings at 9 AM</td><td>Festival Messages page (left panel switch)</td></tr>
  <tr><td>WhatsApp number ID &amp; token</td><td>Settings → WhatsApp Cloud API</td></tr>
  <tr><td>Dry-run (safe mode) on/off</td><td>Settings → WhatsApp Cloud API</td></tr>
  <tr><td>Backup / Restore database</td><td>Settings → Data</td></tr>
  <tr><td>Light / Dark screen</td><td>Sun / moon button, top right</td></tr>
</table>

<p class="muted" style="margin-top:24pt">Sadguru RO Connect v1.1 &nbsp;·&nbsp; Offline desktop edition &nbsp;·&nbsp; This guide was generated by the app.</p>

</body></html>`;
