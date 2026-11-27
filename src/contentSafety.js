const POLICY_RULES = [
  {
    code: "explicit_sexual",
    pattern: /\b(?:porn(?:hub)?|xvideos|xnxx|xxx\s*(?:video|photos?)|sex\s*tape|send\s*nudes?|nude\s*(?:photos?|pics?))\b|(?:صور?\s*(?:اباحي|عاري)|مقاطع?\s*(?:اباحي|جنسي)|محتوى\s*جنسي\s*صريح|سكس\s*صريح)/i,
    ar: "المحتوى الإباحي أو الجنسي الصريح غير مسموح في LOLZ.",
    en: "Pornographic or explicit sexual content is not allowed on LOLZ.",
  },
  {
    code: "drug_promotion",
    pattern: /\b(?:sell|selling|buy|order|dealer|dm\s+for|contact\s+for)\b.{0,55}\b(?:cocaine|heroin|meth|ecstasy|mdma|fentanyl|weed|marijuana|opioids?)\b|\b(?:cocaine|heroin|meth|ecstasy|mdma|fentanyl|weed|marijuana|opioids?)\b.{0,55}\b(?:for\s+sale|buy|order|dm\s+me|message\s+me)\b|(?:بيع|للبيع|اطلب|للطلب|شراء|راسلني|تواصل\s*لـ?).{0,35}(?:مخدرات|حشيش|كوكايين|هيروين|ميثامفيتامين|اكستاسي|فنتانيل)/i,
    ar: "الترويج للمخدرات أو بيعها أو تسهيل الحصول عليها غير مسموح.",
    en: "Promoting, selling, or arranging access to illegal drugs is not allowed.",
  },
  {
    code: "gambling_promotion",
    pattern: /\b(?:online\s+casino|casino\s+bonus|bet\s+now|place\s+(?:your\s+)?bets?|sportsbook|bookmaker|slots?\s+bonus|gambling\s+site|join\s+(?:my\s+)?casino|deposit\s+and\s+win)\b|(?:كازينو\s*اونلاين|مراهنات\s*اونلاين|راهن\s*الان|ضع\s*رهانك|اشترك\s*في\s*القمار|موقع\s*قمار|اربح\s*من\s*المراهنات)/i,
    ar: "الإعلانات والدعوات للمقامرة أو المراهنات غير مسموحة.",
    en: "Gambling and betting advertisements or invitations are not allowed.",
  },
];

function normalizePolicyText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u200B-\u200F\uFEFF]/g, "")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/[ىي]/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[ـ]/g, "")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function checkLocalCommunityText(value, isArabic = false) {
  const normalized = normalizePolicyText(value);
  if (!normalized) return { allowed: true, reason: null, code: null };

  for (const rule of POLICY_RULES) {
    if (rule.pattern.test(normalized)) {
      return {
        allowed: false,
        reason: isArabic ? rule.ar : rule.en,
        code: rule.code,
      };
    }
  }

  return { allowed: true, reason: null, code: null };
}

function fileToImageDataUrl(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      try {
        const maxEdge = 1100;
        const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("Could not prepare the image for safety review.");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.78));
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("This image could not be prepared for safety review."));
    };
    image.src = objectUrl;
  });
}

function waitForVideoEvent(video, eventName, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("Video safety review timed out. Please try another file."));
    }, timeoutMs);
    const cleanup = () => {
      window.clearTimeout(timer);
      video.removeEventListener(eventName, onReady);
      video.removeEventListener("error", onError);
    };
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("This video could not be prepared for safety review."));
    };
    video.addEventListener(eventName, onReady, { once: true });
    video.addEventListener("error", onError, { once: true });
  });
}

