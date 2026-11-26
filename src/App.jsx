import Groups from "./Groups";
import Channels from "./Channels";
import PreferencesSettings from "./PreferencesSettings";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { supabase } from "./supabase";
import { MessageCircle, Heart, UsersRound, Radio, Bookmark, Search, SquarePen, Phone, Video, Info, ImagePlus, Send, Mic, ArrowLeft, X } from "lucide-react";
import Navigation from "./Navigation";
import Lolz from "./Lolz";
import "./App.css";
import "./InstagramRedesign.css";
import "./InstagramExperience.css";
import "./InstagramDirect.css";
import "./InstagramMobile.css";
import Calls from "./Calls";
import Premium from "./Premium";
import StoryViewer from "./StoryViewer";
import ModerationDialog from "./ModerationDialog";
import "./ModerationPage.css";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

const translations = {
  "Please sign in to continue.": "يرجى تسجيل الدخول للمتابعة.",
  "Recently": "مؤخراً",
  "Just now": "الآن",
  "Your profile": "ملفك الشخصي",
  "Could not start the application.": "تعذر تشغيل التطبيق.",
  "Could not load posts: ": "تعذر تحميل المنشورات: ",
  "Write something or choose an image first.": "اكتب شيئاً أو اختر صورة أولاً.",
  "Please sign in first.": "يرجى تسجيل الدخول أولاً.",
  "Your post has been published.": "تم نشر منشورك بنجاح.",
  "Could not publish your post.": "تعذر نشر المنشور.",
  "Please sign in to like posts.": "يرجى تسجيل الدخول للإعجاب بالمنشورات.",
  "Please sign in to comment.": "يرجى تسجيل الدخول للتعليق.",
  "Choose a photo or video for your story.": "اختر صورة أو فيديو لقصتك.",
  "Your story is now live for 24 hours.": "قصتك متاحة الآن لمدة 24 ساعة.",
  "Could not publish story.": "تعذر نشر القصة.",
  "People search error: ": "حدث خطأ أثناء البحث عن الأشخاص: ",
  "Follow error: ": "حدث خطأ أثناء المتابعة: ",
  "Could not open profile: ": "تعذر فتح الملف الشخصي: ",
  "Could not load notifications: ": "تعذر تحميل الإشعارات: ",
  "Could not update notification: ": "تعذر تحديث الإشعار: ",
  "Could not load conversations: ": "تعذر تحميل المحادثات: ",
  "Could not load messages: ": "تعذر تحميل الرسائل: ",
  "Could not open conversation: ": "تعذر فتح المحادثة: ",
  "Could not send message: ": "تعذر إرسال الرسالة: ",
  "Please choose an image or video.": "يرجى اختيار صورة أو فيديو.",
  "Maximum file size is 100 MB.": "الحد الأقصى لحجم الملف هو 100 ميغابايت.",
  "Only images and videos are allowed.": "يُسمح بالصور والفيديوهات فقط.",
  "Could not upload the media file.": "تعذر رفع الملف.",
  "Profile updated successfully.": "تم تحديث الملف الشخصي بنجاح.",
  "Profile photo updated.": "تم تحديث الصورة الشخصية.",
  "Search people by name or username...": "ابحث عن الأشخاص بالاسم أو اسم المستخدم...",
  "Search posts and people...": "ابحث في المنشورات والأشخاص...",
  "YOUR WORLD. YOUR PEOPLE.": "عالمك. وأصدقاؤك.",
  "Welcome back": "مرحباً بعودتك",
  "Your space. Your stories. Your community.": "مساحتك. قصصك. مجتمعك.",
  "MOMENTS": "لحظات",
  "Stories": "القصص",
  "Disappear after 24 hours": "تختفي بعد 24 ساعة",
  "Your story": "قصتك",
  "Share story": "نشر القصة",
  "Uploading...": "جارٍ الرفع...",
  "Cancel": "إلغاء",
  "What's happening in your world?": "ماذا يحدث في عالمك؟",
  "Photo": "صورة",
  "Publishing...": "جارٍ النشر...",
  "Publish": "نشر",
  "THE COMMUNITY": "المجتمع",
  "Your feed": "آخر المنشورات",
  "posts": "منشورات",
  "FIND YOUR COMMUNITY": "اعثر على مجتمعك",
  "Discover": "استكشف",
  "Explore posts from the LOLZ community.": "اكتشف منشورات مجتمع LOLZ.",
  "GROW YOUR COMMUNITY": "وسّع مجتمعك",
  "Discover people": "اكتشف الأشخاص",
  "Find people and connect with the community.": "اعثر على أشخاص وتواصل مع المجتمع.",
  "Search by name or username...": "ابحث بالاسم أو اسم المستخدم...",
  "Search": "بحث",
  "Searching for people...": "جارٍ البحث عن الأشخاص...",
  "No people found": "لم يتم العثور على أشخاص",
  "Try another name or username.": "جرّب اسماً أو اسم مستخدم آخر.",
  "Member": "عضو",
  "Following": "تتابعه",
  "Follow": "متابعة",
  "Please wait...": "يرجى الانتظار...",
  "LOLZ MEMBER": "عضو في LOLZ",
  "Message": "مراسلة",
  "Back": "رجوع",
  "No bio yet.": "لا توجد نبذة بعد.",
  "Posts": "المنشورات",
  "Followers": "المتابعون",
  "Following count": "يتابع",
  "YOUR COLLECTION": "مجموعتك",
  "Saved posts": "المنشورات المحفوظة",
  "Edit photo": "تغيير الصورة",
  "Close editor": "إغلاق التعديل",
  "Edit profile": "تعديل الملف الشخصي",
  "Tell the community something about yourself.": "أخبر المجتمع قليلاً عن نفسك.",
  "Display name": "الاسم الظاهر",
  "Your name": "اسمك",
  "Username": "اسم المستخدم",
  "Bio": "نبذة",
  "Write a little about yourself...": "اكتب نبذة قصيرة عن نفسك...",
  "Website": "الموقع الإلكتروني",
  "Save changes": "حفظ التغييرات",
  "Saving...": "جارٍ الحفظ...",
  "Your posts": "منشوراتك",
  "PRIVATE CONVERSATIONS": "محادثات خاصة",
  "Messages": "الرسائل",
  "Your chats": "محادثاتك",
  "Refresh": "تحديث",
  "Loading conversations...": "جارٍ تحميل المحادثات...",
  "No conversations yet. Visit someone's profile and press Message to start a chat.": "لا توجد محادثات بعد. افتح الملف الشخصي لشخص ما واضغط على مراسلة لبدء محادثة.",
  "Start a conversation": "ابدأ محادثة",
  "Private conversation": "محادثة خاصة",
  "Loading messages...": "جارٍ تحميل الرسائل...",
  "No messages yet. Say hello!": "لا توجد رسائل بعد. قل مرحباً!",
  "Remove": "إزالة",
  "Write a message...": "اكتب رسالة...",
  "Sending...": "جارٍ الإرسال...",
  "Send": "إرسال",
  "Images and videos only · Maximum 100 MB": "الصور والفيديوهات فقط · الحد الأقصى 100 ميغابايت",
  "Your private messages": "رسائلك الخاصة",
  "Choose a conversation or visit a person's profile and press Message.": "اختر محادثة أو افتح الملف الشخصي لشخص واضغط على مراسلة.",
  "STAY IN THE LOOP": "ابقَ على اطلاع",
  "Notifications": "الإشعارات",
  "You have": "لديك",
  "unread notifications.": "إشعارات غير مقروءة.",
  "You're all caught up.": "أنت على اطلاع بكل جديد.",
  "Mark all as read": "تحديد الكل كمقروء",
  "Loading notifications...": "جارٍ تحميل الإشعارات...",
  "No notifications yet": "لا توجد إشعارات بعد",
  "Likes, comments and new followers will appear here.": "ستظهر هنا الإعجابات والتعليقات والمتابعون الجدد.",
  "liked your post.": "أُعجب بمنشورك.",
  "commented on your post.": "علّق على منشورك.",
  "started following you.": "بدأ بمتابعتك.",
  "interacted with you.": "تفاعل معك.",
  "Read": "قراءة",
  "PERSONALIZE YOUR EXPERIENCE": "خصص تجربتك",
  "Nothing here yet": "لا يوجد شيء هنا بعد",
  "When posts are available, they will appear here.": "عندما تتوفر منشورات، ستظهر هنا.",
  "likes": "إعجاب",
  "View comments": "عرض التعليقات",
  "Comments": "التعليقات",
  "More options": "خيارات إضافية",
  "Loading profile...": "جارٍ تحميل الملف الشخصي...",
  "Like": "إعجاب",
  "Comment": "تعليق",
  "Saved": "محفوظ",
  "Save": "حفظ",
  "Write a comment...": "اكتب تعليقاً...",
  "No bio yet": "لا توجد نبذة بعد",
  "Photo message": "صورة",
  "Video message": "فيديو",
  "Voice message": "رسالة صوتية",
  "Someone": "شخص ما",
  "Edit": "تعديل",
  "Recording...": "جارٍ التسجيل...",
};


function useTranslation() {
  const savedLang =
    typeof window !== "undefined"
      ? localStorage.getItem("lolz_lang") || document.documentElement.lang
      : "ar";

  const isArabic = savedLang !== "en";

  const t = useCallback((value) => {
    if (!isArabic || !value) return value;
    return translations[value] || value;
  }, [isArabic]);

  return { t, isArabic };
}


function timeAgo(date, isArabic = true) {
  if (!date) return isArabic ? "مؤخراً" : "Recently";

  const seconds = Math.floor(
    (Date.now() - new Date(date).getTime()) / 1000
  );

  if (seconds < 60) return isArabic ? "الآن" : "Just now";
  if (seconds < 3600) {
    const value = Math.floor(seconds / 60);
    return isArabic ? `منذ ${value} د` : `${value}m ago`;
  }
  if (seconds < 86400) {
    const value = Math.floor(seconds / 3600);
    return isArabic ? `منذ ${value} س` : `${value}h ago`;
  }

  const value = Math.floor(seconds / 86400);
  return isArabic ? `منذ ${value} يوم` : `${value}d ago`;
}

function Avatar({ url, name, size = "normal" }) {
  return (
    <div className={`avatar avatar-${size}`}>
      {url ? (
        <img src={url} alt={name || ""} />
      ) : (
        (name || "U").charAt(0).toUpperCase()
      )}
    </div>
  );
}

