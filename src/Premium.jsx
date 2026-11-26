
import { useState } from "react";
import {
  Crown,
  Palette,
  HardDrive,
  UserRound,
  BadgeCheck,
  Heart,
  ShieldCheck,
  Check,
  Sparkles,
  X,
  CreditCard,
  CalendarCheck,
} from "lucide-react";
import "./Premium.css";

export default function Premium({
  isArabic = false,
  isPremium = false,
  subscriptionEnd = null,
  canCancelSubscription = false,
  onStartCheckout,
  onCancelSubscription,
  onSupport,
}) {
  const [modal, setModal] = useState("");
  const [notice, setNotice] = useState("");

  const t = (en, ar) => (isArabic ? ar : en);
  const formattedSubscriptionEnd = subscriptionEnd
    ? new Date(subscriptionEnd).toLocaleDateString(isArabic ? "ar" : "en", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  const features = [
    {
      icon: Palette,
      title: t("Exclusive themes", "ثيمات حصرية"),
      description: t(
        "Exclusive colors and themes for your profile.",
        "ألوان وثيمات حصرية لملفك الشخصي."
      ),
    },
    {
      icon: HardDrive,
      title: t("More media storage", "مساحة أكبر للوسائط"),
      description: t(
        "More space for your photos and videos.",
        "مساحة أكبر لحفظ الصور والفيديوهات."
      ),
    },
    {
      icon: UserRound,
      title: t("Profile customization", "تخصيص الملف الشخصي"),
      description: t(
        "Customize your profile your own way.",
        "خصص ملفك الشخصي بالطريقة التي تحبها."
      ),
    },
    {
      icon: BadgeCheck,
      title: t("Premium badge", "شارة Premium"),
      description: t(
        "Display a Premium badge next to your name.",
        "أظهر شارة Premium بجانب اسمك."
      ),
    },
    {
      icon: ShieldCheck,
      title: t("Ad-free experience", "تجربة بدون إعلانات"),
      description: t(
        "Enjoy LOLZ without advertisements.",
        "استمتع بـ LOLZ دون إعلانات."
      ),
    },
  ];

  const startCheckout = async () => {
    setModal("");

    if (onStartCheckout) {
      try {
        await onStartCheckout();
      } catch {
        setNotice(
          t(
            "Checkout could not be started. Please try again.",
            "تعذر بدء عملية الدفع. حاول مرة أخرى."
          )
        );
      }
    } else {
      setNotice(
        t(
          "Secure payment is not connected yet. No money has been charged.",
          "الدفع الآمن غير مربوط حتى الآن. لم يتم خصم أي مبلغ."
        )
      );
    }
  };

  const cancelSubscription = async () => {
    if (!onCancelSubscription) {
      setModal("");
      setNotice(
        t(
          "Subscription cancellation will be connected to your payment provider before launch.",
          "سيتم ربط إلغاء الاشتراك بنظام الدفع قبل إطلاق الميزة."
        )
      );
      return;
    }

    try {
      await onCancelSubscription();
      setModal("");
      setNotice(
        t(
          "Your cancellation request was submitted.",
          "تم إرسال طلب إلغاء اشتراكك."
        )
      );
    } catch {
      setNotice(
        t(
          "Could not cancel your subscription. Please try again.",
          "تعذر إلغاء الاشتراك. حاول مرة أخرى."
        )
      );
    }
  };

  const supportProject = async () => {
    if (!onSupport) {
      setNotice(
        t(
          "Voluntary support payments will be available soon.",
          "سيكون الدعم الطوعي متاحاً قريباً."
        )
      );
      return;
    }

    try {
      await onSupport();
    } catch {
      setNotice(
        t(
          "Support could not be started. Please try again.",
          "تعذر بدء عملية الدعم. حاول مرة أخرى."
        )
      );
    }
  };

  return (
    <div className="premium-page">
      <section className="premium-hero">
        <div className="premium-hero-content">
          <div className="premium-label">
            <Crown size={17} />
            LOLZ PREMIUM
          </div>

          <h1>
            {t("Make LOLZ yours.", "اجعل LOLZ عالمك الخاص.")}
          </h1>

          <p>
            {t(
              "Unlock more ways to express yourself and enjoy the full LOLZ experience.",
              "استمتع بمزايا إضافية وخصص تجربتك داخل LOLZ."
            )}
          </p>

          <div className="premium-price">
            <strong>€2.99</strong>
            <span>{t("/ month", "/ شهرياً")}</span>
          </div>

          {isPremium ? (
            <div className="premium-active">
              <BadgeCheck size={20} />
              {t("Your Premium is active", "اشتراكك Premium فعّال")}
            </div>
          ) : (
            <button
              className="premium-primary-btn"
              onClick={() => setModal("checkout")}
            >
              <Crown size={19} />
              {t("Get Premium", "اشترك في Premium")}
            </button>
          )}

          <small>
            {t(
              "Cancel anytime. No hidden fees.",
              "يمكنك الإلغاء في أي وقت. لا توجد رسوم مخفية."
            )}
          </small>
        </div>

        <div className="premium-hero-art">
          <div className="premium-crown-circle">
            <Crown size={76} strokeWidth={1.5} />
            <Sparkles className="premium-sparkle" size={25} />
          </div>
          <span>LOLZ</span>
          <strong>PREMIUM</strong>
        </div>
      </section>

      {notice && (
        <div className="premium-notice" role="status">
          <span>{notice}</span>
          <button
            onClick={() => setNotice("")}
            aria-label="Close notification"
          >
            <X size={17} />
          </button>
        </div>
      )}

      {isPremium && (
        <section className="premium-subscription-card">
          <div className="premium-subscription-icon">
            <CalendarCheck size={25} />
          </div>

          <div className="premium-subscription-info">
            <h3>{t("Your subscription", "اشتراكك")}</h3>
            <p>
              {formattedSubscriptionEnd
                ? t(
                    `Your Premium access is scheduled until ${formattedSubscriptionEnd}.`,
                    `ستستمر مزايا Premium حتى ${formattedSubscriptionEnd}.`
                  )
                : t(
                    "Your Premium subscription is active.",
                    "اشتراك Premium الخاص بك فعّال."
                  )}
            </p>
          </div>

          {canCancelSubscription && (
            <button
              className="premium-cancel-btn"
              onClick={() => setModal("cancel")}
            >
              {t("Cancel subscription", "إلغاء الاشتراك")}
            </button>
          )}
        </section>
      )}

      <section className="premium-features">
        <div className="premium-section-heading">
          <span>{t("THE BENEFITS", "المميزات")}</span>
          <h2>{t("Your Premium experience", "تجربتك المميزة")}</h2>
          <p>
            {t(
              "Everything you need to make your experience better.",
              "كل ما تحتاجه لجعل تجربتك أفضل."
            )}
          </p>
        </div>

        <div className="premium-feature-grid">
          {features.map((feature) => {
            const Icon = feature.icon;

            return (
              <article
                className="premium-feature-card"
                key={feature.title}
              >
                <div className="premium-feature-icon">
                  <Icon size={23} />
                </div>

                <div>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                </div>

                <Check
                  className="premium-feature-check"
                  size={19}
                />
              </article>
            );
          })}
        </div>
      </section>

      <section className="premium-support">
        <div className="premium-support-icon">
          <Heart size={27} />
        </div>

        <div className="premium-support-content">
          <span>{t("SUPPORT THE PROJECT", "ادعم المشروع")}</span>
          <h2>{t("Support LOLZ", "ادعم LOLZ")}</h2>
          <p>
            {t(
              "Support the development of LOLZ voluntarily. Every contribution helps us improve the platform.",
              "ساهم طوعياً في تطوير LOLZ. كل مساهمة تساعدنا على تحسين المنصة."
            )}
          </p>
        </div>

        <button
          className="premium-support-btn"
          onClick={supportProject}
        >
          <Heart size={17} />
          {t("Support us", "ادعمنا")}
        </button>
      </section>

      {modal && (
        <div
          className="premium-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setModal("");
            }
          }}
        >
          <div
            className="premium-modal"
            role="dialog"
            aria-modal="true"
          >
            <button
              className="premium-modal-close"
              onClick={() => setModal("")}
              aria-label="Close"
            >
              <X size={20} />
            </button>

            {modal === "checkout" && (
              <>
                <div className="premium-modal-icon">
                  <CreditCard size={30} />
                </div>

                <h2>
                  {t("Confirm Premium", "تأكيد Premium")}
                </h2>

                <p>
                  {t(
                    "LOLZ Premium costs €2.99 per month.",
                    "تكلفة اشتراك LOLZ Premium هي €2.99 شهرياً."
                  )}
                </p>

                <div className="premium-modal-price">
                  €2.99 <span>{t("/ month", "/ شهرياً")}</span>
                </div>

                <div className="premium-modal-actions">
                  <button
                    className="premium-primary-btn"
                    onClick={startCheckout}
                  >
                    {t("Continue to payment", "المتابعة إلى الدفع")}
                  </button>

                  <button
                    className="premium-secondary-btn"
                    onClick={() => setModal("")}
                  >
                    {t("Cancel payment", "إلغاء الدفع")}
                  </button>
                </div>

                <small>
                  {t(
                    "You will be redirected to PayPal's secure checkout. Premium activates after PayPal confirms your subscription.",
                    "سيتم تحويلك إلى صفحة الدفع الآمنة في PayPal. يتم تفعيل Premium بعد تأكيد الاشتراك من PayPal."
                  )}
                </small>
              </>
            )}

            {modal === "cancel" && (
              <>
                <div className="premium-modal-icon cancel-icon">
                  <X size={30} />
                </div>

                <h2>
                  {t(
                    "Cancel your subscription?",
                    "هل تريد إلغاء اشتراكك؟"
                  )}
                </h2>

                <p>
                  {t(
                    "Your Premium benefits should remain available until the end of your paid billing period. You will not be charged for the next period after cancellation is confirmed.",
                    "من المفترض أن تستمر مزايا Premium حتى نهاية الفترة المدفوعة. لن يتم تحصيل رسوم الفترة التالية بعد تأكيد الإلغاء."
                  )}
                </p>

                <div className="premium-modal-actions">
                  <button
                    className="premium-danger-btn"
                    onClick={cancelSubscription}
                  >
                    {t("Confirm cancellation", "تأكيد الإلغاء")}
                  </button>

                  <button
                    className="premium-secondary-btn"
                    onClick={() => setModal("")}
                  >
                    {t("Keep Premium", "الاحتفاظ بـ Premium")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
