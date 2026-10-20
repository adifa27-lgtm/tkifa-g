import "server-only";

export type CellValue = string | number | boolean | null | undefined;
export type Values = CellValue[][];

export interface SheetMeta {
  title: string;
  tabs: string[];
}

export interface Permission {
  emailAddress?: string | null;
  role?: string | null;
  type?: string | null;
}

/** Everything the server needs from Google. Implemented by the real APIs and by the in-memory mock. */
export interface SheetSource {
  readonly sheetUrl: string;
  meta(): Promise<SheetMeta>;
  /** Drive modifiedTime of the spreadsheet (RFC 3339). */
  modifiedTime(): Promise<string>;
  /** values.batchGet. `unformatted` = UNFORMATTED_VALUE with SERIAL_NUMBER dates, else FORMATTED_VALUE. */
  batchGet(ranges: string[], unformatted?: boolean): Promise<Values[]>;
  /** values.batchUpdate with USER_ENTERED. */
  batchUpdate(data: { range: string; values: (string | number)[][] }[]): Promise<void>;
  /** Adds a hidden tab (used only if `_app` is missing). */
  addHiddenSheet(title: string): Promise<void>;
  permissions(): Promise<Permission[]>;
}
