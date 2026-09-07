import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ApiError, authApi } from "../api/client";
import type { AuthStatus, DazzjunUser } from "../models/user";

type AuthContextValue = {
  authStatus: AuthStatus;
  authLoading: boolean;
  user: DazzjunUser | null;
  error: string;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (input: { displayName: string; bio: string; avatarUrl?: string | null }) => Promise<void>;
  changePassword: (currentPassword: string, nextPassword: string) => Promise<void>;
  retrySession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<{ authStatus: AuthStatus; user: DazzjunUser | null; error: string }>({
    authStatus: "loading",
    user: null,
    error: "",
  });
  const sessionAttempt = useRef(0);

  useEffect(() => {
    console.info(`[AUTH]\nstatus: ${authState.authStatus}\nuser: ${authState.user?.id ?? "null"}\ntime: ${new Date().toISOString()}`);
  }, [authState.authStatus, authState.user]);

  const retrySession = useCallback(async () => {
    const attempt = ++sessionAttempt.current;
    setAuthState((current) => ({ ...current, authStatus: "loading", error: "" }));
    try {
      const session = await authApi.session();
      if (attempt !== sessionAttempt.current) return;
      setAuthState({ authStatus: "authenticated", user: session.user, error: "" });
    } catch (cause) {
      if (attempt !== sessionAttempt.current) return;
      setAuthState({
        authStatus: "unauthenticated",
        user: null,
        error: cause instanceof ApiError && cause.status !== 401 ? cause.message : "",
      });
    }
  }, []);

  useEffect(() => { void retrySession(); }, [retrySession]);
  useEffect(() => {
    const expired = () => {
      sessionAttempt.current += 1;
      setAuthState({ authStatus: "unauthenticated", user: null, error: "登录状态已过期，请重新登录" });
    };
    window.addEventListener("dazzjun:session-expired", expired);
    return () => window.removeEventListener("dazzjun:session-expired", expired);
  }, []);

  const login = async (email: string, password: string) => {
    sessionAttempt.current += 1;
    setAuthState((current) => ({ ...current, error: "" }));
    try {
      const result = await authApi.login({ email, password });
      setAuthState({ authStatus: "authenticated", user: result.user, error: "" });
    } catch (cause) {
      setAuthState({ authStatus: "unauthenticated", user: null, error: "" });
      throw cause;
    }
  };
  const register = async (email: string, password: string, displayName: string) => {
    sessionAttempt.current += 1;
    setAuthState((current) => ({ ...current, error: "" }));
    try {
      const result = await authApi.register({ email, password, displayName });
      setAuthState({ authStatus: "authenticated", user: result.user, error: "" });
    } catch (cause) {
      setAuthState({ authStatus: "unauthenticated", user: null, error: "" });
      throw cause;
    }
  };
  const logout = async () => {
    sessionAttempt.current += 1;
    try { await authApi.logout(); }
    finally { setAuthState({ authStatus: "unauthenticated", user: null, error: "" }); }
  };
  const updateProfile = async (input: { displayName: string; bio: string; avatarUrl?: string | null }) => {
    const result = await authApi.updateProfile(input);
    setAuthState((current) => ({ ...current, user: result.user }));
  };
  const changePassword = async (currentPassword: string, nextPassword: string) => { await authApi.changePassword({ currentPassword, nextPassword }); };

  const value = useMemo(() => ({
    authStatus: authState.authStatus,
    authLoading: authState.authStatus === "loading",
    user: authState.user,
    error: authState.error,
    login,
    register,
    logout,
    updateProfile,
    changePassword,
    retrySession,
  }), [authState, retrySession]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
