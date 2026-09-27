"use client";

import * as React from "react"

const MOBILE_BREAKPOINT = 768

// Subscribe to the matchMedia store without triggering a cascading render:
// useSyncExternalStore reports the current media-query state during
// hydration/subscribe and keeps React's snapshot consistent.
function subscribe(callback: () => void) {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  mql.addEventListener("change", callback)
  return () => mql.removeEventListener("change", callback)
}

export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.innerWidth < MOBILE_BREAKPOINT,
    () => false,
  )
}
