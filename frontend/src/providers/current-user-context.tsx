"use client";

import { createContext, useContext } from "react";
import type { Role, User } from "@/types";

const CurrentUserContext = createContext<User | null>(null);

export function CurrentUserProvider({ user, children }: { user: User; children: React.ReactNode }) {
  return <CurrentUserContext.Provider value={user}>{children}</CurrentUserContext.Provider>;
}

export function useCurrentUser(): User | null {
  return useContext(CurrentUserContext);
}

export function useCurrentRole(): Role | null {
  return useCurrentUser()?.role ?? null;
}
