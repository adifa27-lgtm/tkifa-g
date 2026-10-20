"use client";

import { useState } from "react";
import { ROLE_PRESETS, ST } from "@/lib/core/constants";
import type { Model } from "@/lib/core/model";
import type { Soldier, StatusKey } from "@/lib/core/types";
import { fmtDate, norm } from "@/lib/core/util";
import { v } from "./common";

export function StatusSheet({ s, m, date, onPick, onClose }: { s: Soldier; m: Model; date: string; onPick: (v: StatusKey | "") => void; onClose: () => void }) {
  const cur = m.stOf(s);
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" dir="rtl" role="dialog" aria-label="בחירת סטטוס">
        <h3>{s.name}</h3>
        <p className="num">{fmtDate(date).short}</p>
        <div className="opts">
          {ST.map((o) => (
            <button key={o.k} className={`opt ${cur === o.k ? "sel" : ""}`} onClick={() => onPick(o.k)}>
              <i className="dot" style={{ background: v(o.c) }} />
              {o.n}
            </button>
          ))}
        </div>
        {cur ? (
          <button className="btn clear" onClick={() => onPick("")}>
            נקה סטטוס
          </button>
        ) : null}
      </div>
    </>
  );
}

export function RoleSheet({
  s,
  m,
  onSet,
  onCmd,
  onClose,
}: {
  s: Soldier;
  m: Model;
  onSet: (v: string) => void;
  onCmd: (on: boolean) => void;
  onClose: () => void;
}) {
  const r = m.roleOf(s);
  const c = m.isCmd(s);
  const [txt, setTxt] = useState(ROLE_PRESETS.includes(r) ? "" : r);
  const hasOverride = m.S.roles?.pakal?.[norm(s.name)] != null;
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" dir="rtl" role="dialog" aria-label="תפקיד">
        <h3>{s.name}</h3>
        <p>
          תפקיד / פק&quot;ל{s.pakal ? ` · בשיט: ${s.pakal}` : ""}
        </p>
        <div className="opts">
          {ROLE_PRESETS.map((o) => (
            <button key={o} className={`opt ${r === o ? "sel" : ""}`} onClick={() => onSet(o)}>
              {o}
            </button>
          ))}
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <input type="text" id="roletxt" placeholder="תפקיד אחר" value={txt} onChange={(e) => setTxt(e.target.value)} />
          <button className="btn sm primary" onClick={() => onSet(txt.trim())}>
            שמור
          </button>
        </div>
        <label className="note" style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
          <input type="checkbox" id="cmdchk" checked={c} onChange={(e) => onCmd(e.target.checked)} /> מפק&quot;צ קבוע (מודגש ומופיע ראשון בצוות)
        </label>
        {hasOverride ? (
          <button className="btn clear" onClick={() => onSet("__sheet")}>
            חזור לתפקיד מהשיט
          </button>
        ) : null}
      </div>
    </>
  );
}
