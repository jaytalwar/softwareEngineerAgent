interface IconProps {
  size?: number;
  className?: string;
}

const base = { fill: "none" as const, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function BrainIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base} className={className}>
      <path
        d="M6 2.5a2 2 0 0 0-2 2v.2A2 2 0 0 0 2.5 6.5v1a2 2 0 0 0 .8 1.6A2 2 0 0 0 4 12.5a2 2 0 0 0 2 1.5v-9.5A2 2 0 0 0 6 2.5Z"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M10 2.5a2 2 0 0 1 2 2v.2A2 2 0 0 1 13.5 6.5v1a2 2 0 0 1-.8 1.6A2 2 0 0 1 12 12.5a2 2 0 0 1-2 1.5v-9.5A2 2 0 0 1 10 2.5Z"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}

export function SearchIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base} className={className}>
      <circle cx="7" cy="7" r="4.2" stroke="currentColor" strokeWidth="1.3" />
      <path d="m13 13-2.6-2.6" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

export function FileIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base} className={className}>
      <path
        d="M4 1.5h5L12.5 5v9a.5.5 0 0 1-.5.5H4a.5.5 0 0 1-.5-.5v-12a.5.5 0 0 1 .5-.5Z"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path d="M9 1.5V5h3.5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function EditIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base} className={className}>
      <path
        d="M10.5 2.5 13.5 5.5 5.5 13.5H2.5v-3l8-7.5Z"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path d="m9 4 3 3" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function FolderIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base} className={className}>
      <path
        d="M2 4a1 1 0 0 1 1-1h3l1.2 1.5H13a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4Z"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}

export function TerminalIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base} className={className}>
      <rect x="1.5" y="2.5" width="13" height="11" rx="1.3" stroke="currentColor" strokeWidth="1.2" />
      <path d="m4.5 6 2.4 2-2.4 2M8.5 10h3" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function FlaskIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base} className={className}>
      <path
        d="M6.3 2h3.4M6.8 2v3.8L3.3 12a1.2 1.2 0 0 0 1 1.8h7.4a1.2 1.2 0 0 0 1-1.8L9.2 5.8V2"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path d="M5 10h6" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function GitBranchIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base} className={className}>
      <circle cx="4" cy="3" r="1.6" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="4" cy="13" r="1.6" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="12" cy="6" r="1.6" stroke="currentColor" strokeWidth="1.2" />
      <path d="M4 4.6v6.8M4 8c0-2.5 2-3.5 6.2-3.6" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function PatchIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base} className={className}>
      <path
        d="M2.5 8 6 4.5l2 2L11.5 3l2 2-3.5 3.5-2-2L4.5 10l-2-2Z"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path d="m8 10 2 2-2.5 2H5v-2.5L8 10Z" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function LintIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base} className={className}>
      <path d="M3 4h10M3 8h6M3 12h8" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="13" cy="12" r="1.4" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function CheckIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base} className={className}>
      <path d="M3 8.5 6.2 12 13 4" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function ChevronIcon({ size = 12, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" {...base} className={className}>
      <path d="M4 2.5 8 6l-4 3.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function ChevronDownIcon({ size = 12, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" {...base} className={className}>
      <path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function PlusIcon({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" {...base} className={className}>
      <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function CloseIcon({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" {...base} className={className}>
      <path d="m2 2 10 10M12 2 2 12" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function SunIcon({ size = 15, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base} className={className}>
      <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M8 1.5v1.6M8 12.9v1.6M14.5 8h-1.6M3.1 8H1.5M12.6 3.4l-1.1 1.1M4.5 11.5l-1.1 1.1M12.6 12.6l-1.1-1.1M4.5 4.5 3.4 3.4"
        stroke="currentColor"
        strokeWidth="1.3"
      />
    </svg>
  );
}

export function MoonIcon({ size = 15, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className}>
      <path d="M13.8 9.7A6 6 0 0 1 6.3 2.2a6 6 0 1 0 7.5 7.5Z" />
    </svg>
  );
}

export function SettingsIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base} className={className}>
      <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M8 1.8v1.4M8 12.8v1.4M14.2 8h-1.4M3.2 8H1.8M12.2 3.8l-1 1M4.8 11.2l-1 1M12.2 12.2l-1-1M4.8 4.8l-1-1"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}

export function SparkleIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className}>
      <path d="M8 1.5c.3 2.4 1.1 4 2.3 5.2 1.2 1.2 2.8 2 5.2 2.3-2.4.3-4 1.1-5.2 2.3-1.2 1.2-2 2.8-2.3 5.2-.3-2.4-1.1-4-2.3-5.2C4.5 10.1 2.9 9.3.5 9c2.4-.3 4-1.1 5.2-2.3C6.9 5.5 7.7 3.9 8 1.5Z" />
    </svg>
  );
}

export function AttachIcon({ size = 15, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base} className={className}>
      <path
        d="M10.5 4.5 5.8 9.2a2 2 0 1 0 2.8 2.8l5-5a3.2 3.2 0 0 0-4.5-4.5l-5 5a4.4 4.4 0 0 0 6.2 6.2l4.2-4.2"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}

export function MenuIcon({ size = 18, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base} className={className}>
      <path d="M2 4.5h12M2 8h12M2 11.5h12" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function PanelIcon({ size = 16, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base} className={className}>
      <rect x="1.5" y="2.5" width="13" height="11" rx="1.3" stroke="currentColor" strokeWidth="1.2" />
      <path d="M10 2.5v11" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function ArrowUpIcon({ size = 15, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" {...base} className={className}>
      <path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
