import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { DollarSign, Activity, Users, TrendingUp } from "lucide-react";
import { UserMenu } from "@/components/UserMenu";

export default function AdminDashboard() {
  const [statistics, setStatistics] = useState<any[]>([]);
  const [totalStats, setTotalStats] = useState({
    totalCost: 0,
    totalApiCalls: 0,
    totalUsers: 0,
    avgProcessingTime: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      // Fetch statistics
      const { data: statsData, error: statsError } = await supabase
        .from("admin_statistics")
        .select("*")
        .order("date", { ascending: false })
        .limit(30);

      if (statsError) throw statsError;

      // Calculate totals
      const totalCost = statsData?.reduce((sum, stat) => sum + Number(stat.estimated_cost_usd), 0) || 0;
      const totalApiCalls = statsData?.reduce((sum, stat) => sum + stat.ai_api_calls, 0) || 0;
      const avgProcessingTime = statsData?.length 
        ? statsData.reduce((sum, stat) => sum + stat.processing_time_seconds, 0) / statsData.length 
        : 0;

      // Get total users count
      const { count: usersCount } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      setStatistics(statsData || []);
      setTotalStats({
        totalCost,
        totalApiCalls,
        totalUsers: usersCount || 0,
        avgProcessingTime,
      });
    } catch (error: any) {
      toast.error("Error loading admin data: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold">Admin Dashboard</h1>
        <UserMenu />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalStats.totalCost.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Estimated AI costs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API Calls</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStats.totalApiCalls.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Total AI API calls</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">Registered users</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Processing Time</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStats.avgProcessingTime.toFixed(1)}s</div>
            <p className="text-xs text-muted-foreground">Average time per task</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daily Statistics</CardTitle>
          <CardDescription>Processing costs and usage over time</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Interviews</TableHead>
                <TableHead>CV Analyses</TableHead>
                <TableHead>Gap Analyses</TableHead>
                <TableHead>API Calls</TableHead>
                <TableHead>Cost (USD)</TableHead>
                <TableHead>Processing Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statistics.map((stat) => (
                <TableRow key={stat.id}>
                  <TableCell>{new Date(stat.date).toLocaleDateString()}</TableCell>
                  <TableCell>{stat.total_interviews}</TableCell>
                  <TableCell>{stat.total_cv_analyses}</TableCell>
                  <TableCell>{stat.total_gap_analyses}</TableCell>
                  <TableCell>{stat.ai_api_calls}</TableCell>
                  <TableCell>${Number(stat.estimated_cost_usd).toFixed(2)}</TableCell>
                  <TableCell>{stat.processing_time_seconds}s</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
