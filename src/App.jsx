import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate, Outlet } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import IdleWarningDialog from '@/components/IdleWarningDialog';
import SessionExpiredDialog from '@/components/SessionExpiredDialog';
import { useSessionManager } from '@/hooks/useSessionManager';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import Upload from "@/pages/Upload";
import DrawingDetail from "@/pages/DrawingDetail";
import Family from "@/pages/Family";
import FamilyOnboarding from "@/pages/FamilyOnboarding";
import Account from "@/pages/Account";
import Permisos from "@/pages/Permisos";
import Soporte from "@/pages/Soporte";
import About from "@/pages/About";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import OAuthConsent from "@/pages/OAuthConsent";

// Any authenticated-only route below needs a real session -- unauthenticated
// visitors land on the routed /login instead of Base44's hosted login
// (Module 10's whole point for Phase 4).
function RequireAuth() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}

// Module 18-retired: family_id IS the membership. An authenticated user with
// none yet has nothing to see in the main app -- send them to create or join
// one first, every time, not just on first login.
function RequireFamily() {
  const { user } = useAuth();
  return user?.family_id ? <Outlet /> : <Navigate to="/bienvenida" replace />;
}

// Module 20, Layer 1+2 (idle timer + heartbeat) and its two dialogs. Mounted
// once the caller is authenticated, regardless of which route they're on --
// a session can go idle from the login... no, from any authenticated page.
function SessionControl() {
  const { user } = useAuth();
  const { idleState, sessionExpired, continueSession } = useSessionManager();
  useActivityTracker(user?.family_id);
  return (
    <>
      <IdleWarningDialog open={idleState === 'idle_warning'} onContinue={continueSession} />
      <SessionExpiredDialog open={sessionExpired} />
    </>
  );
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // A platform-level ban is terminal regardless of route; everything else
  // (including "auth required") falls through to the routes below, where
  // RequireAuth sends an unauthenticated visitor to /login.
  if (authError?.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }

  return (
    <>
      {isAuthenticated && <SessionControl />}
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/oauth/consent" element={<OAuthConsent />} />

        <Route element={<RequireAuth />}>
          <Route path="/bienvenida" element={<FamilyOnboarding />} />
          <Route element={<RequireFamily />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Home />} />
              <Route path="/subir" element={<Upload />} />
              <Route path="/dibujo/:id" element={<DrawingDetail />} />
              <Route path="/familia" element={<Family />} />
              <Route path="/cuenta" element={<Account />} />
              <Route path="/permisos" element={<Permisos />} />
              <Route path="/soporte" element={<Soporte />} />
              <Route path="/acerca" element={<About />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </>
  );
};


function App() {

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <ScrollToTop />
            <AuthenticatedApp />
          </Router>
          <ThemeSwitcher />
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
