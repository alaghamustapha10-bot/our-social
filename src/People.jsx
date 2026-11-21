
import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { usePreferences } from "./PreferencesProvider";
import "./People.css";

export default function People({ user }) {
  const { preferences } = usePreferences();
  const isArabic = preferences.language === "ar";

  const [search, setSearch] = useState("");
  const [people, setPeople] = useState([]);
  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyIds, setBusyIds] = useState([]);
  const [notice, setNotice] = useState("");

  const t = {
    title: isArabic ? "اكتشف الأشخاص" : "Discover people",
    subtitle: isArabic
      ? "اعثر على أشخاص جدد وانضم إلى مجتمع LOLZ."
      : "Find interesting people and grow your community.",
    search: isArabic
      ? "ابحث بالاسم أو اسم المستخدم..."
      : "Search by name or username...",
    community: isArabic ? "المجتمع" : "Community",
    results: isArabic ? "نتائج البحث" : "Search results",
    suggestions: isArabic ? "أشخاص قد يعجبونك" : "People you may like",
    loading: isArabic ? "جارٍ التحميل..." : "Loading...",
    people: isArabic ? "شخص" : "people",
    empty: isArabic ? "لم يتم العثور على أشخاص" : "No people found",
    emptyText: isArabic
      ? "جرّب البحث باسم آخر أو اسم مستخدم مختلف."
      : "Try searching with another name or username.",
    everyone: isArabic ? "عرض الجميع" : "Show everyone",
    member: isArabic ? "عضو" : "Member",
    welcome: isArabic
      ? "مرحباً بك في مجتمع LOLZ."
      : "Welcome to the LOLZ community.",
    follow: isArabic ? "متابعة" : "Follow",
    following: isArabic ? "تتابعه" : "Following",
    wait: isArabic ? "انتظر..." : "Please wait...",
    loadError: isArabic
      ? "تعذر تحميل قائمة المتابَعين: "
      : "Could not load following list: ",
    searchError: isArabic ? "فشل البحث: " : "Search failed: ",
    followError: isArabic
      ? "تعذرت عملية المتابعة: "
      : "Follow action failed: ",
  };

  useEffect(() => {
    let cancelled = false;

    async function loadFollowing() {
      if (!user?.id) {
        setFollowing([]);
        return;
      }

      const { data, error } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id);

      if (cancelled) return;

      if (error) {
        setNotice(t.loadError + error.message);
        return;
      }

      setFollowing((data || []).map((item) => item.following_id));
    }

    loadFollowing();

    return () => {
      cancelled = true;
    };
  }, [user?.id, preferences.language]);

  useEffect(() => {
    let cancelled = false;

    async function searchPeople() {
      if (!user?.id) {
        setPeople([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setNotice("");

      let query = supabase
        .from("profiles")
        .select("id, username, display_name, full_name, avatar_url, bio")
        .neq("id", user.id)
        .limit(30);

      const term = search.trim().replace(
        /[^\p{L}\p{N}\s@._-]/gu,
        ""
      );

      if (term) {
        const pattern = `%${term}%`;

        query = query.or(
          `username.ilike.${pattern},display_name.ilike.${pattern},full_name.ilike.${pattern}`
        );
      } else {
        query = query.order("created_at", {
          ascending: false,
        });
      }

      const { data, error } = await query;

      if (cancelled) return;

      if (error) {
        setNotice(t.searchError + error.message);
        setPeople([]);
        setLoading(false);
        return;
      }

      setPeople(data || []);
      setLoading(false);
    }

    const timer = setTimeout(searchPeople, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, user?.id, preferences.language]);

  async function toggleFollow(personId) {
    if (!user?.id || busyIds.includes(personId)) return;

    const isFollowing = following.includes(personId);

    setBusyIds((current) => [...current, personId]);
    setNotice("");

    const result = isFollowing
      ? await supabase
          .from("follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", personId)
      : await supabase
          .from("follows")
          .insert({
            follower_id: user.id,
            following_id: personId,
          });

    if (result.error) {
      setNotice(t.followError + result.error.message);
    } else {
      setFollowing((current) =>
        isFollowing
          ? current.filter((id) => id !== personId)
          : [...current, personId]
      );
    }

    setBusyIds((current) =>
      current.filter((id) => id !== personId)
    );
  }

  return (
    <section className="people-page" dir={isArabic ? "rtl" : "ltr"}>
      <header className="people-header">
        <div>
          <h1>{t.title}</h1>
          <p>{t.subtitle}</p>
        </div>
      </header>

      <div className="people-search">
        <span className="people-search-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <circle cx="10.8" cy="10.8" r="6.8" />
            <path d="m16 16 4.2 4.2" />
          </svg>
        </span>

        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t.search}
          aria-label={t.search}
        />

        {search && (
          <button
            type="button"
            className="people-clear-search"
            onClick={() => setSearch("")}
            aria-label={isArabic ? "مسح البحث" : "Clear search"}
          >
            ×
          </button>
        )}
      </div>

      {notice && (
        <div className="people-notice" role="alert">
          {notice}
        </div>
      )}

      <div className="people-results-heading">
        <h2>{search.trim() ? t.results : t.suggestions}</h2>
        <span>
          {loading ? t.loading : `${people.length} ${t.people}`}
        </span>
      </div>

      {loading ? (
        <div className="people-list">
          {Array.from({ length: 6 }).map((_, index) => (
            <div className="people-skeleton" key={index}>
              <div className="skeleton-avatar" />
              <div className="skeleton-details">
                <div className="skeleton-line skeleton-name" />
                <div className="skeleton-line skeleton-bio" />
              </div>
              <div className="skeleton-button" />
            </div>
          ))}
        </div>
      ) : people.length === 0 ? (
        <div className="people-empty">
          <div className="people-empty-icon">⌕</div>
          <h3>{t.empty}</h3>
          <p>{t.emptyText}</p>

          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="people-reset-button"
            >
              {t.everyone}
            </button>
          )}
        </div>
      ) : (
        <div className="people-list">
          {people.map((person) => {
            const name =
              person.display_name ||
              person.full_name ||
              person.username ||
              t.member;

            const isFollowing = following.includes(person.id);
            const isBusy = busyIds.includes(person.id);

            return (
              <article className="person-card" key={person.id}>
                <div className="person-avatar">
                  {person.avatar_url ? (
                    <img
                      src={person.avatar_url}
                      alt={name}
                      loading="lazy"
                      onError={(event) => {
                        event.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <span>{name.charAt(0).toUpperCase()}</span>
                  )}
                </div>

                <div className="person-details">
                  <h3 title={name}>{name}</h3>
                  <span className="person-username">
                    @{person.username || "member"}
                  </span>

                  {person.bio?.trim() && (
                    <p className="person-bio">{person.bio}</p>
                  )}
                </div>

                <button
                  type="button"
                  className={`person-follow ${isFollowing ? "following" : ""}`}
                  onClick={() => toggleFollow(person.id)}
                  disabled={isBusy}
                >
                  {isBusy
                    ? t.wait
                    : isFollowing
                    ? t.following
                    : t.follow}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
