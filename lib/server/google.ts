import "server-only";
import { sheets as sheetsApi, auth as gauth } from "@googleapis/sheets";
import { drive as driveApi } from "@googleapis/drive";
import type { Permission, SheetMeta, SheetSource, Values } from "./source";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive.metadata.readonly"];

/** Private keys pasted into env vars often carry literal "\n" — turn them back into newlines. */
export function normalizePrivateKey(k: string): string {
  let key = k.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) key = key.slice(1, -1);
  return key.replace(/\\n/g, "\n").replace(/\r\n/g, "\n");
}

export function googleSource(env: { email: string; key: string; sheetId: string }): SheetSource {
  const jwt = new gauth.JWT({ email: env.email, key: normalizePrivateKey(env.key), scopes: SCOPES });
  const sheets = sheetsApi({ version: "v4", auth: jwt });
  // Both packages share googleapis-common; the auth client is compatible at runtime.
  const drive = driveApi({ version: "v3", auth: jwt as never });
  const spreadsheetId = env.sheetId;

  return {
    sheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,

    async meta(): Promise<SheetMeta> {
      const r = await sheets.spreadsheets.get({ spreadsheetId, fields: "properties.title,sheets.properties.title" });
      return {
        title: r.data.properties?.title || "",
        tabs: (r.data.sheets || []).map((s) => s.properties?.title || "").filter(Boolean),
      };
    },

    async modifiedTime(): Promise<string> {
      const r = await drive.files.get({ fileId: spreadsheetId, fields: "modifiedTime", supportsAllDrives: true });
      return r.data.modifiedTime || "";
    },

    async batchGet(ranges: string[], unformatted = false): Promise<Values[]> {
      if (!ranges.length) return [];
      const r = await sheets.spreadsheets.values.batchGet({
        spreadsheetId,
        ranges,
        majorDimension: "ROWS",
        valueRenderOption: unformatted ? "UNFORMATTED_VALUE" : "FORMATTED_VALUE",
        dateTimeRenderOption: "SERIAL_NUMBER",
      });
      return (r.data.valueRanges || []).map((vr) => (vr.values || []) as Values);
    },

    async batchUpdate(data): Promise<void> {
      if (!data.length) return;
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: { valueInputOption: "USER_ENTERED", data },
      });
    },

    async addHiddenSheet(title: string): Promise<void> {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ addSheet: { properties: { title, hidden: true } } }] },
      });
    },

    async permissions(): Promise<Permission[]> {
      const out: Permission[] = [];
      let pageToken: string | undefined;
      do {
        const r = await drive.permissions.list({
          fileId: spreadsheetId,
          fields: "nextPageToken,permissions(emailAddress,role,type)",
          supportsAllDrives: true,
          pageSize: 100,
          pageToken,
        });
        out.push(...(r.data.permissions || []));
        pageToken = r.data.nextPageToken || undefined;
      } while (pageToken);
      return out;
    },
  };
}
