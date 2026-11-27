import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck, BarChart3, BriefcaseBusiness, CalendarDays, Check,
  ChevronDown, CircleDollarSign, Clock3, Crown, GraduationCap, Heart,
  Megaphone, Package, Plus, RefreshCw, ShoppingBag, Sparkles, Store,
  Ticket, Users, Wallet, X,
} from "lucide-react";
import { supabase } from "./supabase";
import "./MonetizationHub.css";

const OFFER_TYPES = [
  ["creator_membership", "عضوية صانع محتوى", "Creator membership"],
  ["community_access", "وصول إلى مجتمع حصري", "Exclusive community access"],
  ["digital_product", "منتج رقمي", "Digital product"],
  ["event_ticket", "تذكرة فعالية", "Event ticket"],
  ["course", "دورة تعليمية", "Course"],
  ["booking", "حجز موعد", "Appointment booking"],
  ["service", "خدمة", "Service"],
];

const REVENUE_STREAMS = [
  { icon: Crown, title: "Premium", ar: "اشتراك Premium", detail: "Paid plan with optional profile themes and creator tools.", arDetail: "اشتراك اختياري لمزايا وتخصيصات إضافية." },
  { icon: Heart, title: "Creator memberships", ar: "عضويات صناع المحتوى", detail: "Sell clearly described time-limited membership passes.", arDetail: "بيع عضويات محددة المدة لصناع المحتوى." },
  { icon: Users, title: "Paid communities", ar: "المجتمعات المدفوعة", detail: "Offer a paid access pass to an exclusive group or channel.", arDetail: "تقديم تصريح وصول مدفوع لمجتمع أو قناة حصرية." },
  { icon: CircleDollarSign, title: "Creator tips", ar: "دعم صناع المحتوى", detail: "Let followers support creators with an optional payment.", arDetail: "تمكين المتابعين من دعم المبدعين اختيارياً." },
  { icon: ShoppingBag, title: "Digital shop", ar: "المتجر الرقمي", detail: "List original digital goods, templates and design packs.", arDetail: "عرض منتجات رقمية وتصاميم وقوالب أصلية." },
  { icon: Ticket, title: "Events & tickets", ar: "الفعاليات والتذاكر", detail: "Sell tickets for permissible events and workshops.", arDetail: "بيع تذاكر الفعاليات والورش المباحة." },
  { icon: Store, title: "Business accounts", ar: "حسابات الأعمال", detail: "Build a public creator or business storefront.", arDetail: "إنشاء واجهة عامة لصانع محتوى أو شركة." },
  { icon: BriefcaseBusiness, title: "Marketplace", ar: "سوق الخدمات", detail: "Offer products and professional services for a stated price.", arDetail: "عرض المنتجات والخدمات المهنية بسعر معلوم." },
  { icon: Megaphone, title: "Sponsored collaborations", ar: "التعاونات الإعلانية", detail: "Connect brands with creators through public briefs and applications.", arDetail: "ربط الشركات بالمبدعين عبر طلبات تعاون واضحة." },
  { icon: GraduationCap, title: "Courses", ar: "الدورات التعليمية", detail: "Publish paid educational courses and learning resources.", arDetail: "عرض الدورات والمواد التعليمية المدفوعة." },
  { icon: CalendarDays, title: "Appointments", ar: "المواعيد والحجوزات", detail: "Receive appointment requests for bookable services.", arDetail: "استقبال طلبات حجز الخدمات والمواعيد." },
  { icon: BarChart3, title: "Ad campaigns & creator tools", ar: "الحملات وأدوات المحترفين", detail: "Submit reviewed ad campaigns and use advanced creator services.", arDetail: "تقديم حملات للمراجعة والاستفادة من أدوات المحترفين." },
];

function money(cents, locale = "en") {
  return new Intl.NumberFormat(locale === "ar" ? "ar-NL" : "nl-NL", {
    style: "currency", currency: "EUR", maximumFractionDigits: 2,
  }).format((Number(cents) || 0) / 100);
}

function friendlyDate(value, locale) {
  if (!value) return "";
  return new Date(value).toLocaleString(locale === "ar" ? "ar" : "en-GB", {
    dateStyle: "medium", timeStyle: "short",
  });
}

