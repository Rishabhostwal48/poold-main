import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

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

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const databaseRoles = (data || [])
        .map(({ role }) => role)
        .filter((role): role is UserRole =>
          role === "admin" || role === "interviewer" || role === "interviewee"
        );
      const metadataRoles = (user.user_metadata?.roles || []) as UserRole[];

      if (!cancelled) {
        setRoles(error ? metadataRoles : databaseRoles);
        setLoading(false);
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
