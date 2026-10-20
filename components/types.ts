import type { DrillKey, Model, View } from "@/lib/core/model";
import type { AppData, BreakPeriod, StatusKey, VehKey } from "@/lib/core/types";

export interface UiState {
  view: View;
  unit: string | null;
  date: string;
  drill: DrillKey | null;
  attFilter: string | null;
  sheetFor: string | null;
  roleFor: string | null;
}

export interface Actions {
  go(view: View, extra?: Partial<UiState>): void;
  setUi(p: Partial<UiState>): void;
  shiftDay(n: number): void;
  today(): void;
  refresh(): void;
  setStatus(id: string, v: StatusKey | ""): void;
  allBase(): void;
  copyPrev(): void;
  setVeh(id: string, v: VehKey | ""): void;
  setRole(id: string, v: string): void;
  setCmd(id: string, on: boolean): void;
  setBreaks(next: BreakPeriod[], msg: string): void;
  copy(text: string, ok: string, fail: string, fallbackEl?: string): void;
  toast(t: string, ms?: number): void;
  hideInstall(): void;
  signOut(): void;
}

export interface ViewProps {
  m: Model;
  ui: UiState;
  data: AppData;
  act: Actions;
  pending: Record<string, true>;
  syncText: React.ReactNode;
  netErr: string | null;
  loadedAt: number;
  now: number;
  showInstall: boolean;
  standalone: boolean;
  isIOS: boolean;
  mock: boolean;
  email: string;
}
