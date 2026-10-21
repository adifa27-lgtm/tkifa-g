#!/usr/bin/env node
// Checks that the service account in .env.local can read the sheet. Prints no secrets.
import fs from "node:fs";
import { sheets, auth } from "@googleapis/sheets";

const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Z0-9_]+)="(.*)"$/);
  if (m) env[m[1]] = m[2].replace(/\\"/g, '"');
}
const key = env.GOOGLE_SA_PRIVATE_KEY.replace(/\\n/g, "\n");
const jwt = new auth.JWT({ email: env.GOOGLE_SA_EMAIL, key, scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"] });
try {
  const r = await sheets({ version: "v4", auth: jwt }).spreadsheets.get({ spreadsheetId: env.SHEET_ID, fields: "sheets.properties.title" });
  console.log("OK: the service account can read the sheet (" + r.data.sheets.length + " tabs)");
} catch (e) {
  console.log("ERROR " + (e.code || "") + ": " + String(e.message).slice(0, 160));
  process.exit(1);
}
