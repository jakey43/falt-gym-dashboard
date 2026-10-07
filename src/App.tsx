import { HashRouter, Link, NavLink, Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { StoreProvider, useStore } from "./lib/store";
import { IconBowl, IconDumbbell, IconHome, IconSearch, IconSettings, IconTrend } from "./components/icons";
import Overview from "./pages/Overview";
import Training from "./pages/Training";
import Nutrition from "./pages/Nutrition";
import FoodQuery from "./pages/FoodQuery";
import Progress from "./pages/Progress";
import DataPage from "./pages/DataPage";

const TABS = [
  { to: "/", label: "Översikt", icon: IconHome, end: true },
  { to: "/traning", label: "Träning", icon: IconDumbbell },
  { to: "/kost", label: "Kost", icon: IconBowl },
  { to: "/mat", label: "Matfråga", icon: IconSearch },
  { to: "/progress", label: "Progress", icon: IconTrend },
];

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return null;
}

function Shell() {
  const { loaded, data } = useStore();
  return (
    <div className="app">
      <ScrollTop />
      <header className="topbar">
        <Link to="/" className="brand" aria-label="Fält – till översikten">
          <span className="brand-dots" aria-hidden="true">
            <span style={{ background: "var(--green)" }} />
            <span style={{ background: "var(--yellow)" }} />
            <span style={{ background: "var(--blue)" }} />
            <span style={{ background: "var(--orange)" }} />
          </span>
          <span className="brand-name">Fält</span>
        </Link>
        <div className="row">
          {data.settings.isDemo && (
            <Link to="/data" className="tag" style={{ background: "var(--pink-soft)", textDecoration: "none" }}>
              Exempeldata
            </Link>
          )}
          <NavLink to="/data" className="icon-btn" aria-label="Data och inställningar">
            <IconSettings />
          </NavLink>
        </div>
      </header>
      <main>
        {loaded ? (
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/traning" element={<Training />} />
            <Route path="/kost" element={<Nutrition />} />
            <Route path="/mat" element={<FoodQuery />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/data" element={<DataPage />} />
          </Routes>
        ) : (
          <p className="muted">Laddar…</p>
        )}
      </main>
      <nav className="tabbar" aria-label="Huvudmeny">
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `tab${isActive ? " active" : ""}`}>
            <Icon />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <HashRouter>
        <Shell />
      </HashRouter>
    </StoreProvider>
  );
}
