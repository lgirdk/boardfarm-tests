import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FlaskConical } from "lucide-react";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { useAuth } from "@/lib/auth";

/**
 * V3 sign-in page: centered card on the ambient-glow background.
 * Mock accepts any non-empty credentials.
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
    <div className="flex h-screen items-center justify-center bg-dotgrid px-4">
      <div className="v3-card w-full max-w-sm p-6">
        <div className="flex items-center gap-[9px]">
          <div className="grid h-[30px] w-[30px] place-items-center rounded-[10px] bg-brand-gradient">
            <FlaskConical className="h-[16px] w-[16px] text-accent-fg" />
          </div>
          <span className="text-brand font-display text-[18px] font-semibold tracking-tight">
            Boardfarm
          </span>
        </div>
        <p className="mt-2 text-[12.5px] text-muted">
          One place to browse, generate, run, and analyze boardfarm tests. Sign
          in to your workspace.
        </p>

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="mt-5 flex flex-col gap-4"
        >
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
          {error && <p className="text-[12px] text-danger">{error}</p>}
          <Button
            type="submit"
            variant="primary"
            disabled={busy}
            className="w-full justify-center"
          >
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <div className="mt-5 border-t border-border pt-3 text-center text-[11px] text-faint">
          Single sign-on arrives later.
        </div>
      </div>
    </div>
  );
}
