"use client";
import { createContext, useContext, useRef } from "react";
import { useStore } from "zustand";
import { createShellStore, type ShellState } from "./shell-store";

type Store = ReturnType<typeof createShellStore>;
const ShellContext = createContext<Store | null>(null);

export function ShellProvider({ children }: { children: React.ReactNode }) {
  const storeRef = useRef<Store | null>(null);
  if (!storeRef.current) storeRef.current = createShellStore();
  return <ShellContext.Provider value={storeRef.current}>{children}</ShellContext.Provider>;
}
export function useShell<T>(selector: (state: ShellState) => T) {
  const store = useContext(ShellContext);
  if (!store) throw new Error("useShell must be used inside ShellProvider");
  return useStore(store, selector);
}

