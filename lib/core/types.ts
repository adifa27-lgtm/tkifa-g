export type StatusKey = "base" | "tzav" | "org" | "out" | "home" | "abroad" | "loc";
export type VehKey = "898" | "506" | "497" | "207" | "savana" | "berlingo" | "private";

/** One soldier as sent to the client. Never contains sensitive DATA-tab columns. */
export interface Soldier {
  id: string;
  pid: string;
  name: string;
  unit: string;
  unitOrder: number;
  order: number;
  baseDays: number | null;
  homeDays: number | null;
  arriving: boolean;
  student: boolean;
  indep: boolean;
  line: string;
  note: string;
  plan: Record<string, StatusKey>;
  pakal: string;
  cmd: boolean;
  sheetVeh: VehKey | "";
  shab: boolean;
}

export interface AttachedRow {
  name: string;
  purpose: string;
  status: string;
  role: string;
  unit: string;
  phone: string;
}

export interface RolesConfig {
  cmd?: string[];
  pakal?: Record<string, string>;
}

export interface BreakPeriod {
  from: string;
  to: string;
  label?: string;
}

export interface AlertsConfig {
  breaks?: BreakPeriod[];
}

export interface AppConfig {
  roles: RolesConfig | null;
  alerts: AlertsConfig | null;
}

/** Response of GET /api/data. */
export interface AppData {
  ver: string;
  title: string;
  sheetUrl: string;
  events: Record<string, string>;
  soldiers: Soldier[];
  attached: AttachedRow[];
  config: AppConfig;
}

export type Change =
  | { kind: "status"; pid?: string; name: string; date: string; status: StatusKey | "" }
  | { kind: "veh"; pid?: string; name: string; veh: VehKey | "" }
  | { kind: "config"; key: "roles"; value: RolesConfig }
  | { kind: "config"; key: "alerts"; value: AlertsConfig };

export interface ChangesResult {
  done: number;
  skipped: string[];
}
