import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { backendApi } from "@/lib/backendApi";

export type UserRole = "admin" | "interviewer" | "interviewee";

export const useUserRole = () => {
  const { user, loading: authLoading } = useAuth();
  const [roles, setRoles] = useState<UserRole[]>([]);
  // Keep loading=true until we know auth is settled AND roles are fetched.
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Do not resolve roles while auth is still initialising.
    // This prevents the RoleProtectedRoute from seeing (user!=null, roles=[])
    // for one render cycle between authLoading→false and the roles fetch.
    if (authLoading) return;

    let cancelled = false;

    const loadRoles = async () => {
      setLoading(true);

      if (!user) {
        if (!cancelled) {
          setRoles([]);
          setLoading(false);
        }
        return;
      }

      try {
        const res = await backendApi.getUserRoles();
        const databaseRoles = (res.roles || [])
          .filter((role): role is UserRole =>
            role === "admin" || role === "interviewer" || role === "interviewee"
          );
        if (!cancelled) {
          setRoles(databaseRoles);
          setLoading(false);
        }
      } catch (err) {
        console.error("Error fetching user roles from backend API:", err);
        // Fallback: use roles already stored in user metadata (set by AuthContext)
        const metadataRoles = (user.user_metadata?.roles || []) as UserRole[];
        if (!cancelled) {
          setRoles(metadataRoles);
          setLoading(false);
        }
      }
    };

    void loadRoles();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading]); // Re-run when auth settles or user changes

  const hasRole = useCallback((role: UserRole) => roles.includes(role), [roles]);

  return { roles, loading, hasRole };
};
