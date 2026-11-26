import { useEffect, useState } from "react";
import { callSessionManager } from "./callSessionManager";
import "./CallDock.css";

export default function CallDock() {
  const [callState, setCallState] = useState(
    callSessionManager.getSnapshot()
  );

  const [elapsed, setElapsed] = useState("00:00");
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = callSessionManager.subscribe(() => {
      setCallState(callSessionManager.getSnapshot());
    });

    setCallState(callSessionManager.getSnapshot());

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!callState.active || !callState.startedAt) {
      setElapsed("00:00");
      return;
    }

    const updateTimer = () => {
      const seconds = Math.max(
        0,
        Math.floor((Date.now() - callState.startedAt) / 1000)
      );

      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;

      setElapsed(
        `${String(minutes).padStart(2, "0")}:${String(
          remainingSeconds
        ).padStart(2, "0")}`
      );
    };

    updateTimer();

    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [callState.active, callState.startedAt]);

  if (!callState.active) {
    return null;
  }

  const callTypeLabels = {
    private: "مكالمة خاصة",
    group: "مكالمة مجموعة",
    channel: "مكالمة قناة",
  };

  const callTypeLabel =
    callTypeLabels[callState.callType] || "مكالمة";

  const handleMicrophone = async () => {
    setError("");

    try {
      await callSessionManager.toggleMicrophone();
    } catch (err) {
      console.error(err);
      setError("تعذر تغيير حالة الميكروفون.");
    }
  };

  const handleCamera = async () => {
    setError("");

    try {
      await callSessionManager.toggleCamera();
    } catch (err) {
      console.error(err);
      setError("تعذر تغيير حالة الكاميرا.");
    }
  };

  const handleLeave = async () => {
    const confirmed = window.confirm(
      "هل تريد مغادرة المكالمة؟"
    );

    if (!confirmed) return;

    setError("");

    try {
      await callSessionManager.leaveCall();
    } catch (err) {
      console.error(err);
      setError("حدث خطأ أثناء مغادرة المكالمة.");
    }
  };

  return (
    <div className="lolz-call-dock">
      <div className="lolz-call-dock-info">
        <div className="lolz-call-dock-indicator">
          <span className="lolz-call-dock-dot" />
        </div>

        <div className="lolz-call-dock-details">
          <strong>
            {callState.title || callTypeLabel}
          </strong>

          <span>
            {callTypeLabel} · {elapsed}
          </span>

          <span className="lolz-call-dock-participants">
            {callState.participantCount} مشارك
          </span>
        </div>
      </div>

      <div className="lolz-call-dock-controls">
        <button
          type="button"
          className={
            callState.microphoneEnabled
              ? "lolz-dock-control"
              : "lolz-dock-control is-muted"
          }
          onClick={handleMicrophone}
          title={
            callState.microphoneEnabled
              ? "إيقاف الميكروفون"
              : "تشغيل الميكروفون"
          }
        >
          {callState.microphoneEnabled ? "🎙️" : "🔇"}
        </button>

        {callState.cameraAvailable && (
          <button
            type="button"
            className={
              callState.cameraEnabled
                ? "lolz-dock-control"
                : "lolz-dock-control is-muted"
            }
            onClick={handleCamera}
            title={
              callState.cameraEnabled
                ? "إيقاف الكاميرا"
                : "تشغيل الكاميرا"
            }
          >
            {callState.cameraEnabled ? "📹" : "📷"}
          </button>
        )}

        <button
          type="button"
          className="lolz-dock-leave"
          onClick={handleLeave}
          title="مغادرة المكالمة"
        >
          إنهاء
        </button>
      </div>

      {error && (
        <div className="lolz-call-dock-error">
          {error}
        </div>
      )}
    </div>
  );
}