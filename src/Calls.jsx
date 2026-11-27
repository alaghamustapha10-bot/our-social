import "./Calls.css";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { Room, RoomEvent, Track } from "livekit-client";
import { Capacitor, registerPlugin } from "@capacitor/core";

const NativeCallBackground = registerPlugin("CallBackground");
import { createPortal } from "react-dom";
import { dispatchLolzPush } from "./pushNotifications";

import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  X,
  Users,
  RefreshCw,
  Clock,
  Volume2,
  SwitchCamera,
  Hand,
  ShieldCheck,
  Circle,
  Check,
  XCircle,
  Radio,
  UserRound,
  Loader2,
  Minimize2,
  ScreenShare,
  ScreenShareOff,
  Copy,
  UserX,
  VolumeX,
} from "lucide-react";

export default function Calls({
  supabase,
  user,
  conversation,
  callType = "private",
  groupId = null,
  channelId = null,
  canStart = true,
  canEnd = false,
  onCallStateChange = null,
  onCallActionsReady = null,
  showIdleControls = true,
  backgroundCallsEnabled = false,
  incomingCallAction = null,
  onIncomingCallActionHandled = null,
}) {
  const [incomingCall, setIncomingCall] = useState(null);
  const [incomingProfile, setIncomingProfile] = useState(null);
  const [activeCalls, setActiveCalls] = useState([]);

  const [connecting, setConnecting] = useState(false);
  const [active, setActive] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [activeMediaType, setActiveMediaType] = useState("audio");
  const [cameraFacing, setCameraFacing] = useState("user");
  const [switchingCamera, setSwitchingCamera] = useState(false);

  const [audioPlaybackBlocked, setAudioPlaybackBlocked] = useState(false);
  const [error, setError] = useState("");
  const [connectedAt, setConnectedAt] = useState(null);
  const [callDuration, setCallDuration] = useState(0);

  const [callMode, setCallMode] = useState("open");
  const [isCallAdmin, setIsCallAdmin] = useState(false);
  const [canPublish, setCanPublish] = useState(true);
  const [participants, setParticipants] = useState([]);
  const [speakRequests, setSpeakRequests] = useState([]);
  const [mySpeakRequest, setMySpeakRequest] = useState(null);
  const [activeSpeakers, setActiveSpeakers] = useState([]);
  const [requestingToSpeak, setRequestingToSpeak] = useState(false);
  const [respondingToSpeak, setRespondingToSpeak] = useState(null);

  const [recording, setRecording] = useState(null);
  const [recordingConsents, setRecordingConsents] = useState([]);
  const [canManageRecording, setCanManageRecording] = useState(false);
  const [recordingBusy, setRecordingBusy] = useState(false);
  const [recordingPrompt, setRecordingPrompt] = useState(null);
  const [recordingMessage, setRecordingMessage] = useState("");

  const [joinConsent, setJoinConsent] = useState(null);
  const [screenSharing, setScreenSharing] = useState(false);
  const [callModeBusy, setCallModeBusy] = useState(false);
  const [participantBusy, setParticipantBusy] = useState("");
  const [callInviteNotice, setCallInviteNotice] = useState("");

  const roomRef = useRef(null);
  const callIdRef = useRef(null);
  const publishPermissionRef = useRef(null);
  const refreshingRef = useRef(false);
  const localVideoRef = useRef(null);
  const screenSharePreviewRef = useRef(null);
  const remoteMediaRef = useRef(null);
  const mountedRef = useRef(false);
  const activeRef = useRef(false);
  const connectingRef = useRef(false);
  const checkingRef = useRef(false);
  const endingRef = useRef(false);
  const remoteTracksRef = useRef(new Map());
  const startCallRef = useRef(null);
  const joinCallRef = useRef(null);
  const autoJoinInviteRef = useRef("");
  const handledNativeCallActionRef = useRef("");

  const isPrivate = callType === "private";
  const isGroupOrChannel =
    callType === "group" || callType === "channel";

  activeRef.current = active;
  connectingRef.current = connecting;

  useEffect(() => {
    if (Capacitor.getPlatform() !== "android") return undefined;
    let cancelled = false;

    const syncBackgroundCallService = async () => {
      try {
        if (active && backgroundCallsEnabled) {
          await NativeCallBackground.startCall({
            video: Boolean(videoEnabled),
            title: "LOLZ",
            text: document.documentElement.lang === "ar" ? "مكالمة نشطة في الخلفية" : "Active call running in background",
          });
          if (cancelled) await NativeCallBackground.stopCall();
        } else {
          await NativeCallBackground.stopCall();
        }
      } catch (nativeError) {
        console.warn("LOLZ background call service could not be synchronized:", nativeError);
      }
    };

    void syncBackgroundCallService();
    return () => { cancelled = true; };
  }, [active, videoEnabled, backgroundCallsEnabled]);

  useEffect(() => () => {
    if (Capacitor.getPlatform() === "android") {
      void NativeCallBackground.stopCall().catch((nativeError) => {
        console.warn("Could not stop LOLZ background call service:", nativeError);
      });
    }
  }, []);

  const reportCallState = useCallback(
    (status) => {
      onCallStateChange?.({
        status,
        context: {
          callType,
          conversation,
          groupId,
          channelId,
          canStart,
          canEnd,
        },
      });
    },
    [
      onCallStateChange,
      callType,
      conversation,
      groupId,
      channelId,
      canStart,
      canEnd,
    ]
  );

  const buttonStyle = {
    width: "48px",
    height: "48px",
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: "50%",
    background: "#2a2f3a",
    color: "#ffffff",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    touchAction: "manipulation",
    flexShrink: 0,
    transition: "transform 0.14s ease, background 0.16s ease",
  };

  const panelStyle = {
    padding: "12px",
    marginTop: "12px",
    background: "#222732",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "12px",
  };

  const smallButtonStyle = {
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "10px",
    padding: "8px 12px",
    color: "#ffffff",
    background: "#2d3340",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    fontSize: "13px",
  };

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remaining = seconds % 60;
    const two = (number) => String(number).padStart(2, "0");

    if (hours > 0) {
      return `${two(hours)}:${two(minutes)}:${two(remaining)}`;
    }

    return `${two(minutes)}:${two(remaining)}`;
  };

  const invokeCallAction = useCallback(
    async (body) => {
      const { data, error: functionError } =
        await supabase.functions.invoke("livekit-token", { body });

      if (functionError) {
        let payload = data || null;

        try {
          if (functionError.context?.json) {
            payload = await functionError.context.json();
          }
        } catch {
          // Response body may already have been consumed.
        }

        const message =
          payload?.error ||
          functionError.message ||
          "حدث خطأ أثناء تنفيذ العملية";

        const err = new Error(message);
        err.payload = payload;
        err.status = functionError.context?.status || null;
        throw err;
      }

      if (data?.success === false) {
        const err = new Error(data.error || "تعذر تنفيذ العملية");
        err.payload = data;
        throw err;
      }

      return data;
    },
    [supabase]
  );

  const invokeCallActionRef = useRef(invokeCallAction);
  invokeCallActionRef.current = invokeCallAction;

  const getDisplayName = (profile, fallback = "مشارك") => {
    return (
      profile?.display_name ||
      profile?.full_name ||
      profile?.username ||
      fallback
    );
  };

  const attachRemoteTrack = useCallback((track) => {
    const container = remoteMediaRef.current;
    if (!container || !track) return;

    const existing = Array.from(container.children).find(
      (element) => element.dataset.livekitTrack === track.sid
    );

    if (existing) return;

    try {
      const element = track.attach();

      element.autoplay = true;
      element.playsInline = true;
      element.muted = false;
      element.dataset.livekitTrack = track.sid;

      if (track.kind === "audio") {
        element.style.display = "none";
        element.volume = 1;
      } else if (isGroupOrChannel) {
        element.className = track.source === Track.Source.ScreenShare
          ? "lolz-screen-share-video"
          : "lolz-remote-video";
        element.style.width = "100%";
        element.style.maxWidth = "100%";
        element.style.borderRadius = "14px";
        element.style.objectFit = track.source === Track.Source.ScreenShare
          ? "contain"
          : "cover";
      } else {
        element.style.width = "100%";
        element.style.maxWidth = "440px";
        element.style.borderRadius = "14px";
        element.style.objectFit = "cover";
      }

      container.appendChild(element);

      const playResult = element.play?.();

      if (playResult?.catch) {
        playResult.catch((playError) => {
          console.warn("Remote playback blocked:", playError);

          if (track.kind === "audio" && mountedRef.current) {
            setAudioPlaybackBlocked(true);
          }
        });
      }

      if (track.kind === "audio") {
        setAudioPlaybackBlocked(false);
      }
    } catch (attachError) {
      console.error("Could not attach remote track:", attachError);
    }
  }, [isGroupOrChannel]);

  useEffect(() => {
    if (!active || !remoteMediaRef.current) return;

    remoteTracksRef.current.forEach((track) => {
      attachRemoteTrack(track);
    });
  }, [active, attachRemoteTrack]);

  const enableRemoteAudio = async () => {
    const room = roomRef.current;
    if (!room) return;

    try {
      await room.startAudio();

      remoteTracksRef.current.forEach((track) => {
        if (track.kind === "audio") attachRemoteTrack(track);
      });

      if (remoteMediaRef.current) {
        const audioElements =
          remoteMediaRef.current.querySelectorAll("audio");

        for (const element of audioElements) {
          element.muted = false;
          element.volume = 1;
          await element.play();
        }
      }

      setAudioPlaybackBlocked(false);
      setError("");
    } catch (err) {
      console.error("Enable remote audio error:", err);
      setAudioPlaybackBlocked(true);
      setError("لم يتم تشغيل الصوت. تحقق من إعدادات الصوت في المتصفح.");
    }
  };

  const clearCall = useCallback(() => {
    const room = roomRef.current;

    roomRef.current = null;
    callIdRef.current = null;
    publishPermissionRef.current = null;
    refreshingRef.current = false;
    remoteTracksRef.current.clear();

    activeRef.current = false;
    connectingRef.current = false;

    reportCallState("ended");

    if (localVideoRef.current) {
      localVideoRef.current.innerHTML = "";
    }

    if (remoteMediaRef.current) {
      remoteMediaRef.current.innerHTML = "";
    }

    if (screenSharePreviewRef.current) {
      screenSharePreviewRef.current.innerHTML = "";
    }

    if (!mountedRef.current) {
      if (room) room.disconnect();
      return;
    }

    setActive(false);
    setConnecting(false);
    setIsMinimized(false);
    setAudioEnabled(true);
    setVideoEnabled(false);
    setActiveMediaType("audio");
    setCameraFacing("user");
    setSwitchingCamera(false);
    setScreenSharing(false);
    setAudioPlaybackBlocked(false);
    setCallInviteNotice("");
    setParticipantBusy("");
    setConnectedAt(null);
    setCallDuration(0);

    setCallMode("open");
    setIsCallAdmin(false);
    setCanPublish(true);
    setParticipants([]);
    setSpeakRequests([]);
    setMySpeakRequest(null);
    setActiveSpeakers([]);

    setRecording(null);
    setRecordingConsents([]);
    setCanManageRecording(false);
    setRecordingPrompt(null);
    setRecordingMessage("");
    setJoinConsent(null);

    if (room) room.disconnect();
  }, [reportCallState]);

  const connectToRoom = useCallback(
    async (
      serverUrl,
      token,
      id,
      withVideo = false,
      publishPermission = true,
      mode = "open",
      admin = false
    ) => {
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      roomRef.current = room;
      callIdRef.current = id;
      publishPermissionRef.current = publishPermission;
      remoteTracksRef.current.clear();

      room.on(RoomEvent.TrackSubscribed, (track) => {
        remoteTracksRef.current.set(track.sid, track);
        attachRemoteTrack(track);
      });

      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        remoteTracksRef.current.delete(track.sid);
        track.detach().forEach((element) => element.remove());
      });

      room.on(RoomEvent.ParticipantConnected, () => {
        if (mountedRef.current) {
          setConnectedAt((current) => current || Date.now());
        }
      });

      room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        if (!mountedRef.current) return;

        setActiveSpeakers(
          speakers.map((participant) => participant.identity)
        );
      });

      room.on(RoomEvent.LocalTrackUnpublished, (publication) => {
        if (
          publication?.source === Track.Source.ScreenShare &&
          mountedRef.current
        ) {
          setScreenSharing(false);
        }
      });

      room.on(RoomEvent.Disconnected, () => {
        if (roomRef.current !== room) return;

        const disconnectedCallId = callIdRef.current;

        roomRef.current = null;
        publishPermissionRef.current = null;

        if (endingRef.current) {
          return;
        }

        callIdRef.current = null;

        clearCall();

        if (disconnectedCallId) {
          void invokeCallActionRef.current({
            action: "leave",
            call_id: disconnectedCallId,
          }).catch((leaveError) => {
            console.error(
              "Leave after LiveKit disconnect failed:",
              leaveError
            );
          });
        }
      });

      try {
        await room.connect(serverUrl, token);

        if (roomRef.current !== room) {
          await room.disconnect();
          return;
        }

        if (publishPermission) {
          await room.localParticipant.setMicrophoneEnabled(true);

          if (withVideo) {
            await room.localParticipant.setCameraEnabled(true, {
              facingMode: "user",
            });
          }
        }

        if (!mountedRef.current) {
          await room.disconnect();
          return;
        }

        setCanPublish(publishPermission);
        setAudioEnabled(publishPermission);
        setVideoEnabled(publishPermission && withVideo);
        setActiveMediaType(withVideo ? "video" : "audio");
        setCameraFacing("user");
        setCallMode(mode);
        setIsCallAdmin(admin);
        setIsMinimized(false);
        setActive(true);
        activeRef.current = true;
        reportCallState("active");

        if (room.remoteParticipants.size > 0) {
          setConnectedAt(Date.now());
        }

        try {
          await room.startAudio();
          setAudioPlaybackBlocked(false);
        } catch (audioError) {
          console.warn("Audio playback needs user interaction:", audioError);
          setAudioPlaybackBlocked(true);
        }
      } catch (err) {
        const failedCallId = id || callIdRef.current;

        if (roomRef.current === room) {
          roomRef.current = null;
          callIdRef.current = null;
          publishPermissionRef.current = null;
        }

        remoteTracksRef.current.clear();

        if (failedCallId) {
          try {
            await invokeCallActionRef.current({
              action: "leave",
              call_id: failedCallId,
            });
          } catch (cleanupError) {
            console.error(
              "Call cleanup after connection failure failed:",
              cleanupError
            );
          }
        }

        await room.disconnect().catch(() => {});
        throw err;
      }
    },
    [attachRemoteTrack, clearCall, reportCallState]
  );

  useEffect(() => {
    if (!active || !videoEnabled || !localVideoRef.current) return;

    const room = roomRef.current;
    if (!room) return;

    const publication =
      room.localParticipant.getTrackPublication("camera");

    if (!publication?.track) return;

    const container = localVideoRef.current;
    container.innerHTML = "";

    const element = publication.track.attach();

    element.autoplay = true;
    element.muted = true;
    element.playsInline = true;
    element.style.width = "100%";
    element.style.maxWidth = "440px";
    element.style.borderRadius = "14px";
    element.style.objectFit = "cover";

    container.appendChild(element);

    return () => {
      publication.track.detach().forEach((item) => item.remove());
    };
  }, [active, videoEnabled]);

  useEffect(() => {
    if (!active || !screenSharing || !screenSharePreviewRef.current) return;

    const room = roomRef.current;
    if (!room) return;

    const publication = room.localParticipant.getTrackPublication(
      Track.Source.ScreenShare
    );
    if (!publication?.track) return;

    const container = screenSharePreviewRef.current;
    container.innerHTML = "";
    const element = publication.track.attach();
    element.autoplay = true;
    element.muted = true;
    element.playsInline = true;
    element.className = "lolz-local-screen-share-video";
    element.style.width = "100%";
    element.style.maxHeight = "48vh";
    element.style.objectFit = "contain";
    container.appendChild(element);

    return () => {
      publication.track.detach().forEach((item) => item.remove());
      container.innerHTML = "";
    };
  }, [active, screenSharing]);

  useEffect(() => {
    if (!connectedAt) {
      setCallDuration(0);
      return;
    }

    const updateTimer = () => {
      setCallDuration(Math.floor((Date.now() - connectedAt) / 1000));
    };

    updateTimer();

    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [connectedAt]);

  const refreshCallData = useCallback(
    async (providedCallId = null) => {
      const id = providedCallId || callIdRef.current;

      if (
        !id ||
        !isGroupOrChannel ||
        refreshingRef.current ||
        callIdRef.current !== id
      ) {
        return;
      }

      refreshingRef.current = true;

      try {
        const [recordingData, participantData] = await Promise.all([
          invokeCallAction({
            action: "recording_state",
            call_id: id,
          }),
          invokeCallAction({
            action: "list_participants",
            call_id: id,
          }),
        ]);

        if (!mountedRef.current || callIdRef.current !== id) return;

        const canManage =
          recordingData.can_manage_recording === true;

        setRecording(recordingData.recording || null);
        setRecordingConsents(recordingData.consents || []);
        if (recordingData.call_mode === "open" || recordingData.call_mode === "moderated") {
          setCallMode(recordingData.call_mode);
        }
        setCanManageRecording(canManage);
        setIsCallAdmin(canManage);

        const loadedParticipants =
          participantData.participants || [];

        setParticipants(loadedParticipants);

        const ownParticipant = loadedParticipants.find(
          (participant) => participant.user_id === user?.id
        );

        if (ownParticipant) {
          const nextPermission =
            ownParticipant.can_publish === true;

          const previousPermission =
            publishPermissionRef.current;

          publishPermissionRef.current = nextPermission;
          setCanPublish(nextPermission);

          // A newly granted speaking permission never turns on the microphone
          // automatically. The participant chooses when to unmute.
          if (
            previousPermission === true &&
            nextPermission === false &&
            roomRef.current &&
            callIdRef.current === id
          ) {
            try {
              await roomRef.current.localParticipant.setMicrophoneEnabled(false);
              await roomRef.current.localParticipant.setCameraEnabled(false);
            } catch (permissionError) {
              console.warn(
                "Could not disable media after permission removal:",
                permissionError
              );
            }

            if (mountedRef.current && callIdRef.current === id) {
              setAudioEnabled(false);
              setVideoEnabled(false);
            }
          }
        }

        if (canManage) {
          try {
            const requestsData = await invokeCallAction({
              action: "list_speak_requests",
              call_id: id,
            });

            if (mountedRef.current && callIdRef.current === id) {
              setSpeakRequests(requestsData.requests || []);
            }
          } catch (requestError) {
            console.warn(
              "Could not load speaking requests:",
              requestError
            );
          }
        } else {
          setSpeakRequests([]);
        }
      } catch (err) {
        console.error("Refresh call data error:", err);
      } finally {
        refreshingRef.current = false;
      }
    },
    [isGroupOrChannel, invokeCallAction, user?.id]
  );

  const startCall = async (withVideo = false) => {
    if (
      !user ||
      connecting ||
      active ||
      roomRef.current ||
      !canStart
    ) {
      return;
    }

    if (isPrivate && !conversation?.id) return;
    if (callType === "group" && !groupId) return;
    if (callType === "channel" && !channelId) return;

    reportCallState("connecting");
    setConnecting(true);
    connectingRef.current = true;
    setError("");

    try {
      const body = {
        action: "create",
        call_type: callType,
        media_type: withVideo ? "video" : "audio",
      };

      if (isPrivate) {
        body.conversation_id = conversation.id;
      } else if (callType === "group") {
        body.group_id = groupId;
      } else if (callType === "channel") {
        body.channel_id = channelId;
      }

      const data = await invokeCallAction(body);

      if (!data?.token || !data?.server_url || !data?.call?.id) {
        throw new Error(data?.error || "تعذر إنشاء المكالمة");
      }

      // Deliver the incoming-call alert independently of LiveKit connection state.
      void dispatchLolzPush(supabase, {
        action: "call",
        call_id: data.call.id,
      });

      let admin = false;

      if (isGroupOrChannel) {
        try {
          const recordingData = await invokeCallAction({
            action: "recording_state",
            call_id: data.call.id,
          });

          admin = recordingData?.can_manage_recording === true;

          setCanManageRecording(admin);
          setIsCallAdmin(admin);
        } catch (permissionError) {
          console.warn(
            "Could not determine call admin permissions:",
            permissionError
          );
        }
      }

      await connectToRoom(
        data.server_url,
        data.token,
        data.call.id,
        data.media_type === "video",
        data.can_publish !== false,
        data.call_mode || "open",
        admin
      );

      if (isGroupOrChannel) {
        await refreshCallData(data.call.id);
      }
    } catch (err) {
      console.error("Start call error:", err);
      setError(err.message || "تعذر بدء المكالمة");
      clearCall();
    } finally {
      if (mountedRef.current) {
        setConnecting(false);
        connectingRef.current = false;
      }
    }
  };

  startCallRef.current = startCall;

  useEffect(() => {
    if (!isPrivate || !onCallActionsReady) return;

    onCallActionsReady({
      startAudio: () => {
        if (startCallRef.current) void startCallRef.current(false);
      },
      startVideo: () => {
        if (startCallRef.current) void startCallRef.current(true);
      },
    });

    return () => onCallActionsReady(null);
  }, [isPrivate, onCallActionsReady]);

  const checkCalls = useCallback(async () => {
    if (
      !user ||
      activeRef.current ||
      connectingRef.current ||
      roomRef.current ||
      checkingRef.current
    ) {
      return;
    }

    checkingRef.current = true;

    try {
      if (isPrivate) {
        const data = await invokeCallAction({
          action: "incoming_calls",
        });

        if (!mountedRef.current) return;

        if (data?.calls?.length) {
          setIncomingCall(data.calls[0]);
        } else {
          setIncomingCall(null);
          setIncomingProfile(null);
        }

        return;
      }

      const data = await invokeCallAction({
        action: "active_calls",
      });

      if (!mountedRef.current) return;

      const calls = Array.isArray(data?.calls) ? data.calls : [];

      const matchingCalls = calls.filter((call) => {
        if (callType === "group") {
          return (
            call.call_type === "group" &&
            String(call.group_id) === String(groupId)
          );
        }

        if (callType === "channel") {
          return (
            call.call_type === "channel" &&
            String(call.channel_id) === String(channelId)
          );
        }

        return false;
      });

      setActiveCalls(matchingCalls);
    } catch (err) {
      console.error("Check calls error:", err);
    } finally {
      checkingRef.current = false;
    }
  }, [
    user,
    isPrivate,
    callType,
    groupId,
    channelId,
    invokeCallAction,
  ]);

  useEffect(() => {
    const callerId = incomingCall?.created_by;

    if (!callerId) {
      setIncomingProfile(null);
      return;
    }

    let cancelled = false;

    const loadCaller = async () => {
      try {
        const { data, error: profileError } = await supabase
          .from("profiles")
          .select("id, username, full_name, display_name, avatar_url")
          .eq("id", callerId)
          .maybeSingle();

        if (profileError) throw profileError;
        if (!cancelled) setIncomingProfile(data || null);
      } catch (err) {
        console.error("Caller profile error:", err);
      }
    };

    loadCaller();

    return () => {
      cancelled = true;
    };
  }, [incomingCall?.created_by, supabase]);

  useEffect(() => {
    mountedRef.current = true;
    endingRef.current = false;

    return () => {
      mountedRef.current = false;
      endingRef.current = true;

      const callIdToLeave = callIdRef.current;
      const room = roomRef.current;

      roomRef.current = null;
      callIdRef.current = null;
      publishPermissionRef.current = null;
      refreshingRef.current = false;
      remoteTracksRef.current.clear();

      if (callIdToLeave) {
        void invokeCallActionRef.current({
          action: "leave",
          call_id: callIdToLeave,
        }).catch((leaveError) => {
          console.error(
            "Leave call during component unmount failed:",
            leaveError
          );
        });
      }

      if (room) {
        room.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    checkCalls();
    const interval = setInterval(checkCalls, 4000);
    return () => clearInterval(interval);
  }, [checkCalls]);

  useEffect(() => {
    if (!active || !isGroupOrChannel) return;

    refreshCallData();
    const interval = setInterval(() => {
      refreshCallData();
    }, 3500);

    return () => clearInterval(interval);
  }, [active, isGroupOrChannel, refreshCallData]);

  const joinCall = async (call) => {
    if (!call?.id || connecting || active || roomRef.current) return false;

    reportCallState("connecting");
    setConnecting(true);
    connectingRef.current = true;
    setError("");

    try {
      const data = await invokeCallAction({
        action: "join",
        call_id: call.id,
      });

      if (!data?.token || !data?.server_url) {
        throw new Error(data?.error || "تعذر الانضمام للمكالمة");
      }

      const incomingMediaType =
        data.media_type || call.media_type || "audio";

      const joinWithVideo = incomingMediaType === "video";

      setIncomingCall(null);
      setJoinConsent(null);

      await connectToRoom(
        data.server_url,
        data.token,
        call.id,
        joinWithVideo,
        data.can_publish !== false,
        data.call_mode || "open",
        data.is_admin === true
      );

      if (isGroupOrChannel) {
        await refreshCallData(call.id);
      }

      if (typeof window !== "undefined") {
        const inviteUrl = new URL(window.location.href);
        if (inviteUrl.searchParams.get("lolz_call") === String(call.id)) {
          ["lolz_call", "lolz_call_type", "group_id", "channel_id"].forEach(
            (key) => inviteUrl.searchParams.delete(key)
          );
          window.history.replaceState(window.history.state, "", inviteUrl.toString());
        }
      }

      return true;
    } catch (err) {
      reportCallState("ended");

      console.error("Join call error:", err);

      const payload = err.payload || {};

      if (payload.requires_recording_consent) {
        setJoinConsent({
          call,
          decision: payload.decision || "pending",
        });
        setError("");
      } else {
        setError(err.message || "تعذر الانضمام للمكالمة");
      }
      return false;
    } finally {
      if (mountedRef.current) {
        setConnecting(false);
        connectingRef.current = false;
      }
    }
  };

  joinCallRef.current = joinCall;

  useEffect(() => {
    if (!isGroupOrChannel || active || connecting || !activeCalls.length) return;

    const inviteUrl = new URL(window.location.href);
    const inviteCallId = inviteUrl.searchParams.get("lolz_call");
    const inviteType = inviteUrl.searchParams.get("lolz_call_type");
    const inviteGroupId = inviteUrl.searchParams.get("group_id");
    const inviteChannelId = inviteUrl.searchParams.get("channel_id");

    if (!inviteCallId || inviteType !== callType) return;
    if (callType === "group" && String(inviteGroupId) !== String(groupId)) return;
    if (callType === "channel" && String(inviteChannelId) !== String(channelId)) return;
    if (autoJoinInviteRef.current === inviteCallId) return;

    const invitedCall = activeCalls.find(
      (item) => String(item.id) === String(inviteCallId)
    );
    if (!invitedCall) return;

    autoJoinInviteRef.current = inviteCallId;
    void joinCallRef.current?.(invitedCall).then((joined) => {
      if (!joined) autoJoinInviteRef.current = "";
    });
  }, [isGroupOrChannel, active, connecting, activeCalls, callType, groupId, channelId]);

  const acceptCall = async () => {
    if (!incomingCall) return;
    await joinCall(incomingCall);
  };

  const respondToRecordingConsent = async (decision, joining = false) => {
    const targetCall = joining
      ? joinConsent?.call
      : { id: callIdRef.current };

    if (!targetCall?.id || recordingBusy) return;

    setRecordingBusy(true);
    setRecordingMessage("");

    try {
      await invokeCallAction({
        action: "recording_consent",
        call_id: targetCall.id,
        decision,
      });

      if (joining) {
        if (decision === "approved") {
          setJoinConsent(null);
          await joinCall(targetCall);
        } else {
          setJoinConsent({
            call: targetCall,
            decision: "rejected",
          });
          setRecordingMessage(
            "لقد رفضت التسجيل، لذلك لا يمكنك الانضمام ما دام التسجيل جارياً."
          );
        }
      } else {
        setRecordingPrompt(null);
        setRecordingMessage(
          decision === "approved"
            ? "تم تسجيل موافقتك."
            : "تم تسجيل رفضك. لن يبدأ التسجيل إذا كنت مشاركاً حالياً."
        );

        await refreshCallData();
      }
    } catch (err) {
      console.error("Recording consent error:", err);
      setRecordingMessage(err.message || "تعذر حفظ موافقتك");
    } finally {
      if (mountedRef.current) setRecordingBusy(false);
    }
  };

  useEffect(() => {
    if (!active || !recording || isPrivate || !user?.id) {
      setRecordingPrompt(null);
      return;
    }

    const myConsent = recordingConsents.find(
      (item) => item.user_id === user.id
    );

    if (myConsent?.decision === "pending") {
      setRecordingPrompt({ callId: callIdRef.current });
    } else {
      setRecordingPrompt(null);
    }
  }, [active, recording, recordingConsents, user?.id, isPrivate]);

  const requestRecording = async () => {
    const id = callIdRef.current;
    if (!id || !canManageRecording || recordingBusy) return;

    setRecordingBusy(true);
    setRecordingMessage("");

    try {
      await invokeCallAction({
        action: "recording_request",
        call_id: id,
      });

      setRecordingMessage(
        "تم إرسال طلب الموافقة إلى المشاركين. لن يبدأ التسجيل حتى يوافق الجميع."
      );

      await refreshCallData();
    } catch (err) {
      console.error("Recording request error:", err);
      setRecordingMessage(err.message || "تعذر طلب موافقة التسجيل");
    } finally {
      if (mountedRef.current) setRecordingBusy(false);
    }
  };

  const startRecording = async () => {
    const id = callIdRef.current;
    if (!id || !canManageRecording || recordingBusy) return;

    setRecordingBusy(true);
    setRecordingMessage("");

    try {
      await invokeCallAction({
        action: "recording_start",
        call_id: id,
      });

      setRecordingMessage("بدأ تسجيل الصوت.");
      await refreshCallData();
    } catch (err) {
      console.error("Start recording error:", err);
      setRecordingMessage(err.message || "تعذر بدء التسجيل");
      await refreshCallData();
    } finally {
      if (mountedRef.current) setRecordingBusy(false);
    }
  };

  const stopRecording = async () => {
    const id = callIdRef.current;
    if (!id || !canManageRecording || recordingBusy) return;

    setRecordingBusy(true);
    setRecordingMessage("");

    try {
      await invokeCallAction({
        action: "recording_stop",
        call_id: id,
      });

      setRecording(null);
      setRecordingConsents([]);
      setRecordingMessage("تم إيقاف التسجيل.");
      await refreshCallData();
    } catch (err) {
      console.error("Stop recording error:", err);
      setRecordingMessage(err.message || "تعذر إيقاف التسجيل");
    } finally {
      if (mountedRef.current) setRecordingBusy(false);
    }
  };

  const requestToSpeak = async () => {
    const id = callIdRef.current;

    if (!id || requestingToSpeak || canPublish || isCallAdmin) return;

    setRequestingToSpeak(true);
    setError("");

    try {
      const data = await invokeCallAction({
        action: "request_speak",
        call_id: id,
      });

      setMySpeakRequest(data.request || { status: "pending" });
    } catch (err) {
      console.error("Request to speak error:", err);
      setError(err.message || "تعذر إرسال طلب التحدث");
    } finally {
      if (mountedRef.current) setRequestingToSpeak(false);
    }
  };

  const respondToSpeakRequest = async (request, decision) => {
    const id = callIdRef.current;

    if (!id || !request?.id || respondingToSpeak) return;

    setRespondingToSpeak(request.id);

    try {
      await invokeCallAction({
        action: "respond_speak",
        call_id: id,
        request_id: request.id,
        decision,
      });

      setSpeakRequests((current) =>
        current.filter((item) => item.id !== request.id)
      );

      await refreshCallData();
    } catch (err) {
      console.error("Respond to speak request error:", err);
      setError(err.message || "تعذر تحديث طلب التحدث");
    } finally {
      if (mountedRef.current) setRespondingToSpeak(null);
    }
  };

  const updateCallMode = async (nextMode) => {
    if (!isGroupOrChannel || !isCallAdmin || callModeBusy || !["open", "moderated"].includes(nextMode)) return;
    if (nextMode === callMode) return;

    setCallModeBusy(true);
    setError("");
    try {
      const body = {
        action: "update_call_mode",
        call_type: callType,
        call_mode: nextMode,
      };
      if (callType === "group") body.group_id = groupId;
      if (callType === "channel") body.channel_id = channelId;

      await invokeCallAction(body);
      setCallMode(nextMode);
      await refreshCallData();
    } catch (err) {
      console.error("Update call mode error:", err);
      setError(err.message || "تعذر تغيير وضع المكالمة");
    } finally {
      if (mountedRef.current) setCallModeBusy(false);
    }
  };

  const setParticipantPublish = async (targetUserId, nextPermission) => {
    const id = callIdRef.current;
    if (!id || !isCallAdmin || !targetUserId || targetUserId === user?.id || participantBusy) return;

    setParticipantBusy(targetUserId);
    setError("");
    try {
      await invokeCallAction({
        action: "set_publish",
        call_id: id,
        target_user_id: targetUserId,
        can_publish: nextPermission,
      });
      await refreshCallData();
    } catch (err) {
      console.error("Set participant microphone permission error:", err);
      setError(err.message || "تعذر تحديث صلاحية الميكروفون");
    } finally {
      if (mountedRef.current) setParticipantBusy("");
    }
  };

  const removeCallParticipant = async (targetUserId, targetName) => {
    const id = callIdRef.current;
    if (!id || !isCallAdmin || !targetUserId || targetUserId === user?.id || participantBusy) return;

    const confirmed = window.confirm(
      `إزالة ${targetName || "هذا العضو"} من المكالمة الحالية؟`
    );
    if (!confirmed) return;

    setParticipantBusy(targetUserId);
    setError("");
    try {
      await invokeCallAction({
        action: "remove_participant",
        call_id: id,
        target_user_id: targetUserId,
      });
      await refreshCallData();
    } catch (err) {
      console.error("Remove call participant error:", err);
      setError(err.message || "تعذر إزالة العضو من المكالمة");
    } finally {
      if (mountedRef.current) setParticipantBusy("");
    }
  };

  const muteAllParticipants = async () => {
    const id = callIdRef.current;
    if (!id || !isCallAdmin || participantBusy) return;

    const confirmed = window.confirm(
      "كتم جميع المشاركين الآخرين في هذه المكالمة؟"
    );
    if (!confirmed) return;

    setParticipantBusy("all");
    setError("");
    try {
      const result = await invokeCallAction({
        action: "mute_all",
        call_id: id,
      });
      setCallInviteNotice(`تم كتم ${result.muted_count || 0} مشارك.`);
      await refreshCallData();
    } catch (err) {
      console.error("Mute all participants error:", err);
      setError(err.message || "تعذر كتم المشاركين");
    } finally {
      if (mountedRef.current) setParticipantBusy("");
    }
  };

  const shareCallInvite = async () => {
    const id = callIdRef.current;
    if (!id || !isGroupOrChannel) return;

    const inviteUrl = new URL("/", window.location.origin);
    inviteUrl.searchParams.set("lolz_call", id);
    inviteUrl.searchParams.set("lolz_call_type", callType);
    if (callType === "group") inviteUrl.searchParams.set("group_id", groupId);
    if (callType === "channel") inviteUrl.searchParams.set("channel_id", channelId);

    const shareData = {
      title: callType === "channel" ? "مكالمة قناة LOLZ" : "مكالمة قروب LOLZ",
      text: "انضم إلى المكالمة الجارية على LOLZ",
      url: inviteUrl.toString(),
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        setCallInviteNotice("تمت مشاركة رابط المكالمة.");
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(inviteUrl.toString());
        setCallInviteNotice("تم نسخ رابط المكالمة.");
      } else {
        const input = document.createElement("textarea");
        input.value = inviteUrl.toString();
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.appendChild(input);
        input.select();
        const copied = document.execCommand("copy");
        input.remove();
        if (!copied) throw new Error("تعذر نسخ الرابط");
        setCallInviteNotice("تم نسخ رابط المكالمة.");
      }
    } catch (err) {
      if (err?.name !== "AbortError") {
        console.error("Share call invite error:", err);
        setError(err.message || "تعذرت مشاركة رابط المكالمة");
      }
    }
  };

  const toggleScreenSharing = async () => {
    const room = roomRef.current;
    if (!room || !isGroupOrChannel || !canPublish) return;

    const next = !screenSharing;
    try {
      await room.localParticipant.setScreenShareEnabled(next, { audio: false });
      setScreenSharing(next);
      setError("");
    } catch (err) {
      console.error("Screen sharing error:", err);
      setError(
        err.message ||
          "تعذرت مشاركة الشاشة. تحقق من دعم المتصفح وصلاحية مشاركة الشاشة."
      );
    }
  };

  const rejectCall = async () => {
    if (!incomingCall) return;

    const id = incomingCall.id;

    setIncomingCall(null);
    setIncomingProfile(null);

    try {
      await invokeCallAction({
        action: "reject",
        call_id: id,
      });

      void dispatchLolzPush(supabase, {
        action: "missed_call",
        call_id: id,
      });
    } catch (err) {
      console.error("Reject call error:", err);
      setError(err.message || "تعذر رفض المكالمة");
    }
  };

  useEffect(() => {
    if (!incomingCallAction?.call_id) return;
    if (incomingCallAction.action !== "answer" && incomingCallAction.action !== "reject") return;

    const targetCall = isPrivate
      ? incomingCall
      : activeCalls.find((call) => String(call.id) === String(incomingCallAction.call_id));

    if (!targetCall?.id || String(targetCall.id) !== String(incomingCallAction.call_id)) {
      return;
    }

    const actionKey = `${incomingCallAction.call_id}:${incomingCallAction.action}`;
    if (handledNativeCallActionRef.current === actionKey) return;

    handledNativeCallActionRef.current = actionKey;

    const complete = () => onIncomingCallActionHandled?.();
    const actionPromise = incomingCallAction.action === "answer"
      ? (isPrivate ? acceptCall() : joinCall(targetCall))
      : (isPrivate ? rejectCall() : Promise.resolve());

    Promise.resolve(actionPromise).finally(complete);
  }, [
    isPrivate,
    incomingCall?.id,
    activeCalls,
    incomingCallAction?.call_id,
    incomingCallAction?.action,
    acceptCall,
    rejectCall,
    joinCall,
    onIncomingCallActionHandled,
  ]);

  const endCall = async () => {
    const room = roomRef.current;
    const id = callIdRef.current;

    if ((!room && !id) || endingRef.current) return;

    endingRef.current = true;

    try {
      if (id) {
        const shouldEnd = !isPrivate && (canEnd || isCallAdmin);

        await invokeCallAction({
          action: shouldEnd ? "end" : "leave",
          call_id: id,
        });
      }

      if (roomRef.current === room) {
        roomRef.current = null;
      }

      if (callIdRef.current === id) {
        callIdRef.current = null;
      }

      publishPermissionRef.current = null;

      if (room) {
        await room.disconnect();
      }

      clearCall();
      checkCalls();
    } catch (err) {
      console.error("End call error:", err);
      setError(err.message || "تعذر إنهاء المكالمة");
    } finally {
      endingRef.current = false;
    }
  };

  const toggleMicrophone = async () => {
    const room = roomRef.current;
    if (!room) return;

    if (!canPublish) {
      setError("أنت في وضع الاستماع. اطلب الإذن للتحدث أولاً.");
      return;
    }

    try {
      const next = !audioEnabled;
      await room.localParticipant.setMicrophoneEnabled(next);

      if (mountedRef.current) setAudioEnabled(next);
    } catch (err) {
      console.error("Microphone error:", err);
      setError(err.message || "تعذر تغيير الميكروفون");
    }
  };

  const toggleCamera = async () => {
    const room = roomRef.current;
    if (!room) return;

    if (!canPublish) {
      setError("أنت في وضع الاستماع ولا تملك إذن البث حالياً.");
      return;
    }

    try {
      const next = !videoEnabled;

      await room.localParticipant.setCameraEnabled(next, {
        facingMode: cameraFacing,
      });

      if (mountedRef.current) setVideoEnabled(next);
    } catch (err) {
      console.error("Camera error:", err);
      setError(err.message || "تعذر تغيير الكاميرا");
    }
  };

  const switchCamera = async () => {
    const room = roomRef.current;

    if (!room || !videoEnabled || switchingCamera || !canPublish) {
      return;
    }

    const nextFacing =
      cameraFacing === "user" ? "environment" : "user";

    setSwitchingCamera(true);
    setError("");

    try {
      await room.localParticipant.setCameraEnabled(false);

      await room.localParticipant.setCameraEnabled(true, {
        facingMode: nextFacing,
      });

      if (mountedRef.current) {
        setCameraFacing(nextFacing);
        setVideoEnabled(true);
      }
    } catch (err) {
      console.error("Switch camera error:", err);

      setError(
        "تعذر تبديل الكاميرا. قد لا يدعم جهازك كاميرا أخرى."
      );

      try {
        await room.localParticipant.setCameraEnabled(true, {
          facingMode: cameraFacing,
        });
      } catch (restoreError) {
        console.error("Camera restore error:", restoreError);
        if (mountedRef.current) setVideoEnabled(false);
      }
    } finally {
      if (mountedRef.current) setSwitchingCamera(false);
    }
  };

  const callerName = getDisplayName(incomingProfile, "متصل");
  const callerInitials = callerName.trim().slice(0, 2).toUpperCase();

  const approvedCount = recordingConsents.filter(
    (item) => item.decision === "approved"
  ).length;

  const pendingCount = recordingConsents.filter(
    (item) => item.decision === "pending"
  ).length;

  const rejectedCount = recordingConsents.filter(
    (item) => item.decision === "rejected"
  ).length;

  const participantCount = participants.length;
  const isRecordingActive = recording?.status === "recording";
  const isConsentPending = recording?.status === "consent_pending";

  const myConsent = recordingConsents.find(
    (item) => item.user_id === user?.id
  );

  const ownSpeakRequestPending =
    mySpeakRequest?.status === "pending";

  const callsMarkup = (
    <div
      className="lolz-calls"
      style={{ width: "100%", color: "#ffffff" }}
    >
      {!active && !incomingCall && showIdleControls && isPrivate && conversation?.id && (
        <div
          className="lolz-private-call-actions"
          style={{ display: "flex", gap: "10px", padding: "8px 0" }}
        >
          <button
            type="button"
            onClick={() => startCall(false)}
            disabled={connecting || !canStart}
            title="مكالمة صوتية"
            aria-label="مكالمة صوتية"
            style={{ ...buttonStyle, background: "#18794e" }}
          >
            <Phone size={20} />
          </button>

          <button
            type="button"
            onClick={() => startCall(true)}
            disabled={connecting || !canStart}
            title="مكالمة فيديو"
            aria-label="مكالمة فيديو"
            style={{ ...buttonStyle, background: "#3157a4" }}
          >
            <Video size={20} />
          </button>
        </div>
      )}

      {!active && showIdleControls && !isPrivate && (
        <div
          style={{
            padding: "12px",
            margin: "8px 0",
            background: "#20242d",
            borderRadius: "14px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "12px",
            }}
          >
            <Users size={20} />

            <strong style={{ flex: 1 }}>
              {callType === "channel" ? "مكالمات القناة" : "المكالمات الجماعية"}
            </strong>

            <button
              type="button"
              onClick={checkCalls}
              title="تحديث"
              aria-label="تحديث"
              style={buttonStyle}
            >
              <RefreshCw size={17} />
            </button>
          </div>

          {canStart && (
            <div
              style={{
                display: "flex",
                gap: "10px",
                flexWrap: "wrap",
                marginBottom: "12px",
              }}
            >
              <button
                type="button"
                onClick={() => startCall(false)}
                disabled={connecting}
                style={{
                  ...buttonStyle,
                  width: "auto",
                  padding: "0 14px",
                  borderRadius: "10px",
                  background: "#18794e",
                  gap: "7px",
                }}
              >
                <Phone size={18} />
                بدء مكالمة صوتية
              </button>

              <button
                type="button"
                onClick={() => startCall(true)}
                disabled={connecting}
                style={{
                  ...buttonStyle,
                  width: "auto",
                  padding: "0 14px",
                  borderRadius: "10px",
                  background: "#3157a4",
                  gap: "7px",
                }}
              >
                <Video size={18} />
                فيديو
              </button>
            </div>
          )}

          {activeCalls.length > 0 ? (
            <div className="lolz-active-call-list">
              {activeCalls.map((call) => (
                <div
                  key={call.id}
                  className="lolz-active-call-item"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "10px",
                    background: "#303541",
                    borderRadius: "10px",
                  }}
                >
                  {call.media_type === "video" ? (
                    <Video size={19} color="#65a5ff" />
                  ) : (
                    <Phone size={19} color="#48d597" />
                  )}

                  <span
                    className="lolz-active-call-label"
                    style={{ flex: 1 }}
                  >
                    {call.media_type === "video"
                      ? "مكالمة فيديو جارية"
                      : "مكالمة صوتية جارية"}
                    {Number.isFinite(call.participant_count)
                      ? ` · ${call.participant_count} مشارك`
                      : ""}
                  </span>

                  <button
                    type="button"
                    className="lolz-active-call-join"
                    onClick={() => joinCall(call)}
                    disabled={connecting}
                    style={{
                      ...buttonStyle,
                      width: "auto",
                      padding: "0 14px",
                      borderRadius: "10px",
                      background: "#18794e",
                    }}
                  >
                    انضمام
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: "#aeb5c2", margin: 0 }}>
              لا توجد مكالمات جارية حالياً.
            </p>
          )}
        </div>
      )}

      {joinConsent && !active && (
        <div
          style={{
            ...panelStyle,
            background: "#332b20",
            border: "1px solid rgba(255,190,90,0.35)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
            <Radio size={21} color="#ffc46b" />
            <strong style={{ flex: 1 }}>المكالمة مسجّلة حالياً</strong>
          </div>

          <p style={{ color: "#e6d8c3", fontSize: "13px", lineHeight: 1.7 }}>
            بدأ تسجيل صوت هذه المكالمة بعد موافقة المشاركين الحاليين.
            يجب أن توافق على التسجيل قبل الانضمام. لن تتمكن من دخول المكالمة
            أثناء استمرار التسجيل إذا رفضت.
          </p>

          {joinConsent.decision === "rejected" ? (
            <div style={{ color: "#ffaaaa", fontSize: "13px" }}>
              لقد رفضت التسجيل. لا يمكنك الانضمام ما دام التسجيل جارياً.
            </div>
          ) : (
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button
                type="button"
                disabled={recordingBusy || connecting}
                onClick={() => respondToRecordingConsent("approved", true)}
                style={{
                  ...smallButtonStyle,
                  background: "#18794e",
                  border: "none",
                  padding: "10px 14px",
                }}
              >
                <Check size={16} />
                أوافق وانضم
              </button>

              <button
                type="button"
                disabled={recordingBusy || connecting}
                onClick={() => respondToRecordingConsent("rejected", true)}
                style={{
                  ...smallButtonStyle,
                  background: "#a52d3a",
                  border: "none",
                  padding: "10px 14px",
                }}
              >
                <XCircle size={16} />
                لا أوافق
              </button>
            </div>
          )}
        </div>
      )}

      {connecting && (
        <div
          className="lolz-call-connecting"
          style={{
            padding: "10px",
            color: "#aeb5c2",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <Loader2 size={17} />
          جارٍ الاتصال...
        </div>
      )}

      {error && (
        <div
          className="lolz-call-error"
          style={{
            padding: "10px 12px",
            margin: "8px 0",
            background: "#542b32",
            borderRadius: "12px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <span>{error}</span>

          <button
            type="button"
            onClick={() => setError("")}
            aria-label="إغلاق"
            style={buttonStyle}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {incomingCall && !active && isPrivate && (
        <div
          className="lolz-incoming-call"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "14px",
            margin: "8px 0",
            background: "#1c2029",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "16px",
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "50%",
              overflow: "hidden",
              background: "#38445b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {incomingProfile?.avatar_url ? (
              <img
                src={incomingProfile.avatar_url}
                alt={callerName}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            ) : (
              <strong>{callerInitials}</strong>
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <strong
              style={{
                display: "block",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {callerName}
            </strong>

            <small style={{ color: "#aeb5c2" }}>
              {incomingCall.media_type === "video"
                ? "مكالمة فيديو واردة"
                : "مكالمة صوتية واردة"}
            </small>
          </div>

          <button
            type="button"
            onClick={acceptCall}
            disabled={connecting}
            title="قبول المكالمة"
            aria-label="قبول المكالمة"
            style={{ ...buttonStyle, background: "#18794e" }}
          >
            {incomingCall.media_type === "video" ? (
              <Video size={19} />
            ) : (
              <Phone size={19} />
            )}
          </button>

          <button
            type="button"
            onClick={rejectCall}
            disabled={connecting}
            title="رفض المكالمة"
            aria-label="رفض المكالمة"
            style={{ ...buttonStyle, background: "#b83240" }}
          >
            <PhoneOff size={19} />
          </button>
        </div>
      )}

      {active && isMinimized && typeof document !== "undefined" &&
        createPortal(
          <div className="lolz-call-mini-portal">
            <button
              type="button"
              className="lolz-call-mini"
              onClick={() => setIsMinimized(false)}
              title="العودة إلى المكالمة"
              aria-label="العودة إلى المكالمة"
            >
              <span className="lolz-call-mini-dot" />
              <Phone size={16} />
              <span className="lolz-call-mini-label">
                {isPrivate
                  ? getDisplayName(conversation?.otherProfile, "مكالمة LOLZ")
                  : callType === "channel"
                    ? "مكالمة القناة"
                    : "مكالمة جماعية"}
              </span>
              <span className="lolz-call-mini-duration">
                {formatDuration(callDuration)}
              </span>
            </button>
          </div>,
          document.body
        )}

      {active && (
        <>

          <div
            className={
              `lolz-call-active-panel${isMinimized ? " is-minimized" : ""}${isGroupOrChannel ? " is-group-or-channel" : ""}`
            }
            style={{
              padding: "18px",
              margin: "8px 0",
              background: "linear-gradient(145deg, #1b1f28, #12151c)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "20px",
            }}
          >
            <div
              className="lolz-call-header"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                marginBottom: "18px",
              }}
            >
              <div>
                <strong style={{ display: "block", fontSize: "16px" }}>
                  {isPrivate
                    ? `مكالمة مع ${getDisplayName(conversation?.otherProfile, "المستخدم")}`
                    : activeMediaType === "video"
                      ? "مكالمة فيديو LOLZ"
                      : callType === "channel"
                        ? "مكالمة القناة"
                        : "مكالمة جماعية LOLZ"}
                </strong>

                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    color: "#48d597",
                    fontSize: "12px",
                    marginTop: "5px",
                  }}
                >
                  <span
                    style={{
                      width: "7px",
                      height: "7px",
                      borderRadius: "50%",
                      background: "#48d597",
                    }}
                  />
                  {connectedAt ? "متصل" : "بانتظار المشاركين"}
                </span>
              </div>

              <div className="lolz-call-header-actions">
                <div className="lolz-call-timer">
                  <Clock size={15} />
                  {formatDuration(callDuration)}
                </div>

                <button
                  type="button"
                  className="lolz-call-minimize-button"
                  onClick={() => setIsMinimized(true)}
                  title="تصغير المكالمة"
                  aria-label="تصغير المكالمة"
                >
                  <Minimize2 size={19} />
                </button>
              </div>
            </div>

            {isPrivate && activeMediaType === "audio" && (
              <div className="ig-call-voice-stage">
                <div className="ig-call-portrait">
                  {conversation?.otherProfile?.avatar_url ? (
                    <img
                      src={conversation.otherProfile.avatar_url}
                      alt={getDisplayName(conversation.otherProfile)}
                    />
                  ) : (
                    <span>
                      {getDisplayName(conversation?.otherProfile, "U").slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </div>
                <strong>{getDisplayName(conversation?.otherProfile, "المستخدم")}</strong>
                <span>{connectedAt ? "المكالمة جارية" : "جارٍ الاتصال..."}</span>
              </div>
            )}

            {isGroupOrChannel && isRecordingActive && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "9px",
                  padding: "10px 12px",
                  marginBottom: "12px",
                  borderRadius: "10px",
                  background: "rgba(174,38,50,0.2)",
                  border: "1px solid rgba(255,85,95,0.35)",
                  color: "#ff9ca3",
                  fontSize: "13px",
                }}
              >
                <span
                  style={{
                    width: "9px",
                    height: "9px",
                    borderRadius: "50%",
                    background: "#ff4d5b",
                    boxShadow: "0 0 10px rgba(255,77,91,0.7)",
                  }}
                />
                <strong>جارٍ تسجيل صوت المكالمة</strong>
                <span style={{ marginInlineStart: "auto", opacity: 0.85 }}>
                  تسجيل صوتي
                </span>
              </div>
            )}

            {isGroupOrChannel && (
              <div className="lolz-group-call-toolbar">
                <div className="lolz-group-call-mode">
                  <strong>المحادثة الصوتية المباشرة</strong>
                  <small>
                    {callMode === "moderated"
                      ? "وضع المستمعين — التحدث بموافقة المشرف"
                      : "وضع مفتوح — يمكن للأعضاء التحدث"}
                  </small>
                </div>

                <button
                  type="button"
                  className="lolz-call-invite-button"
                  onClick={shareCallInvite}
                >
                  <Copy size={16} />
                  دعوة
                </button>

                {isCallAdmin && (
                  <>
                    <label className="lolz-call-mode-select">
                      <span>الصلاحيات</span>
                      <select
                        value={callMode}
                        disabled={callModeBusy}
                        onChange={(event) => updateCallMode(event.target.value)}
                      >
                        <option value="open">مفتوح للجميع</option>
                        <option value="moderated">مستمعون وطلبات تحدث</option>
                      </select>
                    </label>

                    <button
                      type="button"
                      className="lolz-call-mute-all-button"
                      onClick={muteAllParticipants}
                      disabled={participantBusy === "all" || participantCount <= 1}
                    >
                      {participantBusy === "all" ? (
                        <Loader2 size={16} />
                      ) : (
                        <VolumeX size={16} />
                      )}
                      كتم الجميع
                    </button>
                  </>
                )}
                {callInviteNotice && (
                  <span className="lolz-call-invite-notice" role="status">
                    {callInviteNotice}
                  </span>
                )}
              </div>
            )}

            {isGroupOrChannel && activeMediaType === "audio" && (
              <div className="ig-call-voice-stage ig-group-call-voice-stage">
                <div className="ig-group-call-avatar-stack">
                  {participants.slice(0, 4).map((participant) => {
                    const profile = participant.profile || {};
                    const participantName =
                      participant.user_id === user?.id
                        ? "أنت"
                        : getDisplayName(profile);

                    return (
                      <div
                        key={participant.user_id}
                        className="ig-group-call-avatar"
                        title={participantName}
                      >
                        {profile.avatar_url ? (
                          <img src={profile.avatar_url} alt={participantName} />
                        ) : (
                          <UserRound size={32} />
                        )}
                      </div>
                    );
                  })}

                  {participants.length > 4 && (
                    <span className="ig-group-call-avatar-more">
                      +{participants.length - 4}
                    </span>
                  )}

                  {participants.length === 0 && (
                    <div className="ig-group-call-avatar ig-group-call-avatar-empty">
                      <Users size={36} />
                    </div>
                  )}
                </div>

                <strong>
                  {callType === "channel"
                    ? "البث الصوتي المباشر"
                    : "المكالمة الجماعية"}
                </strong>
                <span>
                  {participantCount} مشارك ·{" "}
                  {connectedAt ? "المكالمة جارية" : "جارٍ الاتصال..."}
                </span>
              </div>
            )}

            <div
              className="ig-call-remote-media"
              ref={remoteMediaRef}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "8px",
                minHeight: "30px",
              }}
            />

            {isGroupOrChannel && screenSharing && (
              <div className="lolz-local-screen-share-stage">
                <div className="lolz-local-screen-share-heading">
                  <ScreenShare size={15} />
                  أنت تشارك شاشتك
                </div>
                <div ref={screenSharePreviewRef} />
              </div>
            )}

            <div
              className="ig-call-local-media"
              ref={localVideoRef}
              style={{
                display: "flex",
                justifyContent: "center",
              }}
            />

            {!connectedAt && (
              <div
                style={{
                  textAlign: "center",
                  color: "#aeb5c2",
                  padding: "10px",
                  fontSize: "13px",
                }}
              >
                يتم انتظار اتصال المشاركين...
              </div>
            )}

            {!audioEnabled && !videoEnabled && (
              <div
                style={{
                  textAlign: "center",
                  color: "#aeb5c2",
                  padding: "10px",
                  fontSize: "13px",
                }}
              >
                أنت في وضع الاستماع.
              </div>
            )}

            {audioPlaybackBlocked && (
              <button
                type="button"
                className="lolz-call-audio-retry"
                onClick={enableRemoteAudio}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  width: "100%",
                  padding: "12px",
                  marginTop: "12px",
                  border: "none",
                  borderRadius: "10px",
                  background: "#3157a4",
                  color: "#ffffff",
                  cursor: "pointer",
                }}
              >
                <Volume2 size={18} />
                اضغط لتفعيل صوت المشاركين
              </button>
            )}

            {isGroupOrChannel && (
              <div style={panelStyle}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "10px",
                  }}
                >
                  <Users size={18} />
                  <strong style={{ flex: 1 }}>المشاركون</strong>
                  <span
                    style={{
                      padding: "3px 8px",
                      borderRadius: "20px",
                      background: "#394354",
                      color: "#dbe5f7",
                      fontSize: "12px",
                    }}
                  >
                    {participantCount}
                  </span>
                </div>

                {participants.length > 0 ? (
                  <div className="lolz-call-participant-grid">
                    {participants.map((participant) => {
                      const profile = participant.profile;
                      const name =
                        participant.user_id === user?.id
                          ? "أنت"
                          : getDisplayName(profile);
                      const isSpeaking = activeSpeakers.includes(
                        participant.user_id
                      );
                      const isSelf = participant.user_id === user?.id;
                      const isBusy = participantBusy === participant.user_id;

                      return (
                        <article
                          key={participant.user_id}
                          className={"lolz-call-participant " +
                            (isSpeaking ? "is-speaking " : "") +
                            (participant.can_publish ? "can-speak" : "listener")}
                        >
                          <div className="lolz-call-participant-avatar">
                            {profile?.avatar_url ? (
                              <img src={profile.avatar_url} alt={name} />
                            ) : (
                              <UserRound size={22} />
                            )}
                          </div>
                          <strong>{name}</strong>
                          <small>
                            {isSpeaking
                              ? "يتحدث الآن"
                              : participant.can_publish
                                ? "متحدث"
                                : "مستمع"}
                          </small>
                          {isSpeaking && (
                            <span className="lolz-call-speaking-indicator">
                              <Radio size={14} />
                              مباشر
                            </span>
                          )}
                          {isCallAdmin && !isSelf && (
                            <div className="lolz-call-participant-actions">
                              <button
                                type="button"
                                disabled={Boolean(participantBusy)}
                                onClick={() =>
                                  setParticipantPublish(
                                    participant.user_id,
                                    !participant.can_publish
                                  )
                                }
                                title={participant.can_publish ? "كتم الميكروفون" : "السماح بالتحدث"}
                              >
                                {isBusy ? (
                                  <Loader2 size={14} />
                                ) : participant.can_publish ? (
                                  <MicOff size={14} />
                                ) : (
                                  <Mic size={14} />
                                )}
                                {participant.can_publish ? "كتم" : "السماح"}
                              </button>
                              <button
                                type="button"
                                className="danger"
                                disabled={Boolean(participantBusy)}
                                onClick={() =>
                                  removeCallParticipant(participant.user_id, name)
                                }
                                title="إزالة من المكالمة"
                              >
                                <UserX size={14} />
                                إزالة
                              </button>
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <p style={{ color: "#aeb5c2", fontSize: "13px", margin: 0 }}>
                    جارٍ تحميل قائمة المشاركين...
                  </p>
                )}
              </div>
            )}

            {isGroupOrChannel &&
              callMode === "moderated" &&
              !canPublish &&
              !isCallAdmin && (
                <div
                  style={{
                    ...panelStyle,
                    background: "#282d3a",
                    textAlign: "center",
                  }}
                >
                  <Hand
                    size={25}
                    color="#ffc46b"
                    style={{ marginBottom: "6px" }}
                  />

                  <strong style={{ display: "block" }}>
                    أنت في وضع الاستماع
                  </strong>

                  <p
                    style={{
                      color: "#aeb5c2",
                      fontSize: "13px",
                      lineHeight: 1.6,
                      margin: "7px 0 12px",
                    }}
                  >
                    يمكنك طلب التحدث. سيصل طلبك إلى مشرفي المكالمة للموافقة عليه.
                  </p>

                  <button
                    type="button"
                    disabled={requestingToSpeak || ownSpeakRequestPending}
                    onClick={requestToSpeak}
                    style={{
                      ...smallButtonStyle,
                      background: ownSpeakRequestPending
                        ? "#596273"
                        : "#3157a4",
                      border: "none",
                      padding: "10px 15px",
                      opacity: requestingToSpeak ? 0.7 : 1,
                    }}
                  >
                    {requestingToSpeak ? (
                      <Loader2 size={16} />
                    ) : (
                      <Hand size={16} />
                    )}
                    {ownSpeakRequestPending
                      ? "طلبك قيد المراجعة"
                      : "طلب التحدث"}
                  </button>
                </div>
              )}

            {isGroupOrChannel &&
              callMode === "moderated" &&
              !canPublish &&
              isCallAdmin && (
                <div
                  style={{
                    ...panelStyle,
                    color: "#d8deea",
                    fontSize: "13px",
                  }}
                >
                  أنت مشرف هذه المكالمة، ويمكنك التحدث وإدارة طلبات المشاركين.
                </div>
              )}

            {isGroupOrChannel && isCallAdmin && (
              <div style={panelStyle}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "10px",
                  }}
                >
                  <Hand size={18} />
                  <strong style={{ flex: 1 }}>طلبات التحدث</strong>
                  <span style={{ color: "#aeb5c2", fontSize: "12px" }}>
                    {speakRequests.length} طلب
                  </span>
                </div>

                {speakRequests.length > 0 ? (
                  <div style={{ display: "grid", gap: "9px" }}>
                    {speakRequests.map((request) => {
                      const requestParticipant = participants.find(
                        (participant) =>
                          participant.user_id === request.user_id
                      );

                      const requestName = getDisplayName(
                        requestParticipant?.profile
                      );

                      return (
                        <div
                          key={request.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: "8px",
                            padding: "9px",
                            borderRadius: "9px",
                            background: "#303541",
                          }}
                        >
                          <span style={{ flex: 1, fontSize: "13px" }}>
                            {requestName} يريد التحدث
                          </span>

                          <button
                            type="button"
                            disabled={respondingToSpeak === request.id}
                            onClick={() =>
                              respondToSpeakRequest(request, "approved")
                            }
                            style={{
                              ...smallButtonStyle,
                              background: "#18794e",
                              border: "none",
                            }}
                          >
                            <Check size={15} />
                            موافقة
                          </button>

                          <button
                            type="button"
                            disabled={respondingToSpeak === request.id}
                            onClick={() =>
                              respondToSpeakRequest(request, "rejected")
                            }
                            style={{
                              ...smallButtonStyle,
                              background: "#a52d3a",
                              border: "none",
                            }}
                          >
                            <X size={15} />
                            رفض
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p style={{ color: "#aeb5c2", fontSize: "13px", margin: 0 }}>
                    لا توجد طلبات تحدث معلقة.
                  </p>
                )}
              </div>
            )}

            {isGroupOrChannel &&
              recordingPrompt &&
              myConsent?.decision === "pending" && (
                <div
                  style={{
                    ...panelStyle,
                    background: "#332b20",
                    border: "1px solid rgba(255,190,90,0.35)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <Radio size={20} color="#ffc46b" />
                    <strong>طلب موافقتك على تسجيل المكالمة</strong>
                  </div>

                  <p
                    style={{
                      color: "#e6d8c3",
                      fontSize: "13px",
                      lineHeight: 1.7,
                    }}
                  >
                    طلب مشرف المكالمة تسجيل الصوت. لن يبدأ التسجيل إلا بعد
                    موافقة جميع المشاركين الحاليين.
                  </p>

                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      disabled={recordingBusy}
                      onClick={() =>
                        respondToRecordingConsent("approved", false)
                      }
                      style={{
                        ...smallButtonStyle,
                        background: "#18794e",
                        border: "none",
                      }}
                    >
                      <Check size={16} />
                      أوافق
                    </button>

                    <button
                      type="button"
                      disabled={recordingBusy}
                      onClick={() =>
                        respondToRecordingConsent("rejected", false)
                      }
                      style={{
                        ...smallButtonStyle,
                        background: "#a52d3a",
                        border: "none",
                      }}
                    >
                      <X size={16} />
                      أرفض
                    </button>
                  </div>
                </div>
              )}

            {isGroupOrChannel && canManageRecording && (
              <div style={panelStyle}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "10px",
                  }}
                >
                  <ShieldCheck size={19} color="#78aaff" />
                  <strong style={{ flex: 1 }}>إدارة تسجيل المكالمة</strong>
                </div>

                {isRecordingActive ? (
                  <>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        color: "#ff929b",
                        fontSize: "13px",
                        marginBottom: "10px",
                      }}
                    >
                      <Circle size={10} fill="#ff4d5b" color="#ff4d5b" />
                      التسجيل الصوتي يعمل الآن
                    </div>

                    <button
                      type="button"
                      disabled={recordingBusy}
                      onClick={stopRecording}
                      style={{
                        ...smallButtonStyle,
                        background: "#a52d3a",
                        border: "none",
                        padding: "10px 14px",
                      }}
                    >
                      <PhoneOff size={16} />
                      إيقاف التسجيل
                    </button>
                  </>
                ) : isConsentPending ? (
                  <>
                    <p
                      style={{
                        color: "#d5dbea",
                        fontSize: "13px",
                        lineHeight: 1.6,
                      }}
                    >
                      بانتظار موافقة المشاركين قبل بدء التسجيل.
                    </p>

                    <div
                      style={{
                        display: "flex",
                        gap: "12px",
                        flexWrap: "wrap",
                        marginBottom: "12px",
                        fontSize: "12px",
                        color: "#c2cad8",
                      }}
                    >
                      <span style={{ color: "#65dda8" }}>
                        وافق: {approvedCount}
                      </span>
                      <span style={{ color: "#ffc46b" }}>
                        بانتظار: {pendingCount}
                      </span>
                      <span style={{ color: "#ff929b" }}>
                        رفض: {rejectedCount}
                      </span>
                    </div>

                    {rejectedCount > 0 && (
                      <p style={{ color: "#ff929b", fontSize: "12px" }}>
                        رفض أحد المشاركين التسجيل. أُلغي طلب التسجيل أو يجب
                        إعادة طلب الموافقة.
                      </p>
                    )}

                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        disabled={
                          recordingBusy ||
                          pendingCount > 0 ||
                          rejectedCount > 0 ||
                          approvedCount < participantCount
                        }
                        onClick={startRecording}
                        style={{
                          ...smallButtonStyle,
                          background: "#18794e",
                          border: "none",
                          opacity:
                            pendingCount > 0 ||
                            rejectedCount > 0 ||
                            approvedCount < participantCount
                              ? 0.5
                              : 1,
                        }}
                      >
                        <Radio size={16} />
                        بدء التسجيل
                      </button>

                      <button
                        type="button"
                        disabled={recordingBusy}
                        onClick={stopRecording}
                        style={{
                          ...smallButtonStyle,
                          background: "#596273",
                        }}
                      >
                        إلغاء الطلب
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p
                      style={{
                        color: "#aeb5c2",
                        fontSize: "13px",
                        lineHeight: 1.6,
                      }}
                    >
                      يمكنك طلب موافقة جميع المشاركين قبل بدء تسجيل صوت المكالمة.
                      التسجيل غير متاح في المكالمات الخاصة.
                    </p>

                    <button
                      type="button"
                      disabled={recordingBusy || participantCount === 0}
                      onClick={requestRecording}
                      style={{
                        ...smallButtonStyle,
                        background: "#3157a4",
                        border: "none",
                        padding: "10px 14px",
                      }}
                    >
                      <Radio size={16} />
                      طلب موافقة التسجيل
                    </button>
                  </>
                )}

                {recordingMessage && (
                  <p
                    style={{
                      color: "#cbd5e1",
                      fontSize: "12px",
                      lineHeight: 1.6,
                      marginBottom: 0,
                    }}
                  >
                    {recordingMessage}
                  </p>
                )}
              </div>
            )}

            {isGroupOrChannel &&
              !canManageRecording &&
              recordingMessage && (
                <div
                  style={{
                    ...panelStyle,
                    color: "#cbd5e1",
                    fontSize: "13px",
                  }}
                >
                  {recordingMessage}
                </div>
              )}

            <div
              className="lolz-call-controls"
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "14px",
                marginTop: "20px",
                position: "relative",
                zIndex: 10,
              }}
            >
              <button
                type="button"
                onClick={toggleMicrophone}
                disabled={!canPublish}
                title={
                  !canPublish
                    ? "أنت مستمع ولا تملك إذن التحدث"
                    : audioEnabled
                      ? "إيقاف الميكروفون"
                      : "تشغيل الميكروفون"
                }
                aria-label={audioEnabled ? "إيقاف الميكروفون" : "تشغيل الميكروفون"}
                style={{
                  ...buttonStyle,
                  background: audioEnabled ? "#2c313d" : "#b83240",
                  opacity: canPublish ? 1 : 0.45,
                  cursor: canPublish ? "pointer" : "not-allowed",
                }}
              >
                {audioEnabled ? <Mic size={20} /> : <MicOff size={20} />}
              </button>

              {isGroupOrChannel && (
                <button
                  type="button"
                  onClick={toggleScreenSharing}
                  disabled={!canPublish}
                  title={screenSharing ? "إيقاف مشاركة الشاشة" : "مشاركة الشاشة"}
                  aria-label={screenSharing ? "إيقاف مشاركة الشاشة" : "مشاركة الشاشة"}
                  style={{
                    ...buttonStyle,
                    background: screenSharing ? "#3157a4" : "#2c313d",
                    opacity: canPublish ? 1 : 0.45,
                  }}
                >
                  {screenSharing ? (
                    <ScreenShareOff size={20} />
                  ) : (
                    <ScreenShare size={20} />
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={toggleCamera}
                disabled={!canPublish}
                title={
                  !canPublish
                    ? "لا تملك إذن البث"
                    : videoEnabled
                      ? "إيقاف الكاميرا"
                      : "تشغيل الكاميرا"
                }
                aria-label={videoEnabled ? "إيقاف الكاميرا" : "تشغيل الكاميرا"}
                style={{
                  ...buttonStyle,
                  background: videoEnabled ? "#2c313d" : "#b83240",
                  opacity: canPublish ? 1 : 0.45,
                  cursor: canPublish ? "pointer" : "not-allowed",
                }}
              >
                {videoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
              </button>

              {videoEnabled && (
                <button
                  type="button"
                  onClick={switchCamera}
                  disabled={switchingCamera}
                  title="تبديل الكاميرا الأمامية والخلفية"
                  aria-label="تبديل الكاميرا الأمامية والخلفية"
                  style={{
                    ...buttonStyle,
                    background: "#3157a4",
                    opacity: switchingCamera ? 0.6 : 1,
                  }}
                >
                  <SwitchCamera size={20} />
                </button>
              )}

              <button
                type="button"
                onClick={enableRemoteAudio}
                title="تفعيل صوت المشاركين"
                aria-label="تفعيل صوت المشاركين"
                style={{
                  ...buttonStyle,
                  background: "#3157a4",
                }}
              >
                <Volume2 size={20} />
              </button>

              <button
                type="button"
                className="lolz-call-end-button"
                title={
                  !isPrivate && (canEnd || isCallAdmin)
                    ? "إنهاء المكالمة للجميع"
                    : "مغادرة المكالمة"
                }
                aria-label={
                  !isPrivate && (canEnd || isCallAdmin)
                    ? "إنهاء المكالمة للجميع"
                    : "مغادرة المكالمة"
                }
                onClick={endCall}
                disabled={endingRef.current}
                style={{
                  ...buttonStyle,
                  width: "54px",
                  height: "54px",
                  background: "#c52d3b",
                  opacity: endingRef.current ? 0.6 : 1,
                }}
              >
                <PhoneOff size={22} />
              </button>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: "6px",
                marginTop: "14px",
                color: "#9aa3b5",
                fontSize: "12px",
              }}
            >
              <Volume2 size={14} />
              صوت المكالمة عبر جهازك
            </div>
          </div>
        </>
      )}
    </div>
  );

  const shouldPortalCallWindow =
    isGroupOrChannel &&
    (Boolean(incomingCall) || (active && !isMinimized));

  if (shouldPortalCallWindow && typeof document !== "undefined") {
    const portalTarget =
      document.querySelector(".app-shell") || document.body;

    return createPortal(
      <div className="lolz-call-dock lolz-group-channel-call-dock">
        {callsMarkup}
      </div>,
      portalTarget
    );
  }

  return callsMarkup;
}
