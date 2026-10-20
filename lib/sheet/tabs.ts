import { norm } from "../core/util";

export interface TabNames {
  main: string;
  data: string | null;
  shabzak: string | null;
  attached: string | null;
  app: string | null;
}

/** Finds the tabs the app uses, matching names after normalising (like the artifact's pickTab). */
export function pickTabs(titles: string[]): TabNames | null {
  const pick = (re: RegExp) => titles.find((n) => re.test(norm(n))) ?? null;
  const main = pick(/^תקיפה ג$/) ?? titles[0];
  if (!main) return null;
  return {
    main,
    data: pick(/^DATA/),
    shabzak: pick(/^שבצק$/),
    attached: pick(/^מסופחים$/),
    app: titles.find((n) => n === "_app") ?? null,
  };
}
