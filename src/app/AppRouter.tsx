import { Suspense, lazy } from "react";
import { Route, Routes } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { BottomNav } from "@/components/layout/BottomNav";
import { SkeletonLoader } from "@/components/feedback/SkeletonLoader";

import HomePage from "@/pages/HomePage";
import NotFound from "@/pages/NotFound";

const LivePage = lazy(() => import("@/pages/LivePage"));
const MatchesPage = lazy(() => import("@/pages/MatchesPage"));
const CompetitionsPage = lazy(() => import("@/pages/CompetitionsPage"));
const CalendarPage = lazy(() => import("@/pages/CalendarPage"));
const ResultsPage = lazy(() => import("@/pages/ResultsPage"));
const MatchDetailsPage = lazy(() => import("@/pages/MatchDetailsPage"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
const PrivacyPage = lazy(() => import("@/pages/legal/PrivacyPage"));
const TermsPage = lazy(() => import("@/pages/legal/TermsPage"));
const CookiesPage = lazy(() => import("@/pages/legal/CookiesPage"));
const CommunityRulesPage = lazy(() => import("@/pages/legal/CommunityRulesPage"));
const ContactPage = lazy(() => import("@/pages/legal/ContactPage"));
const BroadcastRightsPage = lazy(() => import("@/pages/legal/BroadcastRightsPage"));
const SponsorsInfoPage = lazy(() => import("@/pages/legal/SponsorsInfoPage"));

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
