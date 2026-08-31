import type { User } from "@/lib/contracts";
import type { AuthClient } from "./AuthClient";

const SESSION_KEY = "mock-auth-user";

/**
 * Accepts any non-empty credentials and mints a fake user in the demo
 * workspace. Session survives reloads via sessionStorage (not localStorage —
 * closing the browser signs you out, which feels right for a mock).
 */
export class MockAuthClient implements AuthClient {
  constructor(private readonly delayMs = 350) {}

  async login(username: string, password: string): Promise<User> {
    await sleep(this.delayMs);
    const name = username.trim();
    if (!name || !password.trim()) {
      throw new Error("Enter a username and password to sign in.");
    }
    const user: User = {
      username: name,
      display_name: name,
      initials: name.slice(0, 2).toUpperCase(),
      role: "admin",
      workspace: { id: "docsis-team", name: "docsis-team" },
    };
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
    } catch {
      // storage unavailable — session lives for this page only
    }
    return user;
  }

  async logout(): Promise<void> {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // ignore
    }
  }

  async me(): Promise<User | null> {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
