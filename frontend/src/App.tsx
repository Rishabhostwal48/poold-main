import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { RoleProtectedRoute } from "./components/RoleProtectedRoute";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Setup from "./pages/Setup";
import Interview from "./pages/Interview";
import Summary from "./pages/Summary";
import NotFound from "./pages/NotFound";
import InterviewerDashboard from "./pages/InterviewerDashboard";
import IntervieweeDashboard from "./pages/IntervieweeDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import JobPostings from "./pages/JobPostings";
import BrowseJobs from "./pages/BrowseJobs";
import MayaInterview from "./pages/MayaInterview";
import Profile from "./pages/Profile";
import HiringAccess from "./pages/HiringAccess";
import { CursorFollower } from "./components/CursorFollower";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <CursorFollower />
            <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/contact" element={<HiringAccess />} />
            <Route path="/book-demo" element={<HiringAccess />} />
            <Route path="/maya" element={<MayaInterview />} />
            <Route path="/setup" element={<ProtectedRoute><Setup /></ProtectedRoute>} />
            <Route path="/interview" element={<ProtectedRoute><Interview /></ProtectedRoute>} />
            <Route path="/summary" element={<ProtectedRoute><Summary /></ProtectedRoute>} />
            <Route path="/interviewer" element={<RoleProtectedRoute allowedRoles={['interviewer', 'admin']}><InterviewerDashboard /></RoleProtectedRoute>} />
            <Route path="/interviewee" element={<RoleProtectedRoute allowedRoles={['interviewee']}><IntervieweeDashboard /></RoleProtectedRoute>} />
            <Route path="/admin" element={<RoleProtectedRoute allowedRoles={['admin']}><AdminDashboard /></RoleProtectedRoute>} />
            <Route path="/job-postings" element={<RoleProtectedRoute allowedRoles={['interviewer', 'admin']}><JobPostings /></RoleProtectedRoute>} />
            <Route path="/browse-jobs" element={<ProtectedRoute><BrowseJobs /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
