import { useEffect, useRef } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAppState } from "@/state/store-context";
import { buildTodayView, todaySummary } from "@/state/selectors";
import { Icon, type IconName } from "@/components/primitives/Icon";
import { GlobalMiniTimer } from "./GlobalMiniTimer";

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/today", label: "Today", icon: "today" },
  { to: "/commitments", label: "Commitments", icon: "commitments" },
  { to: "/progress", label: "Progress", icon: "progress" },
  { to: "/settings", label: "Settings", icon: "settings" },
];

function Sidebar(): JSX.Element {
  return (
    <aside className="sidebar" aria-label="Primary">
      <div className="sidebar__brand">
        THE ARCHITECT
        <small>Build a better you</small>
      </div>
      <nav className="nav" aria-label="Sections">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} className="nav__link">
            <Icon name={item.icon} size={18} />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar__footer">
        <span className="eyebrow">Plan · Execute · Record · Repeat</span>
      </div>
    </aside>
  );
}

function BottomNav(): JSX.Element {
  return (
    <nav className="bottom-nav" aria-label="Primary">
      {NAV_ITEMS.map((item) => (
        <NavLink key={item.to} to={item.to} className="bottom-nav__item">
          <Icon name={item.icon} size={20} />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

function ContextRail(): JSX.Element {
  const { data, nowMs } = useAppState();
  const summary = data ? todaySummary(buildTodayView(data, nowMs)) : { completed: 0, total: 0 };
  return (
    <aside className="context-rail" aria-label="Current session">
      <span className="context-rail__title">Current session</span>
      <GlobalMiniTimer variant="rail" />
      <div className="hairline" />
      <div className="kpi">
        <span className="kpi__value numeric">
          {summary.completed} / {summary.total}
        </span>
        <span className="kpi__label">Completed today</span>
      </div>
    </aside>
  );
}

export function AppShell(): JSX.Element {
  const { status } = useAppState();
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // Move focus to the main region on route change (Blueprint §S).
    mainRef.current?.focus();
  }, [location.pathname]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <Sidebar />
      <main id="main-content" className="workspace" tabIndex={-1} ref={mainRef}>
        <div className="workspace__inner">
          {status === "SAFE_MODE" ? (
            <div className="banner banner--danger" role="alert">
              <Icon name="alert" size={18} />
              <span>
                Safe mode: a data integrity issue was detected. Your data is preserved and read-only.
                You can export it from Settings → Data.
              </span>
            </div>
          ) : null}
          <Outlet />
        </div>
      </main>
      <ContextRail />
      <BottomNav />
      <GlobalMiniTimer variant="mobile" />
    </div>
  );
}
