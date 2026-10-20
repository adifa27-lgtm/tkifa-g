"use client";

import { useEffect } from "react";
import { clearLocalData } from "@/lib/client/storage";

/** Signed-out / unauthorised screens: drop any roster cached on this device. */
export function ClearLocalData() {
  useEffect(() => {
    clearLocalData();
  }, []);
  return null;
}