export default function MonetizationHub({ user, isArabic = false }) {
  const t = (en, ar) => isArabic ? ar : en;
  const [tab, setTab] = useState("explore");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [offers, setOffers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [briefs, setBriefs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [monetizationProfile, setMonetizationProfile] = useState({
    account_type: "creator", display_name: "", description: "", website_url: "", country_code: "NL", is_public: true,
  });
  const [offerForm, setOfferForm] = useState({
    offer_type: "digital_product", title: "", description: "", price: "9.99", duration_days: "30", starts_at: "", location: "",
  });
  const [briefForm, setBriefForm] = useState({ title: "", description: "", min: "50", max: "250" });
  const [campaignForm, setCampaignForm] = useState({ title: "", description: "", destination_url: "", placement: "feed", budget: "25" });
  const [tipForm, setTipForm] = useState({ creator_id: "", amount: "5" });
  const [bookingForm, setBookingForm] = useState({ requested_at: "", customer_note: "" });
  const [applicationPitch, setApplicationPitch] = useState("");
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutNote, setPayoutNote] = useState("");

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setNotice("");
    try {
      const [activeResult, ownResult, buyerResult, sellerResult, bookingBuyer, bookingSeller, profileResult, briefsResult, campaignsResult, payoutResult, applicationsResult] = await Promise.all([
        supabase.from("lolz_commerce_offers").select("*").eq("status", "active").order("created_at", { ascending: false }).limit(80),
        supabase.from("lolz_commerce_offers").select("*").eq("seller_id", user.id).order("created_at", { ascending: false }).limit(80),
        supabase.from("lolz_commerce_orders").select("*").eq("buyer_id", user.id).order("created_at", { ascending: false }).limit(100),
        supabase.from("lolz_commerce_orders").select("*").eq("seller_id", user.id).order("created_at", { ascending: false }).limit(100),
        supabase.from("lolz_booking_requests").select("*").eq("customer_id", user.id).order("requested_at", { ascending: false }).limit(50),
        supabase.from("lolz_booking_requests").select("*").eq("seller_id", user.id).order("requested_at", { ascending: false }).limit(50),
        supabase.from("lolz_monetization_profiles").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("lolz_sponsorship_briefs").select("*").eq("status", "open").order("created_at", { ascending: false }).limit(50),
        supabase.from("lolz_ad_campaigns").select("*").eq("advertiser_id", user.id).order("created_at", { ascending: false }).limit(50),
        supabase.from("lolz_payout_requests").select("*").eq("seller_id", user.id).order("created_at", { ascending: false }).limit(50),
        supabase.from("lolz_sponsorship_applications").select("*").eq("creator_id", user.id).order("created_at", { ascending: false }).limit(50),
      ]);
      const required = [activeResult, ownResult, buyerResult, sellerResult, bookingBuyer, bookingSeller, profileResult, briefsResult, campaignsResult, payoutResult, applicationsResult];
      const failed = required.find((item) => item.error);
      if (failed?.error) throw failed.error;

      const combinedOffers = [...(ownResult.data || [])];
      const ownIds = new Set(combinedOffers.map((row) => row.id));
      for (const offer of activeResult.data || []) if (!ownIds.has(offer.id)) combinedOffers.push(offer);
      setOffers(combinedOffers);
      const allOrders = [...(buyerResult.data || [])];
      const orderIds = new Set(allOrders.map((row) => row.id));
      for (const order of sellerResult.data || []) if (!orderIds.has(order.id)) allOrders.push(order);
      setOrders(allOrders);
      setBookings([...(bookingBuyer.data || []), ...(bookingSeller.data || [])]);
      setBriefs(briefsResult.data || []);
      setCampaigns(campaignsResult.data || []);
      setPayouts(payoutResult.data || []);
      setApplications(applicationsResult.data || []);
      if (profileResult.data) setMonetizationProfile((current) => ({ ...current, ...profileResult.data }));

      const peopleIds = [...new Set([
        ...(activeResult.data || []).map((row) => row.seller_id),
        ...(sellerResult.data || []).map((row) => row.buyer_id),
        ...(briefsResult.data || []).map((row) => row.advertiser_id),
      ].filter((id) => id && id !== user.id))];
      if (peopleIds.length) {
        const { data: people, error: peopleError } = await supabase.from("profiles")
          .select("id,username,display_name,avatar_url").in("id", peopleIds);
        if (!peopleError) setProfiles(Object.fromEntries((people || []).map((person) => [person.id, person])));
      }
    } catch (error) {
      setNotice(t(
        "The monetization database is not ready yet. Apply the LOLZ monetization migration, then reload. Details: ",
        "قاعدة بيانات الربح غير جاهزة بعد. طبّق ترحيل LOLZ Monetization ثم أعد التحميل. التفاصيل: ",
      ) + (error?.message || String(error)));
    } finally {
      setLoading(false);
    }
  }, [user?.id, isArabic]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!user?.id) return undefined;
    const url = new URL(window.location.href);
    const state = url.searchParams.get("lolz_commerce");
    const orderId = url.searchParams.get("order_id");
    const paypalOrderId = url.searchParams.get("token");
    if (!state) return undefined;

    let active = true;
    const finish = async () => {
      if (state === "return" && orderId && paypalOrderId) {
        setBusy("capture");
        setNotice(t("Confirming your PayPal payment…", "جارٍ تأكيد دفعتك عبر PayPal…"));
        const { data, error } = await supabase.functions.invoke("lolz-commerce", {
          body: { action: "capture", order_id: orderId, paypal_order_id: paypalOrderId },
        });
        if (!active) return;
        setNotice(error?.message || data?.error
          ? (error?.message || data?.error)
          : t("Payment confirmed. Your order is recorded.", "تم تأكيد الدفع وتسجيل طلبك."));
        if (!error && !data?.error) await load();
        setBusy("");
      } else if (state === "cancel" && orderId) {
        await supabase.functions.invoke("lolz-commerce", { body: { action: "cancel", order_id: orderId } });
        if (!active) return;
        setNotice(t("Payment was cancelled. No order was marked as paid.", "تم إلغاء الدفع ولم يُسجّل الطلب كمدفوع."));
        setBusy("");
        await load();
      }
      for (const key of ["lolz_commerce", "order_id", "token", "PayerID"]) url.searchParams.delete(key);
      window.history.replaceState({}, "", url.toString());
    };
    void finish();
    return () => { active = false; };
  }, [user?.id, load, isArabic]);

  const myOffers = useMemo(() => offers.filter((offer) => offer.seller_id === user?.id), [offers, user?.id]);
  const publicOffers = useMemo(() => offers.filter((offer) => offer.status === "active" && offer.seller_id !== user?.id), [offers, user?.id]);
  const paidOrders = orders.filter((order) => order.status === "paid");
  const sellerPaid = paidOrders.filter((order) => order.seller_id === user?.id);
  const grossEarned = sellerPaid.reduce((total, order) => total + Number(order.seller_net_cents || 0), 0);
  const statusLabel = (status) => ({
    pending: t("Pending", "قيد الانتظار"),
    paid: t("Paid", "مدفوع"),
    cancelled: t("Cancelled", "ملغى"),
    failed: t("Failed", "فشل"),
    refunded: t("Refunded", "مسترد"),
    pending_review: t("Pending review", "بانتظار المراجعة"),
    approved: t("Approved", "مقبول"),
    rejected: t("Rejected", "مرفوض"),
    open: t("Open", "مفتوح"),
    paused: t("Paused", "متوقف"),
    closed: t("Closed", "مغلق"),
    accepted: t("Accepted", "مقبول"),
    declined: t("Declined", "مرفوض"),
  }[status] || status || "—");

  async function saveMonetizationProfile(event) {
    event.preventDefault();
    setBusy("profile");
    setNotice("");
    const payload = {
      ...monetizationProfile,
      user_id: user.id,
      display_name: monetizationProfile.display_name.trim(),
      description: monetizationProfile.description.trim(),
      website_url: monetizationProfile.website_url.trim() || null,
      country_code: String(monetizationProfile.country_code || "NL").toUpperCase(),
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("lolz_monetization_profiles").upsert(payload, { onConflict: "user_id" });
    setBusy("");
    if (error) setNotice(error.message);
    else { setNotice(t("Your public seller profile was saved.", "تم حفظ ملف البائع العام.")); await load(); }
  }

  async function createOffer(event) {
    event.preventDefault();
    const cents = Math.round(Number(offerForm.price) * 100);
    if (!offerForm.title.trim() || !Number.isFinite(cents) || cents < 100) {
      setNotice(t("Enter a title and a valid price of at least €1.00.", "أدخل عنواناً وسعراً صحيحاً لا يقل عن €1.00."));
      return;
    }
    setBusy("offer");
    const { error } = await supabase.from("lolz_commerce_offers").insert({
      seller_id: user.id,
      offer_type: offerForm.offer_type,
      title: offerForm.title.trim(),
      description: offerForm.description.trim(),
      price_cents: cents,
      currency: "EUR",
      duration_days: ["creator_membership", "community_access"].includes(offerForm.offer_type)
        ? Math.max(1, Math.min(3650, Number(offerForm.duration_days) || 30)) : null,
      starts_at: offerForm.starts_at ? new Date(offerForm.starts_at).toISOString() : null,
      location: offerForm.location.trim() || null,
      status: "active",
    });
    setBusy("");
    if (error) setNotice(error.message);
    else {
      setOfferForm({ offer_type: "digital_product", title: "", description: "", price: "9.99", duration_days: "30", starts_at: "", location: "" });
      setNotice(t("Your offer is now listed.", "تم نشر العرض الخاص بك."));
      setTab("offers");
      await load();
    }
  }

  async function setOfferStatus(offer, status) {
    setBusy(offer.id);
    const { error } = await supabase.from("lolz_commerce_offers").update({ status, updated_at: new Date().toISOString() }).eq("id", offer.id).eq("seller_id", user.id);
    setBusy("");
    setNotice(error?.message || t("Offer updated.", "تم تحديث العرض."));
    if (!error) await load();
  }

  async function startCheckout(offer) {
    setBusy(offer.id);
    setNotice("");
    const { data, error } = await supabase.functions.invoke("lolz-commerce", {
      body: { action: "create-checkout", offer_id: offer.id },
    });
    setBusy("");
    if (error || data?.error || !data?.approval_url) {
      setNotice(error?.message || data?.error || t("Could not start secure checkout.", "تعذر بدء الدفع الآمن."));
      return;
    }
    window.location.assign(data.approval_url);
  }

  async function sendTip(event) {
    event.preventDefault();
    const amountCents = Math.round(Number(tipForm.amount) * 100);
    if (!tipForm.creator_id || amountCents < 100 || amountCents > 25000) {
      setNotice(t("Choose a creator and enter a tip between €1 and €250.", "اختر صانع محتوى وأدخل دعماً بين €1 و€250."));
      return;
    }
    setBusy("tip");
    const { data, error } = await supabase.functions.invoke("lolz-commerce", {
      body: { action: "tip", creator_id: tipForm.creator_id, amount_cents: amountCents },
    });
    setBusy("");
    if (error || data?.error || !data?.approval_url) setNotice(error?.message || data?.error || t("Could not start the tip payment.", "تعذر بدء دفع الدعم."));
    else window.location.assign(data.approval_url);
  }

  async function supportProject(event) {
    event.preventDefault();
    const amountCents = Math.round(Number(event.currentTarget.amount.value) * 100);
    if (amountCents < 100 || amountCents > 25000) {
      setNotice(t("Project support must be between €1 and €250.", "يجب أن يكون دعم المشروع بين €1 و€250."));
      return;
    }
    setBusy("support");
    const { data, error } = await supabase.functions.invoke("lolz-commerce", {
      body: { action: "support", amount_cents: amountCents },
    });
    setBusy("");
    if (error || data?.error || !data?.approval_url) setNotice(error?.message || data?.error || t("Could not start support payment.", "تعذر بدء دفع الدعم."));
    else window.location.assign(data.approval_url);
  }

  async function requestBooking(offer) {
    if (!bookingForm.requested_at) {
      setNotice(t("Choose a date and time first.", "اختر التاريخ والوقت أولاً."));
      return;
    }
    setBusy(offer.id);
    const { error } = await supabase.from("lolz_booking_requests").insert({
      offer_id: offer.id,
      customer_id: user.id,
      seller_id: offer.seller_id,
      requested_at: new Date(bookingForm.requested_at).toISOString(),
      customer_note: bookingForm.customer_note.trim(),
    });
    setBusy("");
    setNotice(error?.message || t("Booking request sent. The provider will contact you.", "تم إرسال طلب الحجز وسيقوم مقدم الخدمة بالتواصل معك."));
    if (!error) await load();
  }

  async function createBrief(event) {
    event.preventDefault();
    const min = Math.round(Number(briefForm.min) * 100);
    const max = Math.round(Number(briefForm.max) * 100);
    if (min < 100 || max < min) { setNotice(t("Enter a valid budget range.", "أدخل نطاق ميزانية صحيحاً.")); return; }
    setBusy("brief");
    const { error } = await supabase.from("lolz_sponsorship_briefs").insert({
      advertiser_id: user.id, title: briefForm.title.trim(), description: briefForm.description.trim(),
      budget_min_cents: min, budget_max_cents: max, status: "open",
    });
    setBusy("");
    setNotice(error?.message || t("Your collaboration brief is open to creators.", "أصبح طلب التعاون متاحاً لصناع المحتوى."));
    if (!error) await load();
  }

  async function applyToBrief(brief) {
    if (applicationPitch.trim().length < 10) {
      setNotice(t("Write a short pitch of at least 10 characters first.", "اكتب عرض تعاون لا يقل عن 10 أحرف أولاً."));
      return;
    }
    setBusy(brief.id);
    const { error } = await supabase.from("lolz_sponsorship_applications").insert({
      brief_id: brief.id, creator_id: user.id, pitch: applicationPitch.trim(), proposed_rate_cents: brief.budget_min_cents,
    });
    setBusy("");
    setNotice(error?.message || t("Your application was sent.", "تم إرسال طلب التعاون."));
    if (!error) { setApplicationPitch(""); await load(); }
  }

  async function createCampaign(event) {
    event.preventDefault();
    const budget = Math.round(Number(campaignForm.budget) * 100);
    if (budget < 500) { setNotice(t("The campaign budget must be at least €5.", "ميزانية الحملة يجب ألا تقل عن €5.")); return; }
    setBusy("campaign");
    const { error } = await supabase.from("lolz_ad_campaigns").insert({
      advertiser_id: user.id, title: campaignForm.title.trim(), description: campaignForm.description.trim(),
      destination_url: campaignForm.destination_url.trim() || null, placement: campaignForm.placement, budget_cents: budget,
      status: "pending_review",
    });
    setBusy("");
    setNotice(error?.message || t("Campaign submitted for moderation. It will not run until approved and scheduled.", "تم إرسال الحملة للمراجعة، ولن تعمل قبل الموافقة والجدولة."));
    if (!error) await load();
  }

  async function requestPayout(event) {
    event.preventDefault();
    const amountCents = Math.round(Number(payoutAmount) * 100);
    if (amountCents < 100) { setNotice(t("Enter a payout request of at least €1.", "أدخل طلب سحب لا يقل عن €1.")); return; }
    setBusy("payout");
    const { error } = await supabase.from("lolz_payout_requests").insert({
      seller_id: user.id, amount_cents: amountCents, seller_note: payoutNote.trim(), status: "pending_review",
    });
    setBusy("");
    setNotice(error?.message || t("Payout request submitted for manual review. No automatic transfer has been made.", "تم إرسال طلب السحب للمراجعة اليدوية. لم يتم تحويل أي مبلغ تلقائياً."));
    if (!error) { setPayoutAmount(""); setPayoutNote(""); await load(); }
  }

  const creatorChoices = useMemo(() => {
    const ids = [...new Set(offers.filter((offer) => offer.seller_id !== user?.id).map((offer) => offer.seller_id))];
    return ids.map((id) => ({ id, name: profiles[id]?.display_name || profiles[id]?.username || id.slice(0, 8) }));
  }, [offers, profiles, user?.id]);

  const tabs = [
    ["explore", t("Overview", "نظرة عامة")],
    ["offers", t("Marketplace", "السوق")],
    ["create", t("Create an offer", "إنشاء عرض")],
    ["collabs", t("Collaborations", "التعاونات")],
    ["ads", t("Ad campaigns", "الحملات الإعلانية")],
    ["earnings", t("Earnings", "الأرباح")],
  ];

  return (
    <div className="lolz-money-page">
      <header className="lolz-money-hero">
        <div>
          <span className="lolz-money-eyebrow"><Sparkles size={14} /> LOLZ CREATOR ECONOMY</span>
          <h1>{t("Earn with LOLZ", "اربح مع LOLZ")}</h1>
          <p>{t("Build a business, offer useful services and earn through clear, optional transactions.", "أنشئ نشاطك، وقدّم خدمات مفيدة، واكسب من خلال معاملات واضحة واختيارية.")}</p>
          <div className="lolz-money-hero-note"><ShieldCheckIcon /> {t("Clear prices · no hidden fees · free social basics", "أسعار واضحة · دون رسوم مخفية · الأساسيات الاجتماعية مجانية")}</div>
        </div>
        <div className="lolz-money-hero-mark"><Wallet size={44} /><strong>LOLZ</strong><span>CREATOR ECONOMY</span></div>
      </header>

      {notice && (
        <div className="lolz-money-notice" role="status">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice("")} aria-label={t("Close", "إغلاق")}><X size={16} /></button>
        </div>
      )}

      <nav className="lolz-money-tabs" aria-label={t("Monetization sections", "أقسام الربح")}>
        {tabs.map(([id, label]) => <button type="button" key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{label}</button>)}
        <button type="button" className="lolz-money-refresh" onClick={() => void load()} disabled={loading}><RefreshCw size={15} /></button>
      </nav>

      {loading ? (
        <div className="lolz-money-empty"><RefreshCw className="spin" /> {t("Loading your creator economy…", "جارٍ تحميل لوحة الربح…")}</div>
      ) : (
        <>
          {tab === "explore" && (
            <>
              <div className="lolz-money-stats">
                <article><span>{t("Active offers", "العروض النشطة")}</span><strong>{myOffers.filter((item) => item.status === "active").length}</strong></article>
                <article><span>{t("Paid orders", "الطلبات المدفوعة")}</span><strong>{sellerPaid.length}</strong></article>
                <article><span>{t("Net sales", "صافي المبيعات")}</span><strong>{money(grossEarned, isArabic ? "ar" : "en")}</strong></article>
                <article><span>{t("Payout requests", "طلبات السحب")}</span><strong>{payouts.length}</strong></article>
              </div>

              <section className="lolz-money-section">
                <div className="lolz-money-heading"><div><span className="lolz-money-eyebrow">{t("12 WAYS TO GROW", "12 طريقة للنمو")}</span><h2>{t("Build more than a social profile", "حوّل حسابك إلى أكثر من مجرد ملف اجتماعي")}</h2></div></div>
                <div className="lolz-money-stream-grid">
                  {REVENUE_STREAMS.map(({ icon: Icon, title, ar, detail, arDetail }) => (
                    <article key={title} className="lolz-money-stream">
                      <div className="lolz-money-stream-icon"><Icon size={20} /></div>
                      <h3>{isArabic ? ar : title}</h3>
                      <p>{isArabic ? arDetail : detail}</p>
                    </article>
                  ))}
                </div>
              </section>

              <section className="lolz-money-section">
                <div className="lolz-money-heading"><div><span className="lolz-money-eyebrow">{t("START SELLING", "ابدأ البيع")}</span><h2>{t("Your first offer", "أول عرض لك")}</h2><p>{t("Create a product, course, membership pass, ticket or bookable service.", "أنشئ منتجاً أو دورة أو عضوية أو تذكرة أو خدمة قابلة للحجز.")}</p></div><button type="button" className="lolz-money-primary" onClick={() => setTab("create")}><Plus size={17} /> {t("Create offer", "إنشاء عرض")}</button></div>
              </section>

              <section className="lolz-money-support">
                <div><Heart size={25} /><div><h3>{t("Support the development of LOLZ", "ادعم تطوير LOLZ")}</h3><p>{t("A voluntary contribution goes to the platform owner. It does not buy Premium or any extra privileges.", "المساهمة الطوعية تذهب إلى صاحب المنصة، ولا تشتري Premium أو امتيازات إضافية.")}</p></div></div>
                <form onSubmit={supportProject}><label>{t("Amount (€)", "المبلغ (€)")}<input name="amount" type="number" min="1" max="250" step="0.01" defaultValue="5" required /></label><button className="lolz-money-primary" disabled={busy === "support"}>{busy === "support" ? t("Opening PayPal…", "جارٍ فتح PayPal…") : t("Support LOLZ", "ادعم LOLZ")}</button></form>
              </section>

              <section className="lolz-money-panel lolz-money-tip-panel">
                <span className="lolz-money-eyebrow">{t("SUPPORT CREATORS", "ادعم المبدعين")}</span>
                <h2>{t("Send a creator tip", "أرسل دعماً لصانع محتوى")}</h2>
                <p>{t("Tips are optional. The creator receives the net amount after the disclosed 10% platform fee.", "الدعم اختياري. يحصل صانع المحتوى على صافي المبلغ بعد عمولة المنصة المعلنة 10%.")}</p>
                <form className="lolz-money-form" onSubmit={sendTip}>
                  <label>{t("Creator", "صانع المحتوى")}
                    <select required value={tipForm.creator_id} onChange={(event) => setTipForm((current) => ({ ...current, creator_id: event.target.value }))}>
                      <option value="">{t("Choose a creator", "اختر صانع محتوى")}</option>
                      {creatorChoices.map((creator) => <option key={creator.id} value={creator.id}>{creator.name}</option>)}
                    </select>
                  </label>
                  <label>{t("Tip amount (€)", "مبلغ الدعم (€)")}
                    <input type="number" min="1" max="250" step="0.01" value={tipForm.amount} onChange={(event) => setTipForm((current) => ({ ...current, amount: event.target.value }))} />
                  </label>
                  <button className="lolz-money-primary" disabled={busy === "tip" || creatorChoices.length === 0}>{busy === "tip" ? t("Opening PayPal…", "جارٍ فتح PayPal…") : t("Send with PayPal", "إرسال عبر PayPal")}</button>
                </form>
              </section>
            </>
          )}

          {tab === "offers" && (
            <section className="lolz-money-section">
              <div className="lolz-money-heading"><div><span className="lolz-money-eyebrow">{t("DISCOVER", "اكتشف")}</span><h2>{t("Marketplace", "السوق")}</h2><p>{t("Only buy items and services whose description and terms are clear.", "اشترِ المنتجات والخدمات التي يكون وصفها وشروطها واضحة فقط.")}</p></div></div>
              {publicOffers.length === 0 ? <Empty text={t("No offers are listed yet.", "لا توجد عروض منشورة بعد.")} /> : (
                <div className="lolz-money-offer-grid">
                  {publicOffers.map((offer) => {
                    const seller = profiles[offer.seller_id];
                    const kind = OFFER_TYPES.find((item) => item[0] === offer.offer_type);
                    return <article className="lolz-money-offer" key={offer.id}>
                      <div className="lolz-money-offer-kind">{kind ? (isArabic ? kind[1] : kind[2]) : offer.offer_type}</div>
                      <h3>{offer.title}</h3>
                      <p>{offer.description || t("No additional description.", "لا يوجد وصف إضافي.")}</p>
                      <div className="lolz-money-offer-meta"><span>{t("By", "بواسطة")} {seller?.display_name || seller?.username || t("LOLZ member", "عضو LOLZ")}</span>{offer.duration_days ? <span>{offer.duration_days} {t("days", "يوماً")}</span> : null}</div>
                      {offer.starts_at && <small><CalendarDays size={13} /> {friendlyDate(offer.starts_at, isArabic ? "ar" : "en")}</small>}
                      {offer.location && <small>{offer.location}</small>}
                      <div className="lolz-money-offer-bottom"><strong>{money(offer.price_cents, isArabic ? "ar" : "en")}</strong>
                        {offer.offer_type === "booking" ? <button type="button" onClick={() => requestBooking(offer)} disabled={busy === offer.id}>{t("Request booking", "طلب حجز")}</button> : <button type="button" onClick={() => void startCheckout(offer)} disabled={busy === offer.id}>{busy === offer.id ? t("Please wait…", "انتظر…") : t("Buy with PayPal", "اشترِ عبر PayPal")}</button>}
                      </div>
                      {offer.offer_type === "booking" && <div className="lolz-money-booking-fields"><input aria-label={t("Appointment date and time", "تاريخ ووقت الموعد")} type="datetime-local" value={bookingForm.requested_at} onChange={(event) => setBookingForm((current) => ({ ...current, requested_at: event.target.value }))} /><input aria-label={t("Booking note", "ملاحظة الحجز")} placeholder={t("Optional note", "ملاحظة اختيارية")} value={bookingForm.customer_note} onChange={(event) => setBookingForm((current) => ({ ...current, customer_note: event.target.value }))} /></div>}
                    </article>;
                  })}
                </div>
              )}
              <div className="lolz-money-subsection"><h3>{t("Your listings", "عروضك")}</h3>{myOffers.length === 0 ? <Empty text={t("You have not published an offer yet.", "لم تنشر أي عرض بعد.")} /> : myOffers.map((offer) => <div className="lolz-money-row" key={offer.id}><div><strong>{offer.title}</strong><small>{money(offer.price_cents, isArabic ? "ar" : "en")} · {statusLabel(offer.status)}</small></div><button type="button" onClick={() => void setOfferStatus(offer, offer.status === "active" ? "paused" : "active")} disabled={busy === offer.id}>{offer.status === "active" ? t("Pause", "إيقاف") : t("Activate", "تفعيل")}</button></div>)}</div>
            </section>
          )}

          {tab === "create" && (
            <div className="lolz-money-create-grid">
              <section className="lolz-money-panel">
                <span className="lolz-money-eyebrow">{t("SELL ON LOLZ", "بع على LOLZ")}</span><h2>{t("Create an offer", "إنشاء عرض")}</h2>
                <p>{t("Publish a clear offer with a fixed EUR price. Digital delivery and service fulfilment are handled by the seller after payment.", "انشر عرضاً واضحاً بسعر محدد باليورو. يتولى البائع تسليم المنتجات الرقمية أو تقديم الخدمة بعد الدفع.")}</p>
                <form className="lolz-money-form" onSubmit={createOffer}>
                  <label>{t("Offer type", "نوع العرض")}<select value={offerForm.offer_type} onChange={(event) => setOfferForm((current) => ({ ...current, offer_type: event.target.value }))}>{OFFER_TYPES.map(([value, ar, en]) => <option key={value} value={value}>{isArabic ? ar : en}</option>)}</select></label>
                  <label>{t("Title", "العنوان")}<input maxLength={100} required value={offerForm.title} onChange={(event) => setOfferForm((current) => ({ ...current, title: event.target.value }))} /></label>
                  <label>{t("Description and fulfilment terms", "الوصف وشروط التسليم")}<textarea maxLength={3000} rows={4} value={offerForm.description} onChange={(event) => setOfferForm((current) => ({ ...current, description: event.target.value }))} /></label>
                  <div className="lolz-money-form-two"><label>{t("Price (€)", "السعر (€)")}<input type="number" min="1" step="0.01" required value={offerForm.price} onChange={(event) => setOfferForm((current) => ({ ...current, price: event.target.value }))} /></label>
                    {["creator_membership", "community_access"].includes(offerForm.offer_type) && <label>{t("Pass duration (days)", "مدة العضوية (أيام)")}<input type="number" min="1" max="3650" value={offerForm.duration_days} onChange={(event) => setOfferForm((current) => ({ ...current, duration_days: event.target.value }))} /></label>}
                  </div>
                  {offerForm.offer_type === "event_ticket" && <label>{t("Event date and time", "تاريخ ووقت الفعالية")}<input type="datetime-local" value={offerForm.starts_at} onChange={(event) => setOfferForm((current) => ({ ...current, starts_at: event.target.value }))} /></label>}
                  {offerForm.offer_type === "booking" && <label>{t("Location or online meeting details", "الموقع أو تفاصيل اللقاء الإلكتروني")}<input maxLength={240} value={offerForm.location} onChange={(event) => setOfferForm((current) => ({ ...current, location: event.target.value }))} /></label>}
                  <button className="lolz-money-primary" disabled={busy === "offer"}><Plus size={16} /> {busy === "offer" ? t("Publishing…", "جارٍ النشر…") : t("Publish offer", "نشر العرض")}</button>
                </form>
              </section>

              <section className="lolz-money-panel">
                <span className="lolz-money-eyebrow">{t("PUBLIC SELLER PAGE", "صفحة البائع العامة")}</span><h2>{t("Business or creator profile", "ملف النشاط أو صانع المحتوى")}</h2>
                <p>{t("Tell customers who you are. A public profile is not a verified badge or a guarantee of quality.", "عرّف العملاء بنفسك. الملف العام ليس شارة توثيق أو ضماناً لجودة الخدمة.")}</p>
                <form className="lolz-money-form" onSubmit={saveMonetizationProfile}>
                  <label>{t("Account type", "نوع الحساب")}<select value={monetizationProfile.account_type} onChange={(event) => setMonetizationProfile((current) => ({ ...current, account_type: event.target.value }))}><option value="creator">{t("Creator", "صانع محتوى")}</option><option value="business">{t("Business", "نشاط تجاري")}</option></select></label>
                  <label>{t("Public display name", "الاسم الظاهر")}<input required maxLength={80} value={monetizationProfile.display_name} onChange={(event) => setMonetizationProfile((current) => ({ ...current, display_name: event.target.value }))} /></label>
                  <label>{t("About", "نبذة")}<textarea rows={4} maxLength={1200} value={monetizationProfile.description} onChange={(event) => setMonetizationProfile((current) => ({ ...current, description: event.target.value }))} /></label>
                  <label>{t("Website (HTTPS)", "الموقع الإلكتروني (HTTPS)")}<input type="url" placeholder="https://" value={monetizationProfile.website_url || ""} onChange={(event) => setMonetizationProfile((current) => ({ ...current, website_url: event.target.value }))} /></label>
                  <label className="lolz-money-check"><input type="checkbox" checked={monetizationProfile.is_public} onChange={(event) => setMonetizationProfile((current) => ({ ...current, is_public: event.target.checked }))} /> {t("Show this seller profile publicly", "إظهار ملف البائع للعامة")}</label>
                  <button className="lolz-money-primary" disabled={busy === "profile"}>{busy === "profile" ? t("Saving…", "جارٍ الحفظ…") : t("Save profile", "حفظ الملف")}</button>
                </form>
              </section>
            </div>
          )}

          {tab === "collabs" && (
            <div className="lolz-money-create-grid">
              <section className="lolz-money-panel">
                <span className="lolz-money-eyebrow">{t("FOR BRANDS", "للشركات")}</span><h2>{t("Find creators", "ابحث عن صناع محتوى")}</h2><p>{t("Publish a collaboration brief with a budget range. Creators can apply; you agree the final deliverables and terms directly.", "انشر طلب تعاون مع ميزانية محددة. يستطيع صناع المحتوى التقديم، وتتفقون مباشرة على التسليمات والشروط النهائية.")}</p>
                <form className="lolz-money-form" onSubmit={createBrief}>
                  <label>{t("Brief title", "عنوان الطلب")}<input required maxLength={120} value={briefForm.title} onChange={(event) => setBriefForm((current) => ({ ...current, title: event.target.value }))} /></label>
                  <label>{t("Deliverables and requirements", "المطلوب وشروط التعاون")}<textarea required rows={4} minLength={10} maxLength={3000} value={briefForm.description} onChange={(event) => setBriefForm((current) => ({ ...current, description: event.target.value }))} /></label>
                  <div className="lolz-money-form-two"><label>{t("Minimum budget (€)", "أقل ميزانية (€)")}<input type="number" min="1" step="0.01" value={briefForm.min} onChange={(event) => setBriefForm((current) => ({ ...current, min: event.target.value }))} /></label><label>{t("Maximum budget (€)", "أعلى ميزانية (€)")}<input type="number" min="1" step="0.01" value={briefForm.max} onChange={(event) => setBriefForm((current) => ({ ...current, max: event.target.value }))} /></label></div>
                  <button className="lolz-money-primary" disabled={busy === "brief"}><Plus size={16} /> {t("Publish collaboration brief", "نشر طلب التعاون")}</button>
                </form>
              </section>
              <section className="lolz-money-panel">
                <span className="lolz-money-eyebrow">{t("FOR CREATORS", "لصناع المحتوى")}</span><h2>{t("Open opportunities", "فرص التعاون المتاحة")}</h2>
                <label className="lolz-money-full-label">{t("Your pitch", "رسالتك للشركة")}<textarea rows={3} minLength={10} maxLength={2000} value={applicationPitch} onChange={(event) => setApplicationPitch(event.target.value)} placeholder={t("Explain why you are a good fit…", "اشرح لماذا أنت مناسب لهذا التعاون…")} /></label>
                {briefs.length === 0 ? <Empty text={t("No open briefs at the moment.", "لا توجد طلبات تعاون مفتوحة حالياً.")} /> : briefs.map((brief) => <article className="lolz-money-brief" key={brief.id}><h3>{brief.title}</h3><p>{brief.description}</p><strong>{money(brief.budget_min_cents, isArabic ? "ar" : "en")} – {money(brief.budget_max_cents, isArabic ? "ar" : "en")}</strong>{brief.advertiser_id !== user.id && <button type="button" onClick={() => void applyToBrief(brief)} disabled={busy === brief.id}>{t("Apply", "تقديم")}</button>}</article>)}
                {applications.length > 0 && <div className="lolz-money-subsection"><h3>{t("Your applications", "طلباتك")}</h3>{applications.map((item) => <div className="lolz-money-row" key={item.id}><span>{t("Application", "طلب تعاون")} · {statusLabel(item.status)}</span><small>{friendlyDate(item.created_at, isArabic ? "ar" : "en")}</small></div>)}</div>}
              </section>
            </div>
          )}

          {tab === "ads" && (
            <div className="lolz-money-create-grid">
              <section className="lolz-money-panel">
                <span className="lolz-money-eyebrow">{t("ADVERTISERS", "للمعلنين")}</span><h2>{t("Submit an ad campaign", "إرسال حملة إعلانية")}</h2><p>{t("Every campaign is submitted for human review. It is not charged or shown automatically from this form.", "تُرسل كل حملة للمراجعة البشرية. لا يتم تحصيل المال أو عرض الإعلان تلقائياً من هذا النموذج.")}</p>
                <form className="lolz-money-form" onSubmit={createCampaign}>
                  <label>{t("Campaign name", "اسم الحملة")}<input required maxLength={100} value={campaignForm.title} onChange={(event) => setCampaignForm((current) => ({ ...current, title: event.target.value }))} /></label>
                  <label>{t("Product or service description", "وصف المنتج أو الخدمة")}<textarea required minLength={10} rows={3} maxLength={1200} value={campaignForm.description} onChange={(event) => setCampaignForm((current) => ({ ...current, description: event.target.value }))} /></label>
                  <label>{t("Destination URL (HTTPS)", "رابط الوجهة (HTTPS)")}<input type="url" placeholder="https://" value={campaignForm.destination_url} onChange={(event) => setCampaignForm((current) => ({ ...current, destination_url: event.target.value }))} /></label>
                  <div className="lolz-money-form-two"><label>{t("Placement", "مكان الظهور")}<select value={campaignForm.placement} onChange={(event) => setCampaignForm((current) => ({ ...current, placement: event.target.value }))}><option value="feed">{t("Feed", "الخلاصة")}</option><option value="stories">{t("Stories", "القصص")}</option><option value="lolz">LOLZ</option></select></label><label>{t("Proposed budget (€)", "الميزانية المقترحة (€)")}<input type="number" min="5" step="0.01" value={campaignForm.budget} onChange={(event) => setCampaignForm((current) => ({ ...current, budget: event.target.value }))} /></label></div>
                  <button className="lolz-money-primary" disabled={busy === "campaign"}><Megaphone size={16} /> {t("Submit for review", "إرسال للمراجعة")}</button>
                </form>
              </section>
              <section className="lolz-money-panel">
                <span className="lolz-money-eyebrow">{t("CAMPAIGN STATUS", "حالة الحملات")}</span><h2>{t("Your campaigns", "حملاتك")}</h2>
                {campaigns.length === 0 ? <Empty text={t("You have no campaigns.", "ليس لديك حملات بعد.")} /> : campaigns.map((campaign) => <div className="lolz-money-row" key={campaign.id}><div><strong>{campaign.title}</strong><small>{campaign.placement} · {money(campaign.budget_cents, isArabic ? "ar" : "en")}</small></div><span className="lolz-money-status">{statusLabel(campaign.status)}</span></div>)}
                <p className="lolz-money-warning">{t("Prohibited products, misleading claims, gambling, interest-based finance and other harmful promotions are not accepted.", "لا تُقبل إعلانات المنتجات المحرمة أو الادعاءات المضللة أو القمار أو التمويل الربوي أو الترويج الضار.")}</p>
              </section>
            </div>
          )}

          {tab === "earnings" && (
            <>
              <div className="lolz-money-stats">
                <article><span>{t("Gross paid sales", "المبيعات المدفوعة")}</span><strong>{money(sellerPaid.reduce((sum, row) => sum + Number(row.amount_cents || 0), 0), isArabic ? "ar" : "en")}</strong></article>
                <article><span>{t("Platform fee", "عمولة المنصة")}</span><strong>{money(sellerPaid.reduce((sum, row) => sum + Number(row.platform_fee_cents || 0), 0), isArabic ? "ar" : "en")}</strong></article>
                <article><span>{t("Seller net", "صافي مستحقاتك")}</span><strong>{money(grossEarned, isArabic ? "ar" : "en")}</strong></article>
                <article><span>{t("Payouts requested", "طلبات السحب")}</span><strong>{payouts.length}</strong></article>
              </div>
              <section className="lolz-money-panel">
                <span className="lolz-money-eyebrow">{t("SELLER PAYOUT", "سحب الأرباح")}</span><h2>{t("Request a payout", "طلب سحب الأرباح")}</h2>
                <p>{t("The platform fee is currently 10% of paid orders. Payout requests are manually reviewed; no automatic bank or PayPal transfer is enabled yet.", "عمولة المنصة حالياً 10% من الطلبات المدفوعة. تخضع طلبات السحب للمراجعة اليدوية؛ ولا يوجد تحويل تلقائي إلى البنك أو PayPal حالياً.")}</p>
                <form className="lolz-money-form" onSubmit={requestPayout}>
                  <label>{t("Amount (€)", "المبلغ (€)")}<input type="number" min="1" max={(grossEarned / 100).toFixed(2)} step="0.01" required value={payoutAmount} onChange={(event) => setPayoutAmount(event.target.value)} /></label>
                  <label>{t("Optional note", "ملاحظة اختيارية")}<textarea rows={2} maxLength={800} value={payoutNote} onChange={(event) => setPayoutNote(event.target.value)} /></label>
                  <button className="lolz-money-primary" disabled={busy === "payout"}>{busy === "payout" ? t("Submitting…", "جارٍ الإرسال…") : t("Request manual review", "طلب مراجعة يدوية")}</button>
                </form>
              </section>
              <section className="lolz-money-section">
                <div className="lolz-money-heading"><h2>{t("Orders and payments", "الطلبات والمدفوعات")}</h2></div>
                {orders.length === 0 ? <Empty text={t("No orders yet.", "لا توجد طلبات بعد.")} /> : orders.map((order) => <div className="lolz-money-row" key={order.id}><div><strong>{order.title}</strong><small>{friendlyDate(order.created_at, isArabic ? "ar" : "en")} · {order.seller_id === user.id ? t("Sale", "مبيعة") : t("Purchase", "شراء")}</small></div><div className="lolz-money-order-end"><strong>{money(order.amount_cents, isArabic ? "ar" : "en")}</strong><span>{statusLabel(order.status)}</span></div></div>)}
                {payouts.length > 0 && <><h3>{t("Payout request history", "سجل طلبات السحب")}</h3>{payouts.map((row) => <div className="lolz-money-row" key={row.id}><strong>{money(row.amount_cents, isArabic ? "ar" : "en")}</strong><span>{statusLabel(row.status)}</span></div>)}</>}
              </section>
              <section className="lolz-money-section">
                <div className="lolz-money-heading"><h2>{t("Bookings", "الحجوزات")}</h2></div>
                {bookings.length === 0 ? <Empty text={t("No booking requests yet.", "لا توجد طلبات حجز بعد.")} /> : bookings.map((row) => <div className="lolz-money-row" key={row.id}><div><strong>{row.customer_id === user.id ? t("Your request", "طلبك") : t("Customer request", "طلب عميل")}</strong><small>{friendlyDate(row.requested_at, isArabic ? "ar" : "en")}</small></div><span>{statusLabel(row.status)}</span></div>)}
              </section>
            </>
          )}
        </>
      )}

      <footer className="lolz-money-footer">
        <span><Check size={14} /> {t("Transparent EUR pricing", "أسعار واضحة باليورو")}</span>
        <span><ShieldCheckIcon /> {t("Server-confirmed payments", "مدفوعات يؤكدها الخادم")}</span>
        <span><Clock3 size={14} /> {t("Seller fulfilment and payout review", "التسليم ومراجعة السحب بواسطة البائع والمنصة")}</span>
      </footer>
    </div>
  );
}

function ShieldCheckIcon() {
  return <BadgeCheck size={15} aria-hidden="true" />;
}

function Empty({ text }) {
  return <div className="lolz-money-empty"><Package size={18} /><span>{text}</span></div>;
}
