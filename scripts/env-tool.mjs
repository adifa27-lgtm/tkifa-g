#!/usr/bin/env node
/**
 * Local secret plumbing. Never prints secret values.
 *
 *   node scripts/env-tool.mjs ensure-secret              # AUTH_SECRET + SHEET_ID in .env.local if missing
 *   node scripts/env-tool.mjs sa <key.json>              # GOOGLE_SA_EMAIL / GOOGLE_SA_PRIVATE_KEY from a key file
 *   node scripts/env-tool.mjs oauth [client_secret.json] # AUTH_GOOGLE_ID / SECRET (default: newest client_secret_*.json in Downloads)
 *   node scripts/env-tool.mjs check                      # which keys are set (names only)
 *   node scripts/env-tool.mjs push-vercel                # copy .env.local values to the linked Vercel project (production)
 */
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENV = path.join(ROOT, ".env.local");
const SECRETS = path.join(ROOT, "secrets");
const KEYS = ["AUTH_SECRET", "AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET", "GOOGLE_SA_EMAIL", "GOOGLE_SA_PRIVATE_KEY", "SHEET_ID", "EXTRA_ALLOWED_EMAILS"];
const SHEET_ID = "1KBVkNPjLsH9AolAN3ed9S6eWhaqih2hapsIK8PFcq7o";

function readEnv() {
  const out = {};
  if (!fs.existsSync(ENV)) return out;
  for (const line of fs.readFileSync(ENV, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2];
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1).replace(/\\"/g, '"');
    out[m[1]] = v;
  }
  return out;
}
function writeEnv(env) {
  const lines = ["# Local secrets — git-ignored. Managed by scripts/env-tool.mjs"];
  for (const k of [...KEYS, ...Object.keys(env).filter((k) => !KEYS.includes(k))]) {
    if (env[k] == null) continue;
    lines.push(`${k}="${String(env[k]).replace(/"/g, '\\"')}"`);
  }
  fs.writeFileSync(ENV, lines.join("\n") + "\n", { mode: 0o600 });
}
const oneLineKey = (k) => k.replace(/\r?\n/g, "\\n");

const [cmd, arg] = process.argv.slice(2);
const env = readEnv();

if (cmd === "ensure-secret") {
  if (!env.AUTH_SECRET) env.AUTH_SECRET = crypto.randomBytes(32).toString("base64url");
  if (!env.SHEET_ID) env.SHEET_ID = SHEET_ID;
  if (env.EXTRA_ALLOWED_EMAILS == null) env.EXTRA_ALLOWED_EMAILS = "";
  writeEnv(env);
  console.log("ok: AUTH_SECRET and SHEET_ID are set");
} else if (cmd === "sa") {
  const j = JSON.parse(fs.readFileSync(arg, "utf8"));
  if (!j.client_email || !j.private_key) throw new Error("not a service-account key file");
  env.GOOGLE_SA_EMAIL = j.client_email;
  env.GOOGLE_SA_PRIVATE_KEY = oneLineKey(j.private_key);
  writeEnv(env);
  console.log("ok: service account saved for " + j.client_email);
} else if (cmd === "oauth") {
  let file = arg;
  if (!file) {
    const dl = path.join(os.homedir(), "Downloads");
    const c = fs
      .readdirSync(dl)
      .filter((f) => /^client_secret.*\.json$/i.test(f))
      .map((f) => ({ f: path.join(dl, f), t: fs.statSync(path.join(dl, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    if (!c.length) {
      console.error("No client_secret_*.json found in Downloads");
      process.exit(2);
    }
    file = c[0].f;
  }
  const j = JSON.parse(fs.readFileSync(file, "utf8"));
  const w = j.web || j.installed;
  if (!w?.client_id || !w?.client_secret) throw new Error("not an OAuth client file");
  env.AUTH_GOOGLE_ID = w.client_id;
  env.AUTH_GOOGLE_SECRET = w.client_secret;
  writeEnv(env);
  fs.mkdirSync(SECRETS, { recursive: true });
  const dest = path.join(SECRETS, "oauth-client.json");
  fs.copyFileSync(file, dest);
  if (!arg) fs.rmSync(file);
  console.log("ok: OAuth client saved (" + w.client_id.slice(0, 12) + "…), redirect URIs in file: " + (w.redirect_uris || []).join(", "));
} else if (cmd === "check") {
  for (const k of KEYS) console.log(`${k.padEnd(24)} ${env[k] ? "set" : k === "EXTRA_ALLOWED_EMAILS" ? "(empty, optional)" : "MISSING"}`);
} else if (cmd === "push-vercel") {
  const vercel = process.platform === "win32" ? "vercel.cmd" : "vercel";
  for (const k of KEYS) {
    const v = env[k] ?? "";
    if (!v && k !== "EXTRA_ALLOWED_EMAILS") {
      console.error("missing " + k);
      process.exit(2);
    }
    for (const target of ["production", "preview"]) {
      spawnSync(vercel, ["env", "rm", k, target, "-y"], { cwd: ROOT, stdio: "ignore", shell: process.platform === "win32" });
      if (!v) continue; // empty optional value: leave unset
      const r = spawnSync(vercel, ["env", "add", k, target], { cwd: ROOT, input: v, stdio: ["pipe", "ignore", "pipe"], shell: process.platform === "win32" });
      if (r.status !== 0) {
        console.error(`failed: ${k} (${target}): ${String(r.stderr).replace(v, "***").slice(0, 300)}`);
        process.exit(1);
      }
    }
    console.log(`ok: ${k}`);
  }
} else {
  console.log(fs.readFileSync(new URL(import.meta.url), "utf8").split("\n").slice(1, 10).join("\n"));
  void execFileSync;
}
