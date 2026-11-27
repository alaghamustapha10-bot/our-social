
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Search,
  Plus,
  Users,
  Send,
  Info,
  ArrowLeft,
  Globe,
  Lock,
  Copy,
  LogOut,
  Crown,
  Shield,
  MoreVertical,
  X,
  MessageCircle,
  RefreshCw,
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
import "./Groups.css";
import VerifiedBadge from "./VerifiedBadge";
import VoiceMessagePlayer from "./VoiceMessagePlayer";
import GroupActivities from "./GroupActivities";

function getInitials(name = "G") {
  return name.trim().slice(0, 2).toUpperCase();
}

function formatTime(value) {
  if (!value) return "";

  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDuration(seconds = 0) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(
    remainingSeconds
  ).padStart(2, "0")}`;
}

function GroupAvatar({ group, size = "normal" }) {
  return (
    <div className={`groups-avatar ${size}`}>
      {group?.avatar_url ? (
        <img
          src={group.avatar_url}
          alt={group.name || "Group"}
        />
      ) : (
        <span>{getInitials(group?.name)}</span>
      )}
    </div>
  );
}

function MemberAvatar({ profile }) {
  const name =
    profile?.display_name ||
    profile?.full_name ||
    profile?.username ||
    "Member";

  return (
    <div className="groups-member-avatar">
      {profile?.avatar_url ? (
        <img src={profile.avatar_url} alt={name} />
      ) : (
        <span>{getInitials(name)}</span>
      )}
    </div>
  );
}

export default function Groups({
  user,
  backgroundCallsEnabled = false,
  onCallContextChange,
  onReport,
  onModerate,
  initialGroupId = null,
  onInitialGroupOpened,
}) {
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [members, setMembers] = useState([]);
  const [profiles, setProfiles] = useState({});

  const [messageText, setMessageText] = useState("");
  const [searchText, setSearchText] = useState("");
  const [filter, setFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [creating, setCreating] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [groupVisibility, setGroupVisibility] = useState("public");
  const [inviteInput, setInviteInput] = useState("");

  // VOICE MESSAGE STATE
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voiceFile, setVoiceFile] = useState(null);
  const [voicePreviewUrl, setVoicePreviewUrl] = useState("");
  const [uploadingVoice, setUploadingVoice] = useState(false);
  const [messageMediaFile, setMessageMediaFile] = useState(null);
  const [messageMediaPreviewUrl, setMessageMediaPreviewUrl] = useState("");
  const [uploadingMedia, setUploadingMedia] = useState(false);

  const messagesEndRef = useRef(null);
  const channelRef = useRef(null);
  const creatingRef = useRef(false);
  const shouldAutoScrollRef = useRef(true);

  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const recordingStartedAtRef = useRef(null);
  const recordingGroupIdRef = useRef(null);
  const recordingCancelledRef = useRef(false);
  const recordingPointerRef = useRef(false);
  const recordingStartXRef = useRef(0);
  const sendVoiceMessageRef = useRef(null);
  const messageMediaInputRef = useRef(null);

  const notify = useCallback((message) => {
    setNotice(message);

    window.setTimeout(() => {
      setNotice("");
    }, 3500);
  }, []);

  // LOAD MEMBER PROFILES
  const getProfiles = useCallback(async (ids) => {
    const uniqueIds = [...new Set((ids || []).filter(Boolean))];

    if (!uniqueIds.length) return {};

    const { data, error: profileError } = await supabase
      .from("profiles")
      .select("id, username, full_name, display_name, avatar_url, is_verified")
      .in("id", uniqueIds);

    if (profileError) throw profileError;

    return Object.fromEntries(
      (data || []).map((item) => [item.id, item])
    );
  }, []);

  useEffect(() => {
    if (!messageMediaFile) {
      setMessageMediaPreviewUrl("");
      return undefined;
    }

    const previewUrl = URL.createObjectURL(messageMediaFile);
    setMessageMediaPreviewUrl(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [messageMediaFile]);

  const clearMessageMedia = useCallback(() => {
    setMessageMediaFile(null);
    if (messageMediaInputRef.current) {
      messageMediaInputRef.current.value = "";
    }
  }, []);

  const handleMessageMediaChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      setError("Choose an image or video file.");
      event.target.value = "";
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      setError("Maximum media size is 100 MB.");
      event.target.value = "";
      return;
    }

    setError("");
    setMessageMediaFile(file);
  };

  // CLEAR VOICE PREVIEW
  const clearVoicePreview = useCallback(() => {
    setVoiceFile(null);

    setVoicePreviewUrl((currentUrl) => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }

      return "";
    });

    setRecordingSeconds(0);
  }, []);

  // STOP MICROPHONE TRACKS
  const stopMediaStream = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current
        .getTracks()
        .forEach((track) => track.stop());

      mediaStreamRef.current = null;
    }
  }, []);

  // CANCEL RECORDING
  const cancelRecording = useCallback(() => {
    recordingCancelledRef.current = true;
    recordingPointerRef.current = false;

    const recorder = mediaRecorderRef.current;

    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch (err) {
        console.warn("Could not stop voice recorder:", err);
      }
    }

    mediaRecorderRef.current = null;
    stopMediaStream();

    recordingChunksRef.current = [];

    setIsRecording(false);
    setRecordingSeconds(0);
  }, [stopMediaStream]);

  // START VOICE RECORDING
  const startVoiceRecording = useCallback(async () => {
    if (
      !user?.id ||
      !selectedGroup?.id ||
      !selectedGroup?.myRole ||
      isRecording ||
      uploadingVoice ||
      voiceFile
    ) {
      return;
    }

    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setError(
        "Voice recording is not supported by this browser or device."
      );
      return;
    }

    setError("");
    recordingCancelledRef.current = false;
    recordingPointerRef.current = true;
    recordingChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // The user may have released the recording button
      // while the browser was requesting microphone access.
      if (!recordingPointerRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      if (
        selectedGroup?.id !== recordingGroupIdRef.current &&
        recordingGroupIdRef.current
      ) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      mediaStreamRef.current = stream;

      const mimeCandidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/ogg",
      ];

      const supportedMimeType = mimeCandidates.find((type) =>
        MediaRecorder.isTypeSupported(type)
      );

      const recorder = supportedMimeType
        ? new MediaRecorder(stream, {
            mimeType: supportedMimeType,
          })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;
      recordingStartedAtRef.current = Date.now();
      recordingGroupIdRef.current = selectedGroup.id;

      recorder.ondataavailable = (event) => {
        if (event.data?.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = (event) => {
        console.error("Voice recording error:", event);

        setError("Voice recording failed.");
        setIsRecording(false);
        stopMediaStream();
      };

      recorder.onstop = () => {
        stopMediaStream();

        mediaRecorderRef.current = null;

        if (recordingCancelledRef.current) {
          recordingChunksRef.current = [];
          return;
        }

        const chunks = recordingChunksRef.current;
        recordingChunksRef.current = [];

        if (!chunks.length) {
          setError("The recording is empty. Please try again.");
          return;
        }

        const mimeType =
          recorder.mimeType ||
          supportedMimeType ||
          "audio/webm";

        const extension = mimeType.includes("ogg")
          ? "ogg"
          : mimeType.includes("mp4")
          ? "m4a"
          : "webm";

        const file = new File(
          chunks,
          `voice-${Date.now()}.${extension}`,
          {
            type: mimeType,
          }
        );

        const duration = Math.max(
          1,
          Math.round(
            (Date.now() - recordingStartedAtRef.current) / 1000
          )
        );

        recordingPointerRef.current = false;
        setRecordingSeconds(duration);
        setIsRecording(false);
        void sendVoiceMessageRef.current?.(file);
      };

      recorder.start(250);

      setIsRecording(true);
      setRecordingSeconds(0);
    } catch (err) {
      console.error("Could not start voice recording:", err);

      recordingPointerRef.current = false;
      stopMediaStream();

      setIsRecording(false);

      if (err.name === "NotAllowedError") {
        setError(
          "Microphone permission was denied. Please allow microphone access."
        );
      } else if (err.name === "NotFoundError") {
        setError("No microphone was found on this device.");
      } else {
        setError(
          err.message || "Could not start voice recording."
        );
      }
    }
  }, [
    user?.id,
    selectedGroup?.id,
    selectedGroup?.myRole,
    isRecording,
    uploadingVoice,
    voiceFile,
    stopMediaStream,
  ]);

  // STOP RECORDING AND PREPARE PREVIEW
  const stopVoiceRecording = useCallback(() => {
    recordingPointerRef.current = false;

    const recorder = mediaRecorderRef.current;

    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch (err) {
        console.error("Could not finish recording:", err);
        setError("Could not finish the voice recording.");
      }
    }

    setIsRecording(false);
  }, []);

  // RECORDING TIMER
  useEffect(() => {
    if (!isRecording) return undefined;

    const interval = window.setInterval(() => {
      if (recordingStartedAtRef.current) {
        setRecordingSeconds(
          Math.floor(
            (Date.now() - recordingStartedAtRef.current) / 1000
          )
        );
      }
    }, 250);

    return () => window.clearInterval(interval);
  }, [isRecording]);

  // CLEAN UP RECORDING WHEN COMPONENT UNMOUNTS
  useEffect(() => {
    return () => {
      recordingPointerRef.current = false;

      const recorder = mediaRecorderRef.current;

      if (recorder && recorder.state !== "inactive") {
        try {
          recorder.stop();
        } catch {
          // Ignore cleanup errors.
        }
      }

      if (mediaStreamRef.current) {
        mediaStreamRef.current
          .getTracks()
          .forEach((track) => track.stop());
      }

      if (voicePreviewUrl) {
        URL.revokeObjectURL(voicePreviewUrl);
      }
    };
  }, [voicePreviewUrl]);

  // LOAD GROUPS
  const loadGroups = useCallback(async () => {
    if (!user?.id) {
      setGroups([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const {
        data: membershipRows,
        error: membershipError,
      } = await supabase
        .from("group_members")
        .select("group_id, user_id, role")
        .eq("user_id", user.id);

      if (membershipError) throw membershipError;

      const membershipMap = Object.fromEntries(
        (membershipRows || []).map((item) => [
          item.group_id,
          item,
        ])
      );

      const privateIds = (membershipRows || []).map(
        (item) => item.group_id
      );

      const {
        data: publicGroups,
        error: publicError,
      } = await supabase
        .from("groups")
        .select("*")
        .eq("is_public", true)
        .order("updated_at", { ascending: false });

      if (publicError) throw publicError;

      let privateGroups = [];

      if (privateIds.length) {
        const {
          data,
          error: privateError,
        } = await supabase
          .from("groups")
          .select("*")
          .eq("is_public", false)
          .in("id", privateIds)
          .order("updated_at", { ascending: false });

        if (privateError) throw privateError;

        privateGroups = data || [];
      }

      const combined = [
        ...(publicGroups || []),
        ...privateGroups,
      ].filter(
        (group, index, array) =>
          array.findIndex(
            (item) => item.id === group.id
          ) === index
      );

      const groupIds = combined.map((group) => group.id);
      const joinedIds = Object.keys(membershipMap);

      let memberRows = [];
      let lastMessages = [];

      if (groupIds.length) {
        const {
          data,
          error: membersError,
        } = await supabase
          .from("group_members")
          .select("group_id, user_id, role")
          .in("group_id", groupIds);

        if (membersError) throw membersError;

        memberRows = data || [];
      }

      if (joinedIds.length) {
        const {
          data,
          error: messageError,
        } = await supabase
          .from("group_messages")
          .select("*")
          .in("group_id", joinedIds)
          .order("created_at", { ascending: false });

        if (messageError) throw messageError;

        lastMessages = data || [];
      }

      const latestByGroup = {};

      for (const message of lastMessages) {
        if (!latestByGroup[message.group_id]) {
          latestByGroup[message.group_id] = message;
        }
      }

      const senderIds = lastMessages
        .slice(0, 100)
        .map((message) => message.sender_id);

      const profileMap = await getProfiles(senderIds);

      setProfiles((current) => ({
        ...current,
        ...profileMap,
      }));

      const enriched = combined.map((group) => ({
        ...group,
        myRole: membershipMap[group.id]?.role || null,
        memberCount: memberRows.filter(
          (member) => member.group_id === group.id
        ).length,
        lastMessage: latestByGroup[group.id] || null,
      }));

      enriched.sort((a, b) => {
        const aTime =
          a.lastMessage?.created_at || a.updated_at;

        const bTime =
          b.lastMessage?.created_at || b.updated_at;

        return (
          new Date(bTime || 0) -
          new Date(aTime || 0)
        );
      });

      setGroups(enriched);

      if (selectedGroup?.id) {
        const refreshed = enriched.find(
          (group) => group.id === selectedGroup.id
        );

        setSelectedGroup(refreshed || null);
      }
    } catch (err) {
      console.error("Groups loading error:", err);

      setError(
        err.message || "Could not load groups."
      );
    } finally {
      setLoading(false);
    }
  }, [user?.id, getProfiles, selectedGroup?.id]);

  // LOAD SELECTED GROUP CONTENT
  const loadGroupContent = useCallback(
    async (group) => {
      if (!group?.id || !group.myRole) {
        setMessages([]);
        setMembers([]);
        return;
      }

      setMessagesLoading(true);
      setError("");

      try {
        const [
          messageResult,
          memberResult,
        ] = await Promise.all([
          supabase
            .from("group_messages")
            .select("*")
            .eq("group_id", group.id)
            .order("created_at", { ascending: true })
            .limit(200),

          supabase
            .from("group_members")
            .select(
              "id, group_id, user_id, role, joined_at"
            )
            .eq("group_id", group.id)
            .order("joined_at", { ascending: true }),
        ]);

        if (messageResult.error) {
          throw messageResult.error;
        }

        if (memberResult.error) {
          throw memberResult.error;
        }

        const allIds = [
          ...(messageResult.data || []).map(
            (item) => item.sender_id
          ),
          ...(memberResult.data || []).map(
            (item) => item.user_id
          ),
        ];

        const profileMap = await getProfiles(allIds);

        setProfiles((current) => ({
          ...current,
          ...profileMap,
        }));

        setMessages(
          (messageResult.data || []).map((item) => ({
            ...item,
            sender:
              profileMap[item.sender_id] || null,
          }))
        );

        setMembers(
          (memberResult.data || []).map((item) => ({
            ...item,
            profile:
              profileMap[item.user_id] || null,
          }))
        );
      } catch (err) {
        console.error("Group content error:", err);

        setError(
          err.message || "Could not load this group."
        );
      } finally {
        setMessagesLoading(false);
      }
    },
    [getProfiles]
  );

  // INITIAL LOAD
  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  // SELECTED GROUP AND REALTIME MESSAGES
  useEffect(() => {
    if (!selectedGroup?.id) {
      setMessages([]);
      setMembers([]);
      return;
    }

    if (!selectedGroup.myRole) {
      setMessages([]);
      setMembers([]);
      return;
    }

    loadGroupContent(selectedGroup);

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`group-messages-${selectedGroup.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "group_messages",
          filter: `group_id=eq.${selectedGroup.id}`,
        },
        async (payload) => {
          const incoming = payload.new;

          setMessages((current) => {
            if (
              current.some(
                (item) => item.id === incoming.id
              )
            ) {
              return current;
            }

            return [...current, incoming];
          });

          try {
            const profileMap = await getProfiles([
              incoming.sender_id,
            ]);

            setProfiles((current) => ({
              ...current,
              ...profileMap,
            }));

            setMessages((current) =>
              current.map((item) =>
                item.id === incoming.id
                  ? {
                      ...item,
                      sender:
                        profileMap[incoming.sender_id] ||
                        null,
                    }
                  : item
              )
            );
          } catch (err) {
            console.error(
              "Could not load message sender:",
              err
            );
          }

          loadGroups();
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current === channel) {
        supabase.removeChannel(channel);
        channelRef.current = null;
      }
    };
  }, [
    selectedGroup?.id,
    selectedGroup?.myRole,
    loadGroupContent,
    getProfiles,
    loadGroups,
  ]);

  // SMART SCROLL
  useEffect(() => {
    if (!shouldAutoScrollRef.current) return;

    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages]);

  // RESET SCROLLING WHEN A DIFFERENT GROUP IS OPENED
  useEffect(() => {
    shouldAutoScrollRef.current = true;
  }, [selectedGroup?.id]);

  // CLEAN UP A VOICE PREVIEW WHEN SWITCHING GROUPS
  useEffect(() => {
    if (
      voiceFile &&
      recordingGroupIdRef.current &&
      selectedGroup?.id !== recordingGroupIdRef.current
    ) {
      clearVoicePreview();
    }
  }, [selectedGroup?.id, voiceFile, clearVoicePreview]);

  // FILTER GROUPS
  const filteredGroups = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    return groups.filter((group) => {
      const matchesSearch =
        !query ||
        group.name?.toLowerCase().includes(query) ||
        group.description?.toLowerCase().includes(query);

      const matchesFilter =
        filter === "all" ||
        (filter === "mine" && group.myRole) ||
        (filter === "public" &&
          group.is_public &&
          !group.myRole) ||
        (filter === "private" && !group.is_public);

      return matchesSearch && matchesFilter;
    });
  }, [groups, searchText, filter]);

  // OPEN GROUP
  const openGroup = (group) => {
    if (selectedGroup?.id !== group.id) {
      if (isRecording) {
        cancelRecording();
      }

      if (voiceFile) {
        clearVoicePreview();
      }
    }

    setSelectedGroup(group);
    setShowInfo(false);
    setError("");
  };

  useEffect(() => {
    if (!initialGroupId || !groups.length) return;

    const targetGroup = groups.find(
      (group) => String(group.id) === String(initialGroupId)
    );

    if (!targetGroup) return;

    if (String(selectedGroup?.id || "") !== String(targetGroup.id)) {
      openGroup(targetGroup);
    }

    onInitialGroupOpened?.();
  }, [initialGroupId, groups, selectedGroup?.id, openGroup, onInitialGroupOpened]);

  // CREATE GROUP
  const createGroup = async (event) => {
    event.preventDefault();

    if (creatingRef.current) return;

    const cleanName = groupName.trim();
    const cleanDescription = groupDescription.trim();

    if (!cleanName) {
      setError("Please enter a group name.");
      return;
    }

    if (
      !["public", "private"].includes(groupVisibility)
    ) {
      setError("Please select Public or Private.");
      return;
    }

    if (onModerate && !(await onModerate([cleanName, cleanDescription].join("\n"), null))) return;

    creatingRef.current = true;
    setCreating(true);
    setError("");

    try {
      const {
        data: { user: authUser },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!authUser?.id) {
        throw new Error(
          "Your session has expired. Please sign in again."
        );
      }

      if (user?.id && user.id !== authUser.id) {
        throw new Error(
          "Your application user does not match your Supabase account."
        );
      }

      const isPublic = groupVisibility === "public";

      const {
        data,
        error: createError,
      } = await supabase.rpc(
        "create_group_secure",
        {
          p_name: cleanName,
          p_description: cleanDescription,
          p_is_public: isPublic,
        }
      );

      if (createError) throw createError;

      const createdGroup =
        typeof data === "string"
          ? JSON.parse(data)
          : data;

      if (!createdGroup?.id) {
        throw new Error(
          "The group was not returned after creation."
        );
      }

      if (
        Boolean(createdGroup.is_public) !== isPublic
      ) {
        throw new Error(
          "The saved group visibility is incorrect."
        );
      }

      setShowCreate(false);
      setGroupName("");
      setGroupDescription("");
      setGroupVisibility("public");

      setSelectedGroup({
        ...createdGroup,
        myRole: "owner",
        memberCount: 1,
      });

      await loadGroups();

      notify(
        isPublic
          ? "Public group created successfully."
          : "Private group created successfully."
      );
    } catch (err) {
      console.error("CREATE GROUP ERROR:", err);

      setError(
        err.message || "Could not create the group."
      );
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  };

  // JOIN PUBLIC GROUP
  const joinPublicGroup = async (group) => {
    setError("");

    try {
      const {
        data: authData,
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error("Please sign in first.");
      }

      const { error: joinError } = await supabase
        .from("group_members")
        .insert({
          group_id: group.id,
          user_id: authData.user.id,
          role: "member",
        });

      if (joinError) throw joinError;

      void dispatchLolzPush(supabase, {
        action: "group_join",
        group_id: group.id,
      });

      await loadGroups();

      setSelectedGroup({
        ...group,
        myRole: "member",
        memberCount: (group.memberCount || 0) + 1,
      });

      notify("You joined the group.");
    } catch (err) {
      console.error(
        "Join public group error:",
        err
      );

      setError(
        err.message || "Could not join this group."
      );
    }
  };

  // JOIN PRIVATE GROUP
  const joinPrivateGroup = async (event) => {
    event.preventDefault();

    if (!inviteInput.trim()) return;

    setError("");

    try {
      const { data, error: joinError } =
        await supabase.rpc(
          "join_group_by_invite",
          {
            p_invite_code: inviteInput.trim(),
          }
        );

      if (joinError) throw joinError;

      void dispatchLolzPush(supabase, {
        action: "group_join",
        group_id: String(data),
      });

      setInviteInput("");

      await loadGroups();

      const {
        data: group,
        error: groupError,
      } = await supabase
        .from("groups")
        .select("*")
        .eq("id", data)
        .single();

      if (groupError) throw groupError;

      setSelectedGroup({
        ...group,
        myRole: "member",
      });

      notify("You joined the private group.");
    } catch (err) {
      console.error(
        "Join private group error:",
        err
      );

      setError(
        err.message || "Invalid invitation code."
      );
    }
  };

  // SEND IMAGE OR VIDEO TO THE GROUP
  const sendMediaMessage = async (fileToSend = messageMediaFile) => {
    if (
      !fileToSend ||
      !selectedGroup?.id ||
      !selectedGroup?.myRole ||
      uploadingMedia ||
      sending
    ) {
      return;
    }

    const targetGroupId = selectedGroup.id;
    const caption = messageText.trim();
    const messageType = fileToSend.type.startsWith("image/") ? "image" : "video";
    let storagePath = null;

    if (onModerate && !(await onModerate(caption, fileToSend))) return;

    setUploadingMedia(true);
    setError("");

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user || authData.user.id !== user?.id) {
        throw new Error("Please sign in again before sending media.");
      }

      const safeName = fileToSend.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const fileName = `${messageType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
      storagePath = `${authData.user.id}/messages/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("social-media")
        .upload(storagePath, fileToSend, {
          cacheControl: "3600",
          contentType: fileToSend.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("social-media")
        .getPublicUrl(storagePath);
      const mediaUrl = publicUrlData?.publicUrl;
      if (!mediaUrl) throw new Error("Could not create a media URL.");

      if (selectedGroup?.id !== targetGroupId) {
        throw new Error("The selected group changed before the media could be sent.");
      }

      const { data, error: insertError } = await supabase
        .from("group_messages")
        .insert({
          group_id: targetGroupId,
          sender_id: authData.user.id,
          content: caption || (messageType === "image" ? "Photo" : "Video"),
          message_type: messageType,
          media_url: mediaUrl,
          file_name: fileToSend.name,
          mime_type: fileToSend.type,
        })
        .select("*")
        .single();

      if (insertError) throw insertError;

      void dispatchLolzPush(supabase, {
        action: "group_message",
        message_id: data.id,
      });

      setMessages((current) => [
        ...current,
        { ...data, sender: profiles[authData.user.id] || null },
      ]);
      setMessageText("");
      clearMessageMedia();
      void loadGroups();
    } catch (err) {
      if (storagePath) {
        const { error: cleanupError } = await supabase.storage
          .from("social-media")
          .remove([storagePath]);
        if (cleanupError) console.warn("Could not remove unsent group media:", cleanupError.message);
      }

      console.error("Send group media error:", err);
      setError(err.message || "Media could not be sent.");
    } finally {
      setUploadingMedia(false);
    }
  };

  // SEND TEXT MESSAGE
  const sendMessage = async (event) => {
    event.preventDefault();

    const content = messageText.trim();

    if (messageMediaFile) {
      await sendMediaMessage();
      return;
    }

    if (
      !content ||
      !selectedGroup?.myRole ||
      sending ||
      uploadingMedia
    ) {
      return;
    }

    if (onModerate && !(await onModerate(content, null))) return;

    setSending(true);
    setError("");

    try {
      const {
        data: authData,
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error("Please sign in first.");
      }

      const {
        data,
        error: sendError,
      } = await supabase
        .from("group_messages")
        .insert({
          group_id: selectedGroup.id,
          sender_id: authData.user.id,
          content,
          message_type: "text",
          media_url: null,
          file_name: null,
          mime_type: null,
        })
        .select("*")
        .single();

      if (sendError) throw sendError;

      void dispatchLolzPush(supabase, {
        action: "group_message",
        message_id: data.id,
      });

      const ownProfile =
        profiles[authData.user.id] || null;

      setMessages((current) => [
        ...current,
        {
          ...data,
          sender: ownProfile,
        },
      ]);

      setMessageText("");

      loadGroups();
    } catch (err) {
      console.error(
        "Send group message error:",
        err
      );

      setError(
        err.message || "Message could not be sent."
      );
    } finally {
      setSending(false);
    }
  };

  // SEND VOICE MESSAGE
  const sendVoiceMessage = async (voiceFileToSend = voiceFile) => {
    if (
      !voiceFileToSend ||
      !selectedGroup?.id ||
      !selectedGroup?.myRole ||
      uploadingVoice
    ) {
      return;
    }

    const targetGroupId = selectedGroup.id;

    setUploadingVoice(true);
    setError("");

    try {
      const {
        data: authData,
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error("Please sign in first.");
      }

      if (authData.user.id !== user?.id) {
        throw new Error(
          "Your application user does not match your Supabase account."
        );
      }

      const extension = voiceFileToSend.name.split(".").pop() || "webm";

      const fileName = `voice-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 9)}.${extension}`;

      const storagePath = `${authData.user.id}/messages/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("social-media")
        .upload(storagePath, voiceFileToSend, {
          cacheControl: "3600",
          contentType: voiceFileToSend.type || "audio/webm",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const {
        data: publicUrlData,
      } = supabase.storage
        .from("social-media")
        .getPublicUrl(storagePath);

      const mediaUrl = publicUrlData?.publicUrl;

      if (!mediaUrl) {
        throw new Error(
          "Could not create a URL for the voice message."
        );
      }

      if (selectedGroup?.id !== targetGroupId) {
        throw new Error(
          "The selected group changed before the message could be sent."
        );
      }

      const {
        data,
        error: insertError,
      } = await supabase
        .from("group_messages")
        .insert({
          group_id: targetGroupId,
          sender_id: authData.user.id,
          content: "Voice message",
          message_type: "audio",
          media_url: mediaUrl,
          file_name: fileName,
          mime_type: voiceFileToSend.type || "audio/webm",
        })
        .select("*")
        .single();

      if (insertError) throw insertError;

      void dispatchLolzPush(supabase, {
        action: "group_message",
        message_id: data.id,
      });

      setMessages((current) => [
        ...current,
        {
          ...data,
          sender: profiles[authData.user.id] || null,
        },
      ]);

      clearVoicePreview();
      recordingGroupIdRef.current = null;

      loadGroups();
      notify("Voice message sent.");
    } catch (err) {
      console.error("Send voice message error:", err);

      setError(
        err.message || "Voice message could not be sent."
      );
    } finally {
      setUploadingVoice(false);
    }
  };

  useEffect(() => {
    sendVoiceMessageRef.current = sendVoiceMessage;
  }, [sendVoiceMessage]);

  useEffect(() => {
    clearMessageMedia();
  }, [selectedGroup?.id, clearMessageMedia]);

  // LEAVE GROUP
  const leaveGroup = async () => {
    if (
      !selectedGroup ||
      selectedGroup.myRole === "owner"
    ) {
      return;
    }

    if (
      !window.confirm(
        "Are you sure you want to leave this group?"
      )
    ) {
      return;
    }

    try {
      const { error: leaveError } =
        await supabase.rpc("leave_group", {
          p_group_id: selectedGroup.id,
        });

      if (leaveError) throw leaveError;

      setSelectedGroup(null);
      setMessages([]);
      setMembers([]);

      await loadGroups();

      notify("You left the group.");
    } catch (err) {
      console.error("Leave group error:", err);

      setError(
        err.message || "Could not leave the group."
      );
    }
  };

  // CHANGE MEMBER ROLE
  const changeMemberRole = async (
    member,
    role
  ) => {
    try {
      const { error: roleError } =
        await supabase.rpc(
          "set_group_member_role",
          {
            p_group_id: selectedGroup.id,
            p_user_id: member.user_id,
            p_role: role,
          }
        );

      if (roleError) throw roleError;

      await loadGroupContent(selectedGroup);
      await loadGroups();

      notify("Member role updated.");
    } catch (err) {
      console.error(
        "Change member role error:",
        err
      );

      setError(
        err.message || "Could not update this member."
      );
    }
  };

  // REMOVE MEMBER
  const removeMember = async (member) => {
    const name =
      member.profile?.display_name ||
      member.profile?.username ||
      "this member";

    if (
      !window.confirm(
        `Remove ${name} from this group?`
      )
    ) {
      return;
    }

    try {
      const { error: removeError } =
        await supabase.rpc(
          "remove_group_member",
          {
            p_group_id: selectedGroup.id,
            p_user_id: member.user_id,
          }
        );

      if (removeError) throw removeError;

      await loadGroupContent(selectedGroup);
      await loadGroups();

      notify("Member removed.");
    } catch (err) {
      console.error("Remove member error:", err);

      setError(
        err.message || "Could not remove this member."
      );
    }
  };

  // COPY INVITATION CODE
  const copyInvite = async () => {
    if (!selectedGroup?.invite_code) return;

    try {
      await navigator.clipboard.writeText(
        selectedGroup.invite_code
      );

      notify("Invitation code copied.");
    } catch {
      setError(
        "Could not copy the invitation code."
      );
    }
  };

  // GROUP ROLE
  const currentRole = selectedGroup?.myRole;

  const canManage =
    currentRole === "owner" ||
    currentRole === "admin";

  const isOwner = currentRole === "owner";

  // CLEAR THE OLD FLOATING CALL CONTEXT
  // Group calls are now rendered inside the group chat.
  useEffect(() => {
    onCallContextChange?.(null);
  }, [onCallContextChange]);

  return (
    <section className={`groups-page ${selectedGroup ? "group-chat-open" : ""}`}>
      <div className="groups-top-heading">
        <div>
          <span className="groups-eyebrow">
            LOLZ COMMUNITY
          </span>

          <h1>Groups</h1>
        </div>

        <button
          className="groups-create-button"
          onClick={() => setShowCreate(true)}
        >
          <Plus size={18} />
          <span>Create group</span>
        </button>
      </div>

      {error && (
        <div className="groups-alert error">
          <span>{error}</span>

          <button onClick={() => setError("")}>
            <X size={16} />
          </button>
        </div>
      )}

      {notice && (
        <div className="groups-alert success">
          {notice}
        </div>
      )}

      <div
        className={`groups-workspace ${
          selectedGroup ? "has-selection" : ""
        } ${showInfo ? "show-info" : ""}`}
      >
        <aside className="groups-sidebar">
          <div className="groups-sidebar-header">
            <div>
              <span className="groups-eyebrow">
                YOUR COMMUNITY
              </span>

              <h2>Messages</h2>
            </div>

            <button
              className="groups-icon-button"
              onClick={loadGroups}
              title="Refresh groups"
            >
              <RefreshCw size={17} />
            </button>
          </div>

          <form
            className="groups-search"
            onSubmit={(event) =>
              event.preventDefault()
            }
          >
            <Search size={17} />

            <input
              value={searchText}
              onChange={(event) =>
                setSearchText(event.target.value)
              }
              placeholder="Search groups"
            />

            {searchText && (
              <button
                type="button"
                onClick={() => setSearchText("")}
              >
                <X size={15} />
              </button>
            )}
          </form>

          <div className="groups-filters">
            {[
              ["all", "All"],
              ["mine", "Joined"],
              ["public", "Discover"],
              ["private", "Private"],
            ].map(([value, label]) => (
              <button
                key={value}
                className={
                  filter === value ? "active" : ""
                }
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="groups-list">
            {loading ? (
              <div className="groups-loading">
                Loading groups...
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="groups-empty-list">
                <Users size={28} />

                <strong>No groups found</strong>

                <span>
                  Create a group or discover public
                  communities.
                </span>
              </div>
            ) : (
              filteredGroups.map((group) => {
                const lastMessage =
                  group.lastMessage;

                const sender = lastMessage
                  ? profiles[lastMessage.sender_id]
                  : null;

                const lastMessagePreview =
                  lastMessage?.message_type === "audio"
                    ? "🎤 Voice message"
                    : lastMessage?.content;

                return (
                  <button
                    key={group.id}
                    className={`groups-list-item ${
                      selectedGroup?.id === group.id
                        ? "active"
                        : ""
                    }`}
                    onClick={() => openGroup(group)}
                  >
                    <GroupAvatar group={group} />

                    <span className="groups-list-copy">
                      <span className="groups-list-title">
                        <strong>{group.name}</strong>

                        <small>
                          {formatTime(
                            lastMessage?.created_at ||
                              group.updated_at
                          )}
                        </small>
                      </span>

                      <span className="groups-list-preview">
                        {lastMessage
                          ? `${
                              sender?.display_name ||
                              sender?.username ||
                              "Member"
                            }: ${lastMessagePreview || ""}`
                          : group.description ||
                            "No messages yet"}
                      </span>

                      <span className="groups-list-meta">
                        {group.myRole ? (
                          <span className="groups-joined-label">
                            {group.myRole}
                          </span>
                        ) : (
                          <span>
                            {group.is_public
                              ? "Public group"
                              : "Private group"}
                          </span>
                        )}

                        <span>
                          {group.memberCount || 0} members
                        </span>
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <form
            className="groups-join-form"
            onSubmit={joinPrivateGroup}
          >
            <input
              value={inviteInput}
              onChange={(event) =>
                setInviteInput(event.target.value)
              }
              placeholder="Enter private invite code"
            />

            <button
              type="submit"
              disabled={!inviteInput.trim()}
            >
              Join
            </button>
          </form>
        </aside>

        <main className="groups-chat">
          {!selectedGroup ? (
            <div className="groups-welcome">
              <div className="groups-welcome-icon">
                <MessageCircle size={36} />
              </div>

              <h2>
                Your groups, all in one place
              </h2>

              <p>
                Select a group to start chatting, or
                discover a public community and join
                the conversation.
              </p>

              <button
                className="groups-create-button"
                onClick={() => setShowCreate(true)}
              >
                <Plus size={18} />
                Create your first group
              </button>
            </div>
          ) : (
            <>
              <header className="groups-chat-header">
                <button
                  className="groups-back-button"
                  onClick={() => {
                    if (isRecording) cancelRecording();
                    if (voiceFile) clearVoicePreview();
                    setSelectedGroup(null);
                  }}
                  title="Back to groups"
                >
                  <ArrowLeft size={19} />
                </button>

                <GroupAvatar
                  group={selectedGroup}
                  size="small"
                />

                <button
                  className="groups-chat-title"
                  onClick={() =>
                    setShowInfo((value) => !value)
                  }
                >
                  <strong>
                    {selectedGroup.name}
                  </strong>

                  <small>
                    {selectedGroup.memberCount || 0}{" "}
                    members
                    {selectedGroup.is_public
                      ? " · Public"
                      : " · Private"}
                  </small>
                </button>

                <button
                  className="groups-icon-button"
                  onClick={() =>
                    setShowInfo((value) => !value)
                  }
                  title="Group information"
                >
                  <Info size={19} />
                </button>
              </header>

              {selectedGroup.myRole && <GroupActivities groupId={selectedGroup.id} user={user} onModerate={onModerate} />}

              {!selectedGroup.myRole ? (
                <div className="groups-join-screen">
                  <GroupAvatar
                    group={selectedGroup}
                    size="large"
                  />

                  <h2>{selectedGroup.name}</h2>

                  <p>
                    {selectedGroup.description ||
                      "Join this community to see its messages and members."}
                  </p>

                  <span>
                    {selectedGroup.memberCount || 0}{" "}
                    members
                  </span>

                  {selectedGroup.is_public ? (
                    <button
                      className="groups-create-button"
                      onClick={() =>
                        joinPublicGroup(selectedGroup)
                      }
                    >
                      <Users size={18} />
                      Join group
                    </button>
                  ) : (
                    <p>
                      This is a private group. You need
                      an invitation code.
                    </p>
                  )}
                </div>
              ) : (
                <>
                  {/* GROUP CALLS — INSIDE THE GROUP CHAT */}
                  <div className="groups-call-section">
                    <Calls
                      supabase={supabase}
                      user={user}
                      conversation={null}
                      callType="group"
                      groupId={selectedGroup.id}
                      canStart={canManage}
                      canEnd={canManage}
                      backgroundCallsEnabled={backgroundCallsEnabled}
                    />
                  </div>

                  <div
                    className="groups-message-history"
                    onScroll={(event) => {
                      const element = event.currentTarget;
                      const distanceFromBottom =
                        element.scrollHeight -
                        element.scrollTop -
                        element.clientHeight;

                      shouldAutoScrollRef.current =
                        distanceFromBottom < 120;
                    }}
                  >
                    {messagesLoading ? (
                      <div className="groups-loading">
                        Loading messages...
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="groups-no-messages">
                        <MessageCircle size={30} />

                        <strong>No messages yet</strong>

                        <span>
                          Start the conversation!
                        </span>
                      </div>
                    ) : (
                      messages.map((message) => {
                        const mine =
                          message.sender_id === user.id;

                        const sender =
                          message.sender ||
                          profiles[message.sender_id];

                        const senderName =
                          sender?.display_name ||
                          sender?.full_name ||
                          sender?.username ||
                          "Member";

                        const isAudio =
                          message.message_type === "audio" &&
                          Boolean(message.media_url);
                        const isImage =
                          message.message_type === "image" &&
                          Boolean(message.media_url);
                        const isVideo =
                          message.message_type === "video" &&
                          Boolean(message.media_url);

                        return (
                          <article
                            key={message.id}
                            className={`groups-message ${
                              mine ? "mine" : "theirs"
                            }`}
                          >
                            {!mine && (
                              <MemberAvatar
                                profile={sender}
                              />
                            )}

                            <div className="groups-message-content">
                              {!mine && (
                                <strong className="groups-message-author">
                                  {senderName} <VerifiedBadge verified={sender?.is_verified} size={14} />
                                </strong>
                              )}

                              <div className="groups-message-bubble">
                                {isAudio ? (
                                  <div className="groups-audio-message">
                                    <div className="groups-audio-label">
                                      <Mic size={16} />
                                      <span>Voice message</span>
                                    </div>

                                    <VoiceMessagePlayer src={message.media_url} />
                                  </div>
                                ) : isImage ? (
                                  <div className="groups-media-message">
                                    <img src={message.media_url} alt={message.content || "Group image"} loading="lazy" />
                                    {message.content && !["Photo", "Video"].includes(message.content) && (
                                      <p>{message.content}</p>
                                    )}
                                  </div>
                                ) : isVideo ? (
                                  <div className="groups-media-message">
                                    <video controls preload="metadata" playsInline src={message.media_url}>
                                      Your browser does not support video playback.
                                    </video>
                                    {message.content && !["Photo", "Video"].includes(message.content) && (
                                      <p>{message.content}</p>
                                    )}
                                  </div>
                                ) : (
                                  message.content
                                )}

                                <small>
                                  {formatTime(
                                    message.created_at
                                  )}
                                </small>
                                {!mine && (
                                  <button
                                    type="button"
                                    className="groups-report-message"
                                    onClick={() =>
                                      onReport?.({
                                        type: "group_message",
                                        id: message.id,
                                        targetUserId: message.sender_id,
                                      })
                                    }
                                  >
                                    <Flag size={12} />
                                    Report
                                  </button>
                                )}
                              </div>
                            </div>
                          </article>
                        );
                      })
                    )}

                    <div ref={messagesEndRef} />
                  </div>

                  {/* VOICE RECORDING PREVIEW */}
                  {voiceFile && voicePreviewUrl && (
                    <div className="groups-voice-preview">
                      <div className="groups-voice-preview-info">
                        <Mic size={19} />

                        <div>
                          <strong>Voice message preview</strong>
                          <small>
                            {formatDuration(recordingSeconds)}
                          </small>
                        </div>
                      </div>

                      <audio
                        controls
                        src={voicePreviewUrl}
                        preload="metadata"
                      />

                      <div className="groups-voice-preview-actions">
                        <button
                          type="button"
                          className="groups-voice-cancel"
                          onClick={clearVoicePreview}
                          disabled={uploadingVoice}
                          title="Delete recording"
                        >
                          <Trash2 size={18} />
                          Cancel
                        </button>

                        <button
                          type="button"
                          className="groups-voice-send"
                          onClick={sendVoiceMessage}
                          disabled={uploadingVoice}
                        >
                          {uploadingVoice ? (
                            <>
                              <Loader2
                                size={17}
                                className="groups-spinning"
                              />
                              Sending...
                            </>
                          ) : (
                            <>
                              <Send size={17} />
                              Send voice
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {messageMediaFile && messageMediaPreviewUrl && (
                    <div className="groups-media-preview">
                      <div className="groups-media-preview-file">
                        {messageMediaFile.type.startsWith("image/") ? (
                          <img src={messageMediaPreviewUrl} alt="Selected image" />
                        ) : (
                          <video src={messageMediaPreviewUrl} muted playsInline />
                        )}
                        <div>
                          <strong>{messageMediaFile.name}</strong>
                          <small>{(messageMediaFile.size / (1024 * 1024)).toFixed(1)} MB</small>
                        </div>
                      </div>
                      <button type="button" onClick={clearMessageMedia} disabled={uploadingMedia} aria-label="Remove attachment">
                        <X size={17} />
                      </button>
                    </div>
                  )}

                  {uploadingMedia && (
                    <div className="groups-media-uploading">
                      <Loader2 size={16} className="groups-spinning" />
                      Uploading media...
                    </div>
                  )}

                  {/* RECORDING INDICATOR */}
                  {isRecording && (
                    <div className="groups-recording-indicator">
                      <span className="groups-recording-dot" />
                      <span>Recording voice message...</span>
                      <strong>
                        {formatDuration(recordingSeconds)}
                      </strong>
                      <span>Swipe left to cancel · release to send</span>
                    </div>
                  )}

                  <form
                    className="groups-composer"
                    onSubmit={sendMessage}
                  >
                    <input
                      ref={messageMediaInputRef}
                      type="file"
                      accept="image/*,video/*"
                      hidden
                      onChange={handleMessageMediaChange}
                    />

                    <button
                      type="button"
                      className="groups-attach-button"
                      onClick={() => messageMediaInputRef.current?.click()}
                      disabled={sending || uploadingMedia || uploadingVoice || isRecording}
                      title="Attach photo or video"
                      aria-label="Attach photo or video"
                    >
                      <ImagePlus size={19} />
                    </button>

                    <input
                      value={messageText}
                      onChange={(event) =>
                        setMessageText(event.target.value)
                      }
                      placeholder="Write a message..."
                      disabled={
                        sending ||
                        uploadingMedia ||
                        isRecording ||
                        Boolean(voiceFile) ||
                        uploadingVoice
                      }
                    />

                    <button
                      type="button"
                      className={`groups-voice-button ${
                        isRecording ? "recording" : ""
                      }`}
                      disabled={
                        sending ||
                        uploadingMedia ||
                        uploadingVoice ||
                        Boolean(voiceFile) ||
                        Boolean(messageMediaFile)
                      }
                      title={
                        isRecording
                          ? "Release to finish recording"
                          : "Hold to record a voice message"
                      }
                      onPointerDown={(event) => {
                        if (
                          event.button !== undefined &&
                          event.button !== 0
                        ) {
                          return;
                        }

                        event.preventDefault();
                        try {
                          event.currentTarget.setPointerCapture(event.pointerId);
                        } catch {
                          // Pointer capture is best-effort on touch devices.
                        }
                        recordingPointerRef.current = true;
                        recordingStartXRef.current = event.clientX;
                        recordingGroupIdRef.current = selectedGroup.id;

                        startVoiceRecording();
                      }}
                      onPointerUp={(event) => {
                        event.preventDefault();

                        if (recordingPointerRef.current) {
                          stopVoiceRecording();
                        }
                      }}
                      onPointerMove={(event) => {
                        if (!recordingPointerRef.current) return;
                        if (event.clientX - recordingStartXRef.current < -85) {
                          cancelRecording();
                          setError("Voice recording cancelled.");
                        }
                      }}
                      onPointerCancel={() => {
                        if (recordingPointerRef.current) {
                          cancelRecording();
                        }
                      }}
                      onContextMenu={(event) =>
                        event.preventDefault()
                      }
                    >
                      {isRecording ? (
                        <Square size={18} />
                      ) : (
                        <Mic size={19} />
                      )}
                    </button>

                    <button
                      type="submit"
                      disabled={
                        sending ||
                        uploadingMedia ||
                        (!messageText.trim() && !messageMediaFile) ||
                        isRecording ||
                        Boolean(voiceFile) ||
                        uploadingVoice
                      }
                      title="Send message"
                    >
                      <Send size={19} />
                    </button>
                  </form>
                </>
              )}
            </>
          )}
        </main>

        {selectedGroup && (
          <aside
            className={`groups-info ${
              showInfo ? "open" : ""
            }`}
          >
            <div className="groups-info-header">
              <strong>Group information</strong>

              <button
                className="groups-icon-button"
                onClick={() => setShowInfo(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="groups-info-profile">
              <GroupAvatar
                group={selectedGroup}
                size="large"
              />

              <h2>{selectedGroup.name}</h2>

              <span>
                {selectedGroup.is_public ? (
                  <>
                    <Globe size={14} />
                    Public group
                  </>
                ) : (
                  <>
                    <Lock size={14} />
                    Private group
                  </>
                )}
              </span>

              <p>
                {selectedGroup.description ||
                  "No group description."}
              </p>
            </div>

            <div className="groups-info-stats">
              <div>
                <strong>
                  {selectedGroup.memberCount ||
                    members.length}
                </strong>

                <small>Members</small>
              </div>

              <div>
                <strong>
                  {selectedGroup.myRole || "Visitor"}
                </strong>

                <small>Your role</small>
              </div>
            </div>

            {selectedGroup.myRole && (
              <>
                <div className="groups-info-section">
                  <div className="groups-info-section-heading">
                    <strong>Members</strong>

                    <span>{members.length}</span>
                  </div>

                  <div className="groups-members-list">
                    {members.map((member) => {
                      const memberName =
                        member.profile?.display_name ||
                        member.profile?.full_name ||
                        member.profile?.username ||
                        "Member";

                      const isMe =
                        member.user_id === user.id;

                      const canRemove =
                        canManage &&
                        !isMe &&
                        member.role !== "owner" &&
                        (isOwner ||
                          member.role === "member");

                      return (
                        <div
                          className="groups-member-row"
                          key={member.id}
                        >
                          <MemberAvatar
                            profile={member.profile}
                          />

                          <div className="groups-member-copy">
                            <strong>
                              {memberName}
                              <VerifiedBadge verified={member.profile?.is_verified} size={14} />
                              {isMe ? " (You)" : ""}
                            </strong>

                            <small>
                              {member.role === "owner" ? (
                                <>
                                  <Crown size={12} />
                                  Owner
                                </>
                              ) : member.role === "admin" ? (
                                <>
                                  <Shield size={12} />
                                  Admin
                                </>
                              ) : (
                                "Member"
                              )}
                            </small>
                          </div>

                          {isOwner &&
                            !isMe &&
                            member.role !== "owner" && (
                              <select
                                value={member.role}
                                onChange={(event) =>
                                  changeMemberRole(
                                    member,
                                    event.target.value
                                  )
                                }
                                aria-label={`Change ${memberName}'s role`}
                              >
                                <option value="member">
                                  Member
                                </option>

                                <option value="admin">
                                  Admin
                                </option>
                              </select>
                            )}

                          {canRemove && (
                            <button
                              className="groups-remove-member"
                              onClick={() =>
                                removeMember(member)
                              }
                              title="Remove member"
                            >
                              <MoreVertical size={17} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {!selectedGroup.is_public &&
                  isOwner && (
                    <div className="groups-invite-box">
                      <strong>
                        Private invitation code
                      </strong>

                      <div>
                        <code>
                          {selectedGroup.invite_code}
                        </code>

                        <button
                          onClick={copyInvite}
                          title="Copy invite code"
                        >
                          <Copy size={16} />
                        </button>
                      </div>
                    </div>
                  )}

                {selectedGroup.myRole !== "owner" && (
                  <button
                    className="groups-leave-button"
                    onClick={leaveGroup}
                  >
                    <LogOut size={16} />
                    Leave group
                  </button>
                )}
              </>
            )}
          </aside>
        )}
      </div>

      {showCreate && (
        <div
          className="groups-modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              setShowCreate(false);
            }
          }}
        >
          <form
            className="groups-create-modal"
            onSubmit={createGroup}
          >
            <div className="groups-modal-heading">
              <div>
                <span className="groups-eyebrow">
                  NEW COMMUNITY
                </span>

                <h2>Create a group</h2>
              </div>

              <button
                type="button"
                className="groups-icon-button"
                onClick={() => setShowCreate(false)}
              >
                <X size={19} />
              </button>
            </div>

            <label>
              Group name

              <input
                value={groupName}
                onChange={(event) =>
                  setGroupName(event.target.value)
                }
                placeholder="Give your group a name"
                maxLength={60}
                required
              />
            </label>

            <label>
              Description

              <textarea
                value={groupDescription}
                onChange={(event) =>
                  setGroupDescription(event.target.value)
                }
                placeholder="What is this group about?"
                rows={3}
                maxLength={300}
              />
            </label>

            <div className="groups-visibility-options">
              <button
                type="button"
                aria-pressed={
                  groupVisibility === "public"
                }
                className={
                  groupVisibility === "public"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setGroupVisibility("public")
                }
              >
                <Globe size={18} />

                <span>
                  <strong>Public</strong>

                  <small>
                    Anyone can discover and join
                  </small>
                </span>
              </button>

              <button
                type="button"
                aria-pressed={
                  groupVisibility === "private"
                }
                className={
                  groupVisibility === "private"
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setGroupVisibility("private")
                }
              >
                <Lock size={18} />

                <span>
                  <strong>Private</strong>

                  <small>
                    Join with an invitation code
                  </small>
                </span>
              </button>
            </div>

            <div className="groups-selected-visibility">
              Selected:{" "}
              <strong>
                {groupVisibility.toUpperCase()}
              </strong>
            </div>

            <button
              className="groups-create-button groups-submit-create"
              type="submit"
              disabled={
                creating || !groupName.trim()
              }
            >
              {creating
                ? "Creating..."
                : "Create group"}
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
