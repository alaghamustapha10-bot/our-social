
import {
  Home,
  Compass,
  Clapperboard,
  MessageCircle,
  Bell,
  UserRound,
  Users,
  UsersRound,
  Radio,
  PlusSquare,
  LogOut,
  Menu,
  X,
  Settings,
  Crown,
} from "lucide-react";

import { useState } from "react";
import "./Navigation.css";

const mainItems = [
  { id: "home", label: "Home", icon: Home },
  { id: "discover", label: "Explore", icon: Compass },
  { id: "lolz", label: "LOLZ", icon: Clapperboard },
];

const communityItems = [
  {
    id: "people",
    label: "People",
    description: "Find people and make connections",
    icon: Users,
  },
  {
    id: "groups",
    label: "Groups",
    description: "Join communities and conversations",
    icon: UsersRound,
  },
  {
    id: "channels",
    label: "Channels",
    description: "Explore channels and updates",
    icon: Radio,
  },
];

const connectionItems = [
  { id: "messages", label: "Messages", icon: MessageCircle },
  { id: "activity", label: "Notifications", icon: Bell },
];

const accountItems = [
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "premium", label: "LOLZ Premium", icon: Crown },
  { id: "settings", label: "Settings", icon: Settings },
];

const mobileNavigationItems = [
  { id: "home", label: "Home", icon: Home },
  { id: "lolz", label: "LOLZ", icon: Clapperboard },
  { id: "messages", label: "Messages", icon: MessageCircle },
  { id: "activity", label: "Notifications", icon: Bell },
];

export default function Navigation({
  page,
  setPage,
  onCreate,
  onLogout,
  username,
}) {
  const [expanded, setExpanded] = useState(false);

  const safeUsername = username || "User";

  const closeMenu = () => {
    setExpanded(false);
  };

  const changePage = (id) => {
    setPage(id);
    closeMenu();
  };

  const renderLink = (item) => {
    const Icon = item.icon;

    return (
      <button
        key={item.id}
        type="button"
        className={`os-link ${page === item.id ? "active" : ""}`}
        onClick={() => changePage(item.id)}
        aria-current={page === item.id ? "page" : undefined}
      >
        <Icon />
        <span>{item.label}</span>
        {page === item.id && <i />}
      </button>
    );
  };

  return (
    <>
      {expanded && (
        <button
          type="button"
          className="os-sidebar-backdrop"
          aria-label="Close navigation menu"
          onClick={closeMenu}
        />
      )}

      <aside className={`os-sidebar ${expanded ? "expanded" : ""}`}>
        <div className="os-brand">
          <div className="os-logo">L</div>

          <span className="os-brand-name">LOLZ</span>

          <button
            type="button"
            className="os-collapse"
            onClick={closeMenu}
            aria-label="Close menu"
          >
            <X />
          </button>
        </div>

        <div className="os-navigation-view">
          <div className="os-nav-section">
            <span className="os-nav-eyebrow">MAIN MENU</span>

            <div className="os-links">
              {mainItems.map(renderLink)}
            </div>
          </div>

          <div className="os-nav-section">
            <span className="os-nav-eyebrow">COMMUNITY</span>

            <div className="os-links">
              {communityItems.map(renderLink)}
            </div>
          </div>

          <div className="os-nav-section">
            <span className="os-nav-eyebrow">CONNECTIONS</span>

            <div className="os-links">
              {connectionItems.map(renderLink)}
            </div>
          </div>

          <div className="os-nav-section">
            <span className="os-nav-eyebrow">ACCOUNT</span>

            <div className="os-links">
              {accountItems.map(renderLink)}
            </div>
          </div>
        </div>

        <div className="os-sidebar-bottom">
          <button
            type="button"
            className="os-create"
            onClick={() => {
              closeMenu();
              onCreate?.();
            }}
          >
            <PlusSquare size={19} />
            <span>Create Post</span>
          </button>

          <button
            type="button"
            className="os-user"
            onClick={() => changePage("profile")}
          >
            <div className="os-avatar">
              {safeUsername.charAt(0).toUpperCase()}
            </div>

            <span>{safeUsername}</span>
          </button>

          <button
            type="button"
            className="os-logout"
            onClick={() => {
              closeMenu();
              onLogout?.();
            }}
          >
            <LogOut size={18} />
            <span>Log out</span>
          </button>
        </div>
      </aside>

      <nav className="os-mobile-nav" aria-label="Mobile navigation">
        {mobileNavigationItems.map((item) => {
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              type="button"
              className={page === item.id ? "active" : ""}
              onClick={() => changePage(item.id)}
              aria-label={item.label}
              title={item.label}
              aria-current={page === item.id ? "page" : undefined}
            >
              <Icon />
            </button>
          );
        })}

        <button
          type="button"
          className={expanded ? "active" : ""}
          onClick={() => setExpanded((current) => !current)}
          aria-label="More navigation options"
          title="More"
          aria-expanded={expanded}
        >
          {expanded ? <X /> : <Menu />}
        </button>
      </nav>
    </>
  );
}
