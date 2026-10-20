"use server";

import { signIn, signOut } from "@/auth";
import { isMock } from "@/lib/server/env";

export async function signInAction() {
  await signIn("google", { redirectTo: "/" });
}

export async function signOutAction() {
  if (isMock()) return;
  await signOut({ redirectTo: "/" });
}
