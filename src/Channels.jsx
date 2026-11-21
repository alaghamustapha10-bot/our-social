
import { useCallback, useEffect, useState } from "react";
import {
  Radio,
  Plus,
  Search,
  Send,
  Lock,
  Globe,
  Users,
  ArrowLeft,
  LogOut,
  RefreshCw,
} from "lucide-react";
import { supabase } from "./supabase";
import Calls from "./Calls";
import "./Channels.css";

export default function Channels({ user }) {
  const [channels, setChannels] = useState([]);
  const [selected, setSelected] = useState(null);
  const [posts, setPosts] = useState([]);
  const [members, setMembers] = useState([]);
  const [role, setRole] = useState(null);
  const [search, setSearch] = useState("");
  const [content, setContent] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadChannels = useCallback(async () => {
    if (!user?.id) return;

    const { data, error } = await supabase
      .from("channels")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setError(error.message);
      return;
    }

    setChannels(data || []);
  }, [user?.id]);

  const loadPosts = useCallback(async (channel) => {
    if (!channel?.id) return;

    const { data, error } = await supabase
      .from("channel_posts")
      .select("*")
      .eq("channel_id", channel.id)
      .order("created_at", { ascending: true });

    if (error) {
      setError(error.message);
      return;
    }

    setPosts(data || []);

    const { data: memberData, error: memberError } =
      await supabase
        .from("channel_members")
        .select("*")
        .eq("channel_id", channel.id);

    if (memberError) {
      setError(memberError.message);
      return;
    }

    setMembers(memberData || []);

    const myMembership = (memberData || []).find(
      (member) => member.user_id === user?.id
    );

    setRole(myMembership?.role || null);
  }, [user?.id]);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  useEffect(() => {
    if (selected) {
      loadPosts(selected);
    } else {
      setPosts([]);
      setMembers([]);
      setRole(null);
    }
  }, [selected, loadPosts]);

  const createChannel = async (event) => {
    event.preventDefault();

    if (!name.trim() || !user?.id) return;

    setLoading(true);
    setError("");

    const code = isPublic
      ? null
      : crypto.randomUUID().replaceAll("-", "");

    const { data, error } = await supabase
      .from("channels")
      .insert({
        name: name.trim(),
        description: description.trim(),
        created_by: user.id,
        is_public: isPublic,
        invite_code: code,
      })
      .select()
      .single();

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setShowCreate(false);
    setName("");
    setDescription("");
    setIsPublic(true);

    await loadChannels();
    setSelected(data);
  };

  const joinChannel = async (channel) => {
    setLoading(true);
    setError("");

    const { error } = await supabase
      .from("channel_members")
      .insert({
        channel_id: channel.id,
        user_id: user.id,
        role: "subscriber",
      });

    setLoading(false);

    if (error && error.code !== "23505") {
      setError(error.message);
      return;
    }

    await loadPosts(channel);
  };

  const joinPrivateChannel = async (event) => {
    event.preventDefault();

    if (!inviteCode.trim()) return;

    setLoading(true);
    setError("");

    const { data, error } = await supabase.rpc(
      "join_channel_by_invite",
      { p_invite_code: inviteCode.trim() }
    );

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setInviteCode("");
    await loadChannels();

    const { data: found, error: findError } = await supabase
      .from("channels")
      .select("*")
      .eq("id", data)
      .single();

    if (findError) {
      setError(findError.message);
      return;
    }

    if (found) setSelected(found);
  };

  const publishPost = async (event) => {
    event.preventDefault();

    if (!content.trim() || !selected || !role) return;

    setLoading(true);
    setError("");

    const { error } = await supabase
      .from("channel_posts")
      .insert({
        channel_id: selected.id,
        sender_id: user.id,
        content: content.trim(),
        message_type: "text",
      });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setContent("");
    await loadPosts(selected);
  };

  const leaveChannel = async () => {
    if (!selected) return;

    if (!window.confirm("هل تريد مغادرة هذه القناة؟")) return;

    setLoading(true);
    setError("");

    const { error } = await supabase.rpc("leave_channel", {
      p_channel_id: selected.id,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setSelected(null);
    await loadChannels();
  };

  const filteredChannels = channels.filter((channel) =>
    channel.name.toLowerCase().includes(search.toLowerCase())
  );

  const isAdmin = role === "owner" || role === "admin";

  return (
    <div className="channels-page">
      <aside className={`channels-sidebar ${selected ? "mobile-hidden" : ""}`}>
        <div className="channels-heading">
          <div className="channels-brand">
            <Radio size={24} />
            <div>
              <h2>Channels</h2>
              <span>LOLZ broadcasting</span>
            </div>
          </div>

          <button
            type="button"
            className="channels-create-button"
            onClick={() => setShowCreate(true)}
            title="Create channel"
            aria-label="Create channel"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "44px",
              height: "44px",
              minWidth: "44px",
              flexShrink: 0,
              visibility: "visible",
              opacity: 1,
              position: "relative",
              zIndex: 100,
              backgroundColor: "#6c5ce7",
              color: "#ffffff",
              border: "none",
              borderRadius: "12px",
              cursor: "pointer",
            }}
          >
            <Plus size={24} />
          </button>
        </div>

        <div className="channels-search">
          <Search size={18} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search channels..."
          />
        </div>

        <form className="channels-join-code" onSubmit={joinPrivateChannel}>
          <input
            value={inviteCode}
            onChange={(event) => setInviteCode(event.target.value)}
            placeholder="Private channel code"
          />
          <button disabled={loading || !inviteCode.trim()}>
            Join
          </button>
        </form>

        <div className="channels-list">
          {filteredChannels.map((channel) => (
            <button
              key={channel.id}
              className={`channel-list-item ${
                selected?.id === channel.id ? "active" : ""
              }`}
              onClick={() => setSelected(channel)}
            >
              <div className="channel-avatar">
                {channel.avatar_url ? (
                  <img src={channel.avatar_url} alt="" />
                ) : (
                  <Radio size={22} />
                )}
              </div>

              <div className="channel-list-details">
                <strong>{channel.name}</strong>
                <span>
                  {channel.is_public ? "Public channel" : "Private channel"}
                </span>
              </div>

              {channel.is_public ? (
                <Globe size={15} className="channel-privacy-icon" />
              ) : (
                <Lock size={15} className="channel-privacy-icon" />
              )}
            </button>
          ))}

          {!filteredChannels.length && (
            <div className="channels-empty">
              <Radio size={30} />
              <p>No channels found</p>
            </div>
          )}
        </div>
      </aside>

      <main className={`channels-main ${selected ? "mobile-visible" : ""}`}>
        {selected ? (
          <>
            <header className="channel-chat-header">
              <button
                className="channel-back-button"
                onClick={() => setSelected(null)}
              >
                <ArrowLeft size={20} />
              </button>

              <div className="channel-avatar">
                <Radio size={22} />
              </div>

              <div className="channel-header-details">
                <strong>{selected.name}</strong>
                <span>{members.length} subscribers</span>
              </div>

              <button
                className="channel-refresh"
                onClick={() => loadPosts(selected)}
                title="Refresh"
              >
                <RefreshCw size={18} />
              </button>
            </header>

            <div className="channel-description">
              {selected.description || "Welcome to this channel."}
            </div>

            {!role && (
              <div className="channel-join-banner">
                <span>You are viewing this channel as a visitor.</span>
                {selected.is_public && (
                  <button
                    onClick={() => joinChannel(selected)}
                    disabled={loading}
                  >
                    Join channel
                  </button>
                )}
              </div>
            )}

            {/* CHANNEL CALLS */}
            {role && (
              <Calls
                supabase={supabase}
                user={user}
                callType="channel"
                channelId={selected.id}
                canStart={isAdmin}
                canEnd={isAdmin}
              />
            )}

            <div className="channel-posts">
              {posts.map((post) => (
                <article className="channel-post" key={post.id}>
                  <div className="channel-post-avatar">
                    <Radio size={18} />
                  </div>

                  <div className="channel-post-content">
                    <div className="channel-post-meta">
                      <strong>
                        {post.sender_id === selected.created_by
                          ? selected.name
                          : "Channel admin"}
                      </strong>
                      <time>
                        {new Date(post.created_at).toLocaleString()}
                      </time>
                    </div>

                    <p>{post.content}</p>
                  </div>
                </article>
              ))}

              {!posts.length && (
                <div className="channels-empty">
                  <Radio size={38} />
                  <h3>No posts yet</h3>
                  <p>The first post will appear here.</p>
                </div>
              )}
            </div>

            {isAdmin && (
              <form className="channel-composer" onSubmit={publishPost}>
                <input
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  placeholder="Write a channel post..."
                />
                <button disabled={loading || !content.trim()}>
                  <Send size={19} />
                </button>
              </form>
            )}

            {role === "subscriber" && (
              <div className="channel-subscriber-note">
                <Users size={17} />
                Only channel owners and admins can publish posts.
              </div>
            )}

            {role && role !== "owner" && (
              <button className="channel-leave-button" onClick={leaveChannel}>
                <LogOut size={16} /> Leave channel
              </button>
            )}
          </>
        ) : (
          <div className="channels-welcome">
            <div className="channels-welcome-icon">
              <Radio size={48} />
            </div>

            <h2>LOLZ Channels</h2>
            <p>
              Follow channels, discover updates, and stay connected.
            </p>

            <button onClick={() => setShowCreate(true)}>
              <Plus size={18} /> Create your channel
            </button>
          </div>
        )}
      </main>

      {error && (
        <div className="channels-error">
          {error}
          <button onClick={() => setError("")}>×</button>
        </div>
      )}

      {showCreate && (
        <div
          className="channel-modal-backdrop"
          onClick={() => setShowCreate(false)}
        >
          <form
            className="channel-create-modal"
            onSubmit={createChannel}
            onClick={(event) => event.stopPropagation()}
          >
            <h2>Create a channel</h2>
            <p>Build your own broadcasting space on LOLZ.</p>

            <label>Channel name</label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Enter channel name"
              required
              maxLength={60}
            />

            <label>Description</label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe your channel..."
              rows={3}
              maxLength={500}
            />

            <label>Privacy</label>

            <div className="channel-privacy-options">
              <button
                type="button"
                className={isPublic ? "selected" : ""}
                onClick={() => setIsPublic(true)}
              >
                <Globe size={17} /> Public
              </button>

              <button
                type="button"
                className={!isPublic ? "selected" : ""}
                onClick={() => setIsPublic(false)}
              >
                <Lock size={17} /> Private
              </button>
            </div>

            <div className="channel-modal-actions">
              <button
                type="button"
                className="channel-cancel"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="channel-submit"
                disabled={loading || !name.trim()}
              >
                {loading ? "Creating..." : "Create channel"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
