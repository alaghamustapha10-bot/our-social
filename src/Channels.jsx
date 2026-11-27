import { useCallback, useEffect, useRef, useState } from "react";

import {
  Radio,
  Plus,
  Search,
  Send,
  Lock,
  Globe,
  Users,
  ArrowRight,
  LogOut,
  RefreshCw,
  X,
  Sparkles,
  Info,
  Copy,
  CheckCircle2,
  Mic,
  Square,
  ImagePlus,
  Trash2,
  Loader2,
  Flag,
} from "lucide-react";

import { supabase } from "./supabase";
import Calls from "./Calls";
import { dispatchLolzPush } from "./pushNotifications";

import "./Channels.css";

export default function Channels({
  user,
  onCallContextChange,
  onReport,
  initialChannelId = null,
  onInitialChannelOpened,
}) {
  const [channels, setChannels] = useState([]);
  const [selected, setSelected] = useState(null);
  const [posts, setPosts] = useState([]);
  const [members, setMembers] = useState([]);
  const [role, setRole] = useState(null);

  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState("all");
  const [subscribedChannelIds, setSubscribedChannelIds] = useState([]);
  const [showChannelInfo, setShowChannelInfo] = useState(false);
  const [memberProfiles, setMemberProfiles] = useState({});
  const [content, setContent] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [inviteCode, setInviteCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // حالة الرسائل الصوتية
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voiceFile, setVoiceFile] = useState(null);
  const [voicePreviewUrl, setVoicePreviewUrl] = useState("");
  const [uploadingVoice, setUploadingVoice] = useState(false);
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState("");
  const [uploadingMedia, setUploadingMedia] = useState(false);

  const postsContainerRef = useRef(null);
  const scrollToBottomRef = useRef(false);

  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const recordingChannelIdRef = useRef(null);
  const recordingCancelledRef = useRef(false);
  const recordingStartedAtRef = useRef(null);
  const recordingPointerRef = useRef(false);
  const recordingStartXRef = useRef(0);
  const publishVoiceMessageRef = useRef(null);
  const mediaInputRef = useRef(null);

  const isAdmin = role === "owner" || role === "admin";

  const isNearBottom = () => {
    const container = postsContainerRef.current;
    if (!container) return true;

    return (
      container.scrollHeight -
        container.scrollTop -
        container.clientHeight <
      120
    );
  };

  const loadChannels = useCallback(async () => {
    if (!user?.id) return;

    const [{ data, error: loadError }, { data: membershipRows, error: membershipError }] = await Promise.all([
      supabase
        .from("channels")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("channel_members")
        .select("channel_id")
        .eq("user_id", user.id),
    ]);

    if (loadError) {
      setError(loadError.message);
      return;
    }

    setChannels(data || []);
    if (!membershipError) {
      setSubscribedChannelIds((membershipRows || []).map((row) => String(row.channel_id)));
    } else {
      console.warn("Could not load subscribed channel list:", membershipError.message);
      setSubscribedChannelIds([]);
    }
  }, [user?.id]);

  const loadPosts = useCallback(
    async (channel, stickToBottom = isNearBottom()) => {
      if (!channel?.id) return;

      const { data, error: postsError } = await supabase
        .from("channel_posts")
        .select("*")
        .eq("channel_id", channel.id)
        .order("created_at", { ascending: true });

      if (postsError) {
        setError(postsError.message);
        return;
      }

      const { data: memberData, error: memberError } =
        await supabase
          .from("channel_members")
          .select("*")
          .eq("channel_id", channel.id);

      if (memberError) {
        setError(memberError.message);
        return;
      }

      scrollToBottomRef.current = stickToBottom;
      setPosts(data || []);
      setMembers(memberData || []);

      const memberIds = [...new Set((memberData || []).map((member) => member.user_id).filter(Boolean))];
      if (memberIds.length) {
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, display_name, full_name, username, avatar_url, is_verified")
          .in("id", memberIds);

        if (!profilesError) {
          setMemberProfiles(Object.fromEntries((profiles || []).map((profile) => [profile.id, profile])));
        }
      } else {
        setMemberProfiles({});
      }

      const membership = (memberData || []).find(
        (member) => member.user_id === user?.id
      );

      setRole(membership?.role || null);
    },
    [user?.id]
  );

  useEffect(() => {
    if (!scrollToBottomRef.current) return;

    const frame = requestAnimationFrame(() => {
      const container = postsContainerRef.current;

      container?.scrollTo({
        top: container.scrollHeight,
        behavior: "smooth",
      });

      scrollToBottomRef.current = false;
    });

    return () => cancelAnimationFrame(frame);
  }, [posts]);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  useEffect(() => {
    if (!initialChannelId || !channels.length) return;

    const targetChannel = channels.find(
      (channel) => String(channel.id) === String(initialChannelId)
    );

    if (!targetChannel) return;

    if (String(selected?.id || "") !== String(targetChannel.id)) {
      setSelected(targetChannel);
    }

    onInitialChannelOpened?.();
  }, [initialChannelId, channels, selected?.id, onInitialChannelOpened]);

  useEffect(() => {
    if (!selected) {
      setPosts([]);
      setMembers([]);
      setRole(null);
      scrollToBottomRef.current = false;
      return;
    }

    loadPosts(selected, true);
  }, [selected, loadPosts]);

  const stopMediaStream = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        track.stop();
      });

      mediaStreamRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!mediaFile) {
      setMediaPreviewUrl("");
      return undefined;
    }

    const previewUrl = URL.createObjectURL(mediaFile);
    setMediaPreviewUrl(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [mediaFile]);

  const clearMediaFile = useCallback(() => {
    setMediaFile(null);
    if (mediaInputRef.current) mediaInputRef.current.value = "";
  }, []);

  const handleMediaChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      setError("يرجى اختيار صورة أو فيديو.");
      event.target.value = "";
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      setError("الحد الأقصى لحجم الملف هو 100 ميغابايت.");
      event.target.value = "";
      return;
    }

    setError("");
    setMediaFile(file);
  };

  const clearVoicePreview = useCallback(() => {
    setVoiceFile(null);

    setVoicePreviewUrl((previousUrl) => {
      if (previousUrl) {
        URL.revokeObjectURL(previousUrl);
      }

      return "";
    });
  }, []);

  const cancelRecording = useCallback(() => {
    recordingPointerRef.current = false;
    recordingCancelledRef.current = true;

    const recorder = mediaRecorderRef.current;

    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }

    mediaRecorderRef.current = null;
    recordingChunksRef.current = [];
    recordingChannelIdRef.current = null;
    recordingStartedAtRef.current = null;

    stopMediaStream();

    setIsRecording(false);
    setRecordingSeconds(0);

    clearVoicePreview();
  }, [clearVoicePreview, stopMediaStream]);

  useEffect(() => {
    if (!isRecording) return;

    const interval = window.setInterval(() => {
      if (!recordingStartedAtRef.current) return;

      setRecordingSeconds(
        Math.floor(
          (Date.now() - recordingStartedAtRef.current) / 1000
        )
      );
    }, 500);

    return () => window.clearInterval(interval);
  }, [isRecording]);

  useEffect(() => {
    if (
      recordingChannelIdRef.current &&
      recordingChannelIdRef.current !== selected?.id
    ) {
      cancelRecording();
    }
  }, [selected?.id, cancelRecording]);

  useEffect(() => {
    return () => {
      const recorder = mediaRecorderRef.current;

      if (recorder && recorder.state !== "inactive") {
        recordingCancelledRef.current = true;
        recorder.stop();
      }

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
      }

      if (voicePreviewUrl) {
        URL.revokeObjectURL(voicePreviewUrl);
      }
    };
  }, [voicePreviewUrl]);

  const startVoiceRecording = async () => {
    if (
      !selected?.id ||
      !isAdmin ||
      loading ||
      uploadingVoice ||
      isRecording ||
      mediaRecorderRef.current
    ) {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError("التسجيل الصوتي غير مدعوم في هذا المتصفح.");
      return;
    }

    try {
      clearVoicePreview();
      setError("");

      recordingCancelledRef.current = false;
      recordingChunksRef.current = [];
      recordingChannelIdRef.current = selected.id;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      if (!recordingPointerRef.current || selected?.id !== recordingChannelIdRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        recordingChannelIdRef.current = null;
        return;
      }

      mediaStreamRef.current = stream;

      const mimeTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/ogg",
      ];

      const supportedMimeType = mimeTypes.find((type) =>
        MediaRecorder.isTypeSupported(type)
      );

      const recorder = supportedMimeType
        ? new MediaRecorder(stream, { mimeType: supportedMimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        recordingCancelledRef.current = true;
        recordingPointerRef.current = false;
        stopMediaStream();
        mediaRecorderRef.current = null;
        recordingChannelIdRef.current = null;
        setIsRecording(false);
        setError("حدث خطأ أثناء تسجيل الصوت.");
      };

      recorder.onstop = () => {
        const wasCancelled = recordingCancelledRef.current;
        const chunks = recordingChunksRef.current;

        mediaRecorderRef.current = null;
        recordingChunksRef.current = [];

        stopMediaStream();

        if (wasCancelled || !chunks.length) {
          recordingChannelIdRef.current = null;
          return;
        }

        const mimeType = recorder.mimeType || "audio/webm";

        const extension = mimeType.includes("ogg")
          ? "ogg"
          : mimeType.includes("mp4")
          ? "m4a"
          : "webm";

        const audioBlob = new Blob(chunks, { type: mimeType });

        if (!audioBlob.size) {
          recordingChannelIdRef.current = null;
          setError("التسجيل فارغ، يرجى المحاولة مرة أخرى.");
          return;
        }

        const file = new File(
          [audioBlob],
          `voice-${Date.now()}.${extension}`,
          { type: mimeType }
        );

        recordingPointerRef.current = false;
        setIsRecording(false);
        recordingChannelIdRef.current = null;
        void publishVoiceMessageRef.current?.(file);
      };

      recordingStartedAtRef.current = Date.now();
      recorder.start(250);

      setRecordingSeconds(0);
      setIsRecording(true);
    } catch (err) {
      stopMediaStream();
      mediaRecorderRef.current = null;
      recordingPointerRef.current = false;
      recordingChannelIdRef.current = null;
      recordingStartedAtRef.current = null;

      setIsRecording(false);
      setError(err.message || "تعذر الوصول إلى الميكروفون.");
    }
  };

  const stopVoiceRecording = () => {
    recordingPointerRef.current = false;
    const recorder = mediaRecorderRef.current;

    if (!recorder || recorder.state === "inactive") return;

    setIsRecording(false);

    if (recorder.state === "recording") {
      recorder.stop();
    }
  };

  const createChannel = async (event) => {
    event.preventDefault();

    if (!name.trim() || !user?.id || loading) return;

    setLoading(true);
    setError("");

    try {
      const code = isPublic
        ? null
        : crypto.randomUUID().replaceAll("-", "");

      const { data, error: createError } = await supabase
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

      if (createError) throw createError;

      setShowCreate(false);
      setName("");
      setDescription("");
      setIsPublic(true);

      await loadChannels();
      setSelected(data);
    } catch (err) {
      setError(err.message || "تعذر إنشاء القناة.");
    } finally {
      setLoading(false);
    }
  };

  const joinChannel = async (channel) => {
    if (loading) return;

    setLoading(true);
    setError("");

    try {
      const { error: joinError } = await supabase
        .from("channel_members")
        .insert({
          channel_id: channel.id,
          user_id: user.id,
          role: "subscriber",
        });

      if (joinError && joinError.code !== "23505") {
        throw joinError;
      }

      if (!joinError) {
        void dispatchLolzPush(supabase, {
          action: "channel_join",
          channel_id: channel.id,
        });
      }

      await loadChannels();
      await loadPosts(channel);
    } catch (err) {
      setError(err.message || "تعذر الانضمام إلى القناة.");
    } finally {
      setLoading(false);
    }
  };

  const joinPrivateChannel = async (event) => {
    event.preventDefault();

    if (!inviteCode.trim() || loading) return;

    setLoading(true);
    setError("");

    try {
      const { data, error: joinError } = await supabase.rpc(
        "join_channel_by_invite",
        { p_invite_code: inviteCode.trim() }
      );

      if (joinError) throw joinError;

      void dispatchLolzPush(supabase, {
        action: "channel_join",
        channel_id: String(data),
      });

      setInviteCode("");
      await loadChannels();

      const { data: found, error: findError } = await supabase
        .from("channels")
        .select("*")
        .eq("id", data)
        .single();

      if (findError) throw findError;

      setSelected(found);
      setShowChannelInfo(false);
    } catch (err) {
      setError(err.message || "رمز الدعوة غير صحيح.");
    } finally {
      setLoading(false);
    }
  };

  const publishMediaPost = async (fileToSend = mediaFile) => {
    if (!fileToSend || !selected?.id || !isAdmin || loading || uploadingMedia) return;

    const channelAtUpload = selected;
    const caption = content.trim();
    const messageType = fileToSend.type.startsWith("image/") ? "image" : "video";
    const stickToBottom = isNearBottom();
    let filePath = null;

    setUploadingMedia(true);
    setError("");

    try {
      const fileName = messageType + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + "-" + fileToSend.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      filePath = user.id + "/messages/" + fileName;

      const { error: uploadError } = await supabase.storage
        .from("social-media")
        .upload(filePath, fileToSend, {
          cacheControl: "3600",
          contentType: fileToSend.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("social-media")
        .getPublicUrl(filePath);
      const mediaUrl = publicUrlData?.publicUrl;
      if (!mediaUrl) throw new Error("تعذر إنشاء رابط الوسائط.");

      if (selected?.id !== channelAtUpload.id) {
        throw new Error("تم تغيير القناة قبل اكتمال رفع الملف.");
      }

      const { data: newPost, error: publishError } = await supabase
        .from("channel_posts")
        .insert({
          channel_id: channelAtUpload.id,
          sender_id: user.id,
          content: caption || (messageType === "image" ? "Photo" : "Video"),
          message_type: messageType,
          media_url: mediaUrl,
        })
        .select("id")
        .single();

      if (publishError) throw publishError;

      if (newPost?.id) {
        void dispatchLolzPush(supabase, {
          action: "channel_post",
          post_id: newPost.id,
        });
      }

      setContent("");
      clearMediaFile();
      await loadPosts(channelAtUpload, stickToBottom);
    } catch (err) {
      if (filePath) {
        const { error: cleanupError } = await supabase.storage
          .from("social-media")
          .remove([filePath]);
        if (cleanupError) console.warn("Could not remove unsent channel media:", cleanupError.message);
      }

      setError(err.message || "تعذر نشر الوسائط في القناة.");
    } finally {
      setUploadingMedia(false);
    }
  };

  const publishPost = async (event) => {
    event.preventDefault();

    if ((!content.trim() && !mediaFile) || !selected || !isAdmin || loading || uploadingMedia || uploadingVoice) return;

    if (mediaFile) {
      await publishMediaPost();
      return;
    }

    const stickToBottom = isNearBottom();

    setLoading(true);
    setError("");

    try {
      const { data: newPost, error: publishError } = await supabase
        .from("channel_posts")
        .insert({
          channel_id: selected.id,
          sender_id: user.id,
          content: content.trim(),
          message_type: "text",
        })
        .select("id")
        .single();

      if (publishError) throw publishError;

      if (newPost?.id) {
        void dispatchLolzPush(supabase, {
          action: "channel_post",
          post_id: newPost.id,
        });
      }

      setContent("");
      await loadPosts(selected, stickToBottom);
    } catch (err) {
      setError(err.message || "تعذر نشر المنشور.");
    } finally {
      setLoading(false);
    }
  };

  const publishVoiceMessage = async (voiceFileToSend = voiceFile) => {
    if (
      !voiceFileToSend ||
      !selected?.id ||
      !isAdmin ||
      loading ||
      uploadingVoice
    ) {
      return;
    }

    const channelAtUpload = selected;
    const stickToBottom = isNearBottom();

    setUploadingVoice(true);
    setError("");

    try {
      const fileName = `voice-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}.${voiceFileToSend.name.split(".").pop() || "webm"}`;

      const filePath = `${user.id}/messages/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("social-media")
        .upload(filePath, voiceFileToSend, {
          contentType: voiceFileToSend.type || "audio/webm",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("social-media")
        .getPublicUrl(filePath);

      const mediaUrl = publicUrlData?.publicUrl;

      if (!mediaUrl) {
        throw new Error("تعذر إنشاء رابط الرسالة الصوتية.");
      }

      const { data: newPost, error: publishError } = await supabase
        .from("channel_posts")
        .insert({
          channel_id: channelAtUpload.id,
          sender_id: user.id,
          content: "",
          message_type: "audio",
          media_url: mediaUrl,
        })
        .select("id")
        .single();

      if (publishError) throw publishError;

      if (newPost?.id) {
        void dispatchLolzPush(supabase, {
          action: "channel_post",
          post_id: newPost.id,
        });
      }

      clearVoicePreview();

      if (selected?.id === channelAtUpload.id) {
        await loadPosts(channelAtUpload, stickToBottom);
      }
    } catch (err) {
      setError(err.message || "تعذر نشر الرسالة الصوتية.");
    } finally {
      setUploadingVoice(false);
    }
  };

  useEffect(() => {
    publishVoiceMessageRef.current = publishVoiceMessage;
  }, [publishVoiceMessage]);

  useEffect(() => {
    clearMediaFile();
  }, [selected?.id, clearMediaFile]);

  const leaveChannel = async () => {
    if (!selected || loading) return;

    if (!window.confirm("هل تريد مغادرة هذه القناة؟")) return;

    setLoading(true);
    setError("");

    try {
      const { error: leaveError } = await supabase.rpc(
        "leave_channel",
        { p_channel_id: selected.id }
      );

      if (leaveError) throw leaveError;

      cancelRecording();
      setSelected(null);
      setShowChannelInfo(false);
      await loadChannels();
    } catch (err) {
      setError(err.message || "تعذر مغادرة القناة.");
    } finally {
      setLoading(false);
    }
  };

  const filteredChannels = channels.filter((channel) => {
    const matchesSearch = channel.name?.toLowerCase().includes(search.toLowerCase()) ||
      channel.description?.toLowerCase().includes(search.toLowerCase());
    const isSubscribed = subscribedChannelIds.includes(String(channel.id));
    const matchesFilter =
      channelFilter === "all" ||
      (channelFilter === "subscribed" && isSubscribed) ||
      (channelFilter === "discover" && channel.is_public && !isSubscribed) ||
      (channelFilter === "private" && !channel.is_public);
    return matchesSearch && matchesFilter;
  });

  const copyChannelInvite = async () => {
    if (!selected?.invite_code) return;
    try {
      await navigator.clipboard.writeText(selected.invite_code);
      setError("");
    } catch {
      setError("تعذر نسخ رمز الدعوة. انسخه يدوياً.");
    }
  };

  useEffect(() => {
    onCallContextChange?.(null);
  }, [onCallContextChange]);

  const formatDate = (value) => {
    if (!value) return "";

    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  };

  const formatRecordingTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(
      remainingSeconds
    ).padStart(2, "0")}`;
  };

  return (
    <section className={`channels-page ${selected ? "channel-chat-open" : ""} ${selected && showChannelInfo ? "show-channel-info" : ""}`}>
      <aside className={`channels-sidebar ${selected ? "mobile-hidden" : ""}`}>
        <div className="channels-heading">
          <div className="channels-brand">
            <div className="channels-brand-icon">
              <Radio size={22} />
            </div>

            <div>
              <h2>القنوات</h2>
              <span>بث مجتمع LOLZ</span>
            </div>
          </div>

          <button
            type="button"
            className="channels-create-button"
            onClick={() => setShowCreate(true)}
            title="إنشاء قناة"
            aria-label="إنشاء قناة"
          >
            <Plus size={22} />
          </button>
        </div>

        <div className="channels-search">
          <Search size={18} />

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ابحث في القنوات..."
          />

          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="مسح البحث"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <div className="channels-filter-tabs" role="tablist" aria-label="تصفية القنوات">
          {[
            ["all", "الكل"],
            ["subscribed", "مشترك بها"],
            ["discover", "اكتشف"],
            ["private", "خاصة"],
          ].map(([value, label]) => (
            <button
              type="button"
              role="tab"
              aria-selected={channelFilter === value}
              className={channelFilter === value ? "active" : ""}
              key={value}
              onClick={() => setChannelFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>

        <form className="channels-join-code" onSubmit={joinPrivateChannel}>
          <input
            value={inviteCode}
            onChange={(event) => setInviteCode(event.target.value)}
            placeholder="رمز قناة خاصة"
          />

          <button disabled={loading || !inviteCode.trim()}>
            انضمام
          </button>
        </form>

        <div className="channels-list">
          {filteredChannels.map((channel) => (
            <button
              key={channel.id}
              className={`channel-list-item ${
                selected?.id === channel.id ? "active" : ""
              }`}
              onClick={() => {
                setSelected(channel);
                setShowChannelInfo(false);
              }}
            >
              <div className="channel-avatar">
                {channel.avatar_url ? (
                  <img src={channel.avatar_url} alt="" />
                ) : (
                  <Radio size={21} />
                )}
              </div>

              <div className="channel-list-details">
                <strong>{channel.name}</strong>
                <span>
                  {subscribedChannelIds.includes(String(channel.id))
                    ? "مشترك · قناة"
                    : channel.is_public ? "قناة عامة" : "قناة خاصة"}
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
              <p>لا توجد قنوات مطابقة</p>
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
                onClick={() => {
                  cancelRecording();
                  setSelected(null);
                }}
                title="العودة إلى القنوات"
                aria-label="العودة إلى القنوات"
              >
                <ArrowRight size={20} />
              </button>

              <div className="channel-avatar">
                {selected.avatar_url ? (
                  <img src={selected.avatar_url} alt="" />
                ) : (
                  <Radio size={21} />
                )}
              </div>

              <div className="channel-header-details">
                <strong>{selected.name}</strong>
                <span>{members.length} مشترك</span>
              </div>

              <button
                className="channel-header-info-button"
                onClick={() => setShowChannelInfo((value) => !value)}
                title="معلومات القناة"
                aria-label="معلومات القناة"
                aria-expanded={showChannelInfo}
              >
                <Info size={19} />
              </button>

              <button
                className="channel-refresh"
                onClick={() => loadPosts(selected)}
                title="تحديث"
                aria-label="تحديث القناة"
              >
                <RefreshCw size={18} />
              </button>
            </header>

            <div className="channel-description">
              {selected.description || "مرحباً بك في هذه القناة."}
              <span className="channel-description-meta">
                <Users size={14} /> {members.length} مشترك
                {selected.is_public ? <Globe size={13} /> : <Lock size={13} />}
              </span>
            </div>

            {role && (
              <div className="channel-call-section" id="channel-call-section">
                <Calls
                  supabase={supabase}
                  user={user}
                  conversation={null}
                  callType="channel"
                  channelId={selected.id}
                  canStart={isAdmin}
                  canEnd={isAdmin}
                />
              </div>
            )}

            {!role && (
              <div className="channel-join-banner">
                <span>أنت تشاهد هذه القناة كزائر.</span>

                {selected.is_public && (
                  <button
                    onClick={() => joinChannel(selected)}
                    disabled={loading}
                  >
                    <Users size={16} />
                    انضمام للقناة
                  </button>
                )}
              </div>
            )}

            <div className="channel-posts" ref={postsContainerRef}>
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
                          : "مشرف القناة"}
                      </strong>

                      <time>{formatDate(post.created_at)}</time>
                      {post.sender_id !== user?.id && (
                        <button
                          type="button"
                          className="channel-report-post"
                          onClick={() =>
                            onReport?.({
                              type: "channel_post",
                              id: post.id,
                              targetUserId: post.sender_id,
                            })
                          }
                        >
                          <Flag size={13} />
                          إبلاغ
                        </button>
                      )}
                    </div>

                    {post.message_type === "audio" && post.media_url ? (
                      <div className="channel-audio-message">
                        <div className="channel-audio-label">
                          <Mic size={16} />
                          <span>رسالة صوتية</span>
                        </div>

                        <audio
                          controls
                          preload="metadata"
                          src={post.media_url}
                        >
                          متصفحك لا يدعم تشغيل الصوت.
                        </audio>
                      </div>
                    ) : post.message_type === "image" && post.media_url ? (
                      <div className="channel-media-message">
                        <img src={post.media_url} alt={post.content || "صورة من القناة"} loading="lazy" />
                        {post.content && !["Photo", "Video"].includes(post.content) && <p>{post.content}</p>}
                      </div>
                    ) : post.message_type === "video" && post.media_url ? (
                      <div className="channel-media-message">
                        <video controls preload="metadata" playsInline src={post.media_url}>
                          متصفحك لا يدعم تشغيل الفيديو.
                        </video>
                        {post.content && !["Photo", "Video"].includes(post.content) && <p>{post.content}</p>}
                      </div>
                    ) : (
                      <p>{post.content}</p>
                    )}
                  </div>
                </article>
              ))}

              {!posts.length && (
                <div className="channels-empty">
                  <Radio size={38} />
                  <h3>لا توجد منشورات بعد</h3>
                  <p>سيظهر أول منشور هنا.</p>
                </div>
              )}
            </div>

            {isAdmin && (
              <div className="channel-composer-area">
                {isRecording && (
                  <div className="channel-recording-indicator">
                    <span className="channel-recording-dot" />
                    <span>جارٍ تسجيل رسالة صوتية</span>
                    <strong>
                      {formatRecordingTime(recordingSeconds)}
                    </strong>

                    <button
                      type="button"
                      onClick={cancelRecording}
                      title="إلغاء التسجيل"
                      aria-label="إلغاء التسجيل"
                    >
                      <X size={17} />
                    </button>
                  </div>
                )}

                {voicePreviewUrl && voiceFile && !isRecording && (
                  <div className="channel-voice-preview">
                    <div className="channel-voice-preview-heading">
                      <Mic size={18} />
                      <span>معاينة الرسالة الصوتية</span>
                    </div>

                    <audio
                      controls
                      src={voicePreviewUrl}
                      preload="metadata"
                    />

                    <div className="channel-voice-preview-actions">
                      <button
                        type="button"
                        className="channel-voice-delete"
                        onClick={clearVoicePreview}
                        disabled={uploadingVoice}
                      >
                        <Trash2 size={16} />
                        حذف
                      </button>

                      <button
                        type="button"
                        className="channel-voice-send"
                        onClick={publishVoiceMessage}
                        disabled={uploadingVoice || loading}
                      >
                        {uploadingVoice ? (
                          <>
                            <Loader2 size={17} className="channel-spin" />
                            جارٍ الرفع...
                          </>
                        ) : (
                          <>
                            <Send size={17} />
                            نشر الرسالة الصوتية
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {mediaFile && mediaPreviewUrl && (
                  <div className="channel-media-preview">
                    <div className="channel-media-preview-file">
                      {mediaFile.type.startsWith("image/") ? (
                        <img src={mediaPreviewUrl} alt="Selected image" />
                      ) : (
                        <video src={mediaPreviewUrl} muted playsInline />
                      )}
                      <div>
                        <strong>{mediaFile.name}</strong>
                        <small>{(mediaFile.size / (1024 * 1024)).toFixed(1)} MB</small>
                      </div>
                    </div>
                    <button type="button" onClick={clearMediaFile} disabled={uploadingMedia} aria-label="حذف المرفق">
                      <X size={17} />
                    </button>
                  </div>
                )}

                {uploadingMedia && (
                  <div className="channel-media-uploading">
                    <Loader2 size={16} className="channel-spin" />
                    جارٍ رفع الصورة أو الفيديو...
                  </div>
                )}

                {!voicePreviewUrl && (
                  <form className="channel-composer" onSubmit={publishPost}>
                    <input
                      ref={mediaInputRef}
                      type="file"
                      accept="image/*,video/*"
                      hidden
                      onChange={handleMediaChange}
                    />

                    <button
                      type="button"
                      className="channel-attach-button"
                      onClick={() => mediaInputRef.current?.click()}
                      disabled={loading || uploadingMedia || uploadingVoice || isRecording}
                      title="إرفاق صورة أو فيديو"
                      aria-label="إرفاق صورة أو فيديو"
                    >
                      <ImagePlus size={19} />
                    </button>

                    <input
                      value={content}
                      onChange={(event) => setContent(event.target.value)}
                      placeholder="اكتب منشوراً في القناة..."
                      disabled={loading || isRecording || uploadingVoice || uploadingMedia}
                    />

                    <button
                      type="submit"
                      disabled={loading || (!content.trim() && !mediaFile) || isRecording || uploadingMedia || uploadingVoice}
                      title="نشر المنشور"
                      aria-label="نشر المنشور"
                    >
                      <Send size={19} />
                    </button>

                    <button
                      type="button"
                      className={`channel-voice-button ${
                        isRecording ? "recording" : ""
                      }`}
                      disabled={loading || uploadingVoice || uploadingMedia || Boolean(mediaFile)}
                      onPointerDown={(event) => {
                        if (event.button !== undefined && event.button !== 0) return;
                        event.preventDefault();

                        try {
                          event.currentTarget.setPointerCapture(event.pointerId);
                        } catch {
                          // Pointer capture is best-effort on touch devices.
                        }

                        recordingPointerRef.current = true;
                        recordingStartXRef.current = event.clientX;
                        startVoiceRecording();
                      }}
                      onPointerMove={(event) => {
                        if (!recordingPointerRef.current) return;
                        if (event.clientX - recordingStartXRef.current < -85) {
                          cancelRecording();
                          setError("تم إلغاء التسجيل الصوتي.");
                        }
                      }}
                      onPointerUp={(event) => {
                        event.preventDefault();
                        if (recordingPointerRef.current) {
                          stopVoiceRecording();
                        }
                      }}
                      onPointerCancel={cancelRecording}
                      onContextMenu={(event) => event.preventDefault()}
                      title="اضغط مطولاً لتسجيل رسالة صوتية"
                      aria-label="اضغط مطولاً لتسجيل رسالة صوتية"
                    >
                      {isRecording ? (
                        <Square size={19} />
                      ) : (
                        <Mic size={20} />
                      )}
                    </button>
                  </form>
                )}

                <div className="channel-voice-hint">
                  <Mic size={13} />
                  اضغط مطولاً للتسجيل، اسحب لليسار للإلغاء، واترك لإرسال الصوت.
                </div>
              </div>
            )}

            {role === "subscriber" && (
              <div className="channel-subscriber-note">
                <Users size={17} />
                النشر متاح لمالك القناة والمشرفين فقط.
              </div>
            )}

            {role && role !== "owner" && (
              <button
                className="channel-leave-button"
                onClick={leaveChannel}
                disabled={loading}
              >
                <LogOut size={16} />
                مغادرة القناة
              </button>
            )}
          </>
        ) : (
          <div className="channels-welcome">
            <div className="channels-welcome-icon">
              <Sparkles size={43} />
            </div>

            <h2>قنوات LOLZ</h2>

            <p>
              تابع القنوات، واكتشف التحديثات، وابقَ على تواصل مع المجتمعات التي تهمك.
            </p>

            <button onClick={() => setShowCreate(true)}>
              <Plus size={18} />
              أنشئ قناتك
            </button>
          </div>
        )}
      </main>

      {selected && showChannelInfo && (
        <aside className="channel-info-panel">
          <div className="channel-info-heading">
            <strong>معلومات القناة</strong>
            <button
              type="button"
              onClick={() => setShowChannelInfo(false)}
              aria-label="إغلاق معلومات القناة"
            >
              <X size={19} />
            </button>
          </div>

          <div className="channel-info-profile">
            <div className="channel-info-avatar">
              {selected.avatar_url ? (
                <img src={selected.avatar_url} alt={selected.name} />
              ) : (
                <Radio size={30} />
              )}
            </div>
            <h2>{selected.name}</h2>
            <span>{selected.is_public ? "قناة عامة" : "قناة خاصة"}</span>
            <p>{selected.description || "لا يوجد وصف لهذه القناة."}</p>
          </div>

          <div className="channel-info-stats">
            <div>
              <strong>{members.length}</strong>
              <small>مشترك</small>
            </div>
            <div>
              <strong>{role || "زائر"}</strong>
              <small>صلاحيتك</small>
            </div>
          </div>

          {selected.invite_code && role === "owner" && (
            <div className="channel-info-invite">
              <strong>رابط / رمز الدعوة</strong>
              <code>{selected.invite_code}</code>
              <button type="button" onClick={copyChannelInvite}>
                <Copy size={15} /> نسخ الرمز
              </button>
            </div>
          )}

          <div className="channel-info-members">
            <div className="channel-info-members-title">
              <strong>المشتركون</strong>
              <span>{members.length}</span>
            </div>
            {members.map((member) => {
              const profile = memberProfiles[member.user_id] || {};
              const memberName = profile.display_name || profile.full_name || profile.username || "عضو";
              return (
                <div className="channel-info-member" key={member.id}>
                  <div className="channel-info-member-avatar">
                    {profile.avatar_url ? (
                      <img src={profile.avatar_url} alt={memberName} />
                    ) : (
                      memberName.trim().slice(0, 1).toUpperCase()
                    )}
                  </div>
                  <div>
                    <strong>{memberName}</strong>
                    <small>{member.role === "owner" ? "مالك القناة" : member.role === "admin" ? "مشرف" : "مشترك"}</small>
                  </div>
                  {member.role === "owner" ? <Shield size={15} /> : null}
                </div>
              );
            })}
          </div>

          {role && role !== "owner" && (
            <button
              type="button"
              className="channel-info-leave"
              onClick={leaveChannel}
              disabled={loading}
            >
              <LogOut size={16} /> مغادرة القناة
            </button>
          )}
        </aside>
      )}

      {error && (
        <div className="channels-error" role="alert">
          <span>{error}</span>
          <button onClick={() => setError("")} aria-label="إغلاق التنبيه">
            <X size={18} />
          </button>
        </div>
      )}

      {showCreate && (
        <div
          className="channel-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setShowCreate(false);
            }
          }}
        >
          <form className="channel-create-modal" onSubmit={createChannel}>
            <div className="channel-modal-heading">
              <div>
                <span className="channels-modal-eyebrow">مجتمع جديد</span>
                <h2>إنشاء قناة</h2>
                <p>أنشئ مساحة البث الخاصة بك على LOLZ.</p>
              </div>

              <button
                type="button"
                className="channel-modal-close"
                onClick={() => setShowCreate(false)}
                aria-label="إغلاق"
              >
                <X size={19} />
              </button>
            </div>

            <label>
              اسم القناة
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="أدخل اسم القناة"
                required
                maxLength={60}
              />
            </label>

            <label>
              الوصف
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="صف قناتك..."
                rows={3}
                maxLength={500}
              />
            </label>

            <label>الخصوصية</label>

            <div className="channel-privacy-options">
              <button
                type="button"
                className={isPublic ? "selected" : ""}
                aria-pressed={isPublic}
                onClick={() => setIsPublic(true)}
              >
                <Globe size={18} />
                <span>عامة</span>
                <small>ظاهرة للجميع</small>
              </button>

              <button
                type="button"
                className={!isPublic ? "selected" : ""}
                aria-pressed={!isPublic}
                onClick={() => setIsPublic(false)}
              >
                <Lock size={18} />
                <span>خاصة</span>
                <small>تتطلب رمز دعوة</small>
              </button>
            </div>

            <div className="channel-modal-actions">
              <button
                type="button"
                className="channel-cancel"
                onClick={() => setShowCreate(false)}
              >
                إلغاء
              </button>

              <button
                type="submit"
                className="channel-submit"
                disabled={loading || !name.trim()}
              >
                {loading ? "جارٍ الإنشاء..." : "إنشاء قناة"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
