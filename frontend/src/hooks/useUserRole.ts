import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

export type UserRole = "admin" | "interviewer" | "interviewee";

export const useUserRole = () => {
  const { user } = useAuth();
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setRoles((user?.user_metadata?.roles || []) as UserRole[]);
    setLoading(false);
  }, [user]);

  const hasRole = (role: UserRole) => roles.includes(role);

  return { roles, loading, hasRole };
};
