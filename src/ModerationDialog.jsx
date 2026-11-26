import { useState } from "react";
import { ShieldAlert, X } from "lucide-react";
import "./ModerationDialog.css";

const REASONS = [
  ["spam", "Spam"],
  ["harassment", "Harassment or bullying"],
  ["hate", "Hate speech"],
  ["violence", "Violence or dangerous content"],
  ["nudity", "Nudity or sexual content"],
  ["scam", "Scam or fraud"],
  ["other", "Other"],
];

export default function ModerationDialog({
  target,
  isArabic = false,
  onClose,
  onSubmitReport,
  onConfirmBlock,
}) {
  const [reason, setReason] = useState("spam");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  if (!target) return null;

  const isBlock = target.mode === "block";
  const t = (en, ar) => isArabic ? ar : en;

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (isBlock) await onConfirmBlock?.(target.targetUserId);
      else await onSubmitReport?.({
        type: target.type,
        id: target.id,
        targetUserId: target.targetUserId || null,
        reason,
        details: details.trim(),
      });
      onClose?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="lolz-moderation-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose?.();
      }}
    >
      <section
        className="lolz-moderation-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lolz-moderation-title"
        dir={isArabic ? "rtl" : "ltr"}
      >
        <button
          type="button"
          className="lolz-moderation-close"
          onClick={onClose}
          disabled={busy}
          aria-label={t("Close", "إغلاق")}
        >
          <X size={20} />
        </button>

        <div className="lolz-moderation-icon"><ShieldAlert size={25} /></div>

        <h2 id="lolz-moderation-title">
          {isBlock ? t("Block this account?", "حظر هذا الحساب؟") : t("Report content", "الإبلاغ عن محتوى")}
        </h2>

        {isBlock ? (
          <>
            <p>
              {t(
                "You will no longer see this account's posts in your feed. You can manage blocked accounts later.",
                "لن ترى منشورات هذا الحساب في صفحتك الرئيسية. يمكنك إدارة الحسابات المحظورة لاحقاً."
              )}
            </p>
            <div className="lolz-moderation-actions">
              <button type="button" className="lolz-moderation-danger" onClick={submit} disabled={busy}>
                {busy ? t("Please wait...", "يرجى الانتظار...") : t("Block account", "حظر الحساب")}
              </button>
              <button type="button" className="lolz-moderation-secondary" onClick={onClose} disabled={busy}>
                {t("Cancel", "إلغاء")}
              </button>
            </div>
          </>
        ) : (
          <form onSubmit={submit}>
            <p>
              {t(
                "Choose the reason that best describes the issue. Reports are private.",
                "اختر السبب الأقرب للمخالفة. البلاغات سرية."
              )}
            </p>
            <label className="lolz-moderation-label">
              {t("Reason", "السبب")}
              <select value={reason} onChange={(event) => setReason(event.target.value)}>
                {REASONS.map(([value, en]) => (
                  <option value={value} key={value}>
                    {isArabic
                      ? ({
                          spam: "رسائل أو محتوى مزعج",
                          harassment: "تحرش أو تنمر",
                          hate: "خطاب كراهية",
                          violence: "عنف أو محتوى خطير",
                          nudity: "عري أو محتوى جنسي",
                          scam: "احتيال أو نصب",
                          other: "سبب آخر",
                        }[value])
                      : en}
                  </option>
                ))}
              </select>
            </label>
            <label className="lolz-moderation-label">
              {t("Additional details (optional)", "تفاصيل إضافية (اختياري)")}
              <textarea
                rows={4}
                maxLength={1500}
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                placeholder={t("Tell us what happened...", "اشرح لنا ما حدث...")}
              />
            </label>
            <div className="lolz-moderation-actions">
              <button type="submit" className="lolz-moderation-danger" disabled={busy}>
                {busy ? t("Sending...", "جارٍ الإرسال...") : t("Submit report", "إرسال البلاغ")}
              </button>
              <button type="button" className="lolz-moderation-secondary" onClick={onClose} disabled={busy}>
                {t("Cancel", "إلغاء")}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
