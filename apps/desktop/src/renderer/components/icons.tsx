import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function IconBase({ children, ...props }: IconProps & { children: React.ReactNode }): React.ReactElement {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function IconPanelLeft(props: IconProps): React.ReactElement {
  return (
    <IconBase {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="9" y1="4" x2="9" y2="20" />
    </IconBase>
  );
}

export function IconPanelRight(props: IconProps): React.ReactElement {
  return (
    <IconBase {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="15" y1="4" x2="15" y2="20" />
    </IconBase>
  );
}

export function IconCommand(props: IconProps): React.ReactElement {
  return (
    <IconBase {...props}>
      <path d="M15 6a3 3 0 1 1 3 3h-3V6Z" />
      <path d="M9 6a3 3 0 1 0-3 3h3V6Z" />
      <path d="M9 18a3 3 0 1 1-3-3h3v3Z" />
      <path d="M15 18a3 3 0 1 0 3-3h-3v3Z" />
      <path d="M9 9h6v6H9z" />
    </IconBase>
  );
}

export function IconMinimize(props: IconProps): React.ReactElement {
  return (
    <IconBase {...props}>
      <line x1="5" y1="12" x2="19" y2="12" />
    </IconBase>
  );
}

export function IconMaximize(props: IconProps): React.ReactElement {
  return (
    <IconBase {...props}>
      <rect x="5" y="5" width="14" height="14" rx="2" />
    </IconBase>
  );
}

export function IconClose(props: IconProps): React.ReactElement {
  return (
    <IconBase {...props}>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </IconBase>
  );
}

export function IconSearch(props: IconProps): React.ReactElement {
  return (
    <IconBase {...props}>
      <circle cx="11" cy="11" r="7" />
      <line x1="20" y1="20" x2="16.5" y2="16.5" />
    </IconBase>
  );
}

export function IconFolder(props: IconProps): React.ReactElement {
  return (
    <IconBase {...props}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
    </IconBase>
  );
}

export function IconFile(props: IconProps): React.ReactElement {
  return (
    <IconBase {...props}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
      <path d="M14 3v5h5" />
    </IconBase>
  );
}

export function IconActivity(props: IconProps): React.ReactElement {
  return (
    <IconBase {...props}>
      <path d="M3 12h4l2 6 4-14 2 8h6" />
    </IconBase>
  );
}

export function IconSparkles(props: IconProps): React.ReactElement {
  return (
    <IconBase {...props}>
      <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3Z" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" />
    </IconBase>
  );
}

export function IconSend(props: IconProps): React.ReactElement {
  return (
    <IconBase {...props}>
      <path d="M4 12l16-8-6 16-2.5-6L4 12Z" />
    </IconBase>
  );
}
