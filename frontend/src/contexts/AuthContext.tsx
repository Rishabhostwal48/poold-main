import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { BackendSession, BackendUser } from '@/lib/backendAuth';
import { supabase } from '@/integrations/supabase/client';

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
    let mounted = true;

    const restoreSession = async () => {
      let { data: { session: authSession } } = await supabase.auth.getSession();

      // Migrate sessions created by the old custom storage path once.
      if (!authSession) {
        const storedSession = localStorage.getItem('backend_session');
        if (storedSession) {
          try {
            const parsedSession = JSON.parse(storedSession) as BackendSession;
            if (parsedSession.access_token && parsedSession.refresh_token) {
              const result = await supabase.auth.setSession({
                access_token: parsedSession.access_token,
                refresh_token: parsedSession.refresh_token,
              });
              authSession = result.data.session;
            }
          } catch {
            await supabase.auth.signOut();
          } finally {
            localStorage.removeItem('backend_session');
          }
        }
      }

      if (mounted) {
        setSession(authSession as BackendSession | null);
        setUser(authSession?.user as BackendUser | null);
        setLoading(false);
      }
    };

    void restoreSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession as BackendSession | null);
      setUser(nextSession?.user as BackendUser | null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
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
