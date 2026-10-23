"use client";

import { useState } from "react";
import { ST, STMAP, VEH } from "@/lib/core/constants";
import { pkClass, segText, stName, type ClosedSoon, type LongStay, type ShmapChange } from "@/lib/core/model";
import type { Soldier, StatusKey } from "@/lib/core/types";
import { dayDiff, fmtShort, shift, teamName, todayKey } from "@/lib/core/util";
import { Back, DateBar, Spin, v } from "./common";
import type { ViewProps } from "./types";

/* ---------------- sync bar + install hint ---------------- */
function installSteps(isIOS: boolean) {
  return isIOS ? (
    <>
      בספארי: לחץ על כפתור השיתוף <b>⎙</b> בתחתית המסך, ואז <b>&quot;הוסף למסך הבית&quot;</b>.
    </>
  ) : (
    <>
      בכרום: לחץ על <b>⋮</b> למעלה, ואז <b>&quot;הוספה למסך הבית&quot;</b> או <b>&quot;התקנת אפליקציה&quot;</b>.
    </>
  );
}

function SyncBar(p: ViewProps) {
  return (
    <>
      <div className={`syncbar ${p.netErr ? "stale" : "live"}`}>
        <div className="src">
          <b>{p.data.title || "גוגל שיט"}</b>
          <span id="synctxt">{p.syncText}</span>
        </div>
        <button className="btn sm" onClick={() => p.act.refresh()}>
          רענן
        </button>
      </div>
      {p.showInstall ? (
        <div className="banner" style={{ margin: "0 0 10px" }}>
          📲 <b>להתקנה כאפליקציה:</b> {installSteps(p.isIOS)}
          <br />
          <button className="btn sm" style={{ marginTop: 8 }} onClick={() => p.act.hideInstall()}>
            הבנתי, הסתר
          </button>
        </div>
      ) : null}
    </>
  );
}

export function LoadingView({ netErr, onRetry }: { netErr: string | null; onRetry: () => void }) {
  return (
    <>
      <header className="top">
        <span className="eyebrow">תמונת מצב יומית</span>
        <h1>כוח אדם תקיפה ג&apos; גדס&quot;ר</h1>
      </header>
      {netErr ? (
        <div className="banner err" role="alert">
          <b>{netErr}</b>
          <br />
          בדוק שיש אינטרנט ונסה שוב.
          <br />
          <button className="btn sm" onClick={onRetry}>
            נסה שוב
          </button>
        </div>
      ) : (
        <div className="empty">
          <Spin /> טוען נתונים מהשיט…
        </div>
      )}
    </>
  );
}

