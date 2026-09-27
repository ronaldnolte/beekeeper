// The app frame — SPEC A §2–§5, §12.

import { useApp } from './store';
import { BOTTOM_NAV_VIEWS, headerTitle } from './views';
import { Header } from '../components/Header';
import { BottomNav } from '../components/BottomNav';
import { FullScreenLoader, GestureStrip } from '../components/Chrome';
import { WhatsNew } from '../components/WhatsNew';
import { AuthScreen } from '../screens/auth/AuthScreen';
import { UpdatePasswordScreen } from '../screens/auth/UpdatePasswordScreen';
import { BetaSignupScreen } from '../screens/auth/BetaSignupScreen';
import { Placeholder } from '../screens/Placeholder';

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
      <main key={view} className={`flex-1 animate-screen ${showNav ? 'pb-32' : ''}`}>
        <Placeholder view={view} />
      </main>
      {showNav && <BottomNav />}
      <WhatsNew />
      <GestureStrip />
    </div>
  );
}
