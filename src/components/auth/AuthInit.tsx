"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/store/auth";

/**
 * Kicks off session hydration once, at the root — everywhere else just
 * reads useAuth() and gets a live session without knowing this exists.
 * Renders nothing; it's a side effect, not UI.
 */
export function AuthInit() {
  useEffect(() => {
    if (!useAuth.getState().initialized) useAuth.getState().init();
  }, []);
  return null;
}