/* ---------------- home ---------------- */
export function Home(p: ViewProps) {
  const { m, ui, data, act } = p;
  const all = m.roster();
  const act_ = m.active(all);
  const c = m.counts(all);
  const total = act_.length;
  const longs = m.longStays(ui.date);
  const closed = m.closedSoon(ui.date);
  const sh = m.shmapChanges();
  const mv = m.movesDay(ui.date);
  return (
    <>
      <header className="top">
        <span className="eyebrow">תמונת מצב יומית</span>
        <h1>כוח אדם תקיפה ג&apos; גדס&quot;ר</h1>
      </header>
      <SyncBar {...p} />
      {p.mock ? <div className="banner" style={{ margin: "0 0 10px" }}>מצב בדיקה: נתונים בדויים, לא הגיליון האמיתי.</div> : null}
      <DateBar date={ui.date} events={data.events} act={act} />
      <section className="hero" aria-label="חיילים בבסיס">
        <span className="lbl">חיילים בבסיס</span>
        <div className="big num">
          <b>{c.base}</b>
          <span>
            מתוך {total - c.tzav} בשירות{c.tzav ? ` · ${c.tzav} צו סגור` : ""}
          </span>
        </div>
        <div className="stack">
          {ST.map((s) => (c[s.k] ? <i key={s.k} style={{ width: `${(c[s.k] / total) * 100}%`, background: v(s.c) }} /> : null))}
        </div>
        <div className="legend num">
          {ST.filter((s) => c[s.k]).map((s) => (
            <span key={s.k}>
              <i className="dot" style={{ background: v(s.c) }} />
              {s.n} <b className="num">{c[s.k]}</b>
            </span>
          ))}
          {c.none ? (
            <span>
              <i className="dot" style={{ background: "var(--s-none)" }} />
              ללא סטטוס <b className="num">{c.none}</b>
            </span>
          ) : null}
        </div>
      </section>
      <div className="sectionhead">
        <span className="eyebrow">צוותים</span>
        <span className="note num">{total} חיילים</span>
      </div>
      <div className="units">
        {m.units().map((u) => {
          const l = m.inUnit(u.k);
          const la = m.active(l);
          const cc = m.counts(l);
          const sub = [cc.home ? `${cc.home} בבית` : "", cc.out ? `${cc.out} יציאה` : "", cc.tzav ? `${cc.tzav} צו סגור` : ""].filter(Boolean).join(" · ") || " ";
          return (
            <button key={u.k} className="unit" onClick={() => act.go("unit", { unit: u.k })}>
              <div className="nm">{teamName(u.n)}</div>
              <div className="cnt num">
                <b>{cc.base}</b>
                <span>/{la.length}</span>
                <small>בבסיס</small>
              </div>
              <div className="prog" aria-hidden="true">
                {ST.map((s) => (cc[s.k] ? <i key={s.k} style={{ width: `${(cc[s.k] / la.length) * 100}%`, background: v(s.c) }} /> : null))}
              </div>
              <div className="sub num">{sub}</div>
            </button>
          );
        })}
        <button className={`unit mp wide alert ${longs.some((x) => !x.handled) || closed.length ? "hot" : ""}`} onClick={() => act.go("long")}>
          <div>
            <div className="nm">התראות שבוע קרוב</div>
            <div className="sub num">{m.longLine()}</div>
          </div>
          <span className="chev">‹</span>
        </button>
        <button className={`unit mp wide alert ${sh.closed.length ? "hot" : ""}`} onClick={() => act.go("shmap")}>
          <div>
            <div className="nm">שינויי שמ&quot;פ היום</div>
            <div className="sub num">{sh.closed.length || sh.opened.length ? `${sh.closed.length} נסגר · ${sh.opened.length} נפתח` : "אין שינויים היום"}</div>
          </div>
          <span className="chev">‹</span>
        </button>
        <button className="unit mp wide" onClick={() => act.go("crew")}>
          <div>
            <div className="nm">שבצ&quot;ק רכבים</div>
            <div className="sub num">{m.crewSummaryLine()}</div>
          </div>
          <span className="chev">‹</span>
        </button>
        <button className="unit mp wide" onClick={() => act.go("moves")}>
          <div>
            <div className="nm">מגיעים ויוצאים</div>
            <div className="sub num">
              {ui.date === todayKey() ? "היום" : "ביום הזה"}: {mv.arr.length} מגיעים · {mv.out.length} יוצאים הביתה
            </div>
          </div>
          <span className="chev">‹</span>
        </button>
        <button className="unit mp wide" onClick={() => act.go("summary", { drill: null })}>
          <div>
            <div className="nm">נתוני מ&quot;פ</div>
            <div className="sub">סה&quot;כ לפי סטטוס, רשימות שמיות ודוח להעברה</div>
          </div>
          <span className="chev">‹</span>
        </button>
      </div>
      <div className="sectionhead">
        <span></span>
        <button className="btn" onClick={() => act.go("import")}>
          חיבור והתקנה
        </button>
      </div>
    </>
  );
}

