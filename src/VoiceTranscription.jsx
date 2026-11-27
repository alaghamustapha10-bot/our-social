import { useEffect, useState } from "react";
import { Captions, LoaderCircle, Languages } from "lucide-react";
import { supabase } from "./supabase";

export default function VoiceTranscription({ messageId, sourceType, transcript: initialTranscript = "", isArabic = false }) {
  const [transcript, setTranscript] = useState(initialTranscript || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setTranscript(initialTranscript || "");
  }, [initialTranscript, messageId]);

  async function transcribe() {
    if (!messageId || loading || transcript) return;
    setLoading(true);
    setError("");
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("lolz-transcribe", {
        body: {
          source_type: sourceType,
          message_id: String(messageId),
        },
      });
      if (invokeError) {
        let detail = invokeError.message || "";
        const response = invokeError.context;
        if (response && typeof response.clone === "function") {
          const payload = await response.clone().json().catch(() => null);
          detail = payload?.error || payload?.message || detail;
        }
        throw new Error(detail || (isArabic ? "تعذّر تحويل الصوت إلى نص." : "Could not transcribe this voice message."));
      }
      if (data?.error) throw new Error(data.error);
      if (!data?.transcript) throw new Error(isArabic ? "لم يتم العثور على كلام واضح في التسجيل." : "No clear speech was found in this recording.");
      setTranscript(data.transcript);
    } catch (caught) {
      setError(caught?.message || String(caught));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="lolz-voice-transcription">
      {transcript ? (
        <div className="lolz-voice-transcript" dir={isArabic ? "rtl" : "auto"}>
          <span><Languages size={14} /> {isArabic ? "النص المستخرج" : "Transcript"}</span>
          <p>{transcript}</p>
        </div>
      ) : (
        <button type="button" onClick={() => void transcribe()} disabled={loading}>
          {loading ? <LoaderCircle size={15} className="lolz-spin" /> : <Captions size={15} />}
          {loading
            ? (isArabic ? "جارٍ تحويل الصوت…" : "Transcribing…")
            : (isArabic ? "تحويل الصوت إلى نص" : "Transcribe voice")}
        </button>
      )}
      {error && <small role="status">{error}</small>}
    </div>
  );
}
