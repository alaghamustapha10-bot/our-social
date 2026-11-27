import { useEffect, useRef, useState } from "react";
import { AudioLines } from "lucide-react";

const SPEEDS = [1, 1.25, 1.5, 2];

export default function VoiceMessagePlayer({ src }) {
  const audioRef = useRef(null);
  const [speed, setSpeed] = useState(1);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed, src]);

  function cycleSpeed() {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  }

  return (
    <div className="lolz-voice-player">
      <AudioLines size={17} aria-hidden="true" />
      <audio
        ref={audioRef}
        src={src}
        controls
        preload="metadata"
        onError={() => setFailed(true)}
      />
      <button type="button" onClick={cycleSpeed} aria-label="Change playback speed" title="Change playback speed">
        {speed}×
      </button>
      {failed && <span role="status">{document.documentElement.lang === "ar" ? "تعذر تشغيل الصوت" : "Audio unavailable"}</span>}
    </div>
  );
}
