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

const NAV_COPY = {
  ar: {
    brandName: "LOLZ",
    mainMenu: "القائمة الرئيسية",
    community: "المجتمع",
    connections: "التواصل",
    account: "الحساب",
    home: "الرئيسية",
    discover: "استكشف",
    lolz: "LOLZ",
    people: "الأشخاص",
    peopleDesc: "اكتشف الأشخاص وتواصل معهم",
    groups: "المجموعات",
    groupsDesc: "انضم إلى المجموعات والمحادثات الجماعية",
    channels: "القنوات",
    channelsDesc: "تابع القنوات والتحديثات المباشرة",
    messages: "الرسائل",
    activity: "الإشعارات",
    profile: "الملف الشخصي",
    premium: "LOLZ Premium",
    settings: "الإعدادات",
    createPost: "إنشاء منشور",
    logout: "تسجيل الخروج",
    closeMenu: "إغلاق القائمة",
    more: "المزيد",
    moreAria: "خيارات التنقل الإضافية",
    defaultUser: "مستخدم",
  },
  en: {
    brandName: "LOLZ",
    mainMenu: "MAIN MENU",
    community: "COMMUNITY",
    connections: "CONNECTIONS",
    account: "ACCOUNT",
    home: "Home",
    discover: "Explore",
    lolz: "LOLZ",
    people: "People",
    peopleDesc: "Find people and make connections",
    groups: "Groups",
    groupsDesc: "Join communities and conversations",
    channels: "Channels",
    channelsDesc: "Explore channels and updates",
    messages: "Messages",
    activity: "Notifications",
    profile: "Profile",
    premium: "LOLZ Premium",
    settings: "Settings",
    createPost: "Create Post",
    logout: "Log out",
    closeMenu: "Close menu",
    more: "More",
    moreAria: "More navigation options",
    defaultUser: "User",
  },
};

function getLocale() {
  if (typeof document !== "undefined") {
    const lang = (document.documentElement.lang || "").toLowerCase();
    const dir = (document.documentElement.dir || "").toLowerCase();
    if (dir === "rtl" || lang.startsWith("ar")) {
      return "ar";
    }
    if (lang.startsWith("en")) {
      return "en";
    }
  }
  return "ar";
}

export default function Navigation({
  page,
  setPage,
  onCreate,
  onLogout,
  username,
}) {
  const [expanded, setExpanded] = useState(false);

  const locale = getLocale();
  const t = NAV_COPY[locale] || NAV_COPY.ar;

  const mainItems = [
    { id: "home", label: t.home, icon: Home },
    { id: "discover", label: t.discover, icon: Compass },
    { id: "lolz", label: t.lolz, icon: Clapperboard },
  ];

  const communityItems = [
    {
      id: "people",
      label: t.people,
      description: t.peopleDesc,
      icon: Users,
    },
    {
      id: "groups",
      label: t.groups,
      description: t.groupsDesc,
      icon: UsersRound,
    },
    {
      id: "channels",
      label: t.channels,
      description: t.channelsDesc,
      icon: Radio,
    },
  ];

  const connectionItems = [
    { id: "messages", label: t.messages, icon: MessageCircle },
    { id: "activity", label: t.activity, icon: Bell },
  ];

  const accountItems = [
    { id: "profile", label: t.profile, icon: UserRound },
    { id: "premium", label: t.premium, icon: Crown },
    { id: "settings", label: t.settings, icon: Settings },
  ];

  const mobileNavigationItems = [
    { id: "home", label: t.home, icon: Home },
    { id: "discover", label: t.discover, icon: Compass },
    { id: "lolz", label: t.lolz, icon: Clapperboard },
    { id: "messages", label: t.messages, icon: MessageCircle },
  ];

  const safeUsername = username || t.defaultUser;

  const closeMenu = () => {
    setExpanded(false);
  };

  const changePage = (id) => {
    setPage(id);
    closeMenu();
  };

  const renderLink = (item) => {
    const Icon = item.icon;
    const isActive = page === item.id;

    return (
      <button
        key={item.id}
        type="button"
        className={`os-link ${isActive ? "active" : ""}`}
        onClick={() => changePage(item.id)}
        aria-current={isActive ? "page" : undefined}
      >
        <Icon />
        <span>{item.label}</span>
        {isActive && <i aria-hidden="true" />}
      </button>
    );
  };

  return (
    <>
      {expanded && (
        <button
          type="button"
          className="os-sidebar-backdrop"
          aria-label={t.closeMenu}
          onClick={closeMenu}
        />
      )}

      <aside className={`os-sidebar ${expanded ? "expanded" : ""}`}>
        <div className="os-brand">
          <div className="os-logo">L</div>

          <span className="os-brand-name">{t.brandName}</span>

          <button
            type="button"
            className="os-collapse"
            onClick={closeMenu}
            aria-label={t.closeMenu}
          >
            <X />
          </button>
        </div>

        <div className="os-navigation-view">
          <div className="os-nav-section">
            <span className="os-nav-eyebrow">{t.mainMenu}</span>

            <div className="os-links">
              {mainItems.map(renderLink)}
            </div>
          </div>

          <div className="os-nav-section">
            <span className="os-nav-eyebrow">{t.community}</span>

            <div className="os-links">
              {communityItems.map(renderLink)}
            </div>
          </div>

          <div className="os-nav-section">
            <span className="os-nav-eyebrow">{t.connections}</span>

            <div className="os-links">
              {connectionItems.map(renderLink)}
            </div>
          </div>

          <div className="os-nav-section">
            <span className="os-nav-eyebrow">{t.account}</span>

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
            <span>{t.createPost}</span>
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
            <span>{t.logout}</span>
          </button>
        </div>
      </aside>

      <nav className="os-mobile-nav" aria-label="Mobile navigation">
        {mobileNavigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = page === item.id;

          return (
            <button
              key={item.id}
              type="button"
              className={isActive ? "active" : ""}
              onClick={() => changePage(item.id)}
              aria-label={item.label}
              title={item.label}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon />
            </button>
          );
        })}

        <button
          type="button"
          className="os-mobile-create"
          onClick={() => {
            closeMenu();
            onCreate?.();
          }}
          aria-label={t.createPost}
          title={t.createPost}
        >
          <PlusSquare />
        </button>

        <button
          type="button"
          className={expanded ? "active" : ""}
          onClick={() => setExpanded((current) => !current)}
          aria-label={t.moreAria}
          title={t.more}
          aria-expanded={expanded}
        >
          {expanded ? <X /> : <Menu />}
        </button>
      </nav>
    </>
  );
}
