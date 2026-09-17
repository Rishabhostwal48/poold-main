/**
 * Landing page - Introduction to Vocal Recruiter
 * Hero section with feature overview and call-to-action
 */

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Mic, FileText, BarChart3, Users, CheckCircle2, Play, Shield, UserCheck, Briefcase, LogIn, Home, List } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useInterviewStore } from '@/store/interview';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import pooldLogo from '@/assets/poold_logo.svg';
import { UserMenu } from '@/components/UserMenu';

export default function Landing() {
  const navigate = useNavigate();
  const location = useLocation();
  const { canProceedToInterview, sessionId } = useInterviewStore();
  const { user } = useAuth();
  const { roles: userRoles, loading: rolesLoading } = useUserRole();

  // useEffect(() => {
  //   if (user && !rolesLoading && userRoles.length > 0) {
  //     // Redirect to appropriate dashboard based on role
  //     if (userRoles.includes('admin')) {
  //       navigate('/admin');
  //     } else if (userRoles.includes('interviewer')) {
  //       navigate('/interviewer');
  //     } else if (userRoles.includes('interviewee')) {
  //       navigate('/interviewee');
  //     }
  //   }
  // }, [user, userRoles, rolesLoading, navigate]);
  
  const roles = [
    {
      icon: Shield,
      title: "Admin",
      description: "View analytics, costs, and system statistics",
      path: "/admin",
      color: "text-red-500"
    },
    {
      icon: Briefcase,
      title: "Interviewer",
      description: "Review interviews, gap analyses, and candidate responses",
      path: "/interviewer",
      color: "text-blue-500"
    },
    {
      icon: UserCheck,
      title: "Interviewee",
      description: "Upload CV, practice interviews, and view results",
      path: "/interviewee",
      color: "text-green-500"
    }
  ];
  
  const steps = [
    {
      icon: FileText,
      title: "Upload CV",
      description: "Upload candidate's CV and job description for intelligent analysis",
      color: "text-primary"
    },
    {
      icon: BarChart3,
      title: "Gap Analysis",
      description: "Automatically identify skill gaps and coverage areas",
      color: "text-accent"
    },
    {
      icon: Mic,
      title: "AI Interview",
      description: "Conduct adaptive audio interviews with real-time transcription",
      color: "text-success"
    },
    {
      icon: Users,
      title: "Smart Scoring",
      description: "Get detailed scorecards with evidence-based assessments",
      color: "text-warning"
    }
  ];
  
  const features = [
    "Real-time voice transcription",
    "Intelligent question adaptation", 
    "Evidence-based scoring",
    "Competency gap analysis",
    "Export-ready reports",
    "STAR method integration"
  ];
  
  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Header with Logo / Nav */}
      <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src={pooldLogo} alt="Poold Logo" className="w-10 h-10" />
              <span className="text-xl font-bold">Hire for Skills</span>
              {user && (
                <nav className="hidden md:flex items-center gap-2 ml-6">
                  <Button
                    variant={location.pathname === '/' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => navigate('/')}
                    className="flex items-center gap-2"
                  >
                    <Home className="w-4 h-4" />
                    Home
                  </Button>

                  {!userRoles.includes('interviewer') && (
                    <Button
                      variant={location.pathname.startsWith('/maya') ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => navigate('/maya')}
                      className="flex items-center gap-2"
                    >
                      <Mic className="w-4 h-4" />
                      Maya
                    </Button>
                  )}

                  {!userRoles.includes('interviewer') && (
                    <Button
                      variant={location.pathname.startsWith('/browse-jobs') ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => navigate('/browse-jobs')}
                      className="flex items-center gap-2"
                    >
                      <Briefcase className="w-4 h-4" />
                      Jobs
                    </Button>
                  )}

                  {(userRoles.includes('interviewer') || userRoles.includes('admin')) && (
                    <Button
                      variant={location.pathname.startsWith('/job-postings') ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => navigate('/job-postings')}
                      className="flex items-center gap-2"
                    >
                      <List className="w-4 h-4" />
                      Manage jobs
                    </Button>
                  )}
                </nav>
              )}
            </div>

            <div>
              {!user ? (
                <Button variant="outline" onClick={() => navigate('/auth')}>
                  <LogIn className="w-4 h-4 mr-2" />
                  Login
                </Button>
              ) : (
                <UserMenu showBackButton={false} />
              )}
            </div>
          </div>
        </div>
      </header>
      
      {/* Hero Section */}
      <section id="hero" className="relative overflow-hidden">
        <div className="container mx-auto px-6 py-16">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            <div className="space-y-6">
              <h1 className="text-4xl md:text-5xl font-bold leading-tight">
                Get hired for what you can do.
                <br />
                Hire for what really matters.
              </h1>

              <p className="text-lg text-muted-foreground max-w-2xl">
                Poold runs AI-powered skills interviews so candidates can prove what they can do –
                and hiring teams can see who can actually do the job before they make an offer.
              </p>

              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                {!user ? (
                  <>
                    <Button size="lg" onClick={() => navigate('/auth?role=candidate')} className="bg-gradient-hero">
                      I’m looking for a job
                    </Button>

                    <Button size="lg" variant="outline" onClick={() => navigate('/contact')}>
                      I’m hiring talent
                    </Button>
                  </>
                ) : (
                  // If logged in as interviewer, do not show candidate CTAs
                  !userRoles.includes('interviewer') ? (
                    <>
                      <Button size="lg" onClick={() => navigate('/maya')} className="bg-gradient-hero">
                        Start Maya interview
                      </Button>

                      <Button size="lg" variant="outline" onClick={() => navigate('/browse-jobs')}>
                        Find jobs
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="lg" onClick={() => navigate('/job-postings')} className="bg-gradient-hero">
                        Manage jobs
                      </Button>
                    </>
                  )
                )}
              </div>

              <p className="text-sm text-muted-foreground mt-2">No CV required to start • Free for candidates</p>
            </div>

            {/* Hero UI mock (right side) */}
            <div className="relative">
              <Card className="shadow-strong">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">Skills interview in progress</div>
                      <div className="text-sm text-muted-foreground">Alex Morgan</div>
                      <div className="text-xs text-muted-foreground">Product Analyst, London</div>
                    </div>
                    <Badge>Skill match: 87%</Badge>
                  </div>

                  <div className="mt-4 bg-gray-50 p-3 rounded">
                    <div className="text-sm font-medium">Question</div>
                    <div className="text-sm text-muted-foreground mt-1">Describe a time you used data to influence a product decision.</div>
                    <div className="mt-3 text-sm text-foreground font-medium">Answer snippet: “I pulled customer usage metrics and…“</div>
                  </div>
                </CardContent>
              </Card>

              {/* Stacked shortlist panel */}
              <div className="mt-4 grid grid-cols-1 gap-2">
                <Card className="p-3">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium">Shortlist</div>
                      <div className="text-xs text-muted-foreground">3 candidates</div>
                    </div>

                    <div className="space-y-2">
                      {['Maya Lee','Sam Patel','Jordan White'].map((name, i) => (
                        <div key={name} className="flex items-center justify-between gap-4">
                          <div className="text-sm">{name}</div>
                          <div className="w-32 bg-gray-200 h-2 rounded overflow-hidden">
                            <div className={`h-2 rounded bg-gradient-hero`} style={{width: `${70 - i*12}%`}} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Audiences - Candidates vs Hiring Teams (hidden for interviewers) */}
      {!(user && userRoles.includes('interviewer')) && (
      <section id="audiences" className="container mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Who are you?</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Choose the path that fits you — candidates build skills profiles; hiring teams run skills-based interviews.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          <Card className="rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-md bg-primary/10 flex items-center justify-center">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">For candidates</h3>
                  <div className="text-sm text-muted-foreground mt-1">Turn your skills into job offers – not just job applications.</div>
                </div>
              </div>

              <ul className="mt-4 space-y-2 text-sm">
                <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-success mt-1" /> Show what you can do with short, skills-based interviews instead of just a CV.</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-success mt-1" /> Get matched to roles where your skills actually fit, not just your job title.</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-success mt-1" /> Reuse your skills profile across multiple opportunities.</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-success mt-1" /> Get feedback so every interview makes you stronger.</li>
              </ul>

              <div className="mt-6 flex items-center gap-4">
                <Button onClick={() => navigate('/auth?role=candidate')} className="bg-gradient-hero">Start my skills profile</Button>
                <div className="text-xs text-muted-foreground">Free for candidates · 10–15 minutes</div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-md bg-accent/10 flex items-center justify-center">
                  <Briefcase className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">For hiring teams</h3>
                  <div className="text-sm text-muted-foreground mt-1">See who can actually do the job before you hire.</div>
                </div>
              </div>

              <ul className="mt-4 space-y-2 text-sm">
                <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-success mt-1" /> Run structured, AI-powered skills interviews tailored to each role.</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-success mt-1" /> Compare candidates by skills, not CV buzzwords.</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-success mt-1" /> Shortlist faster with clear, consistent scoring.</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-success mt-1" /> Give candidates a fair, transparent experience.</li>
              </ul>

              <div className="mt-6 flex items-center gap-4">
                <Button variant="outline" onClick={() => navigate('/book-demo')}>Book a demo</Button>
                <div className="text-xs text-muted-foreground">Designed for hiring managers, recruiters and founders.</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
      )}

      {/* How it works (hidden for interviewers) */}
      {!(user && userRoles.includes('interviewer')) && (
      <section id="how-it-works" className="container mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">How Poold works</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            We turn real skills into structured data so candidates can shine – and teams can hire with confidence.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <Card className="rounded-xl shadow-md hover:shadow-lg transform hover:-translate-y-1 transition-all">
            <CardContent className="p-6 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <div className="text-sm font-semibold">Define the role & skills</div>
              <div className="mt-2 text-sm text-muted-foreground">Hiring teams pick the skills that matter for the role. Poold turns them into structured interview questions.</div>
            </CardContent>
          </Card>

          <Card className="rounded-xl shadow-md hover:shadow-lg transform hover:-translate-y-1 transition-all">
            <CardContent className="p-6 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mb-3">
                <Mic className="w-6 h-6 text-accent" />
              </div>
              <div className="text-sm font-semibold">Run consistent skills interviews</div>
              <div className="mt-2 text-sm text-muted-foreground">Candidates complete short AI-powered interviews that measure real ability, not just memorised answers.</div>
            </CardContent>
          </Card>

          <Card className="rounded-xl shadow-md hover:shadow-lg transform hover:-translate-y-1 transition-all">
            <CardContent className="p-6 text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mb-3">
                <BarChart3 className="w-6 h-6 text-success" />
              </div>
              <div className="text-sm font-semibold">Match & hire with confidence</div>
              <div className="mt-2 text-sm text-muted-foreground">Teams see comparable scores and skill breakdowns; candidates see where they stand and can improve.</div>
            </CardContent>
          </Card>
        </div>
      </section>
      )}

      {/* Who it's for / social proof */}
      <section id="who-its-for" className="container mx-auto px-6 py-16">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-4">Who Poold is for</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <Card className="rounded-lg shadow-sm p-4">
            <CardContent className="p-4">
              <h4 className="font-semibold">Candidates</h4>
              <div className="text-sm text-muted-foreground mt-2">Graduates, career switchers and experienced professionals who want to be judged on skills, not gaps in their CV.</div>
            </CardContent>
          </Card>

          <Card className="rounded-lg shadow-sm p-4">
            <CardContent className="p-4">
              <h4 className="font-semibold">Hiring managers</h4>
              <div className="text-sm text-muted-foreground mt-2">Team leads who care more about what people can do than which keywords appear on their CV.</div>
            </CardContent>
          </Card>

          <Card className="rounded-lg shadow-sm p-4">
            <CardContent className="p-4">
              <h4 className="font-semibold">Recruiters & talent teams</h4>
              <div className="text-sm text-muted-foreground mt-2">HR and talent teams who need signal, not noise, across large applicant pools.</div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 text-center text-sm text-muted-foreground">Trusted by teams at [logo row]</div>
      </section>

      {/* Final CTA */}
      <section id="final-cta" className="container mx-auto px-6 py-16">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <h2 className="text-3xl font-bold">Ready to make hiring about skills again?</h2>
          <p className="text-muted-foreground">Whether you’re looking for your next role or your next great hire, Poold helps you match on what really matters.</p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-4">
            {!(user && userRoles.includes('interviewer')) && (
              <Button onClick={() => navigate('/auth?role=candidate')}>Create my skills profile</Button>
            )}
            <Button variant="outline" onClick={() => navigate('/contact')}>Talk to us about hiring</Button>
          </div>
        </div>
      </section>
    </div>
  );
}
