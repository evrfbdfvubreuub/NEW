// Original architectural line art (Blueprint §Q6). No external assets.
export function ArchitectArt({ size = 132 }: { size?: number }): JSX.Element {
  return (
    <svg
      className="onboarding__art"
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M10 96h100" stroke="var(--line-strong)" />
      <path d="M60 18 96 54M60 18 24 54" />
      <path d="M32 54v42M88 54v42M32 96h56" />
      <path d="M32 54h56" strokeDasharray="3 4" opacity="0.7" />
      <path d="M44 96V72h16v24M68 96V66h12v30" />
      <path d="M44 60h8M60 60h8" opacity="0.6" />
      <circle cx="60" cy="18" r="2" fill="var(--action)" stroke="none" />
      <path d="M60 18V6" stroke="var(--line)" strokeDasharray="2 3" />
    </svg>
  );
}
