interface RailOneLogoProps {
  compact?: boolean;
  darkText?: boolean;
}

export function RailOneLogo({ compact = false, darkText = true }: RailOneLogoProps) {
  return (
    <div className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 select-none">
      <svg
        width={compact ? 30 : 34}
        height={compact ? 30 : 34}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0 shadow-sm rounded-xl"
      >
        <rect width="64" height="64" rx="16" fill="#0B63E5" />
        {/* Aerodynamic Vande Bharat train silhouette matching Play Store RailOne icon */}
        <path
          d="M11 26C19 20.5 31 18 42.5 18.5C47.8 18.8 52.2 22.8 54.8 29.2C56.2 32.5 54.4 36.2 50.8 36.9L11 43"
          stroke="white"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M11 32.5L36 28.5"
          stroke="white"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <path
          d="M11 37.5L30 34.8"
          stroke="white"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d="M36 23.5C41.5 23 46.5 24.5 49.5 29.5L40.5 31.2L36 23.5Z"
          stroke="white"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <path
          d="M11 47H54"
          stroke="white"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeOpacity="0.85"
        />
      </svg>
      <span
        className={`font-display font-bold tracking-tight ${
          compact ? 'text-lg' : 'text-xl'
        } ${darkText ? 'text-slate-900' : 'text-white'}`}
      >
        RailOne
      </span>
    </div>
  );
}
