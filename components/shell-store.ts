"use client";
import { createStore } from "zustand/vanilla";

export type ShellState = {
  sidebar: "expanded" | "compact";
  mobileNavOpen: boolean;
  commandOpen: boolean;
  notificationOpen: boolean;
  toggleSidebar: () => void;
  setMobileNavOpen: (value: boolean) => void;
  setCommandOpen: (value: boolean) => void;
  setNotificationOpen: (value: boolean) => void;
};

export const createShellStore = () => createStore<ShellState>((set) => ({
  sidebar: "expanded", mobileNavOpen: false, commandOpen: false, notificationOpen: false,
  toggleSidebar: () => set((state) => ({ sidebar: state.sidebar === "expanded" ? "compact" : "expanded" })),
  setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
  setCommandOpen: (commandOpen) => set({ commandOpen }),
  setNotificationOpen: (notificationOpen) => set({ notificationOpen }),
}));