export default function App() {
  const { t, isArabic } = useTranslation();
  const [isPremium, setIsPremium] = useState(false);
  const [subscriptionInfo, setSubscriptionInfo] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    document.documentElement.lang = isArabic ? "ar" : "en";
    document.documentElement.dir = isArabic ? "rtl" : "ltr";
  }, [isArabic]);

  useEffect(() => {
    if (!user?.id || !Capacitor.isNativePlatform()) return;

    let active = true;
    const listeners = [];

    async function setupPushNotifications() {
      try {
        let permission = await PushNotifications.checkPermissions();

        if (permission.receive !== "granted") {
          permission = await PushNotifications.requestPermissions();
        }

        if (permission.receive !== "granted") {
          return;
        }

        listeners.push(
          await PushNotifications.addListener("registration", async (token) => {
            if (!active) return;

            const { error } = await supabase
              .from("push_tokens")
              .upsert(
                {
                  user_id: user.id,
                  token: token.value,
                  platform: Capacitor.getPlatform(),
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "token" }
              );

            if (error) console.error("Saving push token failed:", error);
          })
        );

        listeners.push(
          await PushNotifications.addListener("registrationError", (error) => {
            console.error("Push registration error:", error);
          })
        );

        await PushNotifications.register();
      } catch (error) {
        console.error("Push setup failed:", error);
      }
    }

    setupPushNotifications();

    return () => {
      active = false;
      listeners.forEach((listener) => listener.remove());
    };
  }, [user?.id]);

  const [posts, setPosts] = useState([]);
  const [stories, setStories] = useState([]);
  const [activeStoryId, setActiveStoryId] = useState(null);
  const closeStoryViewer = useCallback(() => setActiveStoryId(null), []);
  const [likedPosts, setLikedPosts] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]);

  const [activePage, setActivePage] = useState("home");
  const [search, setSearch] = useState("");

  const [newPost, setNewPost] = useState("");
  const [postFile, setPostFile] = useState(null);
  const [storyFile, setStoryFile] = useState(null);

  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [openComments, setOpenComments] = useState(null);

  const [people, setPeople] = useState([]);
  const [followingIds, setFollowingIds] = useState([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [followBusy, setFollowBusy] = useState([]);

  const [selectedProfile, setSelectedProfile] = useState(null);
  const [selectedProfilePosts, setSelectedProfilePosts] = useState([]);
  const [blockedUserIds, setBlockedUserIds] = useState([]);
  const [blockedProfiles, setBlockedProfiles] = useState([]);
  const [blockedLoading, setBlockedLoading] = useState(false);
  const [moderationTarget, setModerationTarget] = useState(null);
  const [moderationReports, setModerationReports] = useState([]);
  const [moderationLoading, setModerationLoading] = useState(false);
  const [selectedProfileStats, setSelectedProfileStats] = useState({
    followers: 0,
    following: 0,
  });
  const [profileLoading, setProfileLoading] = useState(false);

  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [conversationMessages, setConversationMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messageSending, setMessageSending] = useState(false);
  const [messageSearch, setMessageSearch] = useState("");

  // CENTRAL CALL CONTEXT
  const [selectedCallContext, setSelectedCallContext] = useState(null);
  const [activeCallContext, setActiveCallContext] = useState(null);

  const handleCallContextChange = useCallback((context) => {
    setSelectedCallContext(context);
  }, []);

  const handleCallStateChange = useCallback(({ status, context }) => {
    if (status === "connecting" || status === "active") {
      setActiveCallContext(context);
    }

    if (status === "ended") {
      setActiveCallContext(null);
      if (context) setSelectedCallContext(context);
    }
  }, []);

  const currentCallContext = activeCallContext || selectedCallContext;
  const callContextPage =
    currentCallContext?.callType === "private"
      ? "messages"
      : currentCallContext?.callType === "group"
        ? "groups"
        : currentCallContext?.callType === "channel"
          ? "channels"
          : null;
  const showIdleCallControls =
    activePage === callContextPage &&
    (currentCallContext?.callType !== "private" || Boolean(activeConversation?.id));
  const callActionsRef = useRef(null);

  const registerPrivateCallActions = useCallback((actions) => {
    callActionsRef.current = actions;
  }, []);

  const voicePressActiveRef = useRef(false);
  const [messageFile, setMessageFile] = useState(null);
  const [messageFilePreview, setMessageFilePreview] = useState("");
  const [voiceFile, setVoiceFile] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voiceFilePreview, setVoiceFilePreview] = useState("");
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const [notifications, setNotifications] = useState([]);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const voiceCancelledRef = useRef(false);
  const [followStats, setFollowStats] = useState({
    followers: 0,
    following: 0,
  });

  const [editProfile, setEditProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    display_name: "",
    username: "",
    bio: "",
    website: "",
  });

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const postInput = useRef(null);
  const storyInput = useRef(null);
  const imageInput = useRef(null);
  const messageMediaInput = useRef(null);
  const messagesEndRef = useRef(null);
  const shouldAutoScrollRef = useRef(true);

  useEffect(() => {
    if (activePage === "messages" && activeConversation?.id) {
      setSelectedCallContext({
        callType: "private",
        conversation: activeConversation,
        groupId: null,
        channelId: null,
        canStart: true,
        canEnd: false,
      });
    }
  }, [activePage, activeConversation]);

  useEffect(() => {
    if (!isRecording) {
      setRecordingSeconds(0);
      return;
    }

    const timer = setInterval(() => {
      setRecordingSeconds((seconds) => seconds + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isRecording]);

  useEffect(() => {
    if (!voiceFile) {
      setVoiceFilePreview("");
      return;
    }

    const previewUrl = URL.createObjectURL(voiceFile);
    setVoiceFilePreview(previewUrl);

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [voiceFile]);

  useEffect(() => {
    if (!messageFile) {
      setMessageFilePreview("");
      return;
    }

    const previewUrl = URL.createObjectURL(messageFile);
    setMessageFilePreview(previewUrl);

    return () => URL.revokeObjectURL(previewUrl);
  }, [messageFile]);

  const loadPremiumStatus = useCallback(async (userId, accountRole = null) => {
    if (!userId) {
      setIsPremium(false);
      setSubscriptionInfo(null);
      return;
    }

    if (accountRole === "admin" || accountRole === "owner") {
      setIsPremium(true);
      setSubscriptionInfo(null);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("lolz_subscriptions")
        .select("status,paypal_subscription_id,next_billing_time,cancelled_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      const status = String(data?.status || "").toLowerCase();
      const accessEnd = data?.next_billing_time
        ? new Date(data.next_billing_time).getTime()
        : 0;
      const isWithinPaidPeriod =
        status === "cancelled" &&
        Number.isFinite(accessEnd) &&
        accessEnd > Date.now();

      setSubscriptionInfo(data || null);
      setIsPremium(status === "active" || isWithinPaidPeriod);
    } catch (error) {
      console.error("Premium status error:", error);
      setIsPremium(false);
      setSubscriptionInfo(null);
    }
  }, []);

  const loadPosts = useCallback(async (userId) => {
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setNotice(t("Could not load posts: ") + error.message);
      return;
    }

    const postRows = data || [];
    const userIds = [...new Set(postRows.map((post) => post.user_id))];
    const postIds = postRows.map((post) => post.id);

    let profileMap = {};
    let likes = [];

    if (userIds.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .in("id", userIds);

      (profiles || []).forEach((item) => {
        profileMap[item.id] = item;
      });
    }

    if (postIds.length) {
      const { data: allLikes } = await supabase
        .from("post_likes")
        .select("post_id,user_id")
        .in("post_id", postIds);

      likes = allLikes || [];
    }

    setLikedPosts(
      likes
        .filter((like) => like.user_id === userId)
        .map((like) => like.post_id)
    );

    setPosts(
      postRows.map((post) => ({
        ...post,
        author: profileMap[post.user_id] || {},
        likesCount: likes.filter(
          (like) => like.post_id === post.id
        ).length,
      }))
    );
  }, [t]);

  const loadStories = useCallback(async () => {
    const { data, error } = await supabase
      .from("stories")
      .select("*")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (error || !data) return;

    const { data: authData } = await supabase.auth.getUser();
    const currentUserId = authData?.user?.id;

    let blockedIds = [];
    if (currentUserId) {
      const { data: blocks, error: blocksError } = await supabase
        .from("user_blocks")
        .select("blocked_id")
        .eq("blocker_id", currentUserId);

      if (!blocksError) blockedIds = (blocks || []).map((item) => item.blocked_id);
    }

    const visibleStories = data.filter(
      (story) => !blockedIds.includes(story.user_id)
    );

    const userIds = [...new Set(visibleStories.map((story) => story.user_id))];
    let profileMap = {};

    if (userIds.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .in("id", userIds);

      (profiles || []).forEach((item) => {
        profileMap[item.id] = item;
      });
    }

    const ownStories = visibleStories.filter((story) => story.user_id === currentUserId);
    const viewCounts = new Map();

    await Promise.all(
      ownStories.map(async (story) => {
        const { data: viewers, error: viewersError } = await supabase.rpc(
          "get_lolz_story_viewers",
          { p_story_id: String(story.id) }
        );
        if (!viewersError) viewCounts.set(String(story.id), viewers?.length || 0);
      })
    );

    setStories(
      visibleStories.map((story) => ({
        ...story,
        view_count: viewCounts.get(String(story.id)) || 0,
        author: profileMap[story.user_id] || {},
      }))
    );
  }, []);

  const recordStoryView = useCallback(async (story) => {
    if (!user?.id || !story?.id || story.user_id === user.id) return;

    const { error } = await supabase
      .from("story_views")
      .upsert(
        {
          story_id: String(story.id),
          viewer_id: user.id,
          viewed_at: new Date().toISOString(),
        },
        { onConflict: "story_id,viewer_id", ignoreDuplicates: true }
      );

    if (error) {
      console.warn("Could not record story view:", error.message);
    }
  }, [user?.id]);

  const loadFollowing = useCallback(async (userId) => {
    if (!userId) return;

    const { data, error } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", userId);

    if (error) {
      console.error("Following error:", error.message);
      return;
    }

    setFollowingIds((data || []).map((item) => item.following_id));
  }, []);

  const loadBlockedUsers = useCallback(async (userId) => {
    if (!userId) return;

    const { data, error } = await supabase
      .from("user_blocks")
      .select("blocked_id")
      .eq("blocker_id", userId);

    if (error) {
      console.warn("Could not load blocked accounts:", error.message);
      return;
    }

    setBlockedUserIds((data || []).map((item) => item.blocked_id));
  }, []);

  const loadBlockedProfiles = useCallback(async () => {
    if (!user?.id) return;

    setBlockedLoading(true);
    try {
      if (!blockedUserIds.length) {
        setBlockedProfiles([]);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id,username,display_name,avatar_url")
        .in("id", blockedUserIds);

      if (error) throw error;
      setBlockedProfiles(data || []);
    } catch (error) {
      setNotice(
        isArabic
          ? "تعذر تحميل الحسابات المحظورة: " + error.message
          : "Could not load blocked accounts: " + error.message
      );
    } finally {
      setBlockedLoading(false);
    }
  }, [user?.id, blockedUserIds, isArabic]);

  const loadFollowStats = useCallback(async (userId) => {
    if (!userId) return;

    const [followersResult, followingResult] = await Promise.all([
      supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", userId),

      supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", userId),
    ]);

    setFollowStats({
      followers: followersResult.count || 0,
      following: followingResult.count || 0,
    });
  }, []);

  const loadReports = useCallback(async () => {
    if (user?.app_metadata?.role !== "admin") return;

    setModerationLoading(true);
    try {
      const { data, error } = await supabase
        .from("content_reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      const rows = data || [];
      const reporterIds = [...new Set(rows.map((item) => item.reporter_id))];
      let profileMap = {};

      if (reporterIds.length) {
        const { data: profiles, error: profileError } = await supabase
          .from("profiles")
          .select("id,username,display_name")
          .in("id", reporterIds);

        if (profileError) throw profileError;
        (profiles || []).forEach((item) => { profileMap[item.id] = item; });
      }

      setModerationReports(
        rows.map((item) => ({
          ...item,
          reporter: profileMap[item.reporter_id] || {},
        }))
      );
    } catch (error) {
      setNotice(
        isArabic
          ? "تعذر تحميل البلاغات: " + error.message
          : "Could not load reports: " + error.message
      );
    } finally {
      setModerationLoading(false);
    }
  }, [user?.app_metadata?.role, isArabic]);

  async function updateReportStatus(reportId, status) {
    if (user?.app_metadata?.role !== "admin") return;

    const { error } = await supabase
      .from("content_reports")
      .update({
        status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
      })
      .eq("id", reportId);

    if (error) {
      setNotice(
        isArabic
          ? "تعذر تحديث البلاغ: " + error.message
          : "Could not update report: " + error.message
      );
      return;
    }

    setModerationReports((current) =>
      current.map((item) =>
        item.id === reportId
          ? { ...item, status, reviewed_at: new Date().toISOString(), reviewed_by: user.id }
          : item
      )
    );
  }

  const loadNotifications = useCallback(async (userId) => {
    if (!userId) return;

    setNotificationLoading(true);

    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("recipient_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      const rows = data || [];
      const actorIds = [...new Set(rows.map((item) => item.actor_id))];

      let profileMap = {};

      if (actorIds.length) {
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("*")
          .in("id", actorIds);

        if (profilesError) throw profilesError;

        (profiles || []).forEach((item) => {
          profileMap[item.id] = item;
        });
      }

      setNotifications(
        rows.map((item) => ({
          ...item,
          actor: profileMap[item.actor_id] || {},
        }))
      );
    } catch (error) {
      setNotice(t("Could not load notifications: ") + error.message);
    } finally {
      setNotificationLoading(false);
    }
  }, [t]);

  const startApp = useCallback(async () => {
    setLoading(true);

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      const currentUser = authData.user;
      setUser(currentUser);
      await loadPremiumStatus(currentUser.id, currentUser.app_metadata?.role);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .maybeSingle();

      const currentProfile = profileData || {
        id: currentUser.id,
        username: currentUser.user_metadata?.username || "user",
        display_name: "",
        full_name: "",
        bio: "",
        avatar_url: "",
        website: "",
      };

      setProfile(currentProfile);

      setProfileForm({
        display_name: currentProfile.display_name || "",
        username: currentProfile.username || "",
        bio: currentProfile.bio || "",
        website: currentProfile.website || "",
      });

      await Promise.all([
        loadPosts(currentUser.id),
        loadStories(),
        loadFollowing(currentUser.id),
        loadBlockedUsers(currentUser.id),
        loadNotifications(currentUser.id),
        loadFollowStats(currentUser.id),
      ]);
    } catch (error) {
      setNotice(error.message || t("Could not start the application."));
    }

    setLoading(false);
  }, [loadFollowStats, loadFollowing, loadBlockedUsers, loadNotifications, loadPosts, loadPremiumStatus, loadStories, t]);

  useEffect(() => {
    startApp();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setUser(null);
        setProfile(null);
        setIsPremium(false);
        setSubscriptionInfo(null);
      } else {
        setUser((prev) => {
          if (prev?.id !== session.user.id) {
            void startApp();
          }
          return session.user;
        });
      }
    });

    return () => subscription?.unsubscribe();
  }, [startApp]);

  useEffect(() => {
    if (!user?.id) return;

    const url = new URL(window.location.href);
    const paypalState = url.searchParams.get("paypal");
    const subscriptionId = url.searchParams.get("subscription_id");

    if (paypalState === "cancel") {
      setNotice(
        isArabic
          ? "تم إلغاء عملية الاشتراك في PayPal."
          : "The PayPal subscription checkout was cancelled."
      );
      url.searchParams.delete("paypal");
      window.history.replaceState({}, "", url.toString());
      return;
    }

    if (paypalState !== "return" || !subscriptionId) return;

    let active = true;
    (async () => {
      setNotice(
        isArabic
          ? "جارٍ التحقق من اشتراك PayPal..."
          : "Verifying your PayPal subscription..."
      );

      const { data, error } = await supabase.functions.invoke(
        "paypal-subscription",
        {
          body: {
            action: "sync",
            subscription_id: subscriptionId,
          },
        }
      );

      if (!active) return;

      if (error || data?.error) {
        setNotice(
          error?.message ||
            data?.error ||
            (isArabic
              ? "تعذر التحقق من الاشتراك."
              : "Could not verify the subscription.")
        );
      } else {
        await loadPremiumStatus(user.id, user.app_metadata?.role);
        setNotice(
          isArabic
            ? "تم التحقق من حالة اشتراكك."
            : "Your subscription status has been verified."
        );
      }

      url.searchParams.delete("paypal");
      url.searchParams.delete("subscription_id");
      window.history.replaceState({}, "", url.toString());
    })();

    return () => {
      active = false;
    };
  }, [user?.id, isArabic, loadPremiumStatus]);

  function findPost(postId) {
    return (
      posts.find((item) => item.id === postId) ||
      selectedProfilePosts.find((item) => item.id === postId) ||
      null
    );
  }

  async function publishPost(event) {
    event?.preventDefault();

    if (!newPost.trim() && !postFile) {
      setNotice(t("Write something or choose an image first."));
      return;
    }

    if (!user) {
      setNotice(t("Please sign in first."));
      return;
    }

    setBusy(true);
    setNotice("");

    try {
      let imageUrl = null;

      if (postFile) {
        imageUrl = await uploadMedia(postFile, "posts");
      }

      const { error } = await supabase.from("posts").insert({
        user_id: user.id,
        content: newPost.trim(),
        image_url: imageUrl,
      });

      if (error) throw error;

      setNewPost("");
      setPostFile(null);

      if (imageInput.current) imageInput.current.value = "";

      await loadPosts(user.id);
      setNotice(t("Your post has been published."));
    } catch (error) {
      setNotice(error.message || t("Could not publish your post."));
    }

    setBusy(false);
  }

  async function createNotification(recipientId, type, postId = null) {
    if (!user || !recipientId || recipientId === user.id) return;

    const notification = {
      recipient_id: recipientId,
      actor_id: user.id,
      type,
    };

    if (postId) notification.post_id = postId;

    const { error } = await supabase
      .from("notifications")
      .insert(notification);

    if (error) console.error("Notification error:", error.message);
  }

  async function toggleLike(postId) {
    if (!user) {
      setNotice(t("Please sign in to like posts."));
      return;
    }

    const post = findPost(postId);
    if (!post) return;

    const alreadyLiked = likedPosts.includes(postId);

    setLikedPosts((current) =>
      alreadyLiked
        ? current.filter((id) => id !== postId)
        : [...current, postId]
    );

    const updateCount = (items) =>
      items.map((item) =>
        item.id === postId
          ? {
              ...item,
              likesCount: Math.max(
                0,
                (item.likesCount || 0) + (alreadyLiked ? -1 : 1)
              ),
            }
          : item
      );

    setPosts(updateCount);
    setSelectedProfilePosts(updateCount);

    const result = alreadyLiked
      ? await supabase
          .from("post_likes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", user.id)
      : await supabase.from("post_likes").insert({
          post_id: postId,
          user_id: user.id,
        });

    if (result.error) {
      setNotice(result.error.message);
      await loadPosts(user.id);
      return;
    }

    if (!alreadyLiked && post.user_id !== user.id) {
      await createNotification(post.user_id, "like", postId);
    }
  }

  async function fetchPostComments(postId) {
    const { data, error } = await supabase
      .from("comments")
      .select("*")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (error) {
      setNotice(error.message);
      return;
    }

    const userIds = [
      ...new Set((data || []).map((item) => item.user_id)),
    ];

    let profileMap = {};

    if (userIds.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .in("id", userIds);

      (profiles || []).forEach((item) => {
        profileMap[item.id] = item;
      });
    }

    setComments(
      (data || []).map((item) => ({
        ...item,
        author: profileMap[item.user_id] || {},
      }))
    );
  }

  async function loadComments(postId) {
    const isClosing = openComments === postId;
    setOpenComments(isClosing ? null : postId);
    if (!isClosing) {
      await fetchPostComments(postId);
    }
  }

  async function addComment(event, postId) {
    event.preventDefault();

    if (!user) {
      setNotice(t("Please sign in to comment."));
      return;
    }

    const trimmed = commentText.trim();
    if (!trimmed) return;

    const post = findPost(postId);
    setCommentText("");

    const { error } = await supabase.from("comments").insert({
      post_id: postId,
      user_id: user.id,
      content: trimmed,
    });

    if (error) {
      setNotice(error.message);
      return;
    }

    if (post && post.user_id !== user.id) {
      await createNotification(post.user_id, "comment", postId);
    }

    setOpenComments(postId);
    await fetchPostComments(postId);
  }

  async function publishStory(event) {
    event.preventDefault();

    if (!storyFile) {
      setNotice(t("Choose a photo or video for your story."));
      return;
    }

    if (!user) {
      setNotice(t("Please sign in first."));
      return;
    }

    setBusy(true);

    try {
      const mediaUrl = await uploadMedia(storyFile, "stories");

      const { error } = await supabase.from("stories").insert({
        user_id: user.id,
        media_url: mediaUrl,
        caption: "",
      });

      if (error) throw error;

      setStoryFile(null);
      if (storyInput.current) storyInput.current.value = "";

      await loadStories();
      setNotice(t("Your story is now live for 24 hours."));
    } catch (error) {
      setNotice(error.message || t("Could not publish story."));
    }

    setBusy(false);
  }

  async function uploadMedia(file, folder) {
    if (!file || !user) return null;

    const extension = file.name.split(".").pop();

    const fileName = `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${extension}`;

    const path = `${user.id}/${folder}/${fileName}`;

    const { error } = await supabase.storage
      .from("social-media")
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) throw error;

    const { data } = supabase.storage
      .from("social-media")
      .getPublicUrl(path);

    return data.publicUrl;
  }

  async function uploadPrivateMessageMedia(file, conversationId) {
    if (!file || !user?.id || !conversationId) return null;

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
    const path = `${user.id}/messages/${conversationId}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;

    const { error } = await supabase.storage
      .from("private-messages")
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "application/octet-stream",
      });

    if (error) throw error;
    return path;
  }

  const searchPeople = useCallback(async (term = "") => {
    if (!user?.id) return;

    setPeopleLoading(true);

    try {
      let query = supabase
        .from("profiles")
        .select("id,username,display_name,full_name,avatar_url,bio")
        .neq("id", user.id)
        .limit(30);

      const cleanTerm = term
        .trim()
        .replace(/[,%()]/g, " ")
        .replace(/\s+/g, " ");

      if (cleanTerm) {
        query = query.or(
          `username.ilike.%${cleanTerm}%,display_name.ilike.%${cleanTerm}%,full_name.ilike.%${cleanTerm}%`
        );
      } else {
        query = query.order("created_at", { ascending: false });
      }

      const { data, error } = await query;
      if (error) throw error;

      setPeople((data || []).filter((person) => !blockedUserIds.includes(person.id)));
    } catch (error) {
      setNotice(t("People search error: ") + error.message);
    }

    setPeopleLoading(false);
  }, [t, user?.id, blockedUserIds]);

  useEffect(() => {
    if (!user?.id || activePage !== "people") return;

    const timer = setTimeout(() => searchPeople(search), 350);
    return () => clearTimeout(timer);
  }, [search, activePage, user?.id, searchPeople]);

  async function toggleFollow(personId) {
    if (!user || personId === user.id) return;
    if (followBusy.includes(personId)) return;

    const alreadyFollowing = followingIds.includes(personId);
    setFollowBusy((current) => [...current, personId]);

    try {
      if (alreadyFollowing) {
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", personId);

        if (error) throw error;

        setFollowingIds((current) =>
          current.filter((id) => id !== personId)
        );
      } else {
        const { error } = await supabase.from("follows").insert({
          follower_id: user.id,
          following_id: personId,
        });

        if (error) throw error;

        setFollowingIds((current) => [...current, personId]);
        await createNotification(personId, "follow");
      }

      await loadFollowStats(user.id);

      if (selectedProfile?.id === personId) {
        const { count } = await supabase
          .from("follows")
          .select("*", { count: "exact", head: true })
          .eq("following_id", personId);

        setSelectedProfileStats((current) => ({
          ...current,
          followers: count || 0,
        }));
      }
    } catch (error) {
      setNotice(t("Follow error: ") + error.message);
      await loadFollowing(user.id);
    }

    setFollowBusy((current) =>
      current.filter((id) => id !== personId)
    );
  }

  async function openUserProfile(personId) {
    if (!personId || !user?.id) return;

    if (personId === user.id) {
      goTo("profile");
      return;
    }

    if (blockedUserIds.includes(personId)) {
      setNotice(
        isArabic
          ? "لقد حظرت هذا الحساب. أزل الحظر أولاً لفتح ملفه."
          : "You blocked this account. Unblock it before opening the profile."
      );
      return;
    }

    setNotice("");
    setSelectedProfile(null);
    setSelectedProfilePosts([]);
    setProfileLoading(true);
    goTo("user-profile");

    try {
      const { data: person, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", personId)
        .single();

      if (error) throw error;

      const [postsResult, followersResult, followingResult] =
        await Promise.all([
          supabase
            .from("posts")
            .select("*")
            .eq("user_id", personId)
            .order("created_at", { ascending: false }),

          supabase
            .from("follows")
            .select("*", { count: "exact", head: true })
            .eq("following_id", personId),

          supabase
            .from("follows")
            .select("*", { count: "exact", head: true })
            .eq("follower_id", personId),
        ]);

      if (postsResult.error) throw postsResult.error;
      if (followersResult.error) throw followersResult.error;
      if (followingResult.error) throw followingResult.error;

      const profilePosts = postsResult.data || [];
      const postIds = profilePosts.map((post) => post.id);
      let likes = [];

      if (postIds.length) {
        const { data: likesData, error: likesError } = await supabase
          .from("post_likes")
          .select("post_id,user_id")
          .in("post_id", postIds);

        if (likesError) throw likesError;
        likes = likesData || [];
      }

      setSelectedProfile(person);

      setSelectedProfilePosts(
        profilePosts.map((post) => ({
          ...post,
          author: person,
          likesCount: likes.filter(
            (like) => like.post_id === post.id
          ).length,
        }))
      );

      setLikedPosts((current) => {
        const otherIds = current.filter((id) => !postIds.includes(id));
        const myLikes = likes
          .filter((like) => like.user_id === user.id)
          .map((like) => like.post_id);

        return [...otherIds, ...myLikes];
      });

      setSelectedProfileStats({
        followers: followersResult.count || 0,
        following: followingResult.count || 0,
      });
    } catch (error) {
      setNotice(t("Could not open profile: ") + error.message);
      goTo("people");
    }

    setProfileLoading(false);
  }

  async function replyToStory(story, text) {
    if (!user?.id || !story?.user_id || story.user_id === user.id) return false;

    if (blockedUserIds.includes(story.user_id)) {
      setNotice(isArabic ? "لا يمكنك الرد على قصة حساب محظور." : "You cannot reply to a blocked account's story.");
      return false;
    }

    const firstUser = [user.id, story.user_id].sort()[0];
    const secondUser = [user.id, story.user_id].sort()[1];

    try {
      let { data: conversation, error } = await supabase
        .from("conversations")
        .select("*")
        .eq("user_one", firstUser)
        .eq("user_two", secondUser)
        .maybeSingle();

      if (error) throw error;

      if (!conversation) {
        const { data, error: createError } = await supabase
          .from("conversations")
          .insert({ user_one: firstUser, user_two: secondUser })
          .select()
          .single();

        if (createError) throw createError;
        conversation = data;
      }

      const { error: messageError } = await supabase.from("messages").insert({
        conversation_id: conversation.id,
        sender_id: user.id,
        content: text,
        message_type: "text",
        media_url: null,
      });

      if (messageError) throw messageError;

      await createNotification(story.user_id, "story_reply");
      await loadConversations();

      setNotice(
        isArabic
          ? "تم إرسال ردك على القصة."
          : "Your story reply was sent."
      );
      return true;
    } catch (error) {
      console.error("Story reply failed:", error);
      setNotice(
        isArabic
          ? "تعذر إرسال الرد: " + error.message
          : "Could not send story reply: " + error.message
      );
      return false;
    }
  }

  async function reportContent(report) {
    if (!user?.id || !report?.type || !report?.id || !report?.reason) return false;

    const { error } = await supabase.from("content_reports").insert({
      reporter_id: user.id,
      target_type: report.type,
      target_id: String(report.id),
      target_user_id: report.targetUserId || null,
      reason: report.reason,
      details: report.details || null,
    });

    if (error) {
      setNotice(
        isArabic
          ? "تعذر إرسال البلاغ: " + error.message
          : "Could not submit report: " + error.message
      );
      return false;
    }

    setNotice(
      isArabic
        ? "وصل بلاغك بسرية. شكراً لمساعدتنا في حماية LOLZ."
        : "Your private report has been submitted. Thank you for helping keep LOLZ safe."
    );
    return true;
  }

  async function blockUser(targetUserId) {
    if (!user?.id || !targetUserId || targetUserId === user.id) return false;

    const { error } = await supabase.from("user_blocks").insert({
      blocker_id: user.id,
      blocked_id: targetUserId,
    });

    if (error && error.code !== "23505") {
      setNotice(
        isArabic
          ? "تعذر حظر الحساب: " + error.message
          : "Could not block account: " + error.message
      );
      return false;
    }

    setBlockedUserIds((current) =>
      current.includes(targetUserId) ? current : [...current, targetUserId]
    );
    setPeople((current) => current.filter((person) => person.id !== targetUserId));
    setStories((current) => current.filter((story) => story.user_id !== targetUserId));

    const activeOtherId = activeConversation
      ? (activeConversation.user_one === user.id
        ? activeConversation.user_two
        : activeConversation.user_one)
      : null;

    if (activeOtherId === targetUserId) {
      setActiveConversation(null);
      setConversationMessages([]);
      setMessageText("");
    }

    if (selectedProfile?.id === targetUserId) {
      setSelectedProfile(null);
      setSelectedProfilePosts([]);
      setActivePage("people");
    }

    setNotice(
      isArabic
        ? "تم حظر الحساب. لن تظهر منشوراته في صفحتك الرئيسية."
        : "Account blocked. Their posts will no longer appear in your feed."
    );
    return true;
  }

  async function unblockUser(targetUserId) {
    if (!user?.id || !targetUserId) return;

    const { error } = await supabase
      .from("user_blocks")
      .delete()
      .eq("blocker_id", user.id)
      .eq("blocked_id", targetUserId);

    if (error) {
      setNotice(
        isArabic
          ? "تعذر إلغاء الحظر: " + error.message
          : "Could not unblock account: " + error.message
      );
      return;
    }

    setBlockedUserIds((current) => current.filter((id) => id !== targetUserId));
    setBlockedProfiles((current) => current.filter((item) => item.id !== targetUserId));
    setNotice(isArabic ? "تم إلغاء الحظر." : "Account unblocked.");
    void loadStories();
    void loadPosts(user.id);
  }

  async function markNotificationRead(notificationId) {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId)
      .eq("recipient_id", user.id);

    if (error) {
      setNotice(t("Could not update notification: ") + error.message);
      return;
    }

    setNotifications((current) =>
      current.map((item) =>
        item.id === notificationId ? { ...item, is_read: true } : item
      )
    );
  }

  async function markAllNotificationsRead() {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("recipient_id", user.id)
      .eq("is_read", false);

    if (error) {
      setNotice(error.message);
      return;
    }

    setNotifications((current) =>
      current.map((item) => ({ ...item, is_read: true }))
    );
  }

  useEffect(() => {
    if (activePage === "activity" && user?.id) {
      void loadNotifications(user.id);
    }
  }, [activePage, user?.id, loadNotifications]);

  useEffect(() => {
    if (activePage === "moderation" && user?.app_metadata?.role === "admin") {
      void loadReports();
    }
    if (activePage === "blocked") {
      void loadBlockedProfiles();
    }
  }, [activePage, user?.app_metadata?.role, loadReports, loadBlockedProfiles]);

  // MESSAGING

  const loadConversations = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from("conversations")
        .select("*")
        .or(`user_one.eq.${user.id},user_two.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const rows = (data || []).filter((conversation) => {
        const otherId = conversation.user_one === user.id
          ? conversation.user_two
          : conversation.user_one;
        return !blockedUserIds.includes(otherId);
      });

      if (!rows.length) {
        setConversations([]);
        return;
      }

      const otherIds = rows.map((conversation) =>
        conversation.user_one === user.id
          ? conversation.user_two
          : conversation.user_one
      );

      const uniqueIds = [...new Set(otherIds)];

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .in("id", uniqueIds);

      if (profilesError) throw profilesError;

      const profileMap = {};

      (profiles || []).forEach((item) => {
        profileMap[item.id] = item;
      });

      const results = await Promise.all(
        rows.map(async (conversation) => {
          const otherId =
            conversation.user_one === user.id
              ? conversation.user_two
              : conversation.user_one;

          const { data: lastMessages } = await supabase
            .from("messages")
            .select("*")
            .eq("conversation_id", conversation.id)
            .order("created_at", { ascending: false })
            .limit(1);

          return {
            ...conversation,
            otherProfile: profileMap[otherId] || {},
            lastMessage: lastMessages?.[0] || null,
          };
        })
      );

      results.sort((a, b) => new Date(b.lastMessage?.created_at || b.created_at || 0) - new Date(a.lastMessage?.created_at || a.created_at || 0));
      setConversations(results);

      setActiveConversation((current) => {
        if (!current) return null;
        return results.find((item) => item.id === current.id) || current;
      });
    } catch (error) {
      setNotice(t("Could not load conversations: ") + error.message);
    }
  }, [t, user?.id, blockedUserIds]);

  const loadMessages = useCallback(async (conversationId) => {
    if (!conversationId) return;

    setMessagesLoading(true);
    shouldAutoScrollRef.current = true;

    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const resolvedMessages = await Promise.all(
        (data || []).map(async (message) => {
          const storedPath = message.media_url;

          // Legacy attachments are existing public URLs. New attachments store
          // only a private bucket path and receive a short-lived signed URL.
          if (!storedPath || /^https?:\/\//i.test(storedPath)) return message;

          const { data: signedData, error: signedError } = await supabase.storage
            .from("private-messages")
            .createSignedUrl(storedPath, 60 * 60 * 24);

          if (signedError) {
            console.warn("Could not sign private message media:", signedError.message);
            return { ...message, media_url: null, media_unavailable: true };
          }

          return {
            ...message,
            media_url: signedData?.signedUrl || null,
            media_storage_path: storedPath,
          };
        })
      );

      setConversationMessages(resolvedMessages);
    } catch (error) {
      setNotice(t("Could not load messages: ") + error.message);
    } finally {
      setMessagesLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!user?.id || activePage !== "messages") return;

    const channel = supabase
      .channel(`user-message-inbox-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const newMessage = payload.new;
          if (!newMessage?.id || !newMessage?.conversation_id) return;

          if (activeConversation?.id === newMessage.conversation_id) {
            void loadMessages(newMessage.conversation_id);
          }

          setConversations((current) => {
            const exists = current.some(
              (conversation) => conversation.id === newMessage.conversation_id
            );
            if (!exists) return current;

            return current
              .map((conversation) =>
                conversation.id === newMessage.conversation_id
                  ? { ...conversation, lastMessage: newMessage }
                  : conversation
              )
              .sort(
                (a, b) =>
                  new Date(b.lastMessage?.created_at || b.created_at || 0) -
                  new Date(a.lastMessage?.created_at || a.created_at || 0)
              );
          });

          // Also refresh the inbox so newly-created or newly-visible chats appear.
          void loadConversations();
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activePage, activeConversation?.id, user?.id, loadConversations, loadMessages]);

  async function openConversationWith(person) {
    if (!user || !person?.id || person.id === user.id) return;
    if (blockedUserIds.includes(person.id)) {
      setNotice(isArabic ? "هذا الحساب محظور. أزل الحظر أولاً." : "This account is blocked. Unblock it first.");
      return;
    }

    setNotice("");

    const firstUser = [user.id, person.id].sort()[0];
    const secondUser = [user.id, person.id].sort()[1];

    try {
      let { data: conversation, error } = await supabase
        .from("conversations")
        .select("*")
        .eq("user_one", firstUser)
        .eq("user_two", secondUser)
        .maybeSingle();

      if (error) throw error;

      if (!conversation) {
        const { data: newConversation, error: insertError } =
          await supabase
            .from("conversations")
            .insert({
              user_one: firstUser,
              user_two: secondUser,
            })
            .select()
            .single();

        if (insertError) throw insertError;
        conversation = newConversation;
      }

      const selectedConversation = {
        ...conversation,
        otherProfile: person,
      };

      setActiveConversation(selectedConversation);
      setConversationMessages([]);
      setMessageText("");
      setMessageFile(null);

      if (messageMediaInput.current) {
        messageMediaInput.current.value = "";
      }

      goTo("messages");
      await loadMessages(conversation.id);
      await loadConversations();
      setActiveConversation(selectedConversation);
    } catch (error) {
      setNotice(t("Could not open conversation: ") + error.message);
    }
  }

  function handleMessageFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (
      !file.type.startsWith("image/") &&
      !file.type.startsWith("video/")
    ) {
      setNotice(t("Please choose an image or video."));
      event.target.value = "";
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      setNotice(t("Maximum file size is 100 MB."));
      event.target.value = "";
      return;
    }

    setNotice("");
    setMessageFile(file);
  }

  function clearMessageFile() {
    setMessageFile(null);
    if (messageMediaInput.current) {
      messageMediaInput.current.value = "";
    }
  }

  async function startVoiceRecording() {
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        setNotice("التسجيل الصوتي غير مدعوم في هذا المتصفح.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      if (!voicePressActiveRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const mimeTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/ogg",
      ];

      const mimeType = mimeTypes.find((type) =>
        MediaRecorder.isTypeSupported(type)
      );

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      voiceCancelledRef.current = false;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());

        const blob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });

        if (!voiceCancelledRef.current && blob.size > 0) {
          const extension = blob.type.includes("ogg") ? "ogg" : "webm";

          const file = new File(
            [blob],
            `voice-${Date.now()}.${extension}`,
            { type: blob.type || "audio/webm" }
          );

          setVoiceFile(file);
        }

        audioChunksRef.current = [];
        mediaRecorderRef.current = null;
        setIsRecording(false);
      };

      recorder.start(250);
      setIsRecording(true);
    } catch (error) {
      console.error("Voice recording error:", error);
      setNotice("يرجى السماح بالوصول إلى الميكروفون لتسجيل رسالة صوتية.");
    }
  }

  function stopVoiceRecording() {
    voicePressActiveRef.current = false;

    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }

  function cancelVoiceRecording() {
    voicePressActiveRef.current = false;
    voiceCancelledRef.current = true;

    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }

    setVoiceFile(null);
    setIsRecording(false);
  }

  function handleVoicePointerDown(event) {
    if (event.button !== undefined && event.button !== 0) return;

    event.preventDefault();

    if (isRecording || voiceFile || messageSending || messageFile) return;

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is best-effort; continue without it.
    }

    voicePressActiveRef.current = true;
    void startVoiceRecording();
  }

  function handleVoicePointerUp(event) {
    event.preventDefault();
    stopVoiceRecording();
  }

  function handleVoicePointerCancel() {
    cancelVoiceRecording();
  }

  async function sendMessage(event) {
    event.preventDefault();

    if (!user || !activeConversation) return;

    const otherId = activeConversation.user_one === user.id
      ? activeConversation.user_two
      : activeConversation.user_one;

    if (blockedUserIds.includes(otherId)) {
      setNotice(isArabic ? "لا يمكنك مراسلة حساب محظور." : "You cannot message a blocked account.");
      return;
    }

    const content = messageText.trim();
    const file = messageFile;
    const audioFile = voiceFile;

    if (!content && !file && !audioFile) return;

    if (file && audioFile) {
      setNotice("أرسل الصورة أو الفيديو والرسالة الصوتية بشكل منفصل.");
      return;
    }

    setMessageSending(true);
    setNotice("");
    shouldAutoScrollRef.current = true;

    try {
      let mediaUrl = null;
      let messageType = "text";
      let uploadedFile = null;
      let messageSaved = false;

      if (audioFile) {
        if (!audioFile.type.startsWith("audio/")) {
          throw new Error("ملف الصوت غير صالح.");
        }

        if (audioFile.size > 100 * 1024 * 1024) {
          throw new Error(t("Maximum file size is 100 MB."));
        }

        messageType = "audio";
        uploadedFile = audioFile;
        mediaUrl = await uploadPrivateMessageMedia(audioFile, activeConversation.id);

        if (!mediaUrl) {
          throw new Error(t("Could not upload the media file."));
        }
      } else if (file) {
        if (
          !file.type.startsWith("image/") &&
          !file.type.startsWith("video/")
        ) {
          throw new Error(t("Only images and videos are allowed."));
        }

        if (file.size > 100 * 1024 * 1024) {
          throw new Error(t("Maximum file size is 100 MB."));
        }

        messageType = file.type.startsWith("image/")
          ? "image"
          : "video";

        uploadedFile = file;
        mediaUrl = await uploadPrivateMessageMedia(file, activeConversation.id);

        if (!mediaUrl) {
          throw new Error(t("Could not upload the media file."));
        }
      }

      const { error } = await supabase.from("messages").insert({
        conversation_id: activeConversation.id,
        sender_id: user.id,
        content:
          content ||
          (messageType === "image"
            ? "Photo"
            : messageType === "video"
            ? "Video"
            : messageType === "audio"
            ? "Voice message"
            : ""),
        message_type: messageType,
        media_url: mediaUrl,
        file_name: uploadedFile?.name || null,
        mime_type: uploadedFile?.type || null,
      });

      if (error) throw error;
      messageSaved = true;

      setMessageText("");
      setMessageFile(null);
      setVoiceFile(null);

      if (messageMediaInput.current) {
        messageMediaInput.current.value = "";
      }

      await loadMessages(activeConversation.id);
      await loadConversations();
    } catch (error) {
      if (
        mediaUrl &&
        !messageSaved &&
        !/^https?:\/\//i.test(mediaUrl)
      ) {
        const { error: cleanupError } = await supabase.storage
          .from("private-messages")
          .remove([mediaUrl]);
        if (cleanupError) {
          console.warn("Could not clean up an unsent private attachment:", cleanupError.message);
        }
      }
      setNotice(t("Could not send message: ") + error.message);
    } finally {
      setMessageSending(false);
    }
  }

  useEffect(() => {
    if (activePage === "messages" && user?.id) {
      void loadConversations();
    }
  }, [activePage, user?.id, loadConversations]);

  useEffect(() => {
    const container = messagesEndRef.current?.parentElement;
    if (!container || !shouldAutoScrollRef.current) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth",
    });
  }, [conversationMessages]);

  async function saveProfile(event) {
    event.preventDefault();
    if (!user) return;

    setBusy(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: profileForm.display_name,
        username: profileForm.username,
        bio: profileForm.bio,
        website: profileForm.website,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      setNotice(error.message);
    } else {
      setProfile((current) => ({ ...current, ...profileForm }));
      setEditProfile(false);
      setNotice(t("Profile updated successfully."));
    }

    setBusy(false);
  }

  async function changeAvatar(file) {
    if (!file || !user) return;

    setBusy(true);

    try {
      const avatarUrl = await uploadMedia(file, "avatars");

      const { error } = await supabase
        .from("profiles")
        .update({
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (error) throw error;

      setProfile((current) => ({
        ...current,
        avatar_url: avatarUrl,
      }));

      setNotice(t("Profile photo updated."));
    } catch (error) {
      setNotice(error.message);
    }

    setBusy(false);
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  async function startPremiumCheckout() {
    try {
      setNotice("");

      const { data, error } = await supabase.functions.invoke(
        "paypal-subscription",
        { body: { action: "create" } }
      );

      if (error) throw error;

      if (!data?.approval_url) {
        throw new Error(
          data?.error || "تعذر الحصول على رابط الموافقة من PayPal."
        );
      }

      window.location.assign(data.approval_url);
    } catch (error) {
      console.error("Premium checkout error:", error);
      setNotice(
        error.message || "تعذر الاتصال بـ PayPal. يرجى المحاولة مرة أخرى."
      );
    }
  }

  async function cancelPremiumSubscription() {
    const subscriptionId = subscriptionInfo?.paypal_subscription_id;
    if (!subscriptionId) {
      throw new Error(
        isArabic
          ? "لم يتم العثور على رقم اشتراك PayPal."
          : "The PayPal subscription ID could not be found."
      );
    }

    const { data, error } = await supabase.functions.invoke(
      "paypal-subscription",
      {
        body: {
          action: "cancel",
          subscription_id: subscriptionId,
        },
      }
    );

    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    await loadPremiumStatus(user.id, user.app_metadata?.role);
    setNotice(
      isArabic
        ? "تم إلغاء التجديد. ستبقى المزايا حتى نهاية الفترة المدفوعة إن كانت متاحة."
        : "Renewal was cancelled. Benefits remain until the paid period ends, where applicable."
    );
  }

  const displayName =
    profile?.display_name ||
    profile?.full_name ||
    profile?.username ||
    t("Your profile");

  const filteredPosts = posts.filter((post) => {
    const term = search.toLowerCase().trim();
    if (!term) return true;

    return (
      (post.content || "").toLowerCase().includes(term) ||
      (post.author?.username || "").toLowerCase().includes(term) ||
      (post.author?.display_name || "").toLowerCase().includes(term)
    );
  });

  const unblockedPosts = filteredPosts.filter(
    (post) => !blockedUserIds.includes(post.user_id)
  );

  const visiblePosts =
    activePage === "saved"
      ? unblockedPosts.filter((post) => savedPosts.includes(post.id))
      : activePage === "profile"
      ? filteredPosts.filter((post) => post.user_id === user?.id)
      : unblockedPosts;

  const unreadCount = notifications.filter((item) => !item.is_read).length;

  function goTo(page) {
    setActivePage(page);
    setNotice("");
    setOpenComments(null);
  }

  function createPost() {
    goTo("home");
    setTimeout(() => postInput.current?.focus(), 100);
  }

  const postListProps = {
    likedPosts,
    savedPosts,
    onLike: toggleLike,
    onSave: (id) =>
      setSavedPosts((current) =>
        current.includes(id)
          ? current.filter((item) => item !== id)
          : [...current, id]
      ),
    onComments: loadComments,
    openComments,
    comments,
    commentText,
    setCommentText,
    onAddComment: addComment,
    onOpenProfile: openUserProfile,
    onReport: (target) => setModerationTarget(target),
    onBlock: (targetUserId) =>
      setModerationTarget({ mode: "block", targetUserId }),
    currentUserId: user?.id,
    t,
    isArabic,
  };

  if (loading) {
    return (
      <div className="loading-screen" dir={isArabic ? "rtl" : "ltr"}>
        LOLZ<span>.</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="loading-screen" dir={isArabic ? "rtl" : "ltr"}>
        {t("Please sign in to continue.")}
      </div>
    );
  }

  return (
    <div
      className={`app-shell ${isArabic ? "is-arabic" : ""} ${
        activePage === "messages" && activeConversation
          ? "private-chat-open"
          : ""
      }`}
      dir={isArabic ? "rtl" : "ltr"}
    >
      <Navigation
        page={activePage}
        setPage={goTo}
        onCreate={createPost}
        onLogout={logout}
        username={displayName}
        isAdmin={user?.app_metadata?.role === "admin"}
      />

      <main className="main-area">
        <header className="topbar ig-topbar">
          <div className="mobile-brand">
            <span className="brand-mark">L</span>
            LOLZ
          </div>

          <div className="topbar-search">
            <span aria-hidden="true">⌕</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t(
                activePage === "people"
                  ? "Search people by name or username..."
                  : "Search posts and people..."
              )}
              aria-label={t("Search posts and people...")}
            />
            {search && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => setSearch("")}
                aria-label={t("Cancel")}
              >
                ×
              </button>
            )}
          </div>

          <div className="ig-topbar-actions">
            <button type="button" onClick={() => goTo("messages")} aria-label={t("Messages")} title={t("Messages")}>
              <MessageCircle />
            </button>
            <button type="button" onClick={() => goTo("activity")} aria-label={t("Notifications")} title={t("Notifications")}>
              <Heart />
              {unreadCount > 0 && <span className="ig-notification-dot" />}
            </button>
          </div>

          <button
            type="button"
            className="top-profile"
            onClick={() => goTo("profile")}
            aria-label={displayName}
          >
            <Avatar url={profile?.avatar_url} name={displayName} />
          </button>
        </header>

        <div className="page-content">
          {notice && (
            <div className="notice" role="status">
              <span>{notice}</span>
              <button
                type="button"
                onClick={() => setNotice("")}
                aria-label="إغلاق"
              >
                ×
              </button>
            </div>
          )}

          {activePage === "channels" && (
            <section
              className={`other-page messages-page ${
                activeConversation ? "conversation-open" : ""
              }`}
            >
              <Channels
                user={user}
                onCallContextChange={handleCallContextChange}
              />
            </section>
          )}

          {activePage === "groups" && (
            <section className="other-page groups-outer-page">
              <Groups
                user={user}
                onCallContextChange={handleCallContextChange}
              />
            </section>
          )}

          {activePage === "home" && (
            <section className="ig-home">
              <div className="ig-home-column">
                <section className="stories-section">
                  <div className="ig-stories-heading">
                    <strong>{t("Stories")}</strong>
                    <span>{t("Disappear after 24 hours")}</span>
                  </div>

                  <div className="stories-list">
                    <button
                      type="button"
                      className="story-item add-story"
                      onClick={() => storyInput.current?.click()}
                    >
                      <div className="story-ring add-ring">
                        <Avatar url={profile?.avatar_url} name={displayName} size="large" />
                        <span className="add-story-plus">+</span>
                      </div>
                      <span>{t("Your story")}</span>
                    </button>

                    {stories.filter((story) => story.user_id === user.id).length > 0 && (
                      <button
                        type="button"
                        className="story-item own-story"
                        onClick={() => {
                          const ownStory = stories.find((story) => story.user_id === user.id);
                          if (ownStory) setActiveStoryId(ownStory.id);
                        }}
                      >
                        <div className="story-ring">
                          <Avatar url={profile?.avatar_url} name={displayName} size="large" />
                        </div>
                        <span>{isArabic ? "مشاهدة قصتك" : "Your active story"}</span>
                      </button>
                    )}

                    {stories.filter((story) => story.user_id !== user.id).map((story) => (
                      <button
                        type="button"
                        className="story-item"
                        key={story.id}
                        onClick={() => setActiveStoryId(story.id)}
                      >
                        <div className="story-ring">
                          <Avatar
                            url={story.author?.avatar_url}
                            name={story.author?.username}
                            size="large"
                          />
                        </div>
                        <span>
                          {story.author?.display_name ||
                            story.author?.username ||
                            t("Member")}
                        </span>
                      </button>
                    ))}
                  </div>

                  <form className="story-upload" onSubmit={publishStory}>
                    <input
                      ref={storyInput}
                      type="file"
                      accept="image/*,video/*"
                      hidden
                      onChange={(event) => setStoryFile(event.target.files?.[0] || null)}
                    />
                    {storyFile && (
                      <>
                        <span className="file-name">{storyFile.name}</span>
                        <button type="submit" className="primary-button" disabled={busy}>
                          {busy ? t("Uploading...") : t("Share story")}
                        </button>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => {
                            setStoryFile(null);
                            if (storyInput.current) storyInput.current.value = "";
                          }}
                        >
                          {t("Cancel")}
                        </button>
                      </>
                    )}
                  </form>
                </section>

                <form className="composer-card" onSubmit={publishPost}>
                  <div className="composer-top">
                    <Avatar url={profile?.avatar_url} name={displayName} />
                    <textarea
                      ref={postInput}
                      value={newPost}
                      onChange={(event) => setNewPost(event.target.value)}
                      placeholder={t("What's happening in your world?")}
                      rows="2"
                    />
                  </div>

                  <div className="composer-bottom">
                    <div className="composer-tools">
                      <input
                        ref={imageInput}
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={(event) => setPostFile(event.target.files?.[0] || null)}
                      />
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => imageInput.current?.click()}
                      >
                        ▧ {t("Photo")}
                      </button>
                      {postFile && <span className="file-name">{postFile.name}</span>}
                    </div>
                    <button className="primary-button" type="submit" disabled={busy}>
                      {busy ? t("Publishing...") : t("Publish")}
                    </button>
                  </div>
                </form>

                <section className="feed-section">
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">{t("THE COMMUNITY")}</span>
                      <h2>{t("Your feed")}</h2>
                    </div>
                    <span className="subtle-text">{posts.length} {t("posts")}</span>
                  </div>
                  <PostList posts={visiblePosts} {...postListProps} />
                </section>
              </div>

              <aside className="ig-home-sidebar">
                <div className="ig-mini-profile">
                  <Avatar url={profile?.avatar_url} name={displayName} />
                  <div className="ig-mini-profile-copy">
                    <strong>{displayName}</strong>
                    <span>@{profile?.username || "user"}</span>
                  </div>
                  <button type="button" className="ig-text-button" onClick={() => goTo("profile")}>
                    {t("Profile")}
                  </button>
                </div>

                <div className="ig-side-card">
                  <strong>{t("Discover")}</strong>
                  <p>{t("Find people and connect with the community.")}</p>
                  <button type="button" className="ig-text-button" onClick={() => goTo("discover")}>
                    {t("Search")}
                  </button>
                </div>

                <div className="ig-side-card">
                  <strong>{t("Your community")}</strong>
                  <div className="ig-side-shortcuts">
                    <button type="button" onClick={() => goTo("groups")}>
                      <UsersRound /> {t("Groups")}
                    </button>
                    <button type="button" onClick={() => goTo("channels")}>
                      <Radio /> {t("Channels")}
                    </button>
                    <button type="button" onClick={() => goTo("saved")}>
                      <Bookmark /> {t("Saved posts")}
                    </button>
                  </div>
                </div>
              </aside>
            </section>
          )}

          {activePage === "discover" && (
            <section className="other-page">
              <span className="eyebrow">{t("FIND YOUR COMMUNITY")}</span>
              <h1>{t("Discover")}</h1>
              <p>{t("Explore posts from the LOLZ community.")}</p>
              <PostList posts={visiblePosts} {...postListProps} />
            </section>
          )}

          {activePage === "people" && (
            <section className="other-page">
              <span className="eyebrow">{t("GROW YOUR COMMUNITY")}</span>
              <h1>{t("Discover people")}</h1>
              <p>{t("Find people and connect with the community.")}</p>

              <div className="people-search">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t("Search by name or username...")}
                />
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => searchPeople(search)}
                >
                  {t("Search")}
                </button>
              </div>

              {peopleLoading ? (
                <p>{t("Searching for people...")}</p>
              ) : people.length === 0 ? (
                <div className="empty-state">
                  <span>✦</span>
                  <h3>{t("No people found")}</h3>
                  <p>{t("Try another name or username.")}</p>
                </div>
              ) : (
                <div className="people-grid">
                  {people.map((person) => {
                    const name =
                      person.display_name ||
                      person.full_name ||
                      person.username ||
                      t("Member");

                    const isFollowing = followingIds.includes(person.id);
                    const isBusy = followBusy.includes(person.id);

                    return (
                      <article className="person-card" key={person.id}>
                        <button
                          type="button"
                          className="person-avatar-button"
                          onClick={() => openUserProfile(person.id)}
                        >
                          <Avatar
                            url={person.avatar_url}
                            name={name}
                            size="large"
                          />
                        </button>

                        <div className="person-info">
                          <button
                            type="button"
                            className="person-name"
                            onClick={() => openUserProfile(person.id)}
                          >
                            {name}
                          </button>
                          <span className="person-handle">
                            @{person.username || "member"}
                          </span>
                          {person.bio && (
                            <p className="person-bio">{person.bio}</p>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleFollow(person.id)}
                          disabled={isBusy}
                          className={
                            isFollowing ? "secondary-button" : "primary-button"
                          }
                        >
                          {isBusy
                            ? "..."
                            : isFollowing
                            ? t("Following")
                            : t("Follow")}
                        </button>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {activePage === "user-profile" && (
            <section className="profile-page">
              {profileLoading || !selectedProfile ? (
                <div className="empty-state">
                  <h3>{t("Loading profile...")}</h3>
                </div>
              ) : (
                <>
                  <div className="profile-cover">
                    <span>{t("LOLZ MEMBER")}</span>
                  </div>

                  <div className="profile-main">
                    <div className="profile-avatar-wrap">
                      <Avatar
                        url={selectedProfile.avatar_url}
                        name={
                          selectedProfile.display_name ||
                          selectedProfile.username
                        }
                        size="profile"
                      />
                    </div>

                    <div className="profile-action-row">
                      <button
                        type="button"
                        className={
                          followingIds.includes(selectedProfile.id)
                            ? "secondary-button"
                            : "primary-button"
                        }
                        disabled={followBusy.includes(selectedProfile.id)}
                        onClick={() => toggleFollow(selectedProfile.id)}
                      >
                        {followBusy.includes(selectedProfile.id)
                          ? t("Please wait...")
                          : followingIds.includes(selectedProfile.id)
                          ? t("Following")
                          : t("Follow")}
                      </button>

                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => openConversationWith(selectedProfile)}
                      >
                        {t("Message")}
                      </button>

                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() =>
                          setModerationTarget({
                            type: "user",
                            id: selectedProfile.id,
                            targetUserId: selectedProfile.id,
                          })
                        }
                      >
                        {isArabic ? "إبلاغ" : "Report"}
                      </button>

                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() =>
                          setModerationTarget({
                            mode: "block",
                            targetUserId: selectedProfile.id,
                          })
                        }
                      >
                        {isArabic ? "حظر" : "Block"}
                      </button>

                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => goTo("people")}
                      >
                        {t("Back")}
                      </button>
                    </div>

                    <h1>
                      {selectedProfile.display_name ||
                        selectedProfile.full_name ||
                        selectedProfile.username}
                    </h1>
                    <p className="profile-handle">
                      @{selectedProfile.username || "member"}
                    </p>
                    <p className="profile-bio">
                      {selectedProfile.bio || t("No bio yet.")}
                    </p>

                    {selectedProfile.website && (
                      <a
                        href={selectedProfile.website}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {selectedProfile.website}
                      </a>
                    )}

                    <div className="profile-stats">
                      <div>
                        <strong>{selectedProfilePosts.length}</strong>
                        <span>{t("Posts")}</span>
                      </div>
                      <div>
                        <strong>{selectedProfileStats.followers}</strong>
                        <span>{t("Followers")}</span>
                      </div>
                      <div>
                        <strong>{selectedProfileStats.following}</strong>
                        <span>{t("Following count")}</span>
                      </div>
                    </div>
                  </div>

                  <div className="section-heading profile-post-heading">
                    <h2>{t("Posts")}</h2>
                  </div>
                  <PostList
                    posts={selectedProfilePosts}
                    {...postListProps}
                  />
                </>
              )}
            </section>
          )}

          {activePage === "saved" && (
            <section className="other-page">
              <span className="eyebrow">{t("YOUR COLLECTION")}</span>
              <h1>{t("Saved posts")}</h1>
              <PostList
                posts={visiblePosts}
                {...postListProps}
                onSave={(id) =>
                  setSavedPosts((current) =>
                    current.filter((item) => item !== id)
                  )
                }
              />
            </section>
          )}

          {activePage === "lolz" && (
            <Lolz
              user={user}
              blockedUserIds={blockedUserIds}
              onReport={(target) => setModerationTarget(target)}
            />
          )}

          {activePage === "profile" && (
            <section className="profile-page">
              <div className="profile-cover">
                <span>{t("LOLZ MEMBER")}</span>
              </div>

              <div className="profile-main">
                <div className="profile-avatar-wrap">
                  <Avatar
                    url={profile?.avatar_url}
                    name={displayName}
                    size="profile"
                  />

                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    id="avatar-upload"
                    onChange={(event) =>
                      changeAvatar(event.target.files?.[0])
                    }
                  />

                  <label htmlFor="avatar-upload" className="avatar-edit">
                    {t("Edit photo")}
                  </label>
                </div>

                <button
                  type="button"
                  className="secondary-button edit-profile-button"
                  onClick={() => setEditProfile(!editProfile)}
                >
                  {editProfile ? t("Close editor") : t("Edit profile")}
                </button>

                <h1>{displayName}</h1>
                <p className="profile-handle">
                  @{profile?.username || "user"}
                </p>
                <p className="profile-bio">
                  {profile?.bio || t("Tell the community something about yourself.")}
                </p>

                {profile?.website && (
                  <a
                    href={profile.website}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {profile.website}
                  </a>
                )}

                {editProfile && (
                  <form className="profile-edit-form" onSubmit={saveProfile}>
                    <div className="edit-profile-heading">
                      <div>
                        <h2>{t("Edit profile")}</h2>
                        <p>{t("Tell the community something about yourself.")}</p>
                      </div>
                    </div>

                    <div className="edit-profile-photo">
                      <Avatar
                        url={profile?.avatar_url}
                        name={displayName}
                        size="profile"
                      />

                      <div className="edit-profile-photo-info">
                        <strong>{displayName}</strong>
                        <span>@{profile?.username || "user"}</span>
                        <label htmlFor="avatar-upload" className="avatar-edit">
                          {t("Edit photo")}
                        </label>
                      </div>
                    </div>

                    <div className="edit-profile-fields">
                      <label>
                        {t("Display name")}
                        <input
                          value={profileForm.display_name}
                          onChange={(event) =>
                            setProfileForm({
                              ...profileForm,
                              display_name: event.target.value,
                            })
                          }
                          placeholder={t("Your name")}
                        />
                      </label>

                      <label>
                        {t("Username")}
                        <input
                          value={profileForm.username}
                          onChange={(event) =>
                            setProfileForm({
                              ...profileForm,
                              username: event.target.value,
                            })
                          }
                          placeholder="username"
                        />
                      </label>

                      <label>
                        {t("Bio")}
                        <textarea
                          value={profileForm.bio}
                          onChange={(event) =>
                            setProfileForm({
                              ...profileForm,
                              bio: event.target.value,
                            })
                          }
                          placeholder={t("Write a little about yourself...")}
                          maxLength={150}
                        />
                        <small>{profileForm.bio.length}/150</small>
                      </label>

                      <label>
                        {t("Website")}
                        <input
                          type="url"
                          value={profileForm.website}
                          onChange={(event) =>
                            setProfileForm({
                              ...profileForm,
                              website: event.target.value,
                            })
                          }
                          placeholder="https://example.com"
                        />
                      </label>
                    </div>

                    <div className="edit-profile-actions">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => setEditProfile(false)}
                      >
                        {t("Cancel")}
                      </button>

                      <button
                        type="submit"
                        className="primary-button"
                        disabled={busy}
                      >
                        {busy ? t("Saving...") : t("Save changes")}
                      </button>
                    </div>
                  </form>
                )}

                <div className="profile-stats">
                  <div>
                    <strong>
                      {posts.filter((p) => p.user_id === user.id).length}
                    </strong>
                    <span>{t("Posts")}</span>
                  </div>
                  <div>
                    <strong>{followStats.followers}</strong>
                    <span>{t("Followers")}</span>
                  </div>
                  <div>
                    <strong>{followStats.following}</strong>
                    <span>{t("Following count")}</span>
                  </div>
                </div>
              </div>

              <div className="section-heading profile-post-heading">
                <h2>{t("Your posts")}</h2>
              </div>
              <PostList posts={visiblePosts} {...postListProps} />
            </section>
          )}

          {activePage === "messages" && (
            <section
              className={`other-page messages-page ig-dm-page ${
                activeConversation ? "conversation-open" : ""
              }`}
            >
              <div className="ig-dm-layout">
                <aside className="ig-dm-inbox">
                  <div className="ig-dm-inbox-top">
                    <div className="ig-dm-account">
                      <strong>{profile?.username || user?.email?.split("@")[0] || "LOLZ"}</strong>
                      <span>Messages</span>
                    </div>
                    <button
                      type="button"
                      className="ig-dm-icon-button ig-dm-new-message"
                      onClick={() => goTo("people")}
                      title={isArabic ? "رسالة جديدة" : "New message"}
                      aria-label={isArabic ? "رسالة جديدة" : "New message"}
                    >
                      <SquarePen size={21} />
                    </button>
                  </div>

                  <div className="ig-dm-search">
                    <Search size={17} />
                    <input
                      type="search"
                      value={messageSearch}
                      onChange={(event) => setMessageSearch(event.target.value)}
                      placeholder={isArabic ? "بحث" : "Search"}
                      aria-label={isArabic ? "بحث في المحادثات" : "Search conversations"}
                    />
                    {messageSearch && (
                      <button
                        type="button"
                        onClick={() => setMessageSearch("")}
                        aria-label={isArabic ? "مسح البحث" : "Clear search"}
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>

                  <div className="ig-dm-list-heading">
                    <strong>{isArabic ? "الرسائل" : "Messages"}</strong>
                    <span>{conversations.length}</span>
                  </div>

                  <div className="ig-dm-threads">
                    {messagesLoading && conversations.length === 0 ? (
                      <div className="ig-dm-list-state">
                        <span className="ig-dm-loader" />
                        <p>{isArabic ? "جارٍ تحميل المحادثات..." : "Loading messages..."}</p>
                      </div>
                    ) : conversations.filter((conversation) => {
                        const person = conversation.otherProfile || {};
                        const query = messageSearch.trim().toLowerCase();
                        const name = [
                          person.display_name,
                          person.full_name,
                          person.username,
                          conversation.lastMessage?.content,
                        ].filter(Boolean).join(" ").toLowerCase();
                        return !query || name.includes(query);
                      }).length === 0 ? (
                      <div className="ig-dm-list-state">
                        <div className="ig-dm-empty-icon"><MessageCircle size={23} /></div>
                        <strong>{isArabic ? "لا توجد محادثات" : "No messages yet"}</strong>
                        <p>
                          {messageSearch
                            ? (isArabic ? "لم نعثر على محادثة بهذا الاسم." : "No conversations match your search.")
                            : (isArabic ? "ابدأ محادثة جديدة مع شخص من مجتمع LOLZ." : "Start a conversation with someone on LOLZ.")}
                        </p>
                        {!messageSearch && (
                          <button type="button" onClick={() => goTo("people")}>
                            {isArabic ? "العثور على أشخاص" : "Find people"}
                          </button>
                        )}
                      </div>
                    ) : (
                      conversations
                        .filter((conversation) => {
                          const person = conversation.otherProfile || {};
                          const query = messageSearch.trim().toLowerCase();
                          const name = [
                            person.display_name,
                            person.full_name,
                            person.username,
                            conversation.lastMessage?.content,
                          ].filter(Boolean).join(" ").toLowerCase();
                          return !query || name.includes(query);
                        })
                        .map((conversation) => {
                          const person = conversation.otherProfile || {};
                          const name =
                            person.display_name ||
                            person.full_name ||
                            person.username ||
                            t("Member");
                          const lastMessage = conversation.lastMessage;
                          const preview =
                            lastMessage?.message_type === "image"
                              ? (isArabic ? "أرسل صورة" : "Sent a photo")
                              : lastMessage?.message_type === "video"
                              ? (isArabic ? "أرسل فيديو" : "Sent a video")
                              : lastMessage?.message_type === "audio"
                              ? (isArabic ? "رسالة صوتية" : "Voice message")
                              : lastMessage?.content || (isArabic ? "ابدأ المحادثة" : "Start a conversation");

                          return (
                            <button
                              key={conversation.id}
                              type="button"
                              className={`ig-dm-thread ${
                                activeConversation?.id === conversation.id ? "active" : ""
                              }`}
                              onClick={async () => {
                                setActiveConversation(conversation);
                                setConversationMessages([]);
                                setMessageText("");
                                setMessageFile(null);
                                setVoiceFile(null);
                                shouldAutoScrollRef.current = true;
                                if (messageMediaInput.current) {
                                  messageMediaInput.current.value = "";
                                }
                                await loadMessages(conversation.id);
                              }}
                            >
                              <span className="ig-dm-thread-avatar">
                                <Avatar url={person.avatar_url} name={name} size="large" />
                              </span>
                              <span className="ig-dm-thread-copy">
                                <strong>{name}</strong>
                                <small>{preview}</small>
                              </span>
                              <span className="ig-dm-thread-meta">
                                {lastMessage?.created_at ? timeAgo(lastMessage.created_at, isArabic) : ""}
                              </span>
                            </button>
                          );
                        })
                    )}
                  </div>
                </aside>

                <section className="ig-dm-chat">
                  {activeConversation ? (
                    <>
                      <header className="ig-dm-chat-header">
                        <button
                          type="button"
                          className="ig-dm-back ig-dm-icon-button"
                          onClick={() => {
                            setActiveConversation(null);
                            setConversationMessages([]);
                            setMessageText("");
                            setMessageFile(null);
                            setVoiceFile(null);
                            if (messageMediaInput.current) {
                              messageMediaInput.current.value = "";
                            }
                          }}
                          aria-label={isArabic ? "العودة إلى المحادثات" : "Back to messages"}
                        >
                          <ArrowLeft size={21} />
                        </button>

                        <button
                          type="button"
                          className="ig-dm-chat-person"
                          onClick={() => openUserProfile(activeConversation.otherProfile?.id)}
                        >
                          <Avatar
                            url={activeConversation.otherProfile?.avatar_url}
                            name={
                              activeConversation.otherProfile?.display_name ||
                              activeConversation.otherProfile?.username ||
                              t("Member")
                            }
                            size="large"
                          />
                          <span>
                            <strong>
                              {activeConversation.otherProfile?.display_name ||
                                activeConversation.otherProfile?.full_name ||
                                activeConversation.otherProfile?.username ||
                                t("Member")}
                            </strong>
                            <small>
                              @{activeConversation.otherProfile?.username || "user"}
                            </small>
                          </span>
                        </button>

                        <div className="ig-dm-chat-actions">
                          <button
                            type="button"
                            className="ig-dm-icon-button"
                            onClick={() => callActionsRef.current?.startAudio?.()}
                            title={isArabic ? "اتصال صوتي" : "Voice call"}
                            aria-label={isArabic ? "اتصال صوتي" : "Voice call"}
                          >
                            <Phone size={21} />
                          </button>
                          <button
                            type="button"
                            className="ig-dm-icon-button"
                            onClick={() => callActionsRef.current?.startVideo?.()}
                            title={isArabic ? "مكالمة فيديو" : "Video call"}
                            aria-label={isArabic ? "مكالمة فيديو" : "Video call"}
                          >
                            <Video size={22} />
                          </button>
                          <button
                            type="button"
                            className="ig-dm-icon-button ig-dm-info-button"
                            onClick={() => openUserProfile(activeConversation.otherProfile?.id)}
                            title={isArabic ? "معلومات الحساب" : "Profile information"}
                            aria-label={isArabic ? "معلومات الحساب" : "Profile information"}
                          >
                            <Info size={21} />
                          </button>
                        </div>
                      </header>

                      <div
                        className="ig-dm-message-feed"
                        onScroll={(event) => {
                          const container = event.currentTarget;
                          const distanceFromBottom =
                            container.scrollHeight -
                            container.scrollTop -
                            container.clientHeight;
                          shouldAutoScrollRef.current = distanceFromBottom < 150;
                        }}
                      >
                        {conversationMessages.length === 0 && !messagesLoading && (
                          <div className="ig-dm-profile-intro">
                            <div className="ig-dm-profile-avatar">
                              <Avatar
                                url={activeConversation.otherProfile?.avatar_url}
                                name={
                                  activeConversation.otherProfile?.display_name ||
                                  activeConversation.otherProfile?.username ||
                                  t("Member")
                                }
                                size="profile"
                              />
                            </div>
                            <strong>
                              {activeConversation.otherProfile?.display_name ||
                                activeConversation.otherProfile?.full_name ||
                                activeConversation.otherProfile?.username ||
                                t("Member")}
                            </strong>
                            <span>@{activeConversation.otherProfile?.username || "user"}</span>
                            <button
                              type="button"
                              onClick={() => openUserProfile(activeConversation.otherProfile?.id)}
                            >
                              {isArabic ? "عرض الملف الشخصي" : "View profile"}
                            </button>
                          </div>
                        )}

                        {messagesLoading ? (
                          <div className="ig-dm-feed-state">
                            <span className="ig-dm-loader" />
                            <p>{isArabic ? "جارٍ تحميل الرسائل..." : "Loading messages..."}</p>
                          </div>
                        ) : conversationMessages.length === 0 ? (
                          <div className="ig-dm-first-message">
                            <MessageCircle size={24} />
                            <strong>{isArabic ? "ابدأ المحادثة" : "Start a conversation"}</strong>
                            <span>{isArabic ? "أرسل أول رسالة إلى هذا الحساب." : "Send a message to get the conversation started."}</span>
                          </div>
                        ) : (
                          <div className="ig-dm-message-list">
                            {conversationMessages.map((message) => {
                              const mine = message.sender_id === user.id;
                              const isImage =
                                message.message_type === "image" && message.media_url;
                              const isVideo =
                                message.message_type === "video" && message.media_url;
                              const isAudio =
                                message.message_type === "audio" && message.media_url;
                              const isMedia = isImage || isVideo || isAudio;

                              return (
                                <div
                                  key={message.id}
                                  className={`ig-dm-message-row ${mine ? "mine" : "theirs"}`}
                                >
                                  <div className={`ig-dm-bubble ${mine ? "mine" : "theirs"} ${isMedia ? "media" : ""}`}>
                                    {isImage && (
                                      <a href={message.media_url} target="_blank" rel="noreferrer">
                                        <img
                                          src={message.media_url}
                                          alt={message.file_name || "Shared image"}
                                          loading="lazy"
                                        />
                                      </a>
                                    )}
                                    {isVideo && (
                                      <video
                                        src={message.media_url}
                                        controls
                                        playsInline
                                        preload="metadata"
                                      />
                                    )}
                                    {isAudio && (
                                      <audio
                                        src={message.media_url}
                                        controls
                                        preload="metadata"
                                      />
                                    )}
                                    {(!isMedia ||
                                      (message.content &&
                                        !["Photo", "Video", "Voice message"].includes(message.content))) && (
                                      <p>{message.content}</p>
                                    )}
                                    <time>{timeAgo(message.created_at, isArabic)}</time>
                                    {!mine && (
                                      <button
                                        type="button"
                                        className="comment-report-button"
                                        onClick={() =>
                                          setModerationTarget({
                                            type: "message",
                                            id: message.id,
                                            targetUserId: message.sender_id,
                                          })
                                        }
                                      >
                                        {isArabic ? "الإبلاغ عن الرسالة" : "Report message"}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        <div ref={messagesEndRef} />
                      </div>

                      {(messageFile && messageFilePreview) && (
                        <div className="ig-dm-attachment-preview">
                          {messageFile.type.startsWith("image/") ? (
                            <img src={messageFilePreview} alt="Preview" />
                          ) : (
                            <video src={messageFilePreview} controls />
                          )}
                          <div>
                            <strong>{messageFile.name}</strong>
                            <small>{(messageFile.size / (1024 * 1024)).toFixed(2)} MB</small>
                          </div>
                          <button type="button" onClick={clearMessageFile} disabled={messageSending}>
                            <X size={17} />
                          </button>
                        </div>
                      )}

                      <form className="ig-dm-composer" onSubmit={sendMessage}>
                        <input
                          ref={messageMediaInput}
                          type="file"
                          accept="image/*,video/*"
                          hidden
                          onChange={handleMessageFileChange}
                        />
                        <button
                          type="button"
                          className="ig-dm-composer-icon"
                          onClick={() => messageMediaInput.current?.click()}
                          disabled={messageSending || isRecording || !!voiceFile}
                          title={isArabic ? "إرفاق صورة أو فيديو" : "Attach a photo or video"}
                          aria-label={isArabic ? "إرفاق صورة أو فيديو" : "Attach a photo or video"}
                        >
                          <ImagePlus size={22} />
                        </button>

                        {!voiceFile && (
                          <button
                            type="button"
                            className={`ig-dm-composer-icon ig-dm-mic ${isRecording ? "recording" : ""}`}
                            onPointerDown={handleVoicePointerDown}
                            onPointerUp={handleVoicePointerUp}
                            onPointerCancel={handleVoicePointerCancel}
                            onContextMenu={(event) => event.preventDefault()}
                            disabled={messageSending || !!messageFile}
                            title={isArabic ? "اضغط مطولاً لتسجيل رسالة صوتية" : "Hold to record a voice message"}
                            aria-label={isArabic ? "تسجيل رسالة صوتية" : "Record a voice message"}
                          >
                            <Mic size={21} />
                          </button>
                        )}

                        {isRecording && (
                          <div className="ig-dm-recording-state">
                            <span />
                            {isArabic ? "جارٍ التسجيل" : "Recording"} {Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, "0")}
                            <button type="button" onClick={stopVoiceRecording}>■</button>
                            <button type="button" onClick={cancelVoiceRecording}><X size={14} /></button>
                          </div>
                        )}

                        {voiceFile && (
                          <div className="ig-dm-voice-preview">
                            <audio src={voiceFilePreview} controls preload="metadata" />
                            <button type="button" onClick={() => setVoiceFile(null)} aria-label={isArabic ? "حذف التسجيل" : "Remove recording"}>
                              <X size={16} />
                            </button>
                          </div>
                        )}

                        <input
                          className="ig-dm-composer-input"
                          value={messageText}
                          onChange={(event) => setMessageText(event.target.value)}
                          placeholder={isArabic ? "اكتب رسالة..." : "Message..."}
                          disabled={messageSending || isRecording}
                        />

                        <button
                          className="ig-dm-send-button"
                          type="submit"
                          disabled={
                            messageSending ||
                            isRecording ||
                            (!messageText.trim() && !messageFile && !voiceFile)
                          }
                          aria-label={isArabic ? "إرسال الرسالة" : "Send message"}
                        >
                          {messageSending ? <span className="ig-dm-send-spinner" /> : <Send size={19} />}
                        </button>
                      </form>
                      <small className="ig-dm-upload-hint">
                        {isArabic ? "الصور والفيديوهات حتى 100 ميغابايت" : "Photos and videos up to 100 MB"}
                      </small>
                    </>
                  ) : (
                    <div className="ig-dm-welcome">
                      <div className="ig-dm-welcome-icon"><Send size={26} /></div>
                      <h2>{isArabic ? "رسائلك" : "Your messages"}</h2>
                      <p>{isArabic ? "أرسل صوراً ورسائل إلى أصدقائك على LOLZ." : "Send private messages, photos and voice notes to your friends on LOLZ."}</p>
                      <button type="button" onClick={() => goTo("people")}>
                        {isArabic ? "رسالة جديدة" : "New message"}
                      </button>
                    </div>
                  )}
                </section>
              </div>
            </section>
          )}

          {activePage === "activity" && (
            <section className="other-page">
              <div className="notifications-heading">
                <div>
                  <span className="eyebrow">{t("STAY IN THE LOOP")}</span>
                  <h1>{t("Notifications")}</h1>
                  <p>
                    {unreadCount > 0
                      ? `${t("You have")} ${unreadCount} ${t(
                          "unread notifications."
                        )}`
                      : t("You're all caught up.")}
                  </p>
                </div>

                {unreadCount > 0 && (
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={markAllNotificationsRead}
                  >
                    {t("Mark all as read")}
                  </button>
                )}
              </div>

              {notificationLoading ? (
                <p>{t("Loading notifications...")}</p>
              ) : notifications.length === 0 ? (
                <div className="empty-state">
                  <span>✦</span>
                  <h3>{t("No notifications yet")}</h3>
                  <p>
                    {t(
                      "Likes, comments and new followers will appear here."
                    )}
                  </p>
                </div>
              ) : (
                <div className="notifications-list">
                  {notifications.map((item) => {
                    const actor = item.actor || {};
                    const actorName =
                      actor.display_name ||
                      actor.full_name ||
                      actor.username ||
                      t("Someone");

                    const messages = {
                      like: t("liked your post."),
                      comment: t("commented on your post."),
                      follow: t("started following you."),
                    };

                    const message =
                      messages[item.type] || t("interacted with you.");

                    return (
                      <article
                        key={item.id}
                        className={`notification-item ${
                          item.is_read ? "" : "unread"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => openUserProfile(item.actor_id)}
                          aria-label={actorName}
                          className="notification-avatar"
                        >
                          <Avatar
                            url={actor.avatar_url}
                            name={actorName}
                            size="large"
                          />
                        </button>

                        <div className="notification-content">
                          <p>
                            <strong>{actorName}</strong> {message}
                          </p>
                          <span>
                            {timeAgo(item.created_at, isArabic)}
                          </span>
                        </div>

                        {!item.is_read && (
                          <>
                            <span className="unread-dot" />
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => markNotificationRead(item.id)}
                            >
                              {t("Read")}
                            </button>
                          </>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {activePage === "blocked" && (
            <section className="other-page lolz-blocked-page">
              <span className="eyebrow">{isArabic ? "الخصوصية والتحكم" : "PRIVACY & CONTROL"}</span>
              <h1>{isArabic ? "الحسابات المحظورة" : "Blocked accounts"}</h1>
              <p>{isArabic ? "لن تظهر منشورات هذه الحسابات في خلاصتك أو قصصك." : "Posts and stories from these accounts are hidden from your feed."}</p>

              {blockedLoading ? (
                <div className="empty-state">{isArabic ? "جارٍ التحميل..." : "Loading..."}</div>
              ) : blockedProfiles.length === 0 ? (
                <div className="empty-state">
                  <h3>{isArabic ? "لا توجد حسابات محظورة" : "No blocked accounts"}</h3>
                </div>
              ) : (
                <div className="lolz-blocked-list">
                  {blockedProfiles.map((person) => (
                    <article className="lolz-blocked-item" key={person.id}>
                      <Avatar url={person.avatar_url} name={person.display_name || person.username} size="large" />
                      <div>
                        <strong>{person.display_name || person.username}</strong>
                        <span>@{person.username || "member"}</span>
                      </div>
                      <button type="button" className="secondary-button" onClick={() => void unblockUser(person.id)}>
                        {isArabic ? "إلغاء الحظر" : "Unblock"}
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {activePage === "moderation" && user?.app_metadata?.role === "admin" && (
            <section className="other-page lolz-moderation-page">
              <span className="eyebrow">{isArabic ? "مركز الثقة والأمان" : "TRUST & SAFETY"}</span>
              <h1>{isArabic ? "مراجعة البلاغات" : "Report review"}</h1>
              <p>{isArabic ? "البلاغات المرسلة من مستخدمي LOLZ." : "Reports submitted by LOLZ members."}</p>

              <div className="lolz-report-toolbar">
                <strong>
                  {moderationReports.length} {isArabic ? "بلاغ" : "reports"}
                </strong>
                <button type="button" className="secondary-button" onClick={() => void loadReports()} disabled={moderationLoading}>
                  {moderationLoading ? (isArabic ? "جارٍ التحميل..." : "Loading...") : (isArabic ? "تحديث" : "Refresh")}
                </button>
              </div>

              {moderationLoading ? (
                <div className="empty-state">{isArabic ? "جارٍ تحميل البلاغات..." : "Loading reports..."}</div>
              ) : moderationReports.length === 0 ? (
                <div className="empty-state">
                  <h3>{isArabic ? "لا توجد بلاغات" : "No reports"}</h3>
                  <p>{isArabic ? "ستظهر البلاغات الجديدة هنا." : "New reports will appear here."}</p>
                </div>
              ) : (
                <div className="lolz-report-list">
                  {moderationReports.map((report) => (
                    <article className="lolz-report-card" key={report.id}>
                      <div className="lolz-report-card-top">
                        <strong>{report.target_type} · {report.reason}</strong>
                        <span className={"lolz-report-status status-" + report.status}>{report.status}</span>
                      </div>
                      <p>
                        {isArabic ? "المبلّغ: " : "Reporter: "}
                        @{report.reporter?.username || report.reporter_id}
                      </p>
                      <p>
                        {isArabic ? "معرّف المحتوى: " : "Target ID: "}
                        <code>{report.target_id}</code>
                      </p>
                      {report.details && <blockquote>{report.details}</blockquote>}
                      <small>{new Date(report.created_at).toLocaleString(isArabic ? "ar" : "en")}</small>
                      <div className="lolz-report-actions">
                        {report.status !== "reviewing" && (
                          <button type="button" className="secondary-button" onClick={() => void updateReportStatus(report.id, "reviewing")}>
                            {isArabic ? "قيد المراجعة" : "Reviewing"}
                          </button>
                        )}
                        {report.status !== "resolved" && (
                          <button type="button" className="primary-button" onClick={() => void updateReportStatus(report.id, "resolved")}>
                            {isArabic ? "تمت المعالجة" : "Resolve"}
                          </button>
                        )}
                        {report.status !== "rejected" && (
                          <button type="button" className="secondary-button" onClick={() => void updateReportStatus(report.id, "rejected")}>
                            {isArabic ? "رفض البلاغ" : "Reject"}
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {activePage === "premium" && (
            <section className="other-page">
              <Premium
                isArabic={isArabic}
                onStartCheckout={startPremiumCheckout}
                onCancelSubscription={cancelPremiumSubscription}
                subscriptionEnd={subscriptionInfo?.next_billing_time || null}
                isPremium={isPremium}
              />
            </section>
          )}

          {activePage === "settings" && (
            <section className="other-page">
              <span className="eyebrow">
                {t("PERSONALIZE YOUR EXPERIENCE")}
              </span>
              <PreferencesSettings />
            </section>
          )}
        </div>
      </main>

      {currentCallContext && (
        <div className="lolz-call-dock">
          <Calls
            supabase={supabase}
            user={user}
            conversation={currentCallContext.conversation || null}
            callType={currentCallContext.callType || "private"}
            groupId={currentCallContext.groupId || null}
            channelId={currentCallContext.channelId || null}
            canStart={currentCallContext.canStart === true}
            canEnd={currentCallContext.canEnd === true}
            onCallStateChange={handleCallStateChange}
            onCallActionsReady={registerPrivateCallActions}
            showIdleControls={showIdleCallControls}
          />
        </div>
      )}

      {activeStoryId && (
        <StoryViewer
          key={activeStoryId}
          stories={stories}
          startStoryId={activeStoryId}
          currentUserId={user.id}
          isArabic={isArabic}
          onView={recordStoryView}
          onReport={setModerationTarget}
          onReply={replyToStory}
          onClose={closeStoryViewer}
        />
      )}

      {moderationTarget && (
        <ModerationDialog
          target={moderationTarget}
          isArabic={isArabic}
          onClose={() => setModerationTarget(null)}
          onSubmitReport={reportContent}
          onConfirmBlock={blockUser}
        />
      )}
    </div>
  );
}

function PostList({
  posts,
  likedPosts,
  savedPosts,
  onLike,
  onSave,
  onComments,
  openComments,
  comments,
  commentText,
  setCommentText,
  onAddComment,
  onOpenProfile,
  onReport,
  onBlock,
  currentUserId,
  t,
  isArabic,
}) {
  const [openPostMenu, setOpenPostMenu] = useState(null);

  if (!posts.length) {
    return (
      <div className="empty-state">
        <div className="feed-empty-icon">✦</div>
        <h3>{t("Nothing here yet")}</h3>
        <p>{t("When posts are available, they will appear here.")}</p>
      </div>
    );
  }

  const icons = {
    heart: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20.8 8.8c0 4.1-7.3 9.2-8.3 9.9a.8.8 0 0 1-1 0c-1-.7-8.3-5.8-8.3-9.9a4.5 4.5 0 0 1 8.5-2.1 4.5 4.5 0 0 1 8.5 2.1Z" />
      </svg>
    ),
    comment: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20 11.5a8 8 0 0 1-8 8 8.7 8.7 0 0 1-3.5-.7L4 20l1.2-3.7a8 8 0 1 1 14.8-4.8Z" />
      </svg>
    ),
    bookmark: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 4.8A1.8 1.8 0 0 1 7.8 3h8.4A1.8 1.8 0 0 1 18 4.8V21l-6-4-6 4V4.8Z" />
      </svg>
    ),
    send: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m21 3-7.2 18-3.5-7.3L3 10.2 21 3Z" />
        <path d="m10.3 13.7 4.5-4.5" />
      </svg>
    ),
  };

  return (
    <div className="posts-list">
      {posts.map((post) => {
        const author = post.author || {};

        const name =
          author.display_name ||
          author.full_name ||
          author.username ||
          t("Member");

        const liked = likedPosts.includes(post.id);
        const saved = savedPosts.includes(post.id);

        return (
          <article className="post-card" key={post.id}>
            <div className="post-header">
              <button
                type="button"
                onClick={() => onOpenProfile?.(post.user_id)}
                aria-label={name}
                className="post-avatar-button"
              >
                <Avatar
                  url={author.avatar_url}
                  name={name}
                  size="large"
                />
              </button>

              <div className="post-author">
                <button
                  type="button"
                  onClick={() => onOpenProfile?.(post.user_id)}
                  className="post-author-name"
                >
                  {name}
                </button>

                <span>
                  @{author.username || "member"}
                  <span className="post-meta-dot">·</span>
                  {timeAgo(post.created_at, isArabic)}
                </span>
              </div>

              <div
                className="post-menu-wrap"
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) {
                    setOpenPostMenu(null);
                  }
                }}
              >
                <button
                  type="button"
                  className="post-menu"
                  aria-label={t("More options")}
                  title={t("More options")}
                  aria-expanded={openPostMenu === post.id}
                  onClick={() =>
                    setOpenPostMenu((current) =>
                      current === post.id ? null : post.id
                    )
                  }
                >
                  <span>•••</span>
                </button>

                {openPostMenu === post.id && (
                  <div className="post-dropdown-menu" role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        onSave(post.id);
                        setOpenPostMenu(null);
                      }}
                    >
                      {saved
                        ? isArabic ? "إزالة من المحفوظات" : "Remove from saved"
                        : isArabic ? "حفظ المنشور" : "Save post"}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        onComments(post.id);
                        setOpenPostMenu(null);
                      }}
                    >
                      {isArabic ? "عرض التعليقات" : "View comments"}
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        onOpenProfile?.(post.user_id);
                        setOpenPostMenu(null);
                      }}
                    >
                      {isArabic ? "عرض الملف الشخصي" : "View profile"}
                    </button>
                    {post.user_id !== currentUserId && (
                      <>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            onReport?.({
                              type: "post",
                              id: post.id,
                              targetUserId: post.user_id,
                            });
                            setOpenPostMenu(null);
                          }}
                        >
                          {isArabic ? "الإبلاغ عن المنشور" : "Report post"}
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            onBlock?.(post.user_id);
                            setOpenPostMenu(null);
                          }}
                        >
                          {isArabic ? "حظر الحساب" : "Block account"}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {post.content && (
              <p className="post-content">{post.content}</p>
            )}

            {post.image_url && (
              <div className="post-image">
                <img
                  src={post.image_url}
                  alt="Post"
                  loading="lazy"
                />
              </div>
            )}

            <div className="post-stats">
              <span className="post-likes-count">
                <span className="post-mini-heart">♥</span>
                {post.likesCount || 0} {t("likes")}
              </span>

              <button
                type="button"
                onClick={() => onComments(post.id)}
              >
                {t("View comments")}
              </button>
            </div>

            <div className="post-actions">
              <button
                type="button"
                className={liked ? "liked" : ""}
                onClick={() => onLike(post.id)}
                aria-label={t("Like")}
              >
                <span className="post-action-icon">
                  {icons.heart}
                </span>
                <span>{t("Like")}</span>
              </button>

              <button
                type="button"
                onClick={() => onComments(post.id)}
                aria-label={t("Comment")}
              >
                <span className="post-action-icon">
                  {icons.comment}
                </span>
                <span>{t("Comment")}</span>
              </button>

              <button
                type="button"
                className={saved ? "saved" : ""}
                onClick={() => onSave(post.id)}
                aria-label={t("Save")}
              >
                <span className="post-action-icon">
                  {icons.bookmark}
                </span>
                <span>{saved ? t("Saved") : t("Save")}</span>
              </button>
            </div>

            {openComments === post.id && (
              <div className="comments-area">
                <div className="comments-heading">
                  {t("Comments")}
                </div>

                {comments.map((comment) => (
                  <div className="comment-item" key={comment.id}>
                    <Avatar
                      url={comment.author?.avatar_url}
                      name={
                        comment.author?.display_name ||
                        comment.author?.username ||
                        t("Member")
                      }
                      size="small"
                    />

                    <div className="comment-body">
                      <strong>
                        {comment.author?.display_name ||
                          comment.author?.username ||
                          t("Member")}
                      </strong>
                      <p>{comment.content}</p>
                      {comment.user_id !== currentUserId && (
                        <button
                          type="button"
                          className="comment-report-button"
                          onClick={() =>
                            onReport?.({
                              type: "comment",
                              id: comment.id,
                              targetUserId: comment.user_id,
                            })
                          }
                        >
                          {isArabic ? "الإبلاغ عن التعليق" : "Report comment"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                <form
                  className="comment-form"
                  onSubmit={(event) =>
                    onAddComment(event, post.id)
                  }
                >
                  <input
                    value={commentText}
                    onChange={(event) =>
                      setCommentText(event.target.value)
                    }
                    placeholder={t("Write a comment...")}
                  />

                  <button
                    type="submit"
                    className="comment-send-button"
                    aria-label={t("Send")}
                  >
                    {icons.send}
                  </button>
                </form>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
