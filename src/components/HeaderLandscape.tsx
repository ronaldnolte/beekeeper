// The Sandia Mountains header drawing — verbatim from APPENDIX-A, palettes from SPEC A §4.

export interface LandscapePalette {
  sky: [string, string, string, string];
  far: string;
  ridge: string;
  mesa: string;
  floor: string;
  sun: string;
  snow: boolean;
  towering: boolean;
}

export const PALETTES: Record<'winter' | 'spring' | 'monsoon' | 'autumn' | 'dusk', LandscapePalette> = {
  winter: { sky: ['#4A7FB5', '#6D9FC9', '#BBD4E8', '#DCD3C0'], far: '#7C7188', ridge: '#6A6178', mesa: '#BCAC94', floor: '#AFA189', sun: '#EFE3C2', snow: true, towering: false },
  spring: { sky: ['#2E86DE', '#54A0E0', '#AED6F1', '#E8D5B7'], far: '#7B6B8A', ridge: '#6B5B7B', mesa: '#C4A882', floor: '#8FA86A', sun: '#F5D98C', snow: false, towering: false },
  monsoon: { sky: ['#2670BE', '#4A93D4', '#9EC6E4', '#E0CFB4'], far: '#6F6280', ridge: '#5E5270', mesa: '#C4A882', floor: '#A99A6E', sun: '#F5D98C', snow: false, towering: true },
  autumn: { sky: ['#3A8FD8', '#69AAE2', '#C4DCEE', '#EBD9B8'], far: '#7B6B8A', ridge: '#6B5B7B', mesa: '#D9B44A', floor: '#C9A961', sun: '#F5D98C', snow: false, towering: false },
  dusk: { sky: ['#4B4A7A', '#8A6A8E', '#D98E86', '#F2B48C'], far: '#7E5A6E', ridge: '#96566A', mesa: '#8C6A63', floor: '#6E564F', sun: '#F7C9A0', snow: false, towering: false },
};

/** Dusk from 20:00 to 06:00; otherwise by northern-hemisphere month, for every user. */
export function paletteFor(now: Date): LandscapePalette {
  const h = now.getHours();
  if (h >= 20 || h < 6) return PALETTES.dusk;
  const m = now.getMonth(); // 0 = January
  if (m === 11 || m <= 1) return PALETTES.winter;
  if (m <= 4) return PALETTES.spring;
  if (m <= 7) return PALETTES.monsoon;
  return PALETTES.autumn;
}

export function HeaderLandscape({ palette }: { palette: LandscapePalette }) {
  return (
    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={palette.sky[0]} />
          <stop offset="50%" stopColor={palette.sky[1]} />
          <stop offset="85%" stopColor={palette.sky[2]} />
          <stop offset="100%" stopColor={palette.sky[3]} />
        </linearGradient>
      </defs>
      <rect width="400" height="100" fill="url(#skyGrad)" />

      {/* Sandia Mountains — far range */}
      <path d="M0,72 L30,65 L60,55 L80,38 L100,32 L130,28 L155,35 L175,42 L200,55 L220,60 L250,52 L275,45 L300,40 L320,38 L340,42 L360,50 L380,58 L400,62 L400,100 L0,100Z" fill={palette.far} opacity="0.45" />
      {/* Sandia Mountains — main ridge */}
      <path d="M0,78 L40,72 L70,62 L95,48 L115,40 L140,36 L160,42 L180,52 L210,65 L240,60 L265,50 L285,45 L310,42 L330,46 L350,55 L375,64 L400,68 L400,100 L0,100Z" fill={palette.ridge} opacity="0.6" />

      {/* Snow, on the high stretch of the ridge only — it does not reach the foothills */}
      {palette.snow && (
        <path d="M70,62 L95,48 L115,40 L140,36 L160,42 L180,52 L172,54 L158,46 L140,41 L117,45 L97,53 L78,64Z" fill="#FFFFFF" opacity="0.75" />
      )}

      {/* Desert mesa foreground */}
      <path d="M0,88 L50,84 L100,86 L150,82 L200,85 L250,83 L300,86 L350,84 L400,87 L400,100 L0,100Z" fill={palette.mesa} opacity="0.7" />
      {/* Desert floor */}
      <path d="M0,92 L100,90 L200,92 L300,90 L400,93 L400,100 L0,100Z" fill={palette.floor} opacity="0.5" />

      {/* Sun */}
      <circle cx="320" cy="22" r="14" fill={palette.sun} opacity="0.9" />
      <circle cx="320" cy="22" r="20" fill={palette.sun} opacity="0.15" />

      {palette.towering ? (
        /* Monsoon: the afternoon build-up, stacked rather than wispy */
        <>
          <ellipse cx="110" cy="30" rx="46" ry="12" fill="white" opacity="0.30" />
          <ellipse cx="96" cy="20" rx="30" ry="12" fill="white" opacity="0.34" />
          <ellipse cx="126" cy="14" rx="22" ry="10" fill="white" opacity="0.28" />
          <ellipse cx="248" cy="26" rx="30" ry="9" fill="white" opacity="0.22" />
          <ellipse cx="238" cy="17" rx="18" ry="8" fill="white" opacity="0.24" />
        </>
      ) : (
        /* Every other season: two wisps */
        <>
          <ellipse cx="100" cy="18" rx="35" ry="5" fill="white" opacity="0.3" />
          <ellipse cx="240" cy="25" rx="25" ry="4" fill="white" opacity="0.2" />
        </>
      )}
    </svg>
  );
}
