import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  BackendSession,
  BackendUser,
  refreshSession,
  logout,
  setAccessToken,
  getAccessToken,
} from '@/lib/backendAuth';
import { backendApi } from '@/lib/backendApi';

interface AuthContextType {
  user: BackendUser | null;
  session: BackendSession | null;
  loading: boolean;
  setAuthSession: (user: BackendUser, session: BackendSession) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<BackendUser | null>(null);
  const [session, setSession] = useState<BackendSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const restoreSession = async () => {
      try {
        const refreshRes = await refreshSession();
        if (refreshRes.access_token) {
          setAccessToken(refreshRes.access_token);
          const newSession: BackendSession = {
            access_token: refreshRes.access_token,
            expires_in: refreshRes.expires_in,
            token_type: refreshRes.token_type,
          };

          // Fetch roles for authenticated user
          let roles: string[] = [];
          try {
            const roleRes = await backendApi.getUserRoles();
            roles = roleRes.roles || [];
          } catch {
            // ignore role fetch error
          }

          if (mounted) {
            setSession(newSession);
            setUser({
              id: 'restored-session', // User ID resolved on backend via req.user.id
              roles,
              user_metadata: { roles },
            });
          }
        }
      } catch {
        if (mounted) {
          setSession(null);
          setUser(null);
          setAccessToken(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void restoreSession();

    return () => {
      mounted = false;
    };
  }, []);

  const setAuthSession = (newUser: BackendUser, newSession: BackendSession) => {
    setUser(newUser);
    setSession(newSession);
    if (newSession.access_token) {
      setAccessToken(newSession.access_token);
    }
  };

  const signOut = async () => {
    await logout();
    setSession(null);
    setUser(null);
    setAccessToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, setAuthSession, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
