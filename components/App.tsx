"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { STMAP, VEHMAP } from "@/lib/core/constants";
import { createModel, type View } from "@/lib/core/model";
import type { AlertsConfig, AppData, BreakPeriod, Change, ChangesResult, RolesConfig, Soldier, StatusKey, VehKey } from "@/lib/core/types";
import { ago, norm, shift, todayKey } from "@/lib/core/util";
import { clearLocalData, getFlag, INSTALL_HIDE_KEY, readCache, setFlag, writeCache } from "@/lib/client/storage";
import { Spin } from "./common";
import { RoleSheet, StatusSheet } from "./Sheets";
import type { Actions, UiState, ViewProps } from "./types";
import { ConnectView, CrewView, Home, LoadingView, LongView, MovesView, ShmapView, SummaryView, TeamView } from "./views";

const POLL_MS = 20000;
const OFFLINE = "אין חיבור · מוצגים הנתונים האחרונים";

interface Toast {
  t: string;
  ms: number;
  id: number;
}

export default function App({ email, mock, signOut }: { email: string; mock: boolean; signOut: () => Promise<void> }) {
  const [data, setData] = useState<AppData | null>(null);
  const [ui, setUiState] = useState<UiState>({ view: "home", unit: null, date: "", drill: null, attFilter: null, sheetFor: null, roleFor: null });
  const [pending, setPending] = useState<Record<string, true>>({});
  const [saving, setSaving] = useState(0);
  const [netErr, setNetErr] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState(0);
  const [now, setNow] = useState(0);
  const [toast, setToast] = useState<Toast | null>(null);
  const [env, setEnv] = useState({ standalone: false, isIOS: false, installHidden: true });

  const dataRef = useRef<AppData | null>(null);
  const serverRef = useRef<AppData | null>(null);
  const verRef = useRef("");
  const inflight = useRef(0);
  const writeSeq = useRef(0);
  const failed = useRef(false);
  const loading = useRef(false);
  const reloadAgain = useRef(false);
  const polling = useRef(false);
  const lastDay = useRef("");
  const uiRef = useRef(ui);
  uiRef.current = ui;
  dataRef.current = data;

  const showToast = useCallback((t: string, ms = 2200) => setToast({ t, ms, id: Date.now() + Math.random() }), []);

  useEffect(() => {
    if (!toast) return;
    const h = setTimeout(() => setToast(null), toast.ms);
    return () => clearTimeout(h);
  }, [toast]);

  const authLost = useCallback(() => {
    window.location.reload();
  }, []);

  /* ---------- reading ---------- */
  const load = useCallback(
    async (loud = false) => {
      if (loading.current) {
        reloadAgain.current = true;
        return;
      }
      loading.current = true;
      const seq = writeSeq.current;
      try {
        const r = await fetch("/api/data", { cache: "no-store" });
        if (r.status === 401 || r.status === 403) return authLost();
        if (!r.ok) throw new Error("http " + r.status);
        const d = (await r.json()) as AppData;
        // A write started while we were reading: its own refetch will bring the fresh state.
        if (inflight.current || seq !== writeSeq.current) return;
        serverRef.current = d;
        verRef.current = d.ver;
        setData(d);
        writeCache(d);
        setLoadedAt(Date.now());
        setNetErr(null);
        if (loud) showToast("עודכן מהשיט", 1400);
      } catch {
        setNetErr(dataRef.current ? OFFLINE : "אין חיבור לשיט כרגע");
      } finally {
        loading.current = false;
        if (reloadAgain.current) {
          reloadAgain.current = false;
          if (!inflight.current) void load();
        }
      }
    },
    [authLost, showToast],
  );

  const poll = useCallback(async () => {
    if (document.visibilityState === "hidden" || inflight.current || loading.current || polling.current) return;
    polling.current = true;
    try {
      const r = await fetch("/api/version", { cache: "no-store" });
      if (r.status === 401 || r.status === 403) return authLost();
      if (!r.ok) throw new Error();
      const { ver } = (await r.json()) as { ver: string };
      if (ver !== verRef.current) await load();
      else {
        setLoadedAt(Date.now());
        setNetErr(null);
      }
    } catch {
      setNetErr(dataRef.current ? OFFLINE : "אין חיבור לשיט כרגע");
    } finally {
      polling.current = false;
    }
  }, [authLost, load]);

  useEffect(() => {
    const t = todayKey();
    lastDay.current = t;
    setUiState((u) => ({ ...u, date: t }));
    setNow(Date.now());
    const cached = readCache();
    if (cached) {
      serverRef.current = cached;
      verRef.current = "";
      setData(cached);
    }
    const standalone = matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    setEnv({ standalone, isIOS: /iphone|ipad|ipod/i.test(navigator.userAgent), installHidden: getFlag(INSTALL_HIDE_KEY) });
    void load();
    const iv = setInterval(() => void poll(), POLL_MS);
    const tick = setInterval(() => setNow(Date.now()), 30000);
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const d = todayKey();
      if (d !== lastDay.current) {
        lastDay.current = d;
        setUiState((u) => ({ ...u, date: d }));
      }
      setNow(Date.now());
      void poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => {
      clearInterval(iv);
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [load, poll]);

  /* ---------- writing ---------- */
  const send = useCallback(
    async (changes: Change[]): Promise<boolean> => {
      inflight.current++;
      writeSeq.current++;
      setSaving((n) => n + 1);
      let ok = false;
      try {
        const r = await fetch("/api/changes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ changes }) });
        if (r.status === 401 || r.status === 403) {
          showToast("ההתחברות פגה. נכנסים מחדש…", 3000);
          setTimeout(authLost, 1500);
          failed.current = true;
          return false;
        }
        if (!r.ok) throw new Error("http " + r.status);
        const j = (await r.json()) as ChangesResult;
        ok = true;
        if (j.skipped?.length) showToast("לא נמצא בשיט: " + j.skipped.join(", "), 4500);
      } catch {
        failed.current = true;
        showToast("השמירה בשיט נכשלה. בדוק חיבור ונסה שוב", 4500);
      } finally {
        inflight.current--;
        setSaving((n) => n - 1);
        if (!inflight.current) {
          if (failed.current) {
            failed.current = false;
            if (serverRef.current) setData(serverRef.current); // revert to the last server state
          }
          void load();
        }
      }
      return ok;
    },
    [authLost, load, showToast],
  );

  const mutate = useCallback((fn: (d: AppData) => AppData) => setData((d) => (d ? fn(d) : d)), []);
  const findS = (id: string) => dataRef.current?.soldiers.find((x) => x.id === id);

  const setStatuses = useCallback(
    async (pairs: [Soldier, StatusKey | ""][], date: string) => {
      if (!pairs.length) return true;
      const by = new Map(pairs.map(([s, v]) => [s.id, v]));
      mutate((d) => ({
        ...d,
        soldiers: d.soldiers.map((s) => {
          if (!by.has(s.id)) return s;
          const v = by.get(s.id)!;
          const plan = { ...s.plan };
          if (v) plan[date] = v;
          else delete plan[date];
          return { ...s, plan };
        }),
      }));
      return send(pairs.map(([s, v]) => ({ kind: "status", pid: s.pid, name: s.name, date, status: v })));
    },
    [mutate, send],
  );

  const saveConfig = useCallback(
    async (key: "roles" | "alerts", value: RolesConfig | AlertsConfig) => {
      mutate((d) => ({ ...d, config: { ...d.config, [key]: value } }));
      return send([{ kind: "config", key, value } as Change]);
    },
    [mutate, send],
  );

  const model = useMemo(
    () =>
      createModel({
        soldiers: data?.soldiers || [],
        date: ui.date || todayKey(),
        roles: data?.config.roles || null,
        alerts: data?.config.alerts || null,
        attached: data ? data.attached : null,
        view: ui.view,
        unit: ui.unit,
        drill: ui.drill,
        attFilter: ui.attFilter,
      }),
    [data, ui.date, ui.view, ui.unit, ui.drill, ui.attFilter],
  );

  const act: Actions = {
    go(view, extra) {
      setUiState((u) => ({ ...u, view, ...extra }));
      window.scrollTo(0, 0);
    },
    setUi(p) {
      setUiState((u) => ({ ...u, ...p }));
    },
    shiftDay(n) {
      setUiState((u) => ({ ...u, date: shift(u.date, n) }));
    },
    today() {
      setUiState((u) => ({ ...u, date: todayKey() }));
    },
    refresh() {
      showToast("מרענן מהשיט…", 1200);
      void load(true);
    },
    async setStatus(id, v) {
      const s = findS(id);
      const date = uiRef.current.date;
      setUiState((u) => ({ ...u, sheetFor: null }));
      if (!s) return;
      setPending((p) => ({ ...p, [id]: true }));
      const ok = await setStatuses([[s, v]], date);
      setPending((p) => {
        const n = { ...p };
        delete n[id];
        return n;
      });
      if (ok) showToast(v ? `נשמר: ${s.name} · ${STMAP[v]?.n || ""}` : "הסטטוס נוקה", 2600);
    },
    async allBase() {
      const date = uiRef.current.date;
      const l = model.active(model.inUnit(uiRef.current.unit || "")).filter((s) => !model.stOf(s));
      if (await setStatuses(l.map((s) => [s, "base"]), date)) showToast("עודכן");
    },
    async copyPrev() {
      const date = uiRef.current.date;
      const y = shift(date, -1);
      const l = model.active(model.inUnit(uiRef.current.unit || "")).filter((s) => STMAP[s.plan?.[y]] && s.plan[y] !== model.stOf(s));
      if (!l.length) {
        showToast("אין מה להעתיק מאתמול");
        return;
      }
      if (await setStatuses(l.map((s) => [s, s.plan[y]]), date)) showToast(`הועתקו ${l.length} סטטוסים מאתמול`);
    },
    async setVeh(id, v: VehKey | "") {
      const s = findS(id);
      if (!s) return;
      if (!s.shab) {
        showToast(`${s.name} לא מופיע בלשונית שבצ"ק בשיט`, 3500);
        return;
      }
      mutate((d) => ({ ...d, soldiers: d.soldiers.map((x) => (x.id === id ? { ...x, sheetVeh: v } : x)) }));
      if (await send([{ kind: "veh", pid: s.pid, name: s.name, veh: v }])) showToast(`נשמר: ${s.name} · ${VEHMAP[v]?.n || "ללא רכב"}`, 2200);
    },
    async setRole(id, v) {
      const s = findS(id);
      setUiState((u) => ({ ...u, roleFor: null }));
      if (!s) return;
      const nx = model.curRoles();
      if (v === "__sheet") delete nx.pakal[norm(s.name)];
      else nx.pakal[norm(s.name)] = v;
      if (/מפקצ/.test(norm(v)) && !nx.cmd.some((n) => norm(n) === norm(s.name))) nx.cmd.push(s.name);
      await saveConfig("roles", nx);
    },
    async setCmd(id, on) {
      const s = findS(id);
      if (!s) return;
      const nx = model.curRoles();
      nx.cmd = nx.cmd.filter((n) => norm(n) !== norm(s.name));
      if (on) nx.cmd.push(s.name);
      await saveConfig("roles", nx);
    },
    async setBreaks(next: BreakPeriod[], msg) {
      if (await saveConfig("alerts", { ...(dataRef.current?.config.alerts || {}), breaks: next })) showToast(msg);
    },
    async copy(text, okMsg, failMsg, fallbackEl) {
      try {
        await navigator.clipboard.writeText(text);
        showToast(okMsg);
      } catch {
        const el = fallbackEl ? document.getElementById(fallbackEl) : null;
        if (el) {
          const r = document.createRange();
          r.selectNodeContents(el);
          const sel = getSelection();
          sel?.removeAllRanges();
          sel?.addRange(r);
        }
        showToast(failMsg);
      }
    },
    toast: showToast,
    hideInstall() {
      setFlag(INSTALL_HIDE_KEY);
      setEnv((e) => ({ ...e, installHidden: true }));
    },
    async signOut() {
      clearLocalData();
      if (mock) {
        showToast("במצב בדיקה אין התנתקות");
        return;
      }
      await signOut();
    },
  };

  // Escape closes bottom sheets.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setUiState((u) => (u.sheetFor || u.roleFor ? { ...u, sheetFor: null, roleFor: null } : u));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const syncText = netErr ? (
    netErr
  ) : saving ? (
    <>
      <Spin /> כותב בשיט…
    </>
  ) : (
    <>
      <span className="livedot"></span>מחובר לשיט · עודכן {ago(loadedAt, now || Date.now())}
    </>
  );

  let body: React.ReactNode;
  let waText = "";
  let waLabel = "";
  if (!data || !data.soldiers.length || !ui.date) {
    body = <LoadingView netErr={netErr} onRetry={() => void load(true)} />;
  } else {
    const p: ViewProps = {
      m: model,
      ui,
      data,
      act,
      pending,
      syncText,
      netErr,
      loadedAt,
      now,
      showInstall: ui.view === "home" && !env.standalone && !env.installHidden,
      standalone: env.standalone,
      isIOS: env.isIOS,
      mock,
      email,
    };
    const views: Partial<Record<View, (p: ViewProps) => React.ReactNode>> = { unit: TeamView, summary: SummaryView, import: ConnectView, crew: CrewView, moves: MovesView, long: LongView, shmap: ShmapView, home: Home };
    const V = views[ui.view] || Home;
    body = <V {...p} />;
    try {
      waText = model.waText();
      waLabel = model.waLabel();
    } catch {
      waText = "";
    }
  }

  const sheetS = ui.sheetFor ? data?.soldiers.find((x) => x.id === ui.sheetFor) : null;
  const roleS = ui.roleFor ? data?.soldiers.find((x) => x.id === ui.roleFor) : null;

  return (
    <>
      <div className="wrap" dir="rtl" lang="he" id="app">
        {body}
      </div>
      <div id="layer">
        {sheetS ? (
          <StatusSheet s={sheetS} m={model} date={ui.date} onPick={(v) => void act.setStatus(sheetS.id, v)} onClose={() => act.setUi({ sheetFor: null })} />
        ) : roleS ? (
          <RoleSheet key={roleS.id} s={roleS} m={model} onSet={(v) => void act.setRole(roleS.id, v)} onCmd={(on) => void act.setCmd(roleS.id, on)} onClose={() => act.setUi({ roleFor: null })} />
        ) : null}
      </div>
      {waText && !sheetS && !roleS ? (
        <a id="wa" className="wa" dir="rtl" target="_blank" rel="noopener" href={"https://wa.me/?text=" + encodeURIComponent(waText)}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M2.5 11.2 20.6 3.4c.8-.3 1.5.4 1.2 1.2l-7.8 18.1c-.3.8-1.5.8-1.8 0l-2.3-6.6-6.6-2.3c-.8-.3-.8-1.5 0-1.8Zm7.9 4.1 1.6 4.6 5.6-12.9-7.2 8.3Zm-1.4-1.4 7.2-8.3-12.9 5.6 4.6 1.6Z" />
          </svg>
          <span id="walbl">{waLabel}</span>
        </a>
      ) : null}
      {toast ? (
        <div key={toast.id} className="toast" role="status">
          {toast.t}
        </div>
      ) : null}
    </>
  );
}
