import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { TestTube2 } from "lucide-react";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { useAuth } from "@/lib/auth";

/**
 * Sign-in: a centered card on the dot-grid canvas. Auth is a UI seam — the
 * mock accepts any non-empty credentials. Visual room is left under the button
 * for SSO providers later.
 */
export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(undefined);
    setBusy(true);
    try {
      await login(username, password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from !== "/login" ? from : "/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-canvas bg-dotgrid px-4">
      <div className="w-full max-w-sm rounded-[10px] border border-border bg-surface p-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent">
            <TestTube2 className="h-4 w-4 text-accent-fg" />
          </div>
          <span className="text-[15px] font-medium text-foreground">INTA</span>
        </div>
        <p className="mt-1.5 text-xs text-muted">
          AI test automation for the lab. Sign in to your workspace.
        </p>

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-5 flex flex-col gap-4">
          <TextField
            label="Username"
            value={username}
            onChange={setUsername}
            autoComplete="username"
            placeholder="ahazra"
          />
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            placeholder="••••••••"
          />
          {error && <p className="text-xs text-danger">{error}</p>}
          <Button type="submit" variant="primary" disabled={busy} className="w-full">
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        {/* room reserved for SSO providers */}
        <div className="mt-5 border-t border-border pt-3 text-center text-[11px] text-faint">
          Single sign-on arrives later.
        </div>
      </div>
    </div>
  );
}
