"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useAutoAnimate as useLibraryAutoAnimate } from "@formkit/auto-animate/react";
import { MOTION_CHANGE_EVENT, shouldReduceMotion } from "@/lib/motion";

function subscribe(callback: () => void) {
  window.addEventListener(MOTION_CHANGE_EVENT, callback);
  return () => window.removeEventListener(MOTION_CHANGE_EVENT, callback);
}

export function useAutoAnimate<T extends Element>(options?: Parameters<typeof useLibraryAutoAnimate<T>>[0]) {
  const reduced = useSyncExternalStore(subscribe, shouldReduceMotion, () => true);
  const [ref, enable] = useLibraryAutoAnimate<T>(options);
  useEffect(() => { enable(!reduced); }, [enable, reduced]);
  return [ref, enable] as const;
}