/* ---------------- team ---------------- */
function SoldierRow({ s, p, longMap, closedMap }: { s: Soldier; p: ViewProps; longMap: Record<string, LongStay>; closedMap: Record<string, ClosedSoon> }) {
  const { m, ui, act } = p;
  const stk = m.stOf(s);
  const st = stk ? STMAP[stk] : null;
  const off = s.arriving === false;
  const sub = [s.line && s.line !== "התייצבות" ? s.line : "", s.student ? "סטודנט" : "", s.indep ? "עצמאי" : "", s.note].filter(Boolean).join(" · ");
  const lg = longMap[s.id];
  const cl = closedMap[s.id];
  const rl = m.roleOf(s);
  const cm = m.isCmd(s);
  return (
    <div className={`srow ${off ? "off" : ""} ${cm ? "cmd" : ""} ${m.isLead(s) ? "lead" : ""}`}>
      <div className="who">
        <b>
          {s.name}
          {rl ? (
            <>
              {" "}
              <span className={`pk sm ${pkClass(rl)}`}>{rl}</span>
            </>
          ) : cm ? (
            <>
              {" "}
              <span className="pk sm cmdr">מפק&quot;צ</span>
            </>
          ) : null}
        </b>
        {s.baseDays != null || s.homeDays != null ? (
          <span className="days num">
            {s.baseDays ?? 0} ימי בסיס · {s.homeDays ?? 0} ימי בית
          </span>
        ) : null}
        {cl && !(lg && !lg.handled) ? (
          <span className="lbadge num ok">
            {cl.v === "abroad" ? 'חו"ל' : "צו סגור"} מ-{fmtShort(cl.date)}
          </span>
        ) : null}
        {lg && !(lg.handled && cl) ? (
          <span className={`lbadge num ${lg.handled ? "ok" : ""}`}>
            {lg.handled ? lg.hlabel : lg.already ? `מחוץ לבסיס ${dayDiff(lg.st, ui.date) + 1} ימים ברצף` : `יעבור 7 ימים מחוץ לבסיס ב-${fmtShort(lg.cross)}`}
          </span>
        ) : null}
        {sub ? <span className="note2">{sub}</span> : null}
      </div>
      {off ? (
        <span className="tag">לא מגיע לסבב</span>
      ) : p.pending[s.id] ? (
        <span className="pill saving">
          <Spin /> שומר…
        </span>
      ) : (
        <button className={`pill ${st ? "" : "none"}`} style={st ? ({ "--pc": v(st.c) } as React.CSSProperties) : undefined} onClick={() => act.setUi({ sheetFor: s.id })}>
          {st ? st.n : "בחר סטטוס"}
        </button>
      )}
    </div>
  );
}

export function TeamView(p: ViewProps) {
  const { m, ui, data, act } = p;
  const u = m.units().find((x) => x.k === ui.unit);
  if (!u) return <Home {...p} />;
  const longMap = Object.fromEntries(m.longStays(ui.date).map((x) => [x.s.id, x]));
  const closedMap = Object.fromEntries(m.closedSoon(ui.date).map((x) => [x.s.id, x]));
  const l = m.inUnit(u.k);
  const la = m.active(l);
  const off = l.filter((s) => s.arriving === false);
  const c = m.counts(l);
  return (
    <>
      <Back act={act} />
      <div className="viewhead">
        <h2>{teamName(u.n)}</h2>
        <DateBar date={ui.date} events={data.events} act={act} />
        <div className="chips">
          {ST.filter((s) => c[s.k]).map((s) => (
            <span key={s.k} className="chip num">
              <i className="dot" style={{ background: v(s.c) }} />
              {s.n} {c[s.k]}
            </span>
          ))}
          {c.none ? (
            <span className="chip num">
              <i className="dot" style={{ background: "var(--s-none)" }} />
              ללא סטטוס {c.none}
            </span>
          ) : null}
        </div>
        <p className="note" style={{ margin: 0 }}>
          לחיצה על חייל משנה את הסטטוס שלו, והשינוי נכתב מיד בגוגל שיט.
        </p>
        <div className="tools">
          {c.none ? (
            <button className="btn" onClick={() => act.allBase()}>
              סמן {c.none} שאין להם סטטוס: בסיס
            </button>
          ) : null}
          <button className="btn" onClick={() => act.copyPrev()}>
            העתק מאתמול
          </button>
        </div>
      </div>
      <div className="roster">
        {la.length ? la.map((s) => <SoldierRow key={s.id} s={s} p={p} longMap={longMap} closedMap={closedMap} />) : <div className="empty">אין חיילים מגיעים במחלקה הזו.</div>}
        {off.length ? (
          <>
            <div className="subhead">לא מגיעים לסבב ({off.length})</div>
            {off.map((s) => (
              <SoldierRow key={s.id} s={s} p={p} longMap={longMap} closedMap={closedMap} />
            ))}
          </>
        ) : null}
      </div>
      {la.length ? <WeekGrid p={p} list={la} /> : null}
    </>
  );
}

/* ---------------- שבוע וחצי קדימה (team grid) ---------------- */
const WK_DAYS = 11;
const WK_LET: Record<StatusKey, string> = { base: "ב", home: "ה", out: "י", tzav: "צ", abroad: "ח", org: "ת", post: "מ" };
const DAY_LET = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

