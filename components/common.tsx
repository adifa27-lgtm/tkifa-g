"use client";

import { fmtDate, todayKey } from "@/lib/core/util";
import type { Actions } from "./types";

export function DateBar({ date, events, act }: { date: string; events: Record<string, string>; act: Actions }) {
  const f = fmtDate(date);
  const isToday = date === todayKey();
  const ev = events?.[date];
  return (
    <div className="datebar">
      <button className="iconbtn" aria-label="יום קודם" onClick={() => act.shiftDay(-1)}>
        ›
      </button>
      <div className="d num">
        {f.day} · {f.short}
        {ev ? <small className="ev">{ev}</small> : null}
        <small>
          {isToday ? (
            "היום"
          ) : (
            <button className="todaybtn" onClick={() => act.today()}>
              חזרה להיום
            </button>
          )}
        </small>
      </div>
      <button className="iconbtn" aria-label="יום הבא" onClick={() => act.shiftDay(1)}>
        ‹
      </button>
    </div>
  );
}

export function Back({ act }: { act: Actions }) {
  return (
    <button className="back" onClick={() => act.go("home", { unit: null })}>
      › חזרה
    </button>
  );
}

export const Spin = () => <span className="spin" />;

/** Inline colour token, e.g. dot({"--s-base"}) → style={{background:"var(--s-base)"}} */
export const v = (token: string) => `var(${token})`;
