import type { AuthClient } from "./AuthClient";
import { MockAuthClient } from "./MockAuthClient";
import { HttpAuthClient } from "./HttpAuthClient";

export type { AuthClient } from "./AuthClient";
export { MockAuthClient } from "./MockAuthClient";
export { HttpAuthClient } from "./HttpAuthClient";
export { AuthProvider, RequireAuth, useAuth } from "./AuthContext";

const useBackend = import.meta.env.VITE_USE_BACKEND === "1";

/** The active auth client — same switch as every other seam. */
export const authClient: AuthClient = useBackend
  ? new HttpAuthClient()
  : new MockAuthClient();
