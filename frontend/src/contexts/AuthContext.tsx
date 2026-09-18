import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { BackendSession, BackendUser } from '@/lib/backendAuth';

interface AuthContextType {
  user: BackendUser | null;
  session: BackendSession | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<BackendUser | null>(null);
  const [session, setSession] = useState<BackendSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedSession = localStorage.getItem('backend_session');
    const parsedSession = storedSession ? JSON.parse(storedSession) as BackendSession : null;
    setSession(parsedSession);
    setUser(parsedSession?.user ?? null);
    setLoading(false);
  }, []);

  const signOut = async () => {
    localStorage.removeItem('backend_session');
    setSession(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
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
