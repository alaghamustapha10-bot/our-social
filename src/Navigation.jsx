
import React from "react";
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
  ArrowLeft,
  ChevronRight,
  Users2,
  LayoutGrid,
} from "lucide-react";

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
  { id: "settings", label: "Settings", icon: Settings },
];

const mobileNavigationItems = [
  "home",
  "discover",
  "lolz",
  "messages",
  "activity",
  "profile",
];

const allItems = [
  ...mainItems,
  ...communityItems,
  ...connectionItems,
  ...accountItems,
];

export default function Navigation({
  page,
  setPage,
  onCreate,
  onLogout,
  username = "Your profile",
}) {
  const [expanded, setExpanded] = React.useState(false);
  const [view, setView] = React.useState("main");

  const safeUsername =
    typeof username === "string" && username.trim()
      ? username.trim()
      : "Your profile";

  const isCommunityPage = communityItems.some(
    (item) => item.id === page
  );

  const closeMenu = () => {
    setExpanded(false);
    setView("main");
  };

  const changePage = (id) => {
    setPage(id);
    closeMenu();
  };

  const openCommunity = () => {
    setView("community");
  };

  const renderLink = (item) => {
    const Icon = item.icon;
    const active = page === item.id;

    return (
      <button
        key={item.id}
        type="button"
        className={`os-link ${active ? "active" : ""}`}
        onClick={() => changePage(item.id)}
        aria-current={active ? "page" : undefined}
      >
        <Icon size={20} aria-hidden="true" />
        <span>{item.label}</span>
        {active && <i aria-hidden="true" />}
      </button>
    );
  };

  return (
    <>
      {expanded && (
        <button
          type="button"
          className="os-sidebar-backdrop"
          onClick={closeMenu}
          aria-label="Close navigation menu"
        />
      )}

      <aside
        className={`os-sidebar ${expanded ? "expanded" : ""} ${
          view === "community" ? "community-view" : ""
        }`}
        aria-label="Main navigation"
      >
        {/* BRAND */}
        <div className="os-brand">
          <div className="os-logo">L</div>
          <span className="os-brand-name">LOLZ</span>

          <button
            type="button"
            className="os-collapse"
            onClick={() => {
              if (view === "community") {
                setView("main");
              } else {
                setExpanded((previous) => !previous);
              }
            }}
            aria-label={expanded ? "Close menu" : "Open menu"}
          >
            {expanded ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>

        {/* MAIN NAVIGATION */}
        {view === "main" && (
          <div className="os-navigation-view">
            <div className="os-nav-heading">
              <span className="os-nav-eyebrow">YOUR SPACE</span>
              <span className="os-nav-description">
                Everything in one place
              </span>
            </div>

            <nav className="os-links">
              {mainItems.map(renderLink)}
            </nav>

            {/* COMMUNITY ENTRY */}
            <div className="os-nav-section">
              <span className="os-nav-eyebrow">COMMUNITY</span>

              <button
                type="button"
                className={`os-link os-category-link ${
                  isCommunityPage ? "active" : ""
                }`}
                onClick={openCommunity}
                aria-label="Open Community"
              >
                <Users2 size={20} aria-hidden="true" />
                <span>Community</span>
                <ChevronRight
                  className="os-category-arrow"
                  size={18}
                  aria-hidden="true"
                />
              </button>
            </div>

            {/* CONNECTIONS */}
            <div className="os-nav-section">
              <span className="os-nav-eyebrow">CONNECTIONS</span>

              <nav className="os-links">
                {connectionItems.map(renderLink)}
              </nav>
            </div>

            {/* ACCOUNT */}
            <div className="os-nav-section">
              <span className="os-nav-eyebrow">ACCOUNT</span>

              <nav className="os-links">
                {accountItems.map(renderLink)}
              </nav>
            </div>
          </div>
        )}

        {/* COMMUNITY SUBPAGE */}
        {view === "community" && (
          <div className="os-navigation-view os-community-view">
            <button
              type="button"
              className="os-back-button"
              onClick={() => setView("main")}
            >
              <ArrowLeft size={18} aria-hidden="true" />
              <span>Back to menu</span>
            </button>

            <div className="os-community-heading">
              <div className="os-community-icon">
                <Users2 size={25} />
              </div>

              <div>
                <span className="os-nav-eyebrow">EXPLORE TOGETHER</span>
                <h2>Community</h2>
                <p>Connect with people and communities.</p>
              </div>
            </div>

            <div className="os-community-options">
              {communityItems.map((item) => {
                const Icon = item.icon;
                const active = page === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`os-community-option ${
                      active ? "active" : ""
                    }`}
                    onClick={() => changePage(item.id)}
                    aria-current={active ? "page" : undefined}
                  >
                    <span className="os-community-option-icon">
                      <Icon size={22} aria-hidden="true" />
                    </span>

                    <span className="os-community-option-content">
                      <strong>{item.label}</strong>
                      <small>{item.description}</small>
                    </span>

                    <ChevronRight
                      size={18}
                      className="os-community-option-arrow"
                      aria-hidden="true"
                    />
                  </button>
                );
              })}
            </div>

            <div className="os-community-footer">
              <LayoutGrid size={17} />
              <span>Your community, your space.</span>
            </div>
          </div>
        )}

        {/* SIDEBAR BOTTOM */}
        <div className="os-sidebar-bottom">
          <button
            type="button"
            className="os-create"
            onClick={() => {
              closeMenu();
              onCreate?.();
            }}
          >
            <PlusSquare size={20} aria-hidden="true" />
            <span>Create Post</span>
          </button>

          <button
            type="button"
            className="os-user"
            onClick={() => changePage("profile")}
          >
            <div className="os-avatar" aria-hidden="true">
              {safeUsername.charAt(0).toUpperCase()}
            </div>
            <span title={safeUsername}>{safeUsername}</span>
          </button>

          <button
            type="button"
            className="os-logout"
            onClick={() => {
              closeMenu();
              onLogout?.();
            }}
          >
            <LogOut size={19} aria-hidden="true" />
            <span>Log out</span>
          </button>
        </div>
      </aside>

      {/* MOBILE NAVIGATION */}
      <nav className="os-mobile-nav" aria-label="Mobile navigation">
        <button
          type="button"
          className="os-mobile-menu-button"
          onClick={() => {
            setView("main");
            setExpanded(true);
          }}
          aria-label="Open navigation menu"
        >
          <Menu aria-hidden="true" />
        </button>

        {mobileNavigationItems.map((id) => {
          const item = allItems.find((entry) => entry.id === id);
          if (!item) return null;

          const Icon = item.icon;
          const active = page === item.id;

          return (
            <button
              key={id}
              type="button"
              className={active ? "active" : ""}
              onClick={() => changePage(id)}
              aria-label={item.label}
              title={item.label}
              aria-current={active ? "page" : undefined}
            >
              <Icon aria-hidden="true" />
            </button>
          );
        })}
      </nav>
    </>
  );
}
