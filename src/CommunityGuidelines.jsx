import { BookOpenCheck, Flag, HeartHandshake, ShieldCheck } from "lucide-react";
import "./CommunityGuidelines.css";

const COPY = {
  ar: {
    eyebrow: "قيم مجتمعنا",
    title: "قواعد مجتمع LOLZ",
    intro: "نريد أن تكون LOLZ مساحة محترمة وآمنة للتواصل والمشاركة والتعلّم. تنطبق القواعد على المنشورات والقصص والفيديوهات والتعليقات والرسائل والمجموعات والقنوات.",
    sections: [
      {
        title: "محتوى ممنوع",
        icon: ShieldCheck,
        items: [
          "العري والمحتوى الإباحي أو الجنسي الصريح أو الدعوات إليه.",
          "بيع المخدرات أو الترويج لها أو تسهيل الحصول عليها.",
          "الإعلانات والدعوات إلى القمار والمراهنات أو روابطها.",
          "التهديدات والتحريض على العنف وخطاب الكراهية والتنمر والتحرش.",
          "الاحتيال والروابط الخادعة والرسائل المزعجة وانتحال الشخصية.",
          "نشر المعلومات الخاصة أو الصور الشخصية للآخرين دون موافقتهم.",
        ],
      },
      {
        title: "ما نرحّب به",
        icon: HeartHandshake,
        items: [
          "النقاش المحترم والمحتوى المفيد والإبداعي والتعليمي.",
          "التوعية والتحذير والتعافي من السلوكيات الضارة، ما دام المحتوى لا يروّج لها.",
          "اختلاف الآراء دون إساءة أو تهديد أو تحقير للآخرين.",
        ],
      },
      {
        title: "كيف نحافظ على المجتمع؟",
        icon: Flag,
        items: [
          "افحص LOLZ النصوص والوسائط المدعومة قبل نشرها عند تفعيل خدمة الفحص.",
          "يمكنك الإبلاغ بسرية عن منشور أو فيديو أو تعليق أو حساب.",
          "يراجع المشرفون البلاغات، ويمكنهم إزالة المحتوى المخالف أو إرسال تحذير أو تعليق الحساب.",
          "قد يؤدي تكرار المخالفات أو خطورتها إلى إيقاف الحساب.",
        ],
      },
    ],
    noteTitle: "ملاحظة حول الفحص",
    note: "الفلترة الآلية وسيلة مساعدة وليست ضماناً لاكتشاف كل مخالفة. لا يدعم الفحص الحالي تحليل الرسائل الصوتية، وقد تفوت الفلاتر بعض الحالات أو تخطئ في بعضها. لذلك تبقى البلاغات والمراجعة البشرية مهمة.",
    closing: "بمشاركتك في LOLZ، ساعدنا في إبقاء المجتمع محترماً وآمناً للجميع.",
    report: "الإبلاغ عن مخالفة",
  },
  en: {
    eyebrow: "OUR COMMUNITY VALUES",
    title: "LOLZ Community Guidelines",
    intro: "LOLZ should be a respectful and safe place to connect, share, and learn. These rules apply to posts, stories, videos, comments, messages, groups, and channels.",
    sections: [
      {
        title: "Prohibited content",
        icon: ShieldCheck,
        items: [
          "Nudity, pornography, explicit sexual content, or invitations to it.",
          "Selling, promoting, or arranging access to illegal drugs.",
          "Gambling and betting advertisements, invitations, or links.",
          "Threats, incitement to violence, hate speech, bullying, or harassment.",
          "Scams, deceptive links, spam, or impersonation.",
          "Sharing another person's private information or intimate images without consent.",
        ],
      },
      {
        title: "What we welcome",
        icon: HeartHandshake,
        items: [
          "Respectful discussion and useful, creative, and educational content.",
          "Awareness, warnings, and recovery discussions that do not promote harmful activity.",
          "Different opinions expressed without abuse, threats, or humiliation.",
        ],
      },
      {
        title: "How we protect the community",
        icon: Flag,
        items: [
          "Supported text and media are screened before publishing when the moderation service is enabled.",
          "You can privately report a post, video, comment, or account.",
          "Moderators review reports and may remove content, issue warnings, or suspend accounts.",
          "Repeated or severe violations may lead to account suspension.",
        ],
      },
    ],
    noteTitle: "About automated screening",
    note: "Automated screening helps but cannot guarantee that every violation will be detected. Current screening does not analyze voice messages, and automated checks may miss or misclassify some content. Reports and human review remain important.",
    closing: "By using LOLZ, help us keep the community respectful and safe for everyone.",
    report: "Report a violation",
  },
};

export default function CommunityGuidelines({ isArabic = false, onReport }) {
  const copy = isArabic ? COPY.ar : COPY.en;
  return (
    <main className="lolz-guidelines" dir={isArabic ? "rtl" : "ltr"}>
      <header className="lolz-guidelines-hero">
        <span className="eyebrow"><BookOpenCheck size={15} /> {copy.eyebrow}</span>
        <h1>{copy.title}</h1>
        <p>{copy.intro}</p>
      </header>

      <div className="lolz-guidelines-grid">
        {copy.sections.map((section) => {
          const Icon = section.icon;
          return (
            <section className="lolz-guideline-card" key={section.title}>
              <div className="lolz-guideline-title">
                <span><Icon size={20} /></span>
                <h2>{section.title}</h2>
              </div>
              <ul>
                {section.items.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </section>
          );
        })}
      </div>

      <aside className="lolz-guidelines-note">
        <strong>{copy.noteTitle}</strong>
        <p>{copy.note}</p>
      </aside>

      <footer className="lolz-guidelines-footer">
        <strong>{copy.closing}</strong>
        <button type="button" className="secondary-button" onClick={onReport}>
          <Flag size={16} /> {copy.report}
        </button>
      </footer>
    </main>
  );
}
