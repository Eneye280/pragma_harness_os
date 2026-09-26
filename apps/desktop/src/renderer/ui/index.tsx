import { cn } from "../lib/cn";

type DivProps = React.HTMLAttributes<HTMLDivElement>;

export function Panel({ className, ...props }: DivProps): React.ReactElement {
  return <div className={cn("floating-panel", className)} {...props} />;
}

export function Card({ className, ...props }: DivProps): React.ReactElement {
  return <div className={cn("card", className)} {...props} />;
}

export function Sheet({ className, ...props }: DivProps): React.ReactElement {
  return <div className={cn("sheet", className)} {...props} />;
}

export function FloatingToolbar({ className, ...props }: DivProps): React.ReactElement {
  return <div className={cn("floating-toolbar", className)} {...props} />;
}
