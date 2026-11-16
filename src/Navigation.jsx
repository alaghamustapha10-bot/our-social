
import React from "react";
import {
  Home,
  Compass,
  Clapperboard,
  MessageCircle,
  Bell,
  UserRound,
  Users,
  PlusSquare,
  LogOut,
  Menu,
  X,
  Settings,
} from "lucide-react";
import "./Navigation.css";

const navigationItems = [
  { id: "home", label: "Home", icon: Home },
  { id: "discover", label: "Explore", icon: Compass },
  { id: "people", label: "People", icon: Users },
  { id: "lolz", label: "LOLZ", icon: Clapperboard },
  { id: "messages", label: "Messages", icon: MessageCircle },
  { id: "activity", label: "Notifications", icon: Bell },
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "settings", label: "Settings", icon: Settings },
];

export default function Navigation({
  page,
  setPage,
  onCreate,
  onLogout,
  username = "Your profile",
}) {
  const [expanded, setExpanded] = React.useState(false);

  const changePage = (id) => {
    setPage(id);
    setExpanded(false);
  };

  return (
    <>
      <aside className={`os-sidebar ${expanded ? "expanded" : ""}`}>
        <div className="os-brand">
          <div className="os-logo">O</div>
          <span>OUR SOCIAL</span>
          <button
            className="os-collapse"
            onClick={() => setExpanded(!expanded)}
            aria-label="Toggle menu"
          >
            {expanded ? <X /> : <Menu />}
          </button>
        </div>

        <div className="os-nav-label">MENU</div>

        <nav className="os-links">
          {navigationItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`os-link ${page === id ? "active" : ""}`}
              onClick={() => changePage(id)}
            >
              <Icon size={21} />
              <span>{label}</span>
              {page === id && <i />}
            </button>
          ))}
        </nav>

        <div className="os-sidebar-bottom">
          <button className="os-create" onClick={onCreate}>
            <PlusSquare size={21} />
            <span>Create post</span>
          </button>

          <div className="os-user">
            <div className="os-avatar">
              {username.charAt(0).toUpperCase()}
            </div>
            <span>{username}</span>
          </div>

          <button className="os-logout" onClick={onLogout}>
            <LogOut size={19} />
            <span>Log out</span>
          </button>
        </div>
      </aside>

      <nav className="os-mobile-nav">
        {[
          navigationItems[0],
          navigationItems[1],
          navigationItems[2],
          navigationItems[3],
          navigationItems[4],
          navigationItems[6],
          navigationItems[7],
        ].map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            className={page === id ? "active" : ""}
            onClick={() => changePage(id)}
            aria-label={label}
          >
            <Icon size={23} />
          </button>
        ))}
      </nav>
    </>
  );
}
