import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { backendApi } from "@/lib/backendApi";

export type UserRole = "admin" | "interviewer" | "interviewee";

export const useUserRole = () => {
  const { user } = useAuth();
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
  }, [user]);

  const hasRole = useCallback((role: UserRole) => roles.includes(role), [roles]);

  return { roles, loading, hasRole };
};
