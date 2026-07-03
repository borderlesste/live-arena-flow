import { Suspense, lazy, useEffect } from "react";
import { Route, Routes, useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { BottomNav } from "@/components/layout/BottomNav";
import { SkeletonLoader } from "@/components/feedback/SkeletonLoader";
import { MatchReminderManager } from "@/components/notifications/MatchReminderManager";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { subscribeToAuth } from "@/services/auth.service";

import HomePage from "@/views/HomePage";
import NotFound from "@/views/NotFound";

const LivePage = lazy(() => import("@/views/LivePage"));
const MatchesPage = lazy(() => import("@/views/MatchesPage"));
const CompetitionsPage = lazy(() => import("@/views/CompetitionsPage"));
const CalendarPage = lazy(() => import("@/views/CalendarPage"));
const ResultsPage = lazy(() => import("@/views/ResultsPage"));
const MatchDetailsPage = lazy(() => import("@/views/MatchDetailsPage"));
const ProfilePage = lazy(() => import("@/views/ProfilePage"));
const AdminPage = lazy(() => import("@/views/AdminPage"));
const AdminSponsorsPage = lazy(() => import("@/views/AdminSponsorsPage"));
const AdminOperationsPage = lazy(() => import("@/views/AdminOperationsPage"));
const AdminNewsPage = lazy(() => import("@/views/AdminNewsPage"));
const MaintenancePage = lazy(() => import("@/views/MaintenancePage"));
const PrivacyPage = lazy(() => import("@/views/legal/PrivacyPage"));
const TermsPage = lazy(() => import("@/views/legal/TermsPage"));
const CookiesPage = lazy(() => import("@/views/legal/CookiesPage"));
const CommunityRulesPage = lazy(() => import("@/views/legal/CommunityRulesPage"));
const ContactPage = lazy(() => import("@/views/legal/ContactPage"));
const BroadcastRightsPage = lazy(() => import("@/views/legal/BroadcastRightsPage"));
const SponsorsInfoPage = lazy(() => import("@/views/legal/SponsorsInfoPage"));
const ForgotPasswordPage = lazy(() => import("@/views/ForgotPasswordPage"));
const VerifyEmailPage = lazy(() => import("@/views/VerifyEmailPage"));
const AuthConfirmationPage = lazy(() => import("@/views/AuthConfirmationPage"));
const UpdatePasswordPage = lazy(() => import("@/views/UpdatePasswordPage"));

function AuthEventRouter() {
  const navigate = useNavigate();
  useEffect(() => subscribeToAuth((event) => {
    if (event === "PASSWORD_RECOVERY") navigate("/auth/update-password", { replace: true });
    if (event === "SIGNED_IN" && /(?:^|[&#])type=(?:signup|email)(?:&|$)/.test(window.location.hash)) {
      navigate("/auth/confirm", { replace: true });
    }
  }), [navigate]);
  return null;
}

function PageFallback() {
  return (
    <div className="container mx-auto space-y-4 px-4 py-8 md:px-6">
      <SkeletonLoader className="h-10 w-64" />
      <SkeletonLoader className="h-64 w-full" />
      <SkeletonLoader className="h-40 w-full" />
    </div>
  );
}

export function AppRouter() {
  return (
    <div className="flex min-h-dvh flex-col">
      <AuthEventRouter />
      <MatchReminderManager />
      <Header />
      <main id="contenido" className="flex-1 pb-24 lg:pb-0">
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/live" element={<LivePage />} />
            <Route path="/matches" element={<MatchesPage />} />
            <Route path="/competitions" element={<CompetitionsPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/results" element={<ResultsPage />} />
            <Route path="/match/:id" element={<MatchDetailsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/auth/verify-email" element={<VerifyEmailPage />} />
            <Route path="/auth/confirm" element={<AuthConfirmationPage />} />
            <Route path="/auth/update-password" element={<UpdatePasswordPage />} />
            <Route path="/admin" element={<AdminLayout><AdminOperationsPage /></AdminLayout>} />
            <Route path="/admin/dashboard" element={<AdminLayout><AdminOperationsPage /></AdminLayout>} />
            <Route path="/admin/streams" element={<AdminLayout><AdminPage /></AdminLayout>} />
            <Route path="/admin/news" element={<AdminLayout><AdminNewsPage /></AdminLayout>} />
            <Route path="/admin/matches" element={<AdminLayout><AdminOperationsPage /></AdminLayout>} />
            <Route path="/admin/sponsors" element={<AdminLayout><AdminSponsorsPage /></AdminLayout>} />
            <Route path="/admin/users" element={<AdminLayout><AdminOperationsPage /></AdminLayout>} />
            <Route path="/admin/chat" element={<AdminLayout><AdminOperationsPage /></AdminLayout>} />
            <Route path="/admin/analytics" element={<AdminLayout><AdminOperationsPage /></AdminLayout>} />
            <Route path="/admin/settings" element={<AdminLayout><AdminOperationsPage /></AdminLayout>} />
            <Route path="/admin/audit" element={<AdminLayout><AdminOperationsPage /></AdminLayout>} />
            <Route path="/maintenance" element={<MaintenancePage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/cookies" element={<CookiesPage />} />
            <Route path="/community-rules" element={<CommunityRulesPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/broadcast-rights" element={<BroadcastRightsPage />} />
            <Route path="/sponsors" element={<SponsorsInfoPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
}
