import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type UserRole = "admin" | "interviewer" | "interviewee";

export const useUserRole = () => {
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserRoles();
  }, []);

  const fetchUserRoles = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setRoles([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (error) throw error;

      setRoles(data?.map(r => r.role as UserRole) || []);
    } catch (error) {
      console.error("Error fetching user roles:", error);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  };

  const hasRole = (role: UserRole) => roles.includes(role);

  return { roles, loading, hasRole };
};
