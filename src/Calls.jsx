
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { Room, RoomEvent } from "livekit-client";

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
}) {
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCalls, setActiveCalls] = useState([]);
  const [connecting, setConnecting] = useState(false);
  const [active, setActive] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [error, setError] = useState("");

  const roomRef = useRef(null);
  const callIdRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteMediaRef = useRef(null);
  const mountedRef = useRef(false);

  const activeRef = useRef(false);
  const connectingRef = useRef(false);

  activeRef.current = active;
  connectingRef.current = connecting;

  const isPrivate = callType === "private";

  const clearCall = useCallback(() => {
    const room = roomRef.current;

    roomRef.current = null;
    callIdRef.current = null;

    if (localVideoRef.current) {
      localVideoRef.current.innerHTML = "";
    }

    if (remoteMediaRef.current) {
      remoteMediaRef.current.innerHTML = "";
    }

    if (!mountedRef.current) return;

    setActive(false);
    setConnecting(false);
    setAudioEnabled(true);
    setVideoEnabled(false);
  }, []);

  const connectToRoom = useCallback(
    async (
      serverUrl,
      token,
      id,
      withVideo = false,
      canPublish = true
    ) => {
      const room = new Room();

      roomRef.current = room;
      callIdRef.current = id;

      room.on(RoomEvent.TrackSubscribed, (track) => {
        if (!remoteMediaRef.current) return;

        const element = track.attach();
        element.autoplay = true;
        element.playsInline = true;
        element.style.width = "100%";
        element.style.maxWidth = "420px";
        element.style.borderRadius = "12px";

        remoteMediaRef.current.appendChild(element);
      });

      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach().forEach((element) => element.remove());
      });

      room.on(RoomEvent.Disconnected, () => {
        if (roomRef.current === room) {
          clearCall();
        }
      });

      try {
        await room.connect(serverUrl, token);

        if (roomRef.current !== room) {
          await room.disconnect();
          return;
        }

        if (canPublish) {
          await room.localParticipant.setMicrophoneEnabled(true);

          if (withVideo) {
            await room.localParticipant.setCameraEnabled(true);
          }
        }

        if (!mountedRef.current) {
          await room.disconnect();
          return;
        }

        setAudioEnabled(canPublish);
        setVideoEnabled(canPublish && withVideo);
        setActive(true);

        if (canPublish && withVideo) {
          const publication =
            room.localParticipant.getTrackPublication("camera");

          if (publication?.track && localVideoRef.current) {
            const element = publication.track.attach();
            element.autoplay = true;
            element.muted = true;
            element.playsInline = true;
            element.style.width = "100%";
            element.style.maxWidth = "420px";
            element.style.borderRadius = "12px";

            localVideoRef.current.appendChild(element);
          }
        }
      } catch (err) {
        if (roomRef.current === room) {
          roomRef.current = null;
          callIdRef.current = null;
        }

        await room.disconnect().catch(() => {});
        throw err;
      }
    },
    [clearCall]
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

    setConnecting(true);
    setError("");

    try {
      const body = {
        action: "create",
        call_type: callType,
      };

      if (isPrivate) {
        body.conversation_id = conversation.id;
      } else if (callType === "group") {
        body.group_id = groupId;
      } else if (callType === "channel") {
        body.channel_id = channelId;
      }

      const { data, error: functionError } =
        await supabase.functions.invoke("livekit-token", {
          body,
        });

      if (functionError) throw functionError;

      if (
        !data?.success ||
        !data.token ||
        !data.server_url ||
        !data.call?.id
      ) {
        throw new Error(data?.error || "تعذر إنشاء المكالمة");
      }

      await connectToRoom(
        data.server_url,
        data.token,
        data.call.id,
        withVideo,
        data.can_publish !== false
      );
    } catch (err) {
      console.error("Start call error:", err);
      setError(err.message || "تعذر بدء المكالمة");
      clearCall();
    } finally {
      if (mountedRef.current) setConnecting(false);
    }
  };

  const checkCalls = useCallback(async () => {
    if (
      !user ||
      activeRef.current ||
      connectingRef.current ||
      roomRef.current
    ) {
      return;
    }

    try {
      if (isPrivate) {
        const { data, error: functionError } =
          await supabase.functions.invoke("livekit-token", {
            body: { action: "incoming_calls" },
          });

        if (functionError) throw functionError;
        if (!mountedRef.current) return;

        if (data?.success && data.calls?.length) {
          setIncomingCall(data.calls[0]);
        } else {
          setIncomingCall(null);
        }

        return;
      }

      const { data, error: functionError } =
        await supabase.functions.invoke("livekit-token", {
          body: { action: "active_calls" },
        });

      if (functionError) throw functionError;
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
    }
  }, [
    supabase,
    user,
    isPrivate,
    callType,
    groupId,
    channelId,
  ]);

  useEffect(() => {
    mountedRef.current = true;

    checkCalls();

    const interval = setInterval(checkCalls, 4000);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);

      const room = roomRef.current;
      roomRef.current = null;

      if (room) room.disconnect();
    };
  }, [checkCalls]);

  const joinCall = async (call) => {
    if (!call?.id || connecting || active || roomRef.current) return;

    setConnecting(true);
    setError("");

    try {
      const { data, error: functionError } =
        await supabase.functions.invoke("livekit-token", {
          body: {
            action: "join",
            call_id: call.id,
          },
        });

      if (functionError) throw functionError;

      if (!data?.success || !data.token || !data.server_url) {
        throw new Error(data?.error || "تعذر الانضمام للمكالمة");
      }

      setIncomingCall(null);

      await connectToRoom(
        data.server_url,
        data.token,
        call.id,
        false,
        data.can_publish !== false
      );
    } catch (err) {
      console.error("Join call error:", err);
      setError(err.message || "تعذر الانضمام للمكالمة");
    } finally {
      if (mountedRef.current) setConnecting(false);
    }
  };

  const acceptCall = async () => {
    if (!incomingCall) return;
    await joinCall(incomingCall);
  };

  const rejectCall = async () => {
    if (!incomingCall) return;

    const id = incomingCall.id;
    setIncomingCall(null);

    try {
      const { error: functionError } =
        await supabase.functions.invoke("livekit-token", {
          body: {
            action: "reject",
            call_id: id,
          },
        });

      if (functionError) throw functionError;
    } catch (err) {
      console.error("Reject call error:", err);
      setError(err.message || "تعذر رفض المكالمة");
    }
  };

  const endCall = async () => {
    const room = roomRef.current;
    const id = callIdRef.current;

    if (!room) return;

    roomRef.current = null;
    callIdRef.current = null;

    try {
      if (id) {
        const action =
          !isPrivate && canEnd ? "end" : "leave";

        const { error: functionError } =
          await supabase.functions.invoke("livekit-token", {
            body: {
              action,
              call_id: id,
            },
          });

        if (functionError) throw functionError;
      }
    } catch (err) {
      console.error("End call error:", err);
      setError(err.message || "تعذر إنهاء المكالمة");
    } finally {
      await room.disconnect();
      clearCall();
      checkCalls();
    }
  };

  const toggleMicrophone = async () => {
    const room = roomRef.current;
    if (!room) return;

    try {
      const next = !audioEnabled;

      await room.localParticipant.setMicrophoneEnabled(next);

      if (mountedRef.current) setAudioEnabled(next);
    } catch (err) {
      setError(err.message || "تعذر تغيير الميكروفون");
    }
  };

  const toggleCamera = async () => {
    const room = roomRef.current;
    if (!room) return;

    try {
      const next = !videoEnabled;

      await room.localParticipant.setCameraEnabled(next);

      if (!mountedRef.current) return;

      setVideoEnabled(next);

      if (localVideoRef.current) {
        localVideoRef.current.innerHTML = "";

        if (next) {
          const publication =
            room.localParticipant.getTrackPublication("camera");

          if (publication?.track) {
            const element = publication.track.attach();
            element.autoplay = true;
            element.muted = true;
            element.playsInline = true;
            element.style.width = "100%";
            element.style.maxWidth = "420px";
            element.style.borderRadius = "12px";

            localVideoRef.current.appendChild(element);
          }
        }
      }
    } catch (err) {
      setError(err.message || "تعذر تغيير الكاميرا");
    }
  };

  const buttonStyle = {
    width: "44px",
    height: "44px",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: "50%",
    background: "#303541",
    color: "white",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    touchAction: "manipulation",
    pointerEvents: "auto",
  };

  return (
    <div
      className="lolz-calls"
      style={{ width: "100%", color: "white" }}
    >
      {!active && !incomingCall && isPrivate && conversation?.id && (
        <div style={{ display: "flex", gap: "10px", padding: "8px 0" }}>
          <button
            type="button"
            onClick={() => startCall(false)}
            disabled={connecting}
            title="مكالمة صوتية"
            style={{ ...buttonStyle, background: "#18794e" }}
          >
            <Phone size={20} />
          </button>

          <button
            type="button"
            onClick={() => startCall(true)}
            disabled={connecting}
            title="مكالمة فيديو"
            style={{ ...buttonStyle, background: "#3157a4" }}
          >
            <Video size={20} />
          </button>
        </div>
      )}

      {!active && !isPrivate && (
        <div style={{
          padding: "12px",
          margin: "8px 0",
          background: "#20242d",
          borderRadius: "12px",
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "12px",
          }}>
            <Users size={20} />
            <strong style={{ flex: 1 }}>
              المكالمات الجماعية
            </strong>
            <button
              type="button"
              onClick={checkCalls}
              title="تحديث"
              style={buttonStyle}
            >
              <RefreshCw size={17} />
            </button>
          </div>

          {canStart && (
            <div style={{
              display: "flex",
              gap: "10px",
              marginBottom: "12px",
            }}>
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
            <div style={{ display: "grid", gap: "8px" }}>
              {activeCalls.map((call) => (
                <div
                  key={call.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "10px",
                    background: "#303541",
                    borderRadius: "10px",
                  }}
                >
                  <Phone size={19} color="#48d597" />
                  <span style={{ flex: 1 }}>
                    مكالمة جارية
                  </span>
                  <button
                    type="button"
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

      {connecting && <p>جارٍ الاتصال...</p>}

      {error && (
        <div style={{
          padding: "10px",
          margin: "8px 0",
          background: "#542b32",
          borderRadius: "10px",
          display: "flex",
          justifyContent: "space-between",
          gap: "10px",
        }}>
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError("")}
            style={buttonStyle}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {incomingCall && !active && isPrivate && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "12px",
          margin: "8px 0",
          background: "#20242d",
          borderRadius: "12px",
        }}>
          <Phone size={23} />
          <strong style={{ flex: 1 }}>مكالمة واردة</strong>

          <button
            type="button"
            onClick={acceptCall}
            disabled={connecting}
            style={{ ...buttonStyle, background: "#18794e" }}
          >
            <Phone size={19} />
          </button>

          <button
            type="button"
            onClick={rejectCall}
            disabled={connecting}
            style={{ ...buttonStyle, background: "#b83240" }}
          >
            <PhoneOff size={19} />
          </button>
        </div>
      )}

      {active && (
        <div style={{
          padding: "14px",
          margin: "8px 0",
          background: "#20242d",
          borderRadius: "14px",
        }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "12px",
          }}>
            <strong>
              {isPrivate ? "مكالمة LOLZ" : "مكالمة جماعية LOLZ"}
            </strong>
            <span style={{ color: "#48d597" }}>متصل</span>
          </div>

          {!audioEnabled && !videoEnabled && (
            <p style={{ color: "#aeb5c2" }}>
              أنت في وضع الاستماع.
            </p>
          )}

          <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}>
            <div ref={localVideoRef} />
            <div ref={remoteMediaRef} />
          </div>

          <div style={{
            display: "flex",
            justifyContent: "center",
            gap: "14px",
            marginTop: "16px",
            position: "relative",
            zIndex: 10,
          }}>
            <button
              type="button"
              onClick={toggleMicrophone}
              style={buttonStyle}
              title="الميكروفون"
            >
              {audioEnabled ? <Mic size={20} /> : <MicOff size={20} />}
            </button>

            <button
              type="button"
              onClick={toggleCamera}
              style={buttonStyle}
              title="الكاميرا"
            >
              {videoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
            </button>

            <button
              type="button"
              onClick={endCall}
              style={{ ...buttonStyle, background: "#c52d3b" }}
              title="إنهاء المكالمة"
            >
              <PhoneOff size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
