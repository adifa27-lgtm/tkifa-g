import Link from "next/link";
import App from "@/components/App";
import { ClearLocalData } from "@/components/ClearLocalData";
import { isAllowed } from "@/lib/server/access";
import { getSource, isMock } from "@/lib/server/env";
import { currentUser } from "@/lib/server/guard";
import { signInAction, signOutAction } from "./actions";

export const dynamic = "force-dynamic";

function Gate({ children }: { children: React.ReactNode }) {
  return (
    <div className="wrap" dir="rtl" lang="he">
      <div className="gate">
        <header className="top">
          <span className="eyebrow">תמונת מצב יומית</span>
          <h1>כוח אדם תקיפה ג&apos; גדס&quot;ר</h1>
        </header>
        {children}
      </div>
    </div>
  );
}

function SignOutButton() {
  return (
    <form action={signOutAction}>
      <button className="btn" type="submit">
        התנתקות
      </button>
    </form>
  );
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const user = await currentUser().catch(() => null);
  if (!user) {
    return (
      <Gate>
        <ClearLocalData />
        <section className="card">
          <h3>כניסה</h3>
          <p className="note" style={{ margin: 0 }}>
            נכנסים עם חשבון הגוגל שאיתו שותף הגיליון של הפלוגה.
          </p>
          {sp.error ? (
            <div className="banner err" role="alert">
              הכניסה לא הושלמה. נסו שוב.
            </div>
          ) : null}
          <form action={signInAction}>
            <button className="btn primary" type="submit">
              כניסה עם Google
            </button>
          </form>
        </section>
      </Gate>
    );
  }

  let allowed: boolean | null;
  try {
    allowed = await isAllowed(getSource(), user.email);
  } catch {
    allowed = null;
  }
  if (allowed === null) {
    return (
      <Gate>
        <div className="banner err" role="alert">
          <b>אין חיבור לגיליון כרגע</b>
          <br />
          נסו שוב בעוד רגע.
          <br />
          <Link className="btn sm" href="/" prefetch={false} style={{ display: "inline-block", marginTop: 8, textDecoration: "none" }}>
            נסה שוב
          </Link>
        </div>
        <SignOutButton />
      </Gate>
    );
  }
  if (!allowed) {
    return (
      <Gate>
        <ClearLocalData />
        <section className="card">
          <h3>אין לך גישה. בקש מעדי לשתף איתך את הגיליון</h3>
          <p className="note" style={{ margin: 0 }} dir="auto">
            {user.email}
          </p>
          <SignOutButton />
        </section>
      </Gate>
    );
  }
  return <App email={user.email} mock={isMock()} signOut={signOutAction} />;
}
