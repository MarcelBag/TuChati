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
  refreshProfile: (overrideToken?: string | null) => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isStaff: boolean;
  isSuperuser: boolean;
  user: { id: string; username: string; email: string; name: string } | null;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_KEY),
  );
  const [loading, setLoading] = useState(false);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isStaff, setIsStaff] = useState(false);
  const [isSuperuser, setIsSuperuser] = useState(false);
  const [user, setUser] = useState<{ id: string; username: string; email: string; name: string } | null>(
    null,
  );

  const setToken = useCallback((value: string | null) => {
    setTokenState(value);
    if (value) {
      localStorage.setItem(STORAGE_KEY, value);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const refreshProfile = useCallback(
    async (overrideToken?: string | null) => {
      const activeToken = overrideToken ?? token;
      if (!activeToken) {
        setPermissions([]);
        setIsStaff(false);
        setIsSuperuser(false);
        setUser(null);
        return;
      }
      setLoading(true);
      try {
        const response = await apiClient("/api/admin/roles/me/", {
          token: activeToken,
        });
        if (!response.ok) {
          if (response.status === 401) {
            setToken(null);
            setPermissions([]);
            setIsStaff(false);
            setIsSuperuser(false);
            setUser(null);
          }
          return;
        }
        const data = await response.json();
        setPermissions(data.permissions || []);
        setIsStaff(Boolean(data.is_staff));
        setIsSuperuser(Boolean(data.is_superuser));
        setUser(data.user || null);
      } finally {
        setLoading(false);
      }
    },
    [setToken, token],
  );

  const login = useCallback(
    async (username: string, password: string) => {
      setLoading(true);
      try {
        const response = await apiClient("/api/accounts/token/", {
          method: "POST",
          skipAuth: true,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.detail || "Invalid credentials");
        }
        const data = await response.json();
        const access =
          data.access || data.token || data.access_token || data?.accessToken;
        if (!access) {
          throw new Error("Malformed authentication response.");
        }
        setToken(access);
      await refreshProfile(access);
      } finally {
        setLoading(false);
      }
    },
    [refreshProfile, setToken],
  );

  const logout = useCallback(() => {
    setToken(null);
    setPermissions([]);
    setIsStaff(false);
    setIsSuperuser(false);
    setUser(null);
  }, [setToken]);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  const value = useMemo(
    () => ({
      token,
      loading,
      permissions,
      setToken,
      refreshProfile,
      login,
      logout,
      isStaff,
      isSuperuser,
      user,
    }),
    [
      token,
      loading,
      permissions,
      setToken,
      refreshProfile,
      login,
      logout,
      isStaff,
      isSuperuser,
      user,
    ],
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
  const { permissions, isStaff, isSuperuser } = useAuth();
  if (isSuperuser || isStaff) return true;
  return permissions.includes(code);
}
