import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@/components/primitives/Icon";

export interface PageHeaderProps {
  title: string;
  eyebrow?: string;
  back?: { to: string; label: string };
  actions?: ReactNode;
}

export function PageHeader({ title, eyebrow, back, actions }: PageHeaderProps): JSX.Element {
  return (
    <header className="page-header">
      <div className="page-header__meta">
        {back ? (
          <Link className="back-link" to={back.to}>
            <Icon name="chevron-left" size={16} />
            {back.label}
          </Link>
        ) : null}
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <h1 className="page-title">{title}</h1>
      </div>
      {actions ? <div className="row gap-2 wrap">{actions}</div> : null}
    </header>
  );
}
