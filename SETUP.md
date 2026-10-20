# הקמה — מפגש אחד מודרך (כ-15–20 דקות)

את כל השאר Claude כבר עשה. כאן רק הצעדים שדורשים כניסה לחשבונות ולחיצות בדפדפן.
**אף פעם לא מדביקים סיסמה או מפתח בצ'אט.** כל ערך סודי נשמר בקובץ מקומי (`.env.local` / תיקיית `secrets/`) שלא עולה ל-GitHub.

ערכים קבועים:
- חשבון: החשבון של עדי (בעל הגיליון)
- הגיליון: https://docs.google.com/spreadsheets/d/1KBVkNPjLsH9AolAN3ed9S6eWhaqih2hapsIK8PFcq7o/edit
- מאגר הקוד: https://github.com/adifa27-lgtm/tkifa-g
- כתובת האפליקציה: `https://tkifa-g.vercel.app` (אם השם תפוס, Claude יעדכן כאן את הכתובת המדויקת)

---

## 1. שלוש התחברויות (Claude מריץ, אתם רק מאשרים בדפדפן)
1. **GitHub** — Claude מריץ `gh auth login`. נפתח דפדפן: מדביקים את הקוד בן 8 התווים שמוצג בטרמינל ← Continue ← Authorize.
2. **Vercel** — Claude מריץ `vercel login`. נפתח דפדפן ← Continue with GitHub (או עם המייל) ← מאשרים.
3. **Google Cloud** — Claude מריץ `gcloud auth login`. נפתח דפדפן ← בוחרים החשבון של עדי (בעל הגיליון) ← Allow.
   אם זו הפעם הראשונה ב-Google Cloud: נכנסים פעם אחת ל-https://console.cloud.google.com ומאשרים את תנאי השימוש (צ'קבוקס + Agree).

## 2. Claude מקים את הפרויקט בגוגל ואת Vercel
Claude מריץ `scripts/setup-google.sh` (פרויקט, הפעלת Sheets + Drive, חשבון שירות ומפתח שנשמר מקומית) ומקשר את Vercel — כך הכתובת הסופית ידועה. לא צריך לעשות כלום בשלב הזה.

## 3. מסך ההסכמה וה-OAuth Client (ב-Google Cloud Console)
Claude ייתן קישורים ישירים עם מזהה הפרויקט.

**א. מסך ההסכמה** — בקישור `…/auth/overview?project=<הפרויקט>`:
1. **Get started**.
2. App name: `תקיפה ג׳` · User support email: החשבון של עדי (בעל הגיליון) ← Next.
3. Audience: **External** ← Next.
4. Contact information: החשבון של עדי (בעל הגיליון) ← Next ← מסמנים הסכמה ← **Create**.
5. בתפריט הצד **Audience** ← **Publish app** ← Confirm. (משתמשים רק בהרשאות בסיסיות — שם, מייל — ולכן אין צורך באימות של גוגל.)

**ב. ה-Client** — בקישור `…/auth/clients?project=<הפרויקט>`:
1. **Create client** ← Application type: **Web application** ← Name: `tkifa-g`.
2. תחת **Authorized redirect URIs** ← Add URI, פעמיים:
   - `https://tkifa-g.vercel.app/api/auth/callback/google` (או הכתובת ש-Claude ייתן)
   - `http://localhost:3000/api/auth/callback/google`
3. **Create**. בחלון שנפתח לוחצים **Download JSON** (הקובץ נשמר בתיקיית ההורדות). לא מעתיקים כלום לצ'אט.
4. אומרים ל-Claude "הורדתי". Claude קורא את הקובץ מקומית, שומר את הערכים ב-`.env.local` ומוחק אותו מההורדות.

## 4. שיתוף הגיליון עם חשבון השירות
1. פותחים את הגיליון ← **Share / שיתוף**.
2. מדביקים את כתובת חשבון השירות ש-Claude מציג (נראית כמו `tkifa-g-sheets@tkifa-g-xxxxxx.iam.gserviceaccount.com`).
3. הרשאה: **Editor / עורך** ← מבטלים את הסימון "Notify people" ← **Share**.

## 5. Claude טוען את ההגדרות ל-Vercel
`AUTH_SECRET` (נוצר אוטומטית), `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `GOOGLE_SA_EMAIL`, `GOOGLE_SA_PRIVATE_KEY`, `SHEET_ID`, `EXTRA_ALLOWED_EMAILS` (ריק) — נטענים מ-`.env.local` ל-Vercel דרך `scripts/setup-vercel.sh`. אין מה לעשות.

---

### מי יכול להיכנס?
כל חשבון גוגל שהגיליון משותף איתו (בכל הרשאה). להוסיף מפקד = לשתף איתו את הגיליון. להוריד = להסיר אותו מהשיתוף (תוך 5 דקות לכל היותר).