function WeekGrid({ p, list }: { p: ViewProps; list: Soldier[] }) {
  const { m, ui } = p;
  const ds = Array.from({ length: WK_DAYS }, (_, i) => shift(ui.date, i));
  const tk = todayKey();
  return (
    <>
      <div className="sectionhead">
        <span className="eyebrow">שבוע וחצי קדימה</span>
        <span className="note num">
          {fmtShort(ds[0])}–{fmtShort(ds[ds.length - 1])}
        </span>
      </div>
      <div className="wk">
        <table>
          <thead>
            <tr>
              <th className="nm">חייל</th>
              {ds.map((d) => {
                const [y, mo, dd] = d.split("-").map(Number);
                return (
                  <th key={d} className={d === tk ? "today" : ""}>
                    {DAY_LET[new Date(y, mo - 1, dd).getDay()]}
                    <br />
                    <span className="num">
                      {dd}/{mo}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.id}>
                <td className="nm">{s.name}</td>
                {ds.map((d) => {
                  const k = m.stDay(s, d);
                  const st = k ? STMAP[k] : null;
                  const arr = k === "base" && m.stDay(s, shift(d, -1)) !== "base";
                  return (
                    <td key={d}>
                      {st && k ? (
                        <span className={`c ${arr ? "arr" : ""}`} style={{ "--pc": v(st.c) } as React.CSSProperties} title={st.n + (arr ? " · מגיע לבסיס" : "")}>
                          {WK_LET[k]}
                        </span>
                      ) : (
                        <span className="c none">·</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="nm">בבסיס</td>
              {ds.map((d) => (
                <td key={d} className="num">
                  {list.filter((s) => m.stDay(s, d) === "base").length}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="wkleg">
        {ST.map((x) => (
          <span key={x.k}>
            <span className="c" style={{ "--pc": v(x.c) } as React.CSSProperties}>
              {WK_LET[x.k]}
            </span>
            {x.k === "abroad" ? 'חו"ל' : x.n}
          </span>
        ))}
        <span>
          <span className="c arr" style={{ "--pc": v("--s-base") } as React.CSSProperties}>
            ב
          </span>
          מגיע לבסיס
        </span>
      </div>
    </>
  );
}

/* ---------------- מגיעים ויוצאים ---------------- */
export function MovesView(p: ViewProps) {
  const { m, ui, data, act } = p;
  const group = (list: Soldier[], k: StatusKey, title: string, empty: string) => (
    <section className="drill" style={{ "--pc": v(STMAP[k].c) } as React.CSSProperties}>
      <div className="dh">
        <h3>
          {title} · <span className="num">{list.length}</span>
        </h3>
      </div>
      {list.length ? (
        m.byTeam(list).map((g) => (
          <div key={g.u.k} className="dg">
            <div className="dgt">
              {teamName(g.u.n)} <span className="num">{g.l.length}</span>
            </div>
            <div className="names">
              {g.l.map((s) => (
                <span key={s.id}>{s.name}</span>
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className="note">{empty}</div>
      )}
    </section>
  );
  return (
    <>
      <Back act={act} />
      <div className="viewhead">
        <h2>מגיעים ויוצאים</h2>
        <DateBar date={ui.date} events={data.events} act={act} />
        <p className="note" style={{ margin: 0 }}>
          יוצאים = &quot;יציאה הביתה&quot; באותו יום. מגיעים = בבסיס באותו יום, אחרי כל סטטוס אחר ביום שלפני.
        </p>
      </div>
      {[0, 1, 2].map((i) => {
        const x = m.movesDay(shift(ui.date, i));
        return (
          <div key={i}>
            <div className="sectionhead">
              <span className="eyebrow num">{m.relLabel(i)}</span>
              <span className="note num">
                {x.arr.length} מגיעים · {x.out.length} יוצאים
              </span>
            </div>
            {group(x.arr, "base", "מגיעים לבסיס", "אף אחד לא מגיע")}
            {group(x.out, "out", "יוצאים הביתה", "אף אחד לא יוצא")}
          </div>
        );
      })}
    </>
  );
}

/* ---------------- שבצ"ק רכבים ---------------- */
export function CrewView(p: ViewProps) {
  const { m, ui, data, act } = p;
  const { cnt, none } = m.vehCounts();
  const groups = m.crewGroups().filter((x) => x.l.length);
  const row = (s: Soldier) => {
    const r = m.roleOf(s);
    const pc = pkClass(r);
    const c = m.isCmd(s);
    const cur = m.vehOf(s);
    return (
      <div key={s.id} className={`crow ${c ? "cmd" : ""} ${pc === "mp" ? "lead" : ""} ${m.leaving(s) ? "leaving" : ""}`}>
        <div className="who">
          <b>{s.name}</b>
          {m.leaving(s) ? <span className="lv">יוצא הביתה</span> : m.stOf(s) === "post" ? <span className="lv post">מוצב</span> : null}
          {c && pc !== "mp" ? <span className="badge">מפק&quot;צ</span> : null}
          {pc === "med" ? (
            <span className="medic" title="חובש" aria-label="חובש">
              ✚
            </span>
          ) : null}
        </div>
        <select
          className={`veh ${cur ? "set" : ""}`}
          id={`veh-${s.id}`}
          aria-label={`רכב עבור ${s.name}`}
          value={cur}
          onChange={(e) => {
            act.setVeh(s.id, e.target.value as never);
            const t = e.target;
            setTimeout(() => {
              if (document.activeElement === t) t.blur();
            }, 300);
          }}
        >
          <option value="">— רכב —</option>
          {VEH.map((o) => (
            <option key={o.k} value={o.k}>
              {o.n}
            </option>
          ))}
        </select>
      </div>
    );
  };
  return (
    <>
      <Back act={act} />
      <div className="viewhead">
        <h2>שבצ&quot;ק רכבים</h2>
        <DateBar date={ui.date} events={data.events} act={act} />
        <p className="note" style={{ margin: 0 }}>
          החיילים שבבסיס, במוצב או ביציאה הביתה ביום הזה, בלי מפל&quot;ג. שורה כתומה = יוצא הביתה היום ויהיה מחוץ ללופ. השיבוץ נכתב מיד בלשונית שבצ&quot;ק בשיט.
        </p>
        <div className="vehsum">
          {VEH.map((o) => (
            <span key={o.k} className={`vs ${cnt[o.k] ? "" : "zero"}`}>
              <b className="num">{cnt[o.k]}</b>
              {o.n}
            </span>
          ))}
          <span className={`vs ${none ? "warn" : "zero"}`}>
            <b className="num">{none}</b>לא שובצו
          </span>
        </div>
        <div className="legendrow">
          <span className="badge">מפק&quot;צ</span>
          <span className="medic" aria-hidden="true">
            ✚
          </span>
          <span className="note">חובש</span>
        </div>
      </div>
      {groups.length ? (
        groups.map((x) => (
          <div key={x.u.k}>
            <div className="sectionhead">
              <span className="eyebrow">{teamName(x.u.n)}</span>
              <span className="note num">
                {x.l.length} בשבצ&quot;ק{x.l.some(m.leaving) ? ` · ${x.l.filter(m.leaving).length} יוצאים` : ""}
              </span>
            </div>
            <div className="roster">{x.l.map(row)}</div>
          </div>
        ))
      ) : (
        <div className="empty">אין חיילים בשבצ&quot;ק ביום הזה.</div>
      )}
    </>
  );
}

/* ---------------- התראות שבוע קרוב ---------------- */
export function LongView(p: ViewProps) {
  const { m, ui, data, act } = p;
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [label, setLabel] = useState("");
  const l = m.longStays(ui.date);
  const cl = m.closedSoon(ui.date);
  const inCl = new Set(cl.map((x) => x.s.id));
  const todo = l.filter((x) => !x.handled);
  const done = l.filter((x) => x.handled && !inCl.has(x.s.id));
  const breaks = m.approvedBreaks();
  const row = (x: LongStay) => (
    <div key={x.s.id} className={`lrow ${x.handled ? "done" : x.already ? "over" : ""}`}>
      <div className="who">
        <b>{x.s.name}</b>
        <span className="note2">
          {teamName(x.s.unit)}
          {x.s.pakal ? " · " + x.s.pakal : ""}
        </span>
        <span className="days num">
          {x.segs.map(segText).join(" · ")} · {x.len} ימים ברצף
        </span>
      </div>
      <div className="lside num">
        {x.handled ? (
          <>
            <b className="ok">{x.hlabel}</b>
            <span>מטופל</span>
          </>
        ) : (
          <>
            <b>{x.already ? `יום ${dayDiff(x.st, ui.date) + 1}` : fmtShort(x.cross)}</b>
            <span>{x.already ? "מחוץ לבסיס היום" : "עובר 7 ימים"}</span>
          </>
        )}
      </div>
    </div>
  );
  const crow = (x: ClosedSoon) => (
    <div key={x.s.id} className="lrow done">
      <div className="who">
        <b>{x.s.name}</b>
        <span className="note2">
          {teamName(x.s.unit)}
          {x.s.pakal ? " · " + x.s.pakal : ""}
        </span>
        <span className="days num">
          {x.v === "abroad" ? 'חו"ל' : "צו סגור"} {fmtShort(x.date)}–{fmtShort(x.to)} · {x.len} ימים
        </span>
      </div>
      <div className="lside num">
        <b className="ok">{fmtShort(x.date)}</b>
        <span>{x.v === "abroad" ? 'חו"ל · שמ"פ סגור' : 'שמ"פ סגור'}</span>
      </div>
    </div>
  );
  const addBreak = () => {
    if (!from || !to || to < from) {
      act.toast("בחר תאריך התחלה ותאריך סיום");
      return;
    }
    act.setBreaks([...breaks, { from, to, label: label.trim() }], "התקופה נוספה");
    setFrom("");
    setTo("");
    setLabel("");
  };
  return (
    <>
      <Back act={act} />
      <div className="viewhead">
        <h2>התראות שבוע קרוב</h2>
        <DateBar date={ui.date} events={data.events} act={act} />
        <p className="note" style={{ margin: 0 }}>
          חיילים שיהיו מחוץ לבסיס (בית / צו סגור / חו&quot;ל) יותר מ-7 ימים ברצף, בשבוע {fmtShort(ui.date)}–{fmtShort(shift(ui.date, 6))}. &quot;דורש טיפול&quot; = ביום השמיני הוא עדיין רשום בבית: לסגור שמ&quot;פ ולאסוף נשק, או לעדכן חו&quot;ל.
        </p>
      </div>
      {l.length || cl.length ? (
        <>
          {todo.length ? (
            <>
              <div className="sectionhead">
                <span className="eyebrow">דורש טיפול</span>
                <span className="note num">{todo.length}</span>
              </div>
              <div className="roster">{todo.map(row)}</div>
            </>
          ) : (
            <div className="banner">אין חיילים שדורשים טיפול השבוע.</div>
          )}
          {cl.length ? (
            <>
              <div className="sectionhead">
                <span className="eyebrow">עוברים לשמ&quot;פ סגור השבוע</span>
                <span className="note num">{cl.length}</span>
              </div>
              <div className="roster">{cl.map(crow)}</div>
            </>
          ) : null}
          {done.length ? (
            <>
              <div className="sectionhead">
                <span className="eyebrow">מעל 7 ימים — כבר בשמ&quot;פ סגור</span>
                <span className="note num">{done.length}</span>
              </div>
              <div className="roster">{done.map(row)}</div>
            </>
          ) : null}
          <div className="sectionhead">
            <span></span>
            <button className="btn primary" onClick={() => act.copy(m.longText(), "הרשימה הועתקה", "ההעתקה נחסמה")}>
              העתק רשימה
            </button>
          </div>
        </>
      ) : (
        <div className="empty">אין התראות לשבוע הקרוב.</div>
      )}
      <section className="card" style={{ marginTop: 16 }}>
        <h3>תקופות בית מאושרות</h3>
        <p className="note" style={{ margin: 0 }}>
          ימים בתקופות האלה לא נספרים להתראה (למשל חופשה מאושרת אחרי תרגיל).
        </p>
        {breaks.length ? (
          <div className="breaks">
            {breaks.map((b, i) => (
              <div key={i} className="brk">
                <span className="num">
                  {fmtShort(b.from)}–{fmtShort(b.to)}
                </span>
                <span>{b.label || ""}</span>
                <button
                  className="btn sm"
                  aria-label="מחק תקופה"
                  onClick={() => {
                    const cur = [...breaks];
                    cur.splice(i, 1);
                    act.setBreaks(cur, "התקופה נמחקה");
                  }}
                >
                  מחק
                </button>
              </div>
            ))}
          </div>
        ) : null}
        <div className="row">
          <input type="date" id="brkfrom" aria-label="מתאריך" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input type="date" id="brkto" aria-label="עד תאריך" value={to} onChange={(e) => setTo(e.target.value)} />
          <input type="text" id="brklabel" placeholder="שם (לא חובה)" value={label} onChange={(e) => setLabel(e.target.value)} />
          <button className="btn sm primary" onClick={addBreak}>
            הוסף
          </button>
        </div>
      </section>
    </>
  );
}

/* ---------------- שינויי שמ"פ היום ---------------- */
export function ShmapView(p: ViewProps) {
  const { m, ui, data, act } = p;
  const x = m.shmapChanges();
  const row = (c: ShmapChange, cls: string) => (
    <div key={c.s.id} className="lrow">
      <div className="who">
        <b>{c.s.name}</b>
        <span className="note2">
          {teamName(c.s.unit)}
          {c.s.pid ? " · " + c.s.pid : ""}
        </span>
      </div>
      <div className="lside num">
        <b style={{ color: v(cls) }}>{stName(c.to)}</b>
        <span>אתמול: {stName(c.from)}</span>
      </div>
    </div>
  );
  return (
    <>
      <Back act={act} />
      <div className="viewhead">
        <h2>שינויי שמ&quot;פ היום</h2>
        <DateBar date={ui.date} events={data.events} act={act} />
        <p className="note" style={{ margin: 0 }}>
          נסגר = עבר היום מסטטוס פתוח (בסיס / בית / יציאה / התארגנות) לצו סגור או חו&quot;ל, כלומר לא מקבל תשלום. נפתח = היה אתמול בצו סגור / חו&quot;ל או לא בשמ&quot;פ, והיום בסטטוס פתוח. מי שכבר היה סגור לא מופיע.
        </p>
      </div>
      <div className="sectionhead">
        <span className="eyebrow">נסגר שמ&quot;פ</span>
        <span className="note num">{x.closed.length}</span>
      </div>
      {x.closed.length ? <div className="roster">{x.closed.map((c) => row(c, "--err"))}</div> : <div className="empty">אף אחד לא נסגר היום.</div>}
      <div className="sectionhead">
        <span className="eyebrow">נפתח שמ&quot;פ</span>
        <span className="note num">{x.opened.length}</span>
      </div>
      {x.opened.length ? <div className="roster">{x.opened.map((c) => row(c, "--s-base"))}</div> : <div className="empty">אף אחד לא נפתח היום.</div>}
    </>
  );
}

/* ---------------- נתוני מ"פ ---------------- */
export function SummaryView(p: ViewProps) {
  const { m, ui, data, act } = p;
  const all = m.roster();
  const tc = m.counts(all);
  const drill = ui.drill;
  const stDef = (k: StatusKey | "none") => (k === "none" ? { n: "ללא סטטוס", c: "--s-none" } : STMAP[k]);
  const trow = (name: string, l: Soldier[]) => {
    const c = m.counts(l);
    return (
      <>
        <td>{name}</td>
        {ST.map((s) => (
          <td key={s.k} className={`num ${s.k === "base" ? "base" : ""}`}>
            {c[s.k] || "–"}
          </td>
        ))}
        <td className="num">{m.active(l).length}</td>
      </>
    );
  };
  return (
    <>
      <Back act={act} />
      <div className="viewhead">
        <h2>נתוני מ&quot;פ</h2>
        <DateBar date={ui.date} events={data.events} act={act} />
      </div>
      <div className="tiles">
        {m.tiles().map((k) => {
          const st = stDef(k);
          return (
            <button
              key={k}
              className={`tile ${drill === k ? "on" : ""}`}
              style={{ "--pc": v(st.c) } as React.CSSProperties}
              aria-pressed={drill === k}
              onClick={() => act.setUi({ drill: drill === k ? null : k })}
            >
              <b className="num">{tc[k]}</b>
              <span>{st.n}</span>
            </button>
          );
        })}
      </div>
      {drill ? (
        (() => {
          const g = m.listFor(drill);
          const st = stDef(drill);
          return (
            <section className="drill" style={{ "--pc": v(st.c) } as React.CSSProperties}>
              <div className="dh">
                <h3>
                  {st.n} · <span className="num">{tc[drill]}</span>
                </h3>
                <button className="btn sm primary" onClick={() => act.copy(m.listText(drill), "הרשימה הועתקה", "ההעתקה נחסמה. סמן את השמות והעתק ידנית")}>
                  העתק רשימה
                </button>
              </div>
              {g.length ? (
                g.map((x) => (
                  <div key={x.u.k} className="dg">
                    <div className="dgt">
                      {teamName(x.u.n)} <span className="num">{x.l.length}</span>
                    </div>
                    <div className="names">
                      {x.l.map((s) => (
                        <span key={s.id}>{s.name}</span>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="empty">אין חיילים בסטטוס הזה.</div>
              )}
            </section>
          );
        })()
      ) : (
        <p className="note" style={{ margin: "8px 2px 0" }}>
          לחץ על מספר כדי לראות את הרשימה השמית ולהעתיק אותה.
        </p>
      )}
      <div className="sectionhead">
        <span className="eyebrow">פילוח לפי צוות</span>
        <span className="note num">סה&quot;כ {m.active(all).length} חיילים</span>
      </div>
      <div className="tablewrap">
        <table>
          <thead>
            <tr>
              <th>צוות</th>
              {ST.map((s) => (
                <th key={s.k}>{s.n}</th>
              ))}
              <th>סה&quot;כ</th>
            </tr>
          </thead>
          <tbody>
            {m.units().map((u) => (
              <tr key={u.k}>{trow(teamName(u.n), m.inUnit(u.k))}</tr>
            ))}
            <tr className="total">{trow('סה"כ פלוגה', all)}</tr>
          </tbody>
        </table>
      </div>
      <div className="sectionhead">
        <span className="eyebrow">דוח להעברה</span>
        <button className="btn primary" onClick={() => act.copy(m.reportText(), "הדוח הועתק", "סמן והעתק ידנית", "report")}>
          העתק דוח
        </button>
      </div>
      <pre className="report num" id="report">
        {m.reportText()}
      </pre>
    </>
  );
}

/* ---------------- חיבור והתקנה ---------------- */
export function ConnectView(p: ViewProps) {
  const { data, act } = p;
  return (
    <>
      <Back act={act} />
      <div className="viewhead">
        <h2>חיבור והתקנה</h2>
      </div>
      <section className="card">
        <h3>גוגל שיט</h3>
        <div className="note">
          {data.sheetUrl ? (
            <>
              <a href={data.sheetUrl} target="_blank" rel="noopener noreferrer">
                {data.title || "פתח את הגיליון"}
              </a>
              <br />
            </>
          ) : null}
          {p.syncText} · {p.m.roster().length} חיילים
        </div>
        <p className="note" style={{ margin: 0 }}>
          כל שינוי באפליקציה (סטטוס, רכב, תפקיד, תקופות מאושרות) נכתב מיד בגיליון. שינוי שנעשה בגיליון מופיע באפליקציה תוך כחצי דקה.
        </p>
        <div className="row">
          <button className="btn sm primary" onClick={() => act.refresh()}>
            רענן עכשיו
          </button>
        </div>
      </section>
      <section className="card" style={{ marginTop: 12 }}>
        <h3>התקנה בטלפון</h3>
        <p className="note" style={{ margin: 0 }}>
          {p.standalone ? "האפליקציה כבר מותקנת במכשיר הזה ✓" : installSteps(p.isIOS)}
        </p>
        {!p.standalone ? (
          <p className="note" style={{ margin: 0 }}>
            {p.isIOS ? (
              <>
                באנדרואיד: בכרום לחץ על <b>⋮</b> למעלה, ואז <b>&quot;הוספה למסך הבית&quot;</b>.
              </>
            ) : (
              <>
                באייפון: בספארי לחץ על כפתור השיתוף <b>⎙</b>, ואז <b>&quot;הוסף למסך הבית&quot;</b>.
              </>
            )}
          </p>
        ) : null}
        <p className="note" style={{ margin: 0 }}>
          אחרי ההתקנה האפליקציה נפתחת מהאייקון במסך הבית, במסך מלא.
        </p>
      </section>
      <section className="card" style={{ marginTop: 12 }}>
        <h3>חשבון</h3>
        <p className="note" style={{ margin: 0 }} dir="auto">
          מחובר כ-{p.email}
        </p>
        <p className="note" style={{ margin: 0 }}>
          הגישה ניתנת לכל מי שהגיליון משותף איתו.
        </p>
        <div className="row">
          <button className="btn sm" onClick={() => act.signOut()}>
            התנתקות
          </button>
        </div>
      </section>
    </>
  );
}
