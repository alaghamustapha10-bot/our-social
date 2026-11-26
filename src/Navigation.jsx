import {
  Home,
  Search,
  Clapperboard,
  MessageCircle,
  Heart,
  UserRound,
  Users,
  UsersRound,
  Radio,
  PlusSquare,
  LogOut,
  MoreHorizontal,
  X,
  Settings,
  Crown,
  Bookmark,
} from "lucide-react";
import { useState } from "react";
import "./Navigation.css";

const COPY = {
  ar: {
    home: "الرئيسية",
    explore: "استكشاف",
    reels: "LOLZ",
    messages: "الرسائل",
    notifications: "الإشعارات",
    profile: "الملف الشخصي",
    create: "إنشاء",
    more: "المزيد",
    people: "الأشخاص",
    saved: "المحفوظات",
    groups: "المجموعات",
    channels: "القنوات",
    premium: "LOLZ Premium",
    settings: "الإعدادات",
    logout: "تسجيل الخروج",
    close: "إغلاق",
  },
  en: {
    home: "Home",
    explore: "Explore",
    reels: "LOLZ",
    messages: "Messages",
    notifications: "Notifications",
    profile: "Profile",
    create: "Create",
    more: "More",
    people: "People",
    saved: "Saved",
    groups: "Groups",
    channels: "Channels",
    premium: "LOLZ Premium",
    settings: "Settings",
    logout: "Log out",
    close: "Close",
  },
};

function getLocale() {
  if (typeof document === "undefined") return "en";
  const lang = (document.documentElement.lang || "en").toLowerCase();
  return lang.startsWith("ar") || document.documentElement.dir === "rtl" ? "ar" : "en";
}

export default function Navigation({ page, setPage, onCreate, onLogout, username }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const t = COPY[getLocale()];
  const safeUsername = username || (getLocale() === "ar" ? "مستخدم" : "User");

  const primaryItems = [
    { id: "home", label: t.home, icon: Home },
    { id: "discover", label: t.explore, icon: Search },
    { id: "lolz", label: t.reels, icon: Clapperboard },
    { id: "messages", label: t.messages, icon: MessageCircle },
    { id: "activity", label: t.notifications, icon: Heart },
    { id: "profile", label: t.profile, icon: UserRound },
  ];

  const secondaryItems = [
    { id: "people", label: t.people, icon: Users },
    { id: "saved", label: t.saved, icon: Bookmark },
    { id: "groups", label: t.groups, icon: UsersRound },
    { id: "channels", label: t.channels, icon: Radio },
    { id: "premium", label: t.premium, icon: Crown },
    { id: "settings", label: t.settings, icon: Settings },
  ];

  const mobileItems = [
    { id: "home", label: t.home, icon: Home },
    { id: "discover", label: t.explore, icon: Search },
    { id: "create", label: t.create, icon: PlusSquare },
    { id: "lolz", label: t.reels, icon: Clapperboard },
    { id: "profile", label: t.profile, icon: UserRound },
  ];

  function selectPage(id) {
    setPage(id);
    setMoreOpen(false);
  }

  function renderItem(item, mobile) {
    const Icon = item.icon;
    const active = page === item.id;
    return (
      <button
        key={item.id}
        type="button"
        className={"os-link" + (active ? " active" : "") + (mobile ? " mobile-link" : "")}
        onClick={() => {
          if (item.id === "create") {
            setMoreOpen(false);
            onCreate?.();
          } else {
            selectPage(item.id);
          }
        }}
        aria-current={active ? "page" : undefined}
        aria-label={item.label}
        title={item.label}
      >
        <Icon aria-hidden="true" />
        <span>{item.label}</span>
      </button>
    );
  }

  return (
    <>
      {moreOpen && (
        <button
          className="os-more-backdrop"
          type="button"
          aria-label={t.close}
          onClick={() => setMoreOpen(false)}
        />
      )}

      <aside className="os-sidebar">
        <button className="os-brand" type="button" onClick={() => selectPage("home")}>
          <span className="os-logo">L</span>
          <span className="os-brand-name">LOLZ</span>
        </button>

        <nav className="os-navigation-view" aria-label="Main navigation">
          {primaryItems.map((item) => renderItem(item, false))}
          <button
            className="os-link os-create-link"
            type="button"
            onClick={() => onCreate?.()}
          >
            <PlusSquare aria-hidden="true" />
            <span>{t.create}</span>
          </button>
        </nav>

        <div className="os-sidebar-bottom">
          <button
            type="button"
            className={"os-link os-more-toggle" + (moreOpen ? " active" : "")}
            onClick={() => setMoreOpen((value) => !value)}
            aria-expanded={moreOpen}
          >
            {moreOpen ? <X aria-hidden="true" /> : <MoreHorizontal aria-hidden="true" />}
            <span>{t.more}</span>
          </button>

          {moreOpen && (
            <div className="os-more-menu">
              {secondaryItems.map((item) => renderItem(item, false))}
              <button type="button" className="os-link os-logout" onClick={() => { setMoreOpen(false); onLogout?.(); }}>
                <LogOut aria-hidden="true" />
                <span>{t.logout}</span>
              </button>
            </div>
          )}

          <button className="os-user" type="button" onClick={() => selectPage("profile")}>
            <span className="os-avatar">{safeUsername.charAt(0).toUpperCase()}</span>
            <span className="os-user-name">{safeUsername}</span>
          </button>
        </div>
      </aside>

      <nav className="os-mobile-nav" aria-label="Mobile navigation">
        {mobileItems.map((item) => renderItem(item, true))}
        <button
          type="button"
          className={"os-link mobile-link os-mobile-more" + (moreOpen ? " active" : "")}
          onClick={() => setMoreOpen((value) => !value)}
          aria-label={t.more}
          aria-expanded={moreOpen}
        >
          {moreOpen ? <X aria-hidden="true" /> : <MoreHorizontal aria-hidden="true" />}
        </button>
      </nav>

      {moreOpen && (
        <div className="os-mobile-more-panel">
          {secondaryItems.map((item) => renderItem(item, true))}
          <button type="button" className="os-link mobile-link" onClick={() => { setMoreOpen(false); onLogout?.(); }}>
            <LogOut aria-hidden="true" />
            <span>{t.logout}</span>
          </button>
        </div>
      )}
    </>
  );
}
