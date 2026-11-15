
import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import "./People.css";

export default function People({ user }) {
  const [search, setSearch] = useState("");
  const [people, setPeople] = useState([]);
  const [following, setFollowing] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyIds, setBusyIds] = useState([]);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    loadFollowing();
  }, [user?.id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchPeople();
    }, 350);

    return () => clearTimeout(timer);
  }, [search, user?.id]);

  async function loadFollowing() {
    if (!user) return;

    const { data, error } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", user.id);

    if (error) {
      setNotice("Could not load following list: " + error.message);
      return;
    }

    setFollowing((data || []).map((item) => item.following_id));
  }

  async function searchPeople() {
    if (!user) return;

    setLoading(true);
    setNotice("");

    let query = supabase
      .from("profiles")
      .select("id, username, display_name, full_name, avatar_url, bio")
      .neq("id", user.id)
      .limit(20);

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
      query = query.order("created_at", { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
      setNotice("Search failed: " + error.message);
      setPeople([]);
      setLoading(false);
      return;
    }

    setPeople(data || []);
    setLoading(false);
  }

  async function toggleFollow(personId) {
    if (!user || busyIds.includes(personId)) return;

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
      setNotice("Follow action failed: " + result.error.message);
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
    <section className="people-page">
      <div className="people-heading">
        <span className="eyebrow">FIND YOUR COMMUNITY</span>
        <h1>Discover people</h1>
        <p>Find friends and connect with your community.</p>
      </div>

      <div className="people-search">
        <span>⌕</span>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name or username..."
        />
      </div>

      {notice && (
        <div className="people-notice">{notice}</div>
      )}

      <div className="people-results-heading">
        <h2>{search.trim() ? "Search results" : "People to discover"}</h2>
        <span>{people.length} people</span>
      </div>

      {loading ? (
        <div className="people-empty">Searching...</div>
      ) : people.length === 0 ? (
        <div className="people-empty">
          <span>✦</span>
          <h3>No people found</h3>
          <p>Try another name or username.</p>
        </div>
      ) : (
        <div className="people-grid">
          {people.map((person) => {
            const name =
              person.display_name ||
              person.full_name ||
              person.username ||
              "Member";

            const isFollowing = following.includes(person.id);
            const isBusy = busyIds.includes(person.id);

            return (
              <article className="person-card" key={person.id}>
                <div className="person-avatar">
                  {person.avatar_url ? (
                    <img src={person.avatar_url} alt="" />
                  ) : (
                    <span>{name.charAt(0).toUpperCase()}</span>
                  )}
                </div>

                <h3>{name}</h3>
                <span className="person-username">
                  @{person.username || "member"}
                </span>

                <p className="person-bio">
                  {person.bio || "OUR SOCIAL community member"}
                </p>

                <button
                  className={`person-follow ${
                    isFollowing ? "following" : ""
                  }`}
                  onClick={() => toggleFollow(person.id)}
                  disabled={isBusy}
                >
                  {isBusy
                    ? "Please wait..."
                    : isFollowing
                    ? "Following"
                    : "Follow"}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
