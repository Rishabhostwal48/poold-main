import { ArrowLeft, BriefcaseBusiness, CalendarClock, Mail } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function HiringAccess() {
  const navigate = useNavigate();
  const location = useLocation();
  const isDemo = location.pathname === "/book-demo";

  return (
    <main className="dashboard-page flex items-center justify-center">
      <div className="dashboard-content w-full max-w-3xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <div className="dashboard-kicker">Poold // Hiring access</div>
            <h1 className="dashboard-title">{isDemo ? "Request a talent briefing" : "Connect with the hiring team"}</h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" onClick={() => navigate("/")} className="shrink-0">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Home
            </Button>
          </div>
        </div>

        <Card className="dashboard-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              {isDemo ? <CalendarClock className="h-5 w-5 text-primary" /> : <BriefcaseBusiness className="h-5 w-5 text-primary" />}
              {isDemo ? "See the skills signal in action" : "Build a stronger hiring workflow"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="max-w-2xl text-muted-foreground">
              {isDemo
                ? "Create a hiring account to explore structured skills interviews, candidate evidence, and role-specific scoring."
                : "Create a hiring account to manage roles, review interviews, and compare candidates on demonstrated ability."}
            </p>
            <div className="hud-line" />
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button onClick={() => navigate("/auth?role=interviewer")}>
                <BriefcaseBusiness className="mr-2 h-4 w-4" />
                Continue as hiring team
              </Button>
              <Button variant="outline" onClick={() => { window.location.href = "mailto:hello@poold.co"; }}>
                <Mail className="mr-2 h-4 w-4" />
                Email Poold
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
