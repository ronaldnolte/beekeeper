import React from 'react';
import { Mail, LogOut } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { supabase } from '../data/supabase';

// Layered SVG landscape silhouette
const LandscapeSVG = () => (
  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
    {/* New Mexico blue sky */}
    <defs>
      <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#2E86DE" />
        <stop offset="50%" stopColor="#54A0E0" />
        <stop offset="85%" stopColor="#AED6F1" />
        <stop offset="100%" stopColor="#E8D5B7" />
      </linearGradient>
    </defs>
    <rect width="400" height="100" fill="url(#skyGrad)" />
    {/* Sandia Mountains - far range */}
    <path d="M0,72 L30,65 L60,55 L80,38 L100,32 L130,28 L155,35 L175,42 L200,55 L220,60 L250,52 L275,45 L300,40 L320,38 L340,42 L360,50 L380,58 L400,62 L400,100 L0,100Z" fill="#7B6B8A" opacity="0.45" />
    {/* Sandia Mountains - main ridge */}
    <path d="M0,78 L40,72 L70,62 L95,48 L115,40 L140,36 L160,42 L180,52 L210,65 L240,60 L265,50 L285,45 L310,42 L330,46 L350,55 L375,64 L400,68 L400,100 L0,100Z" fill="#6B5B7B" opacity="0.6" />
    {/* Desert mesa foreground */}
    <path d="M0,88 L50,84 L100,86 L150,82 L200,85 L250,83 L300,86 L350,84 L400,87 L400,100 L0,100Z" fill="#C4A882" opacity="0.7" />
    {/* Desert floor */}
    <path d="M0,92 L100,90 L200,92 L300,90 L400,93 L400,100 L0,100Z" fill="#B89B6A" opacity="0.5" />
    {/* Sun */}
    <circle cx="320" cy="22" r="14" fill="#F5D98C" opacity="0.9" />
    <circle cx="320" cy="22" r="20" fill="#F5D98C" opacity="0.15" />
    {/* Wispy cloud */}
    <ellipse cx="100" cy="18" rx="35" ry="5" fill="white" opacity="0.3" />
    <ellipse cx="240" cy="25" rx="25" ry="4" fill="white" opacity="0.2" />
  </svg>
);

export const AppHeader: React.FC = () => {
  const { currentView, isUnifiedHiveView } = useAppStore();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  const titleMap: Record<string, string> = {
    DASHBOARD: 'Beekeeper',
    SELECT_APIARY: 'My Apiaries',
    SELECT_HIVE: isUnifiedHiveView ? 'My Hives' : 'Hives',
    HIVE_DETAIL: 'Hive Detail',
    INSPECTION_FORM: 'Inspection',
    INTERVENTION_FORM: 'Intervention',
    TASK_FORM: 'Task',
    SWARM_PREDICTION: 'Swarm Index',
    FORECAST: 'Forecast',
    ASK_AI: 'Ask AI',
    STATUS_UPDATE_FORM: 'Status',
    SETTINGS: 'Settings',
    ROADMAP: 'Roadmap',
  };

  const title = titleMap[currentView] || 'Beekeeper';
  
  return (
    <header className="glass-header sticky top-0 z-50 flex justify-center w-full" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* SVG Landscape Background */}
      <LandscapeSVG />
      
      {/* Blue sky overlay for text contrast */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#2E86DE]/60 via-[#4A99E0]/30 to-transparent" />

      <div className="relative w-full max-w-4xl px-4 py-5 flex items-center justify-between z-10">
        {/* Left: Logo + Title */}
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Beektools" className="w-8 h-8 object-contain drop-shadow-md" />
          <h1 className="text-lg font-black text-white drop-shadow-sm">{title}</h1>
        </div>

        {/* Right: Action Icons */}
        <div className="flex items-center gap-1">
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
