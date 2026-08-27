"use client";

import { useEffect } from "react";

import { ensureSession } from "../session/bootstrap";

export function SessionBootstrap() {
  useEffect(() => {
    void ensureSession();
  }, []);
  return null;
}
