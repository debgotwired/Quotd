"use client";

import { useEffect } from "react";

export function TrackOpened({ token }: { token: string }) {
  useEffect(() => {
    fetch(`/api/interview/${token}/opened`, { method: "POST" }).catch(() => {});
  }, [token]);

  return null;
}
