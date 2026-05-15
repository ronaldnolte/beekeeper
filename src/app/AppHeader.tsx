import React from 'react';
import { ArrowLeft, Sparkles, Mail, LogOut } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { supabase } from '../data/supabase';

// Layered SVG landscape silhouette
const LandscapeSVG = () => (
  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
    {/* Sky gradient */}
    <defs>
      <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#87CEEB" stopOpacity="0.4" />
        <stop offset="40%" stopColor="#F5D98C" stopOpacity="0.5" />
        <stop offset="70%" stopColor="#F0A830" stopOpacity="0.6" />
        <stop offset="100%" stopColor="#D4782F" stopOpacity="0.7" />
      </linearGradient>
    </defs>
    <rect width="400" height="100" fill="url(#skyGrad)" />
    {/* Far hills - dark forest green */}
    <path d="M0,70 C40,45 80,55 120,48 C160,40 200,55 240,42 C280,30 320,50 360,45 L400,52 L400,100 L0,100Z" fill="#2E5A2E" opacity="0.5" />
    {/* Mid hills - medium green */}
    <path d="M0,78 C50,60 90,72 140,62 C190,52 230,68 280,58 C330,48 370,65 400,60 L400,100 L0,100Z" fill="#3D7A35" opacity="0.6" />
    {/* Near hills - darker green */}
    <path d="M0,85 C30,75 70,82 120,74 C170,66 210,78 260,72 C310,65 350,76 400,70 L400,100 L0,100Z" fill="#2B5E28" opacity="0.7" />
    {/* Trees silhouette scattered */}
    <path d="M30,82 L35,68 L40,82Z" fill="#1D4A1D" opacity="0.6" />
    <path d="M85,78 L91,62 L97,78Z" fill="#1D4A1D" opacity="0.5" />
    <path d="M150,75 L157,58 L164,75Z" fill="#1D4A1D" opacity="0.6" />
    <path d="M220,73 L226,60 L232,73Z" fill="#1D4A1D" opacity="0.5" />
    <path d="M290,70 L296,56 L302,70Z" fill="#1D4A1D" opacity="0.6" />
    <path d="M350,74 L355,62 L360,74Z" fill="#1D4A1D" opacity="0.5" />
    {/* Sun circle */}
    <circle cx="320" cy="28" r="14" fill="#F5D98C" opacity="0.8" />
    <circle cx="320" cy="28" r="18" fill="#F5D98C" opacity="0.2" />
  </svg>
);

export const AppHeader: React.FC = () => {
  const { currentView, navigateTo } = useAppStore();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const titleMap: Record<string, string> = {
    SELECT_APIARY: 'Dashboard',
    SELECT_HIVE: 'Hives',
    HIVE_DETAIL: 'Hive Detail',
    INSPECTION_FORM: 'Inspection',
    INTERVENTION_FORM: 'Intervention',
    TASK_FORM: 'Task',
    SWARM_PREDICTION: 'Swarm Index',
    FORECAST: 'Forecast',
    ASK_AI: 'Ask AI',
    STATUS_UPDATE: 'Status',
    SETTINGS: 'Settings',
    ROADMAP: 'Roadmap',
  };

  const title = titleMap[currentView] || 'Beekeeper';
  const showBackButton = currentView !== 'SELECT_APIARY';

  return (
    <header className="glass-header sticky top-0 z-50 flex justify-center w-full" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* SVG Landscape Background */}
      <LandscapeSVG />
      
      {/* Golden hour gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#2B5E28]/80 via-[#3D7A35]/60 to-[#D4782F]/40" />

      <div className="relative w-full max-w-4xl px-4 py-3 flex items-center justify-between z-10">
        {/* Left: Back + Title */}
        <div className="flex items-center gap-2">
          {showBackButton ? (
            <button 
              onClick={() => window.history.back()}
              className="p-2 -ml-2 rounded-xl text-white/90 hover:bg-white/10 transition-colors active:scale-95"
            >
              <ArrowLeft size={22} />
            </button>
          ) : (
            <img src="/logo.png" alt="Beektools" className="w-8 h-8 object-contain drop-shadow-md" />
          )}
          <h1 className="text-lg font-black text-white drop-shadow-sm">{title}</h1>
        </div>

        {/* Right: Action Icons */}
        <div className="flex items-center gap-1">
          {/* Ask AI — only show after apiary is selected */}
          {currentView !== 'SELECT_APIARY' && (
            <button 
              onClick={() => navigateTo('ASK_AI')}
              className="w-12 rounded-xl flex flex-col items-center justify-center gap-0.5 py-1 transition-colors active:scale-95 text-amber-200 hover:bg-white/10"
              title="Ask AI Beekeeper"
            >
              <Sparkles size={18} />
              <span className="text-[9px] font-bold leading-none">Ask AI</span>
            </button>
          )}
          
          {/* Feedback */}
          <button 
            onClick={() => useAppStore.getState().setFeedbackModalOpen(true)}
            className="w-12 rounded-xl flex flex-col items-center justify-center gap-0.5 py-1 transition-colors active:scale-95 text-white/70 hover:bg-white/10"
            title="Send Feedback"
          >
            <Mail size={16} />
            <span className="text-[9px] font-bold leading-none">Feedback</span>
          </button>

          {/* Logout */}
          <button 
            onClick={handleLogout}
            className="w-12 rounded-xl flex flex-col items-center justify-center gap-0.5 py-1 transition-colors active:scale-95 text-red-300 hover:bg-white/10"
            title="Log Out"
          >
            <LogOut size={16} />
            <span className="text-[9px] font-bold leading-none">Log Out</span>
          </button>
        </div>
      </div>
    </header>
  );
};
