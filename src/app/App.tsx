// The app frame — SPEC A §2–§5, §12.

import { lazy, Suspense, type ReactNode } from 'react';
import { useApp } from './store';
import { BOTTOM_NAV_VIEWS, headerTitle } from './views';
import { Header } from '../components/Header';
import { BottomNav } from '../components/BottomNav';
import { FullScreenLoader, GestureStrip, Spinner } from '../components/Chrome';
import { WhatsNew } from '../components/WhatsNew';
import { MoreBelow } from '../components/MoreBelow';
import { AuthScreen } from '../screens/auth/AuthScreen';
import { UpdatePasswordScreen } from '../screens/auth/UpdatePasswordScreen';
import { BetaSignupScreen } from '../screens/auth/BetaSignupScreen';
import type { View } from './views';

// Heavy screens load on demand (SCAR S-UI-13).
const NectarScreen = lazy(() => import('../screens/nectar/NectarScreen'));
const ForecastScreen = lazy(() => import('../screens/forecast/ForecastScreen'));
const AskAIScreen = lazy(() => import('../screens/askai/AskAIScreen'));
const ApiariesScreen = lazy(() => import('../screens/apiaries/ApiariesScreen'));
const HivesScreen = lazy(() => import('../screens/hives/HivesScreen'));
const HiveDetailScreen = lazy(() => import('../screens/hives/HiveDetailScreen'));
const InspectionScreen = lazy(() => import('../screens/records/InspectionScreen'));
const PhotosVoiceScreen = lazy(() => import('../screens/records/PhotosVoiceScreen'));
const InterventionScreen = lazy(() => import('../screens/records/InterventionScreen'));
const VarroaScreen = lazy(() => import('../screens/records/VarroaScreen'));
const TaskScreen = lazy(() => import('../screens/records/TaskScreen'));
const DashboardScreen = lazy(() => import('../screens/dashboard/DashboardScreen'));
const ProfileScreen = lazy(() => import('../screens/profile/ProfileScreen'));
const RoadmapScreen = lazy(() => import('../screens/roadmap/RoadmapScreen'));

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
    case 'SELECT_APIARY':
      return <ApiariesScreen />;
    case 'SELECT_HIVE':
      return <HivesScreen />;
    case 'HIVE_DETAIL':
      return <HiveDetailScreen />;
    case 'INSPECTION_FORM':
      return <InspectionScreen />;
    case 'INSPECTION_PLUS':
      return <PhotosVoiceScreen />;
    case 'INTERVENTION_FORM':
      return <InterventionScreen />;
    case 'VARROA_FORM':
      return <VarroaScreen />;
    case 'TASK_FORM':
      return <TaskScreen />;
    case 'DASHBOARD':
      return <DashboardScreen />;
    case 'PROFILE':
      return <ProfileScreen />;
    case 'ROADMAP':
      return <RoadmapScreen />;
    default:
      // STATUS_UPDATE_FORM: nothing links to it (SPEC B §19, copied dead feature).
      return null;
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
      {/* Just above the nav pill / record bottom bars (all ≈ 90 px tall). */}
      <MoreBelow key={`more-below-${view}`} className="fixed left-1/2 -translate-x-1/2 z-[45]" style={{ bottom: 'calc(104px + env(safe-area-inset-bottom))' }} />
      <WhatsNew />
      <GestureStrip />
    </div>
  );
}
