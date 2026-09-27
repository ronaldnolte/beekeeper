// The app frame — SPEC A §2–§5, §12.

import { lazy, Suspense, type ReactNode } from 'react';
import { useApp } from './store';
import { BOTTOM_NAV_VIEWS, headerTitle } from './views';
import { Header } from '../components/Header';
import { BottomNav } from '../components/BottomNav';
import { FullScreenLoader, GestureStrip, Spinner } from '../components/Chrome';
import { WhatsNew } from '../components/WhatsNew';
import { AuthScreen } from '../screens/auth/AuthScreen';
import { UpdatePasswordScreen } from '../screens/auth/UpdatePasswordScreen';
import { BetaSignupScreen } from '../screens/auth/BetaSignupScreen';
import { Placeholder } from '../screens/Placeholder';
import type { View } from './views';

// Heavy screens load on demand (SCAR S-UI-13).
const NectarScreen = lazy(() => import('../screens/nectar/NectarScreen'));
const ForecastScreen = lazy(() => import('../screens/forecast/ForecastScreen'));
const AskAIScreen = lazy(() => import('../screens/askai/AskAIScreen'));

function ScreenLoader() {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-text-muted">
      <Spinner />
      <p>Loading...</p>
    </div>
  );
}

function screenFor(view: View): ReactNode {
  switch (view) {
    case 'NECTAR_FLOW':
      return <NectarScreen />;
    case 'FORECAST':
      return <ForecastScreen />;
    case 'ASK_AI':
      return <AskAIScreen />;
    default:
      return <Placeholder view={view} />;
  }
}

export function App() {
  const { state, navigate } = useApp();
  const { booting, user, view } = state;

  if (booting) return <FullScreenLoader />;

  // Stand-alone screens; the two special paths never bounce to Sign-in (SCAR S-AUTH-2).
  if (view === 'UPDATE_PASSWORD' || view === 'BETA_SIGNUP' || view === 'AUTH' || !user) {
    return (
      <>
        {view === 'UPDATE_PASSWORD' ? <UpdatePasswordScreen /> : view === 'BETA_SIGNUP' ? <BetaSignupScreen /> : <AuthScreen />}
        <GestureStrip />
      </>
    );
  }

  const showNav = BOTTOM_NAV_VIEWS.includes(view);
  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <Header
        title={headerTitle(view, state.isUnified)}
        email={user.email}
        showAvatar={view !== 'PROFILE'}
        onAvatar={() => navigate('PROFILE', { keepRecord: false })}
      />
      {/* Every screen change fades in over 380 ms — a fade, never a slide (SCAR S-UI-7). */}
      <main key={view} className={`flex-1 animate-screen ${showNav && view !== 'ASK_AI' ? 'pb-32' : ''}`}>
        <Suspense fallback={<ScreenLoader />}>{screenFor(view)}</Suspense>
      </main>
      {showNav && <BottomNav />}
      <WhatsNew />
      <GestureStrip />
    </div>
  );
}
