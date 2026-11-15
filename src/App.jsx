
import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import Navigation from "./Navigation";
import Lolz from "./Lolz";
import "./App.css";

function timeAgo(date) {
  if (!date) return "Recently";

  const seconds = Math.floor(
    (Date.now() - new Date(date).getTime()) / 1000
  );

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function Avatar({ url, name, size = "normal" }) {
  return (
    <div className={`avatar avatar-${size}`}>
      {url ? (
        <img src={url} alt="" />
      ) : (
        (name || "U").charAt(0).toUpperCase()
      )}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  const [posts, setPosts] = useState([]);
  const [stories, setStories] = useState([]);
  const [likedPosts, setLikedPosts] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]);

  const [activePage, setActivePage] = useState("home");
  const [search, setSearch] = useState("");

  const [newPost, setNewPost] = useState("");
  const [postFile, setPostFile] = useState(null);
  const [storyFile, setStoryFile] = useState(null);

  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [openComments, setOpenComments] = useState(null);

  const [people, setPeople] = useState([]);
  const [followingIds, setFollowingIds] = useState([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [followBusy, setFollowBusy] = useState([]);

  const [selectedProfile, setSelectedProfile] = useState(null);
  const [selectedProfilePosts, setSelectedProfilePosts] = useState([]);
  const [selectedProfileStats, setSelectedProfileStats] = useState({
    followers: 0,
    following: 0,
  });
  const [profileLoading, setProfileLoading] = useState(false);

  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [conversationMessages, setConversationMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messageSending, setMessageSending] = useState(false);

  // Chat media
  const [messageFile, setMessageFile] = useState(null);
  const [messageFilePreview, setMessageFilePreview] = useState("");

  const [notifications, setNotifications] = useState([]);
  const [notificationLoading, setNotificationLoading] = useState(false);

  const [followStats, setFollowStats] = useState({
    followers: 0,
    following: 0,
  });

  const [editProfile, setEditProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    display_name: "",
    username: "",
    bio: "",
    website: "",
  });

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const postInput = useRef(null);
  const storyInput = useRef(null);
  const imageInput = useRef(null);
  const messageMediaInput = useRef(null);
  const messagesEndRef = useRef(null);

  // Create and clean up the local preview URL.
  useEffect(() => {
    if (!messageFile) {
      setMessageFilePreview("");
      return;
    }

    const previewUrl = URL.createObjectURL(messageFile);
    setMessageFilePreview(previewUrl);

    return () => URL.revokeObjectURL(previewUrl);
  }, [messageFile]);

  useEffect(() => {
    startApp();
  }, []);

  // ----------------------------------
  // INITIAL APP LOAD
  // ----------------------------------

  async function startApp() {
    setLoading(true);

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        setLoading(false);
        return;
      }

      const currentUser = authData.user;
      setUser(currentUser);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .maybeSingle();

      const currentProfile = profileData || {
        id: currentUser.id,
        username: currentUser.user_metadata?.username || "user",
        display_name: "",
        full_name: "",
        bio: "",
        avatar_url: "",
        website: "",
      };

      setProfile(currentProfile);

      setProfileForm({
        display_name: currentProfile.display_name || "",
        username: currentProfile.username || "",
        bio: currentProfile.bio || "",
        website: currentProfile.website || "",
      });

      await Promise.all([
        loadPosts(currentUser.id),
        loadStories(),
        loadFollowing(currentUser.id),
        loadNotifications(currentUser.id),
        loadFollowStats(currentUser.id),
      ]);
    } catch (error) {
      setNotice(error.message || "Could not start the application.");
    }

    setLoading(false);
  }

  // ----------------------------------
  // POSTS
  // ----------------------------------

  async function loadPosts(userId = user?.id) {
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setNotice("Could not load posts: " + error.message);
      return;
    }

    const postRows = data || [];
    const userIds = [...new Set(postRows.map((post) => post.user_id))];
    const postIds = postRows.map((post) => post.id);

    let profileMap = {};
    let likes = [];

    if (userIds.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .in("id", userIds);

      (profiles || []).forEach((item) => {
        profileMap[item.id] = item;
      });
    }

    if (postIds.length) {
      const { data: allLikes } = await supabase
        .from("post_likes")
        .select("post_id,user_id")
        .in("post_id", postIds);

      likes = allLikes || [];
    }

    setLikedPosts(
      likes
        .filter((like) => like.user_id === userId)
        .map((like) => like.post_id)
    );

    setPosts(
      postRows.map((post) => ({
        ...post,
        author: profileMap[post.user_id] || {},
        likesCount: likes.filter(
          (like) => like.post_id === post.id
        ).length,
      }))
    );
  }

  function findPost(postId) {
    return (
      posts.find((item) => item.id === postId) ||
      selectedProfilePosts.find((item) => item.id === postId) ||
      null
    );
  }

  async function publishPost(event) {
    event.preventDefault();

    if (!newPost.trim() && !postFile) {
      setNotice("Write something or choose an image first.");
      return;
    }

    if (!user) {
      setNotice("Please sign in first.");
      return;
    }

    setBusy(true);
    setNotice("");

    try {
      let imageUrl = null;

      if (postFile) {
        imageUrl = await uploadMedia(postFile, "posts");
      }

      const { error } = await supabase.from("posts").insert({
        user_id: user.id,
        content: newPost.trim(),
        image_url: imageUrl,
      });

      if (error) throw error;

      setNewPost("");
      setPostFile(null);

      if (imageInput.current) {
        imageInput.current.value = "";
      }

      await loadPosts(user.id);
      setNotice("Your post has been published.");
    } catch (error) {
      setNotice(error.message || "Could not publish your post.");
    }

    setBusy(false);
  }

  // ----------------------------------
  // NOTIFICATION CREATION
  // ----------------------------------

  async function createNotification(recipientId, type, postId = null) {
    if (!user || !recipientId || recipientId === user.id) return;

    const notification = {
      recipient_id: recipientId,
      actor_id: user.id,
      type,
    };

    if (postId) notification.post_id = postId;

    const { error } = await supabase
      .from("notifications")
      .insert(notification);

    if (error) {
      console.error("Notification error:", error.message);
    }
  }

  // ----------------------------------
  // LIKE / UNLIKE
  // ----------------------------------

  async function toggleLike(postId) {
    if (!user) {
      setNotice("Please sign in to like posts.");
      return;
    }

    const post = findPost(postId);
    if (!post) return;

    const alreadyLiked = likedPosts.includes(postId);

    setLikedPosts((current) =>
      alreadyLiked
        ? current.filter((id) => id !== postId)
        : [...current, postId]
    );

    const updateCount = (items) =>
      items.map((item) =>
        item.id === postId
          ? {
              ...item,
              likesCount: Math.max(
                0,
                (item.likesCount || 0) + (alreadyLiked ? -1 : 1)
              ),
            }
          : item
      );

    setPosts(updateCount);
    setSelectedProfilePosts(updateCount);

    const result = alreadyLiked
      ? await supabase
          .from("post_likes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", user.id)
      : await supabase.from("post_likes").insert({
          post_id: postId,
          user_id: user.id,
        });

    if (result.error) {
      setNotice(result.error.message);
      await loadPosts(user.id);
      return;
    }

    if (!alreadyLiked && post.user_id !== user.id) {
      await createNotification(post.user_id, "like", postId);
    }
  }

  // ----------------------------------
  // COMMENTS
  // ----------------------------------

  async function loadComments(postId) {
    setOpenComments(postId);

    const { data, error } = await supabase
      .from("comments")
      .select("*")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (error) {
      setNotice(error.message);
      return;
    }

    const userIds = [
      ...new Set((data || []).map((item) => item.user_id)),
    ];

    let profileMap = {};

    if (userIds.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .in("id", userIds);

      (profiles || []).forEach((item) => {
        profileMap[item.id] = item;
      });
    }

    setComments(
      (data || []).map((item) => ({
        ...item,
        author: profileMap[item.user_id] || {},
      }))
    );
  }

  async function addComment(event, postId) {
    event.preventDefault();

    if (!user) {
      setNotice("Please sign in to comment.");
      return;
    }

    if (!commentText.trim()) return;

    const post = findPost(postId);

    const { error } = await supabase.from("comments").insert({
      post_id: postId,
      user_id: user.id,
      content: commentText.trim(),
    });

    if (error) {
      setNotice(error.message);
      return;
    }

    if (post && post.user_id !== user.id) {
      await createNotification(post.user_id, "comment", postId);
    }

    setCommentText("");
    await loadComments(postId);
  }

  // ----------------------------------
  // STORIES
  // ----------------------------------

  async function loadStories() {
    const { data, error } = await supabase
      .from("stories")
      .select("*")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (error || !data) return;

    const userIds = [...new Set(data.map((story) => story.user_id))];
    let profileMap = {};

    if (userIds.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .in("id", userIds);

      (profiles || []).forEach((item) => {
        profileMap[item.id] = item;
      });
    }

    setStories(
      data.map((story) => ({
        ...story,
        author: profileMap[story.user_id] || {},
      }))
    );
  }

  async function publishStory(event) {
    event.preventDefault();

    if (!storyFile) {
      setNotice("Choose a photo or video for your story.");
      return;
    }

    if (!user) {
      setNotice("Please sign in first.");
      return;
    }

    setBusy(true);

    try {
      const mediaUrl = await uploadMedia(storyFile, "stories");

      const { error } = await supabase.from("stories").insert({
        user_id: user.id,
        media_url: mediaUrl,
        caption: "",
      });

      if (error) throw error;

      setStoryFile(null);

      if (storyInput.current) {
        storyInput.current.value = "";
      }

      await loadStories();
      setNotice("Your story is now live for 24 hours.");
    } catch (error) {
      setNotice(error.message || "Could not publish story.");
    }

    setBusy(false);
  }

  // ----------------------------------
  // FILE UPLOAD
  // ----------------------------------

  async function uploadMedia(file, folder) {
    if (!file || !user) return null;

    const extension = file.name.split(".").pop();

    const fileName = `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${extension}`;

    const path = `${user.id}/${folder}/${fileName}`;

    const { error } = await supabase.storage
      .from("social-media")
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) throw error;

    const { data } = supabase.storage
      .from("social-media")
      .getPublicUrl(path);

    return data.publicUrl;
  }

  // ----------------------------------
  // PEOPLE SEARCH
  // ----------------------------------

  async function searchPeople(term = "") {
    if (!user) return;

    setPeopleLoading(true);

    try {
      let query = supabase
        .from("profiles")
        .select("id,username,display_name,full_name,avatar_url,bio")
        .neq("id", user.id)
        .limit(30);

      const cleanTerm = term
        .trim()
        .replace(/[,%()]/g, " ")
        .replace(/\s+/g, " ");

      if (cleanTerm) {
        query = query.or(
          `username.ilike.%${cleanTerm}%,display_name.ilike.%${cleanTerm}%,full_name.ilike.%${cleanTerm}%`
        );
      } else {
        query = query.order("created_at", { ascending: false });
      }

      const { data, error } = await query;

      if (error) throw error;

      setPeople(data || []);
    } catch (error) {
      setNotice("People search error: " + error.message);
    }

    setPeopleLoading(false);
  }

  useEffect(() => {
    if (!user || activePage !== "people") return;

    const timer = setTimeout(() => {
      searchPeople(search);
    }, 350);

    return () => clearTimeout(timer);
  }, [search, activePage, user?.id]);

  // ----------------------------------
  // FOLLOWING
  // ----------------------------------

  async function loadFollowing(userId = user?.id) {
    if (!userId) return;

    const { data, error } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", userId);

    if (error) {
      console.error("Following error:", error.message);
      return;
    }

    setFollowingIds((data || []).map((item) => item.following_id));
  }

  async function loadFollowStats(userId = user?.id) {
    if (!userId) return;

    const [followersResult, followingResult] = await Promise.all([
      supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", userId),

      supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", userId),
    ]);

    setFollowStats({
      followers: followersResult.count || 0,
      following: followingResult.count || 0,
    });
  }

  async function toggleFollow(personId) {
    if (!user || personId === user.id) return;

    if (followBusy.includes(personId)) return;

    const alreadyFollowing = followingIds.includes(personId);

    setFollowBusy((current) => [...current, personId]);

    try {
      if (alreadyFollowing) {
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", personId);

        if (error) throw error;

        setFollowingIds((current) =>
          current.filter((id) => id !== personId)
        );
      } else {
        const { error } = await supabase.from("follows").insert({
          follower_id: user.id,
          following_id: personId,
        });

        if (error) throw error;

        setFollowingIds((current) => [...current, personId]);

        await createNotification(personId, "follow");
      }

      await loadFollowStats(user.id);

      if (selectedProfile?.id === personId) {
        const { count } = await supabase
          .from("follows")
          .select("*", { count: "exact", head: true })
          .eq("following_id", personId);

        setSelectedProfileStats((current) => ({
          ...current,
          followers: count || 0,
        }));
      }
    } catch (error) {
      setNotice("Follow error: " + error.message);
      await loadFollowing(user.id);
    }

    setFollowBusy((current) =>
      current.filter((id) => id !== personId)
    );
  }

  // ----------------------------------
  // VIEW OTHER USER PROFILE
  // ----------------------------------

  async function openUserProfile(personId) {
    if (!personId) return;

    if (personId === user.id) {
      goTo("profile");
      return;
    }

    setNotice("");
    setSelectedProfile(null);
    setSelectedProfilePosts([]);
    setProfileLoading(true);
    goTo("user-profile");

    try {
      const { data: person, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", personId)
        .single();

      if (error) throw error;

      const [postsResult, followersResult, followingResult] =
        await Promise.all([
          supabase
            .from("posts")
            .select("*")
            .eq("user_id", personId)
            .order("created_at", { ascending: false }),

          supabase
            .from("follows")
            .select("*", { count: "exact", head: true })
            .eq("following_id", personId),

          supabase
            .from("follows")
            .select("*", { count: "exact", head: true })
            .eq("follower_id", personId),
        ]);

      if (postsResult.error) throw postsResult.error;
      if (followersResult.error) throw followersResult.error;
      if (followingResult.error) throw followingResult.error;

      const profilePosts = postsResult.data || [];
      const postIds = profilePosts.map((post) => post.id);

      let likes = [];

      if (postIds.length) {
        const { data: likesData, error: likesError } = await supabase
          .from("post_likes")
          .select("post_id,user_id")
          .in("post_id", postIds);

        if (likesError) throw likesError;
        likes = likesData || [];
      }

      setSelectedProfile(person);

      setSelectedProfilePosts(
        profilePosts.map((post) => ({
          ...post,
          author: person,
          likesCount: likes.filter(
            (like) => like.post_id === post.id
          ).length,
        }))
      );

      setLikedPosts((current) => {
        const otherIds = current.filter(
          (id) => !postIds.includes(id)
        );

        const myLikes = likes
          .filter((like) => like.user_id === user.id)
          .map((like) => like.post_id);

        return [...otherIds, ...myLikes];
      });

      setSelectedProfileStats({
        followers: followersResult.count || 0,
        following: followingResult.count || 0,
      });
    } catch (error) {
      setNotice("Could not open profile: " + error.message);
      goTo("people");
    }

    setProfileLoading(false);
  }

  // ----------------------------------
  // NOTIFICATIONS
  // ----------------------------------

  async function loadNotifications(userId = user?.id) {
    if (!userId) return;

    setNotificationLoading(true);

    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("recipient_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      const rows = data || [];
      const actorIds = [
        ...new Set(rows.map((item) => item.actor_id).filter(Boolean)),
      ];

      let profileMap = {};

      if (actorIds.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("*")
          .in("id", actorIds);

        (profiles || []).forEach((item) => {
          profileMap[item.id] = item;
        });
      }

      setNotifications(
        rows.map((item) => ({
          ...item,
          actor: profileMap[item.actor_id] || {},
        }))
      );
    } catch (error) {
      setNotice("Could not load notifications: " + error.message);
    }

    setNotificationLoading(false);
  }

  async function markNotificationRead(notificationId) {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId)
      .eq("recipient_id", user.id);

    if (error) {
      setNotice("Could not update notification: " + error.message);
      return;
    }

    setNotifications((current) =>
      current.map((item) =>
        item.id === notificationId
          ? { ...item, is_read: true }
          : item
      )
    );
  }

  async function markAllNotificationsRead() {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("recipient_id", user.id)
      .eq("is_read", false);

    if (error) {
      setNotice(error.message);
      return;
    }

    setNotifications((current) =>
      current.map((item) => ({ ...item, is_read: true }))
    );
  }

  useEffect(() => {
    if (activePage === "activity" && user) {
      loadNotifications(user.id);
    }
  }, [activePage, user?.id]);

  // ----------------------------------
  // MESSAGING: LOAD CONVERSATIONS
  // ----------------------------------

  async function loadConversations() {
    if (!user) return;

    setMessagesLoading(true);

    try {
      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .or(`user_one.eq.${user.id},user_two.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const rows = data || [];

      if (!rows.length) {
        setConversations([]);
        setMessagesLoading(false);
        return;
      }

      const otherIds = rows.map((conversation) =>
        conversation.user_one === user.id
          ? conversation.user_two
          : conversation.user_one
      );

      const uniqueIds = [...new Set(otherIds)];

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .in("id", uniqueIds);

      if (profilesError) throw profilesError;

      const profileMap = {};

      (profiles || []).forEach((item) => {
        profileMap[item.id] = item;
      });

      const results = await Promise.all(
        rows.map(async (conversation) => {
          const otherId =
            conversation.user_one === user.id
              ? conversation.user_two
              : conversation.user_one;

          const { data: lastMessages } = await supabase
            .from("messages")
            .select("*")
            .eq("conversation_id", conversation.id)
            .order("created_at", { ascending: false })
            .limit(1);

          return {
            ...conversation,
            otherProfile: profileMap[otherId] || {},
            lastMessage: lastMessages?.[0] || null,
          };
        })
      );

      setConversations(results);

      setActiveConversation((current) => {
        if (!current) return null;
        return results.find((item) => item.id === current.id) || current;
      });
    } catch (error) {
      setNotice("Could not load conversations: " + error.message);
    }

    setMessagesLoading(false);
  }

  // ----------------------------------
  // MESSAGING: LOAD MESSAGES
  // ----------------------------------

  async function loadMessages(conversationId) {
    if (!conversationId) return;

    setMessagesLoading(true);

    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      setConversationMessages(data || []);
    } catch (error) {
      setNotice("Could not load messages: " + error.message);
    }

    setMessagesLoading(false);
  }

  // ----------------------------------
  // MESSAGING: OPEN CONVERSATION
  // ----------------------------------

  async function openConversationWith(person) {
    if (!user || !person?.id || person.id === user.id) return;

    setNotice("");

    const firstUser = [user.id, person.id].sort()[0];
    const secondUser = [user.id, person.id].sort()[1];

    try {
      let { data: conversation, error } = await supabase
        .from("conversations")
        .select("*")
        .eq("user_one", firstUser)
        .eq("user_two", secondUser)
        .maybeSingle();

      if (error) throw error;

      if (!conversation) {
        const { data: newConversation, error: insertError } =
          await supabase
            .from("conversations")
            .insert({
              user_one: firstUser,
              user_two: secondUser,
            })
            .select()
            .single();

        if (insertError) throw insertError;
        conversation = newConversation;
      }

      const selectedConversation = {
        ...conversation,
        otherProfile: person,
      };

      setActiveConversation(selectedConversation);
      setConversationMessages([]);
      setMessageText("");
      setMessageFile(null);

      if (messageMediaInput.current) {
        messageMediaInput.current.value = "";
      }

      goTo("messages");

      await loadMessages(conversation.id);
      await loadConversations();
      setActiveConversation(selectedConversation);
    } catch (error) {
      setNotice("Could not open conversation: " + error.message);
    }
  }

  // ----------------------------------
  // MESSAGING: SELECT / CLEAR MEDIA
  // ----------------------------------

  function handleMessageFileChange(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (
      !file.type.startsWith("image/") &&
      !file.type.startsWith("video/")
    ) {
      setNotice("Please choose an image or video.");
      event.target.value = "";
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      setNotice("Maximum file size is 100 MB.");
      event.target.value = "";
      return;
    }

    setNotice("");
    setMessageFile(file);
  }

  function clearMessageFile() {
    setMessageFile(null);

    if (messageMediaInput.current) {
      messageMediaInput.current.value = "";
    }
  }

  // ----------------------------------
  // MESSAGING: SEND MESSAGE
  // ----------------------------------

  async function sendMessage(event) {
    event.preventDefault();

    if (!user || !activeConversation) return;

    const content = messageText.trim();
    const file = messageFile;

    if (!content && !file) return;

    setMessageSending(true);
    setNotice("");

    try {
      let mediaUrl = null;
      let messageType = "text";

      if (file) {
        if (
          !file.type.startsWith("image/") &&
          !file.type.startsWith("video/")
        ) {
          throw new Error("Only images and videos are allowed.");
        }

        if (file.size > 100 * 1024 * 1024) {
          throw new Error("Maximum file size is 100 MB.");
        }

        messageType = file.type.startsWith("image/")
          ? "image"
          : "video";

        mediaUrl = await uploadMedia(file, "messages");

        if (!mediaUrl) {
          throw new Error("Could not upload the media file.");
        }
      }

      const { error } = await supabase.from("messages").insert({
        conversation_id: activeConversation.id,
        sender_id: user.id,
        content:
          content ||
          (messageType === "image" ? "Photo" : messageType === "video" ? "Video" : ""),
        message_type: messageType,
        media_url: mediaUrl,
        file_name: file?.name || null,
        mime_type: file?.type || null,
      });

      if (error) throw error;

      setMessageText("");
      setMessageFile(null);

      if (messageMediaInput.current) {
        messageMediaInput.current.value = "";
      }

      await loadMessages(activeConversation.id);
      await loadConversations();
    } catch (error) {
      setNotice("Could not send message: " + error.message);
    } finally {
      setMessageSending(false);
    }
  }

  useEffect(() => {
    if (activePage === "messages" && user) {
      loadConversations();
    }
  }, [activePage, user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [conversationMessages]);

  // ----------------------------------
  // PROFILE
  // ----------------------------------

  async function saveProfile(event) {
    event.preventDefault();

    if (!user) return;

    setBusy(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: profileForm.display_name,
        username: profileForm.username,
        bio: profileForm.bio,
        website: profileForm.website,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      setNotice(error.message);
    } else {
      setProfile((current) => ({
        ...current,
        ...profileForm,
      }));

      setEditProfile(false);
      setNotice("Profile updated successfully.");
    }

    setBusy(false);
  }

  async function changeAvatar(file) {
    if (!file || !user) return;

    setBusy(true);

    try {
      const avatarUrl = await uploadMedia(file, "avatars");

      const { error } = await supabase
        .from("profiles")
        .update({
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) throw error;

      setProfile((current) => ({
        ...current,
        avatar_url: avatarUrl,
      }));

      setNotice("Profile photo updated.");
    } catch (error) {
      setNotice(error.message);
    }

    setBusy(false);
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  // ----------------------------------
  // NAVIGATION AND DISPLAY
  // ----------------------------------

  const displayName =
    profile?.display_name ||
    profile?.full_name ||
    profile?.username ||
    "Your profile";

  const filteredPosts = posts.filter((post) => {
    const term = search.toLowerCase().trim();

    if (!term) return true;

    return (
      (post.content || "").toLowerCase().includes(term) ||
      (post.author?.username || "").toLowerCase().includes(term) ||
      (post.author?.display_name || "").toLowerCase().includes(term)
    );
  });

  const visiblePosts =
    activePage === "saved"
      ? filteredPosts.filter((post) => savedPosts.includes(post.id))
      : activePage === "profile"
      ? filteredPosts.filter((post) => post.user_id === user?.id)
      : filteredPosts;

  const unreadCount = notifications.filter(
    (item) => !item.is_read
  ).length;

  function goTo(page) {
    setActivePage(page);
    setNotice("");
    setOpenComments(null);
  }

  function createPost() {
    goTo("home");

    setTimeout(() => {
      postInput.current?.focus();
    }, 100);
  }

  if (loading) {
    return (
      <div className="loading-screen">
        OUR SOCIAL<span>.</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="loading-screen">
        Please sign in to continue.
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Navigation
        page={activePage}
        setPage={goTo}
        onCreate={createPost}
        onLogout={logout}
        username={displayName}
      />

      <main className="main-area">
        <header className="topbar">
          <div className="mobile-brand">
            <span className="brand-mark">O</span>
            OUR SOCIAL<span className="brand-dot">.</span>
          </div>

          <div className="topbar-search">
            <span>⌕</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={
                activePage === "people"
                  ? "Search people by name or username..."
                  : "Search posts and people..."
              }
            />
          </div>

          <button
            className="top-profile"
            onClick={() => goTo("profile")}
          >
            <Avatar
              url={profile?.avatar_url}
              name={displayName}
            />
          </button>
        </header>

        <div className="page-content">
          {notice && (
            <div className="notice">
              <span>{notice}</span>
              <button onClick={() => setNotice("")}>×</button>
            </div>
          )}

          {/* HOME */}

          {activePage === "home" && (
            <>
              <section className="welcome-section">
                <div>
                  <span className="eyebrow">
                    YOUR WORLD. YOUR PEOPLE.
                  </span>

                  <h1>
                    Welcome back, {displayName.split(" ")[0]}.
                  </h1>

                  <p>
                    Your space. Your stories. Your community.
                  </p>
                </div>

                <div className="welcome-decoration">
                  OS<span>.</span>
                </div>
              </section>

              <section className="stories-section">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">MOMENTS</span>
                    <h2>Stories</h2>
                  </div>

                  <span className="subtle-text">
                    Disappear after 24 hours
                  </span>
                </div>

                <div className="stories-list">
                  <button
                    className="story-item add-story"
                    onClick={() => storyInput.current?.click()}
                  >
                    <div className="story-ring add-ring">
                      <Avatar
                        url={profile?.avatar_url}
                        name={displayName}
                        size="large"
                      />
                      <span className="add-story-plus">+</span>
                    </div>

                    <span>Your story</span>
                  </button>

                  {stories.map((story) => (
                    <button
                      className="story-item"
                      key={story.id}
                      onClick={() =>
                        window.open(story.media_url, "_blank")
                      }
                    >
                      <div className="story-ring">
                        <Avatar
                          url={story.author?.avatar_url}
                          name={story.author?.username}
                          size="large"
                        />
                      </div>

                      <span>
                        {story.author?.display_name ||
                          story.author?.username ||
                          "Member"}
                      </span>
                    </button>
                  ))}
                </div>

                <form
                  className="story-upload"
                  onSubmit={publishStory}
                >
                  <input
                    ref={storyInput}
                    type="file"
                    accept="image/*,video/*"
                    hidden
                    onChange={(event) =>
                      setStoryFile(event.target.files?.[0] || null)
                    }
                  />

                  {storyFile && (
                    <>
                      <span>{storyFile.name}</span>

                      <button type="submit" disabled={busy}>
                        {busy ? "Uploading..." : "Share story"}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setStoryFile(null);
                          if (storyInput.current) {
                            storyInput.current.value = "";
                          }
                        }}
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </form>
              </section>

              <section className="composer-card">
                <div className="composer-top">
                  <Avatar
                    url={profile?.avatar_url}
                    name={displayName}
                  />

                  <textarea
                    ref={postInput}
                    value={newPost}
                    onChange={(event) =>
                      setNewPost(event.target.value)
                    }
                    placeholder="What's happening in your world?"
                    rows="2"
                  />
                </div>

                <div className="composer-bottom">
                  <div className="composer-tools">
                    <input
                      ref={imageInput}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(event) =>
                        setPostFile(event.target.files?.[0] || null)
                      }
                    />

                    <button
                      type="button"
                      onClick={() => imageInput.current?.click()}
                    >
                      ▧ Photo
                    </button>

                    {postFile && (
                      <span className="file-name">
                        {postFile.name}
                      </span>
                    )}
                  </div>

                  <button
                    className="primary-button"
                    onClick={publishPost}
                    disabled={busy}
                  >
                    {busy ? "Publishing..." : "Publish ↗"}
                  </button>
                </div>
              </section>

              <section className="feed-section">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">THE COMMUNITY</span>
                    <h2>Your feed</h2>
                  </div>

                  <span className="subtle-text">
                    {posts.length} posts
                  </span>
                </div>

                <PostList
                  posts={visiblePosts}
                  likedPosts={likedPosts}
                  savedPosts={savedPosts}
                  onLike={toggleLike}
                  onSave={(id) =>
                    setSavedPosts((current) =>
                      current.includes(id)
                        ? current.filter((item) => item !== id)
                        : [...current, id]
                    )
                  }
                  onComments={loadComments}
                  openComments={openComments}
                  comments={comments}
                  commentText={commentText}
                  setCommentText={setCommentText}
                  onAddComment={addComment}
                  onOpenProfile={openUserProfile}
                />
              </section>
            </>
          )}

          {/* DISCOVER */}

          {activePage === "discover" && (
            <section className="other-page">
              <span className="eyebrow">
                FIND YOUR COMMUNITY
              </span>

              <h1>Discover</h1>

              <p>
                Explore posts from the OUR SOCIAL community.
              </p>

              <PostList
                posts={visiblePosts}
                likedPosts={likedPosts}
                savedPosts={savedPosts}
                onLike={toggleLike}
                onSave={(id) =>
                  setSavedPosts((current) =>
                    current.includes(id)
                      ? current.filter((item) => item !== id)
                      : [...current, id]
                  )
                }
                onComments={loadComments}
                openComments={openComments}
                comments={comments}
                commentText={commentText}
                setCommentText={setCommentText}
                onAddComment={addComment}
                onOpenProfile={openUserProfile}
              />
            </section>
          )}

          {/* PEOPLE */}

          {activePage === "people" && (
            <section className="other-page">
              <span className="eyebrow">GROW YOUR COMMUNITY</span>
              <h1>Discover people</h1>
              <p>Find people and connect with the community.</p>

              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  alignItems: "center",
                  margin: "24px 0",
                  flexWrap: "wrap",
                }}
              >
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by name or username..."
                  style={{
                    flex: "1",
                    minWidth: "220px",
                    padding: "14px 16px",
                    borderRadius: "12px",
                    border: "1px solid rgba(160,130,255,.25)",
                    background: "#17151f",
                    color: "white",
                  }}
                />

                <button
                  className="primary-button"
                  onClick={() => searchPeople(search)}
                >
                  Search
                </button>
              </div>

              {peopleLoading ? (
                <p>Searching for people...</p>
              ) : people.length === 0 ? (
                <div className="empty-state">
                  <span>✦</span>
                  <h3>No people found</h3>
                  <p>Try another name or username.</p>
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fill,minmax(250px,1fr))",
                    gap: "16px",
                  }}
                >
                  {people.map((person) => {
                    const name =
                      person.display_name ||
                      person.full_name ||
                      person.username ||
                      "Member";

                    const isFollowing = followingIds.includes(person.id);
                    const isBusy = followBusy.includes(person.id);

                    return (
                      <div
                        key={person.id}
                        style={{
                          background: "#17151f",
                          border: "1px solid rgba(160,130,255,.18)",
                          borderRadius: "18px",
                          padding: "20px",
                          display: "flex",
                          alignItems: "center",
                          gap: "14px",
                          minWidth: 0,
                        }}
                      >
                        <button
                          onClick={() => openUserProfile(person.id)}
                          style={{
                            border: "none",
                            background: "transparent",
                            padding: 0,
                            cursor: "pointer",
                          }}
                        >
                          <Avatar
                            url={person.avatar_url}
                            name={name}
                            size="large"
                          />
                        </button>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <button
                            onClick={() => openUserProfile(person.id)}
                            style={{
                              display: "block",
                              color: "white",
                              background: "transparent",
                              border: "none",
                              padding: 0,
                              cursor: "pointer",
                              textAlign: "left",
                              fontWeight: "bold",
                              maxWidth: "100%",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {name}
                          </button>

                          <span
                            style={{
                              color: "#a49ab9",
                              fontSize: "13px",
                            }}
                          >
                            @{person.username || "member"}
                          </span>

                          {person.bio && (
                            <p
                              style={{
                                color: "#aaa1b8",
                                fontSize: "12px",
                                margin: "6px 0 0",
                              }}
                            >
                              {person.bio}
                            </p>
                          )}
                        </div>

                        <button
                          onClick={() => toggleFollow(person.id)}
                          disabled={isBusy}
                          className={
                            isFollowing
                              ? "secondary-button"
                              : "primary-button"
                          }
                          style={{
                            padding: "9px 12px",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {isBusy
                            ? "..."
                            : isFollowing
                            ? "Following"
                            : "Follow"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* OTHER USER PROFILE */}

          {activePage === "user-profile" && (
            <section className="profile-page">
              {profileLoading || !selectedProfile ? (
                <div className="empty-state">
                  <h3>Loading profile...</h3>
                </div>
              ) : (
                <>
                  <div className="profile-cover">
                    <span>OUR SOCIAL MEMBER</span>
                  </div>

                  <div className="profile-main">
                    <div className="profile-avatar-wrap">
                      <Avatar
                        url={selectedProfile.avatar_url}
                        name={
                          selectedProfile.display_name ||
                          selectedProfile.username
                        }
                        size="profile"
                      />
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: "10px",
                        flexWrap: "wrap",
                        marginTop: "12px",
                      }}
                    >
                      <button
                        className={
                          followingIds.includes(selectedProfile.id)
                            ? "secondary-button"
                            : "primary-button"
                        }
                        disabled={followBusy.includes(selectedProfile.id)}
                        onClick={() => toggleFollow(selectedProfile.id)}
                      >
                        {followBusy.includes(selectedProfile.id)
                          ? "Please wait..."
                          : followingIds.includes(selectedProfile.id)
                          ? "Following"
                          : "Follow"}
                      </button>

                      <button
                        className="secondary-button"
                        onClick={() => openConversationWith(selectedProfile)}
                      >
                        Message
                      </button>

                      <button
                        className="secondary-button"
                        onClick={() => goTo("people")}
                      >
                        Back
                      </button>
                    </div>

                    <h1>
                      {selectedProfile.display_name ||
                        selectedProfile.full_name ||
                        selectedProfile.username}
                    </h1>

                    <p className="profile-handle">
                      @{selectedProfile.username || "member"}
                    </p>

                    <p className="profile-bio">
                      {selectedProfile.bio || "No bio yet."}
                    </p>

                    {selectedProfile.website && (
                      <a
                        href={selectedProfile.website}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {selectedProfile.website}
                      </a>
                    )}

                    <div className="profile-stats">
                      <div>
                        <strong>{selectedProfilePosts.length}</strong>
                        <span>Posts</span>
                      </div>

                      <div>
                        <strong>{selectedProfileStats.followers}</strong>
                        <span>Followers</span>
                      </div>

                      <div>
                        <strong>{selectedProfileStats.following}</strong>
                        <span>Following</span>
                      </div>
                    </div>
                  </div>

                  <div className="section-heading profile-post-heading">
                    <h2>Posts</h2>
                  </div>

                  <PostList
                    posts={selectedProfilePosts}
                    likedPosts={likedPosts}
                    savedPosts={savedPosts}
                    onLike={toggleLike}
                    onSave={(id) =>
                      setSavedPosts((current) =>
                        current.includes(id)
                          ? current.filter((item) => item !== id)
                          : [...current, id]
                      )
                    }
                    onComments={loadComments}
                    openComments={openComments}
                    comments={comments}
                    commentText={commentText}
                    setCommentText={setCommentText}
                    onAddComment={addComment}
                    onOpenProfile={openUserProfile}
                  />
                </>
              )}
            </section>
          )}

          {/* SAVED */}

          {activePage === "saved" && (
            <section className="other-page">
              <span className="eyebrow">YOUR COLLECTION</span>
              <h1>Saved posts</h1>

              <PostList
                posts={visiblePosts}
                likedPosts={likedPosts}
                savedPosts={savedPosts}
                onLike={toggleLike}
                onSave={(id) =>
                  setSavedPosts((current) =>
                    current.filter((item) => item !== id)
                  )
                }
                onComments={loadComments}
                openComments={openComments}
                comments={comments}
                commentText={commentText}
                setCommentText={setCommentText}
                onAddComment={addComment}
                onOpenProfile={openUserProfile}
              />
            </section>
          )}

          {/* LOLZ */}

          {activePage === "lolz" && <Lolz user={user} />}

          {/* PROFILE */}

          {activePage === "profile" && (
            <section className="profile-page">
              <div className="profile-cover">
                <span>OUR SOCIAL MEMBER</span>
              </div>

              <div className="profile-main">
                <div className="profile-avatar-wrap">
                  <Avatar
                    url={profile?.avatar_url}
                    name={displayName}
                    size="profile"
                  />

                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    id="avatar-upload"
                    onChange={(event) =>
                      changeAvatar(event.target.files?.[0])
                    }
                  />

                  <label
                    htmlFor="avatar-upload"
                    className="avatar-edit"
                  >
                    Edit photo
                  </label>
                </div>

                <button
                  className="secondary-button edit-profile-button"
                  onClick={() => setEditProfile(!editProfile)}
                >
                  {editProfile ? "Close editor" : "Edit profile"}
                </button>

                <h1>{displayName}</h1>

                <p className="profile-handle">
                  @{profile?.username || "user"}
                </p>

                <p className="profile-bio">
                  {profile?.bio ||
                    "Tell the community something about yourself."}
                </p>

                {profile?.website && (
                  <a
                    href={profile.website}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {profile.website}
                  </a>
                )}

                {editProfile && (
                  <form
                    className="profile-edit-form"
                    onSubmit={saveProfile}
                  >
                    <label>Display name</label>

                    <input
                      value={profileForm.display_name}
                      onChange={(event) =>
                        setProfileForm({
                          ...profileForm,
                          display_name: event.target.value,
                        })
                      }
                      placeholder="Your name"
                    />

                    <label>Username</label>

                    <input
                      value={profileForm.username}
                      onChange={(event) =>
                        setProfileForm({
                          ...profileForm,
                          username: event.target.value,
                        })
                      }
                      placeholder="username"
                    />

                    <label>Bio</label>

                    <textarea
                      value={profileForm.bio}
                      onChange={(event) =>
                        setProfileForm({
                          ...profileForm,
                          bio: event.target.value,
                        })
                      }
                      placeholder="Write a little about yourself..."
                    />

                    <label>Website</label>

                    <input
                      value={profileForm.website}
                      onChange={(event) =>
                        setProfileForm({
                          ...profileForm,
                          website: event.target.value,
                        })
                      }
                      placeholder="https://example.com"
                    />

                    <button
                      className="primary-button"
                      disabled={busy}
                    >
                      {busy ? "Saving..." : "Save changes"}
                    </button>
                  </form>
                )}

                <div className="profile-stats">
                  <div>
                    <strong>
                      {posts.filter((p) => p.user_id === user.id).length}
                    </strong>
                    <span>Posts</span>
                  </div>

                  <div>
                    <strong>{followStats.followers}</strong>
                    <span>Followers</span>
                  </div>

                  <div>
                    <strong>{followStats.following}</strong>
                    <span>Following</span>
                  </div>
                </div>
              </div>

              <div className="section-heading profile-post-heading">
                <h2>Your posts</h2>
              </div>

              <PostList
                posts={visiblePosts}
                likedPosts={likedPosts}
                savedPosts={savedPosts}
                onLike={toggleLike}
                onSave={(id) =>
                  setSavedPosts((current) =>
                    current.includes(id)
                      ? current.filter((item) => item !== id)
                      : [...current, id]
                  )
                }
                onComments={loadComments}
                openComments={openComments}
                comments={comments}
                commentText={commentText}
                setCommentText={setCommentText}
                onAddComment={addComment}
                onOpenProfile={openUserProfile}
              />
            </section>
          )}

          {/* MESSAGES */}

          {activePage === "messages" && (
            <section className="other-page">
              <span className="eyebrow">PRIVATE CONVERSATIONS</span>
              <h1>Messages</h1>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
                  gap: "18px",
                  marginTop: "24px",
                }}
              >
                {/* CONVERSATION LIST */}

                <div
                  style={{
                    background: "#17151f",
                    border: "1px solid rgba(160,130,255,.18)",
                    borderRadius: "16px",
                    padding: "14px",
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <h3 style={{ margin: "5px 0 14px" }}>
                      Your chats
                    </h3>

                    <button
                      className="secondary-button"
                      onClick={loadConversations}
                      style={{ padding: "7px 10px" }}
                    >
                      Refresh
                    </button>
                  </div>

                  {messagesLoading && conversations.length === 0 ? (
                    <p>Loading conversations...</p>
                  ) : conversations.length === 0 ? (
                    <p style={{ color: "#a49ab9", fontSize: "13px" }}>
                      No conversations yet. Visit someone's profile and
                      press Message to start a chat.
                    </p>
                  ) : (
                    <div style={{ display: "grid", gap: "8px" }}>
                      {conversations.map((conversation) => {
                        const person = conversation.otherProfile || {};
                        const name =
                          person.display_name ||
                          person.full_name ||
                          person.username ||
                          "Member";

                        const isActive =
                          activeConversation?.id === conversation.id;

                        const lastMessage = conversation.lastMessage;

                        const lastMessagePreview =
                          lastMessage?.message_type === "image"
                            ? "📷 Photo"
                            : lastMessage?.message_type === "video"
                            ? "🎥 Video"
                            : lastMessage?.content || "Start a conversation";

                        return (
                          <button
                            key={conversation.id}
                            onClick={async () => {
                              setActiveConversation(conversation);
                              setConversationMessages([]);
                              setMessageText("");
                              setMessageFile(null);

                              if (messageMediaInput.current) {
                                messageMediaInput.current.value = "";
                              }

                              await loadMessages(conversation.id);
                            }}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                              width: "100%",
                              textAlign: "left",
                              padding: "10px",
                              borderRadius: "12px",
                              border: isActive
                                ? "1px solid #9670ff"
                                : "1px solid rgba(160,130,255,.12)",
                              background: isActive
                                ? "rgba(116,75,220,.2)"
                                : "transparent",
                              color: "white",
                              cursor: "pointer",
                            }}
                          >
                            <Avatar
                              url={person.avatar_url}
                              name={name}
                              size="large"
                            />

                            <span style={{ minWidth: 0, flex: 1 }}>
                              <strong
                                style={{
                                  display: "block",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {name}
                              </strong>

                              <small
                                style={{
                                  display: "block",
                                  color: "#a49ab9",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {lastMessagePreview}
                              </small>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* CHAT WINDOW */}

                <div
                  style={{
                    background: "#17151f",
                    border: "1px solid rgba(160,130,255,.18)",
                    borderRadius: "16px",
                    padding: "14px",
                    minWidth: 0,
                    display: "flex",
                    flexDirection: "column",
                    minHeight: "430px",
                  }}
                >
                  {activeConversation ? (
                    <>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          paddingBottom: "14px",
                          borderBottom: "1px solid rgba(160,130,255,.15)",
                        }}
                      >
                        <Avatar
                          url={activeConversation.otherProfile?.avatar_url}
                          name={
                            activeConversation.otherProfile?.display_name ||
                            activeConversation.otherProfile?.username
                          }
                          size="large"
                        />

                        <div>
                          <strong>
                            {activeConversation.otherProfile?.display_name ||
                              activeConversation.otherProfile?.full_name ||
                              activeConversation.otherProfile?.username ||
                              "Member"}
                          </strong>

                          <div
                            style={{
                              color: "#a49ab9",
                              fontSize: "12px",
                            }}
                          >
                            Private conversation
                          </div>
                        </div>
                      </div>

                      {/* MESSAGE HISTORY */}

                      <div
                        style={{
                          flex: 1,
                          overflowY: "auto",
                          display: "flex",
                          flexDirection: "column",
                          gap: "10px",
                          padding: "16px 2px",
                          minHeight: "260px",
                          maxHeight: "450px",
                        }}
                      >
                        {messagesLoading ? (
                          <p>Loading messages...</p>
                        ) : conversationMessages.length === 0 ? (
                          <p
                            style={{
                              color: "#a49ab9",
                              textAlign: "center",
                              margin: "auto",
                            }}
                          >
                            No messages yet. Say hello!
                          </p>
                        ) : (
                          conversationMessages.map((message) => {
                            const mine = message.sender_id === user.id;

                            const isImage =
                              message.message_type === "image" &&
                              message.media_url;

                            const isVideo =
                              message.message_type === "video" &&
                              message.media_url;

                            const isMedia =
                              isImage || isVideo;

                            return (
                              <div
                                key={message.id}
                                style={{
                                  alignSelf: mine
                                    ? "flex-end"
                                    : "flex-start",
                                  maxWidth: "85%",
                                  minWidth: 0,
                                  background: mine
                                    ? "rgba(116,75,220,.35)"
                                    : "#252230",
                                  border: "1px solid rgba(160,130,255,.16)",
                                  borderRadius: "14px",
                                  padding: "10px 13px",
                                  color: "white",
                                  overflowWrap: "anywhere",
                                }}
                              >
                                {isImage && (
                                  <img
                                    src={message.media_url}
                                    alt={message.file_name || "Shared image"}
                                    loading="lazy"
                                    style={{
                                      display: "block",
                                      width: "100%",
                                      maxWidth: "320px",
                                      maxHeight: "320px",
                                      objectFit: "contain",
                                      borderRadius: "10px",
                                      marginBottom:
                                        message.content &&
                                        message.content !== "Photo"
                                          ? "8px"
                                          : "0",
                                    }}
                                  />
                                )}

                                {isVideo && (
                                  <video
                                    src={message.media_url}
                                    controls
                                    playsInline
                                    preload="metadata"
                                    style={{
                                      display: "block",
                                      width: "100%",
                                      maxWidth: "320px",
                                      maxHeight: "320px",
                                      borderRadius: "10px",
                                      marginBottom:
                                        message.content &&
                                        message.content !== "Video"
                                          ? "8px"
                                          : "0",
                                    }}
                                  />
                                )}

                                {(!isMedia ||
                                  (message.content &&
                                    message.content !== "Photo" &&
                                    message.content !== "Video")) && (
                                  <div>{message.content}</div>
                                )}

                                <small
                                  style={{
                                    display: "block",
                                    color: "#b9afcb",
                                    fontSize: "10px",
                                    marginTop: "5px",
                                    textAlign: "right",
                                  }}
                                >
                                  {timeAgo(message.created_at)}
                                </small>
                              </div>
                            );
                          })
                        )}

                        <div ref={messagesEndRef} />
                      </div>

                      {/* SELECTED MEDIA PREVIEW */}

                      {messageFile && messageFilePreview && (
                        <div
                          style={{
                            borderTop: "1px solid rgba(160,130,255,.15)",
                            padding: "12px 0",
                            display: "flex",
                            alignItems: "center",
                            gap: "12px",
                            minWidth: 0,
                          }}
                        >
                          {messageFile.type.startsWith("image/") ? (
                            <img
                              src={messageFilePreview}
                              alt="Preview"
                              style={{
                                width: "76px",
                                height: "76px",
                                objectFit: "cover",
                                borderRadius: "10px",
                              }}
                            />
                          ) : (
                            <video
                              src={messageFilePreview}
                              style={{
                                width: "110px",
                                height: "76px",
                                objectFit: "cover",
                                borderRadius: "10px",
                              }}
                            />
                          )}

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <strong
                              style={{
                                display: "block",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {messageFile.name}
                            </strong>

                            <small style={{ color: "#a49ab9" }}>
                              {(messageFile.size / (1024 * 1024)).toFixed(2)} MB
                            </small>
                          </div>

                          <button
                            type="button"
                            onClick={clearMessageFile}
                            disabled={messageSending}
                            className="secondary-button"
                            style={{
                              padding: "7px 11px",
                              flexShrink: 0,
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      )}

                      {/* MESSAGE COMPOSER */}

                      <form
                        onSubmit={sendMessage}
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "8px",
                          borderTop: "1px solid rgba(160,130,255,.15)",
                          paddingTop: "12px",
                        }}
                      >
                        <input
                          ref={messageMediaInput}
                          type="file"
                          accept="image/*,video/*"
                          hidden
                          onChange={handleMessageFileChange}
                        />

                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => messageMediaInput.current?.click()}
                          disabled={messageSending}
                          title="Attach a photo or video"
                          style={{
                            padding: "10px 13px",
                            flexShrink: 0,
                          }}
                        >
                          📎
                        </button>

                        <input
                          value={messageText}
                          onChange={(event) =>
                            setMessageText(event.target.value)
                          }
                          placeholder="Write a message..."
                          disabled={messageSending}
                          style={{
                            flex: 1,
                            minWidth: "100px",
                            padding: "12px",
                            borderRadius: "12px",
                            border: "1px solid rgba(160,130,255,.25)",
                            background: "#100e17",
                            color: "white",
                          }}
                        />

                        <button
                          className="primary-button"
                          type="submit"
                          disabled={
                            messageSending ||
                            (!messageText.trim() && !messageFile)
                          }
                        >
                          {messageSending ? "Sending..." : "Send"}
                        </button>
                      </form>

                      <small
                        style={{
                          color: "#a49ab9",
                          fontSize: "11px",
                          marginTop: "7px",
                        }}
                      >
                        Images and videos only · Maximum 100 MB
                      </small>
                    </>
                  ) : (
                    <div
                      style={{
                        flex: 1,
                        display: "grid",
                        placeItems: "center",
                        textAlign: "center",
                        color: "#a49ab9",
                        padding: "20px",
                      }}
                    >
                      <div>
                        <h3 style={{ color: "white" }}>
                          Your private messages
                        </h3>
                        <p>
                          Choose a conversation or visit a person's
                          profile and press Message.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* NOTIFICATIONS */}

          {activePage === "activity" && (
            <section className="other-page">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "15px",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <span className="eyebrow">STAY IN THE LOOP</span>
                  <h1>Notifications</h1>
                  <p>
                    {unreadCount
                      ? `You have ${unreadCount} unread notifications.`
                      : "You're all caught up."}
                  </p>
                </div>

                {unreadCount > 0 && (
                  <button
                    className="secondary-button"
                    onClick={markAllNotificationsRead}
                  >
                    Mark all as read
                  </button>
                )}
              </div>

              {notificationLoading ? (
                <p>Loading notifications...</p>
              ) : notifications.length === 0 ? (
                <div className="empty-state">
                  <span>✦</span>
                  <h3>No notifications yet</h3>
                  <p>
                    Likes, comments and new followers will appear here.
                  </p>
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gap: "12px",
                    marginTop: "24px",
                  }}
                >
                  {notifications.map((item) => {
                    const actor = item.actor || {};

                    const actorName =
                      actor.display_name ||
                      actor.full_name ||
                      actor.username ||
                      "Someone";

                    let message = "interacted with you.";

                    if (item.type === "like") {
                      message = "liked your post.";
                    } else if (item.type === "comment") {
                      message = "commented on your post.";
                    } else if (item.type === "follow") {
                      message = "started following you.";
                    }

                    return (
                      <div
                        key={item.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "14px",
                          padding: "16px",
                          borderRadius: "16px",
                          background: item.is_read
                            ? "#17151f"
                            : "rgba(116,75,220,.17)",
                          border: "1px solid rgba(160,130,255,.18)",
                        }}
                      >
                        <button
                          onClick={() => openUserProfile(item.actor_id)}
                          style={{
                            border: "none",
                            background: "transparent",
                            padding: 0,
                            cursor: "pointer",
                          }}
                        >
                          <Avatar
                            url={actor.avatar_url}
                            name={actorName}
                            size="large"
                          />
                        </button>

                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0 }}>
                            <strong>{actorName}</strong>{" "}
                            {message}
                          </p>

                          <span
                            style={{
                              color: "#a49ab9",
                              fontSize: "12px",
                            }}
                          >
                            {timeAgo(item.created_at)}
                          </span>
                        </div>

                        {!item.is_read && (
                          <span
                            style={{
                              width: "9px",
                              height: "9px",
                              borderRadius: "50%",
                              background: "#9b78ff",
                              flexShrink: 0,
                            }}
                          />
                        )}

                        {!item.is_read && (
                          <button
                            className="secondary-button"
                            onClick={() =>
                              markNotificationRead(item.id)
                            }
                            style={{ padding: "8px 10px" }}
                          >
                            Read
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

// ----------------------------------
// POST LIST COMPONENT
// ----------------------------------

function PostList({
  posts,
  likedPosts,
  savedPosts,
  onLike,
  onSave,
  onComments,
  openComments,
  comments,
  commentText,
  setCommentText,
  onAddComment,
  onOpenProfile,
}) {
  if (!posts.length) {
    return (
      <div className="empty-state">
        <span>✦</span>
        <h3>Nothing here yet</h3>
        <p>
          When posts are available, they will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="posts-list">
      {posts.map((post) => {
        const author = post.author || {};

        const name =
          author.display_name ||
          author.full_name ||
          author.username ||
          "Member";

        const liked = likedPosts.includes(post.id);
        const saved = savedPosts.includes(post.id);

        return (
          <article className="post-card" key={post.id}>
            <div className="post-header">
              <button
                onClick={() => onOpenProfile?.(post.user_id)}
                style={{
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  cursor: "pointer",
                }}
              >
                <Avatar
                  url={author.avatar_url}
                  name={name}
                />
              </button>

              <div className="post-author">
                <button
                  onClick={() => onOpenProfile?.(post.user_id)}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "inherit",
                    padding: 0,
                    cursor: "pointer",
                    fontWeight: "bold",
                  }}
                >
                  {name}
                </button>

                <span>
                  @{author.username || "member"} ·{" "}
                  {timeAgo(post.created_at)}
                </span>
              </div>

              <span className="post-menu">•••</span>
            </div>

            {post.content && (
              <p className="post-content">
                {post.content}
              </p>
            )}

            {post.image_url && (
              <div className="post-image">
                <img
                  src={post.image_url}
                  alt="Post"
                  loading="lazy"
                />
              </div>
            )}

            <div className="post-stats">
              <span>{post.likesCount || 0} likes</span>

              <span onClick={() => onComments(post.id)}>
                View comments
              </span>
            </div>

            <div className="post-actions">
              <button
                className={liked ? "liked" : ""}
                onClick={() => onLike(post.id)}
              >
                {liked ? "♥" : "♡"} <span>Like</span>
              </button>

              <button onClick={() => onComments(post.id)}>
                ◯ <span>Comment</span>
              </button>

              <button
                className={saved ? "saved" : ""}
                onClick={() => onSave(post.id)}
              >
                ▣ <span>{saved ? "Saved" : "Save"}</span>
              </button>
            </div>

            {openComments === post.id && (
              <div className="comments-area">
                {comments.map((comment) => (
                  <div className="comment-item" key={comment.id}>
                    <Avatar
                      url={comment.author?.avatar_url}
                      name={comment.author?.username}
                      size="small"
                    />

                    <div>
                      <strong>
                        {comment.author?.display_name ||
                          comment.author?.username ||
                          "Member"}
                      </strong>

                      <p>{comment.content}</p>
                    </div>
                  </div>
                ))}

                <form
                  className="comment-form"
                  onSubmit={(event) =>
                    onAddComment(event, post.id)
                  }
                >
                  <input
                    value={commentText}
                    onChange={(event) =>
                      setCommentText(event.target.value)
                    }
                    placeholder="Write a comment..."
                  />

                  <button type="submit">
                    Send ↗
                  </button>
                </form>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
