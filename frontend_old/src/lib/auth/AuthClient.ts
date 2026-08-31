import type { User } from "@/lib/contracts";

/**
 * Auth seam. This is a UI seam, not security — the mock accepts anything and
 * the future HttpAuthClient rides a server cookie session. Components never
 * see the mechanism, only `login/logout/me`.
 */
export interface AuthClient {
  /** Resolve to the signed-in user, or reject with a message. */
  login(username: string, password: string): Promise<User>;
  logout(): Promise<void>;
  /** Current session's user, or null when signed out. */
  me(): Promise<User | null>;
}
