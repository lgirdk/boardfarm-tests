import type { User } from "@/lib/contracts";
import type { AuthClient } from "./AuthClient";

/**
 * Cookie-session auth against the backend (see BACKEND_API_CONTRACT.md §3.5).
 * Untested stub until the endpoints exist; compiles and shares the interface.
 */
export class HttpAuthClient implements AuthClient {
  constructor(private readonly basePath = "/api/auth") {}

  async login(username: string, password: string): Promise<User> {
    const res = await fetch(`${this.basePath}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) throw new Error(await detail(res, "Sign-in failed"));
    return (await res.json()) as User;
  }

  async logout(): Promise<void> {
    await fetch(`${this.basePath}/logout`, { method: "POST" });
  }

  async me(): Promise<User | null> {
    const res = await fetch(`${this.basePath}/me`);
    if (res.status === 401) return null;
    if (!res.ok) throw new Error(await detail(res, "Session check failed"));
    return (await res.json()) as User;
  }
}

async function detail(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: unknown };
    if (body?.detail) return String(body.detail);
  } catch {
    // non-JSON body
  }
  return `${fallback} (HTTP ${res.status})`;
}