async function videoToImageDataUrls(file) {
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;

  try {
    const metadataReady = waitForVideoEvent(video, "loadedmetadata");
    video.src = objectUrl;
    await metadataReady;
    if (!Number.isFinite(video.duration) || video.duration <= 0) {
      throw new Error("Video duration could not be read.");
    }

    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Could not prepare video frames for safety review.");

    // Sample several points across the video instead of relying on its cover frame.
    const samplePoints = [0.12, 0.36, 0.62, 0.86]
      .map((ratio) => Math.min(Math.max(0.05, video.duration * ratio), Math.max(0.05, video.duration - 0.05)));
    const frames = [];

    for (const point of samplePoints) {
      const seekReady = waitForVideoEvent(video, "seeked");
      video.currentTime = point;
      await seekReady;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(canvas.toDataURL("image/jpeg", 0.68));
    }
    return frames;
  } finally {
    video.pause();
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(objectUrl);
  }
}

async function prepareMediaForReview(file) {
  if (!file) return [];
  if (file.type.startsWith("image/")) return [await fileToImageDataUrl(file)];
  if (file.type.startsWith("video/")) return videoToImageDataUrls(file);
  return [];
}

function readFunctionError(error, data) {
  const response = error?.context;
  if (data?.error) return String(data.error);
  if (response && typeof response.clone === "function") {
    return response.clone().json().then((json) => json?.error || json?.message || error?.message || "Safety review failed.").catch(() => error?.message || "Safety review failed.");
  }
  return Promise.resolve(error?.message || "Safety review failed.");
}

export async function moderateLolzSubmission({
  supabase,
  text = "",
  file = null,
  isArabic = false,
} = {}) {
  const local = checkLocalCommunityText(text, isArabic);
  if (!local.allowed) return local;

  if (!text.trim() && !file) return { allowed: true, reason: null, source: "empty" };

  let images = [];
  if (file && (file.type.startsWith("image/") || file.type.startsWith("video/"))) {
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      return {
        allowed: false,
        reason: isArabic ? "هذا النوع من الملفات غير مدعوم." : "This file type is not supported.",
        code: "unsupported_media",
      };
    }
    try {
      images = await prepareMediaForReview(file);
    } catch (error) {
      return { allowed: false, reason: error.message, code: "media_preparation_failed" };
    }
  }

  if (!supabase?.functions?.invoke) {
    if (file) {
      return {
        allowed: false,
        reason: isArabic
          ? "فحص الصور والفيديو غير متاح حالياً؛ لم نسمح برفع الملف قبل فحصه."
          : "Image and video review is unavailable; this upload is held until it can be checked.",
        code: "moderation_unavailable",
      };
    }
    return { allowed: true, reason: null, source: "local-rules" };
  }

  const { data, error } = await supabase.functions.invoke("lolz-moderate", {
    body: { text: String(text || "").slice(0, 5000), image_data_urls: images },
  });

  if (error || data?.error) {
    const message = await readFunctionError(error, data);
    if (file) {
      return {
        allowed: false,
        reason: isArabic
          ? "لم يكتمل فحص الوسائط، لذلك لم نرفعها. " + message
          : "Media review did not complete, so the file was not uploaded. " + message,
        code: data?.code || "moderation_unavailable",
      };
    }
    // Text also passes a database-side policy trigger; local checks remain active
    // while the optional model service is being configured or recovered.
    return { allowed: true, reason: null, source: "local-rules", warning: message };
  }

  if (data?.enabled === false && file) {
    return {
      allowed: false,
      reason: isArabic
        ? "فحص الصور والفيديو لم يتم تفعيله بعد. أضف مفتاح OpenAI إلى أسرار Supabase أولاً."
        : "Image and video review is not enabled yet. Add the OpenAI key to Supabase Edge Function secrets first.",
      code: "moderation_not_configured",
    };
  }

  if (data?.approved === false) {
    return {
      allowed: false,
      reason: data.message || (isArabic
        ? "هذا المحتوى لا يتوافق مع قواعد مجتمع LOLZ."
        : "This content does not comply with LOLZ community rules."),
      code: data.code || "policy_violation",
      categories: data.categories || [],
    };
  }

  return { allowed: true, reason: null, source: data?.enabled ? "ai-and-local" : "local-rules" };
}
