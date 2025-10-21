import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useLocation, Location } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import styles from "./LoginPage.module.css";

export default function LoginPage() {
  const { token, login, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: Location } };
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fromPath = (location.state?.from as Location | undefined)?.pathname;

  useEffect(() => {
    if (token) {
      navigate(fromPath || "/dashboard", { replace: true });
    }
  }, [fromPath, navigate, token]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(identifier, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to login");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.shell}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1>TuChati Admin Center</h1>
          <p>Sign in with your staff credentials to continue.</p>
        </div>
        <form className={styles.form} onSubmit={handleSubmit}>
          <label>
            Username or Email
            <input
              type="text"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="admin@example.com"
              required
              autoFocus
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              required
            />
          </label>
          {error && <p className={styles.error}>{error}</p>}
          <button type="submit" disabled={submitting || loading}>
            {submitting || loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className={styles.footer}>Contact an administrator if you need access.</p>
      </div>
    </div>
  );
}
