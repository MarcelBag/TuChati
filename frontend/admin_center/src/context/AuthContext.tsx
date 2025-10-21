import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import { apiClient } from "../api/client";

const STORAGE_KEY = "tuchati_admin_token";

export type AuthContextValue = {
  token: string | null;
  loading: boolean;
  permissions: string[];
  setToken: (token: string | null) => void;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_KEY),
  );
  const [loading, setLoading] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);

  const setToken = useCallback((value: string | null) => {
    setTokenState(value);
    if (value) {
      localStorage.setItem(STORAGE_KEY, value);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!token) {
      setPermissions([]);
      return;
    }
    setLoading(true);
    try {
      const response = await apiClient("/api/admin/roles/me/", {
        token,
      });
      if (!response.ok) {
        if (response.status === 401) {
          setToken(null);
          setPermissions([]);
        }
        return;
      }
      const data = await response.json();
      setPermissions(data.permissions || []);
    } finally {
      setLoading(false);
    }
  }, [setToken, token]);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  const value = useMemo(
    () => ({ token, loading, permissions, setToken, refreshProfile }),
    [token, loading, permissions, setToken, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

export function useHasPermission(code: string) {
  const { permissions } = useAuth();
  return permissions.includes(code);
}
