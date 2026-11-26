import { useState } from "react";
import { usePreferences } from "./PreferencesProvider";

const LANGUAGES = [
  ["ar", "العربية", "🇸🇦"], ["en", "English", "🇬🇧"],
  ["nl", "Nederlands", "🇳🇱"], ["de", "Deutsch", "🇩🇪"],
  ["fr", "Français", "🇫🇷"], ["es", "Español", "🇪🇸"],
  ["tr", "Türkçe", "🇹🇷"], ["ru", "Русский", "🇷🇺"],
  ["it", "Italiano", "🇮🇹"], ["pt", "Português", "🇵🇹"],
  ["ur", "اردو", "🇵🇰"], ["hi", "हिन्दी", "🇮🇳"],
];

const COPY = {
  ar: { title:"الإعدادات", subtitle:"خصص تجربتك في LOLZ", appearance:"المظهر", dark:"داكن", light:"فاتح", language:"لغة التطبيق", calls:"المكالمات في الخلفية", callsDesc:"السماح باستمرار المكالمة عند تصغير التطبيق (يتطلب دعم Android)", on:"مفعّل", off:"متوقف", accent:"لون الواجهة", font:"حجم النص", normal:"عادي", large:"كبير", motion:"تقليل الحركة", motionDesc:"تقليل الحركات والانتقالات", alerts:"تفضيلات الإشعارات", likes:"الإعجابات والتعليقات", messages:"الرسائل", callAlerts:"المكالمات", save:"جارٍ الحفظ…", failed:"تعذر حفظ الإعدادات" },
  en: { title:"Settings", subtitle:"Make LOLZ feel like yours", appearance:"Appearance", dark:"Dark", light:"Light", language:"App language", calls:"Background calls", callsDesc:"Allow calls to continue when minimized (requires Android support)", on:"Enabled", off:"Off", accent:"Accent color", font:"Text size", normal:"Normal", large:"Large", motion:"Reduce motion", motionDesc:"Reduce animations and transitions", alerts:"Notification preferences", likes:"Likes & comments", messages:"Messages", callAlerts:"Calls", save:"Saving…", failed:"Could not save settings" },
  nl: { title:"Instellingen", subtitle:"Maak LOLZ helemaal van jou", appearance:"Weergave", dark:"Donker", light:"Licht", language:"App-taal", calls:"Gesprekken op de achtergrond", callsDesc:"Gesprekken laten doorgaan wanneer de app is geminimaliseerd", on:"Aan", off:"Uit", accent:"Accentkleur", font:"Tekstgrootte", normal:"Normaal", large:"Groot", motion:"Minder beweging", motionDesc:"Animaties en overgangen verminderen", alerts:"Meldingsvoorkeuren", likes:"Vind-ik-leuks en reacties", messages:"Berichten", callAlerts:"Oproepen", save:"Opslaan…", failed:"Instellingen opslaan mislukt" },
  de: { title:"Einstellungen", subtitle:"Gestalte dein LOLZ-Erlebnis", appearance:"Darstellung", dark:"Dunkel", light:"Hell", language:"App-Sprache", calls:"Anrufe im Hintergrund", callsDesc:"Anrufe bei minimierter App fortsetzen", on:"Ein", off:"Aus", accent:"Akzentfarbe", font:"Textgröße", normal:"Normal", large:"Groß", motion:"Bewegung reduzieren", motionDesc:"Animationen und Übergänge reduzieren", alerts:"Benachrichtigungen", likes:"Likes und Kommentare", messages:"Nachrichten", callAlerts:"Anrufe", save:"Speichern…", failed:"Einstellungen konnten nicht gespeichert werden" },
  fr: { title:"Paramètres", subtitle:"Personnalisez votre expérience LOLZ", appearance:"Apparence", dark:"Sombre", light:"Clair", language:"Langue de l’application", calls:"Appels en arrière-plan", callsDesc:"Continuer les appels lorsque l’application est réduite", on:"Activé", off:"Désactivé", accent:"Couleur d’accent", font:"Taille du texte", normal:"Normale", large:"Grande", motion:"Réduire les animations", motionDesc:"Réduire les animations et transitions", alerts:"Notifications", likes:"J’aime et commentaires", messages:"Messages", callAlerts:"Appels", save:"Enregistrement…", failed:"Impossible d’enregistrer" },
  es: { title:"Ajustes", subtitle:"Personaliza tu experiencia LOLZ", appearance:"Apariencia", dark:"Oscuro", light:"Claro", language:"Idioma de la aplicación", calls:"Llamadas en segundo plano", callsDesc:"Mantener llamadas al minimizar la aplicación", on:"Activado", off:"Desactivado", accent:"Color de acento", font:"Tamaño del texto", normal:"Normal", large:"Grande", motion:"Reducir movimiento", motionDesc:"Reducir animaciones y transiciones", alerts:"Notificaciones", likes:"Me gusta y comentarios", messages:"Mensajes", callAlerts:"Llamadas", save:"Guardando…", failed:"No se pudo guardar" },
  tr: { title:"Ayarlar", subtitle:"LOLZ deneyimini kişiselleştir", appearance:"Görünüm", dark:"Koyu", light:"Açık", language:"Uygulama dili", calls:"Arka planda aramalar", callsDesc:"Uygulama küçültüldüğünde aramaları sürdür", on:"Açık", off:"Kapalı", accent:"Vurgu rengi", font:"Yazı boyutu", normal:"Normal", large:"Büyük", motion:"Hareketi azalt", motionDesc:"Animasyonları ve geçişleri azalt", alerts:"Bildirim tercihleri", likes:"Beğeniler ve yorumlar", messages:"Mesajlar", callAlerts:"Aramalar", save:"Kaydediliyor…", failed:"Ayarlar kaydedilemedi" },
  ru: { title:"Настройки", subtitle:"Настройте LOLZ под себя", appearance:"Внешний вид", dark:"Тёмная", light:"Светлая", language:"Язык приложения", calls:"Звонки в фоне", callsDesc:"Продолжать звонки при сворачивании приложения", on:"Включено", off:"Выключено", accent:"Цвет акцента", font:"Размер текста", normal:"Обычный", large:"Крупный", motion:"Уменьшить движение", motionDesc:"Уменьшить анимацию и переходы", alerts:"Уведомления", likes:"Отметки и комментарии", messages:"Сообщения", callAlerts:"Звонки", save:"Сохранение…", failed:"Не удалось сохранить" },
  it: { title:"Impostazioni", subtitle:"Personalizza la tua esperienza LOLZ", appearance:"Aspetto", dark:"Scuro", light:"Chiaro", language:"Lingua dell’app", calls:"Chiamate in background", callsDesc:"Continua le chiamate quando l’app è ridotta", on:"Attivo", off:"Disattivo", accent:"Colore principale", font:"Dimensione testo", normal:"Normale", large:"Grande", motion:"Riduci movimento", motionDesc:"Riduci animazioni e transizioni", alerts:"Notifiche", likes:"Mi piace e commenti", messages:"Messaggi", callAlerts:"Chiamate", save:"Salvataggio…", failed:"Impossibile salvare" },
  pt: { title:"Configurações", subtitle:"Personalize sua experiência LOLZ", appearance:"Aparência", dark:"Escuro", light:"Claro", language:"Idioma do aplicativo", calls:"Chamadas em segundo plano", callsDesc:"Continuar chamadas ao minimizar o aplicativo", on:"Ativado", off:"Desativado", accent:"Cor de destaque", font:"Tamanho do texto", normal:"Normal", large:"Grande", motion:"Reduzir movimento", motionDesc:"Reduzir animações e transições", alerts:"Notificações", likes:"Curtidas e comentários", messages:"Mensagens", callAlerts:"Chamadas", save:"Salvando…", failed:"Não foi possível salvar" },
  ur: { title:"ترتیبات", subtitle:"اپنا LOLZ تجربہ اپنی مرضی کے مطابق بنائیں", appearance:"ظاہری شکل", dark:"ڈارک", light:"لائٹ", language:"ایپ کی زبان", calls:"پس منظر میں کالز", callsDesc:"ایپ کم سے کم ہونے پر کال جاری رکھیں", on:"فعال", off:"بند", accent:"نمایاں رنگ", font:"متن کا سائز", normal:"معمول", large:"بڑا", motion:"حرکت کم کریں", motionDesc:"اینیمیشن اور تبدیلیاں کم کریں", alerts:"اطلاعات کی ترجیحات", likes:"پسند اور تبصرے", messages:"پیغامات", callAlerts:"کالز", save:"محفوظ ہو رہا ہے…", failed:"ترتیبات محفوظ نہیں ہو سکیں" },
  hi: { title:"सेटिंग्स", subtitle:"अपने LOLZ अनुभव को अनुकूलित करें", appearance:"दिखावट", dark:"डार्क", light:"लाइट", language:"ऐप की भाषा", calls:"बैकग्राउंड कॉल", callsDesc:"ऐप छोटा होने पर कॉल जारी रखें", on:"चालू", off:"बंद", accent:"एक्सेंट रंग", font:"टेक्स्ट आकार", normal:"सामान्य", large:"बड़ा", motion:"गतिशीलता कम करें", motionDesc:"एनिमेशन और ट्रांज़िशन कम करें", alerts:"सूचना प्राथमिकताएँ", likes:"लाइक और टिप्पणियाँ", messages:"संदेश", callAlerts:"कॉल", save:"सहेजा जा रहा है…", failed:"सेटिंग्स सहेजी नहीं जा सकीं" },
};

export default function PreferencesSettings() {
  const { preferences, updatePreferences, loadingPreferences } = usePreferences();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const lang = preferences.language || "en";
  const t = COPY[lang] || COPY.en;
  const rtl = lang === "ar" || lang === "ur";

  async function change(changes) {
    setSaving(true); setError("");
    try { await updatePreferences(changes); }
    catch (e) { console.error("Preference update:", e); setError(t.failed); }
    finally { setSaving(false); }
  }

  const card = { background:"var(--panel)", border:"1px solid var(--border)", borderRadius:18, padding:18, marginTop:16 };
  const button = (active) => ({ border:active?"1px solid #8b5cf6":"1px solid var(--border)", background:active?"rgba(139,92,246,.18)":"var(--panel-2)", color:"var(--text)", borderRadius:12, padding:"11px 15px", fontWeight:650, cursor:"pointer" });
  const switchStyle = (active) => ({ width:48,height:28,border:0,borderRadius:30,background:active?"#8b5cf6":"#687080",padding:3,display:"flex",justifyContent:active?"flex-end":"flex-start",alignItems:"center",cursor:"pointer" });
  const toggle = (key) => change({ [key]: preferences[key] !== true });

  return <main dir={rtl?"rtl":"ltr"} style={{maxWidth:760,margin:"0 auto",padding:"22px 16px 40px",color:"var(--text)"}}>
    <header style={{padding:"22px",borderRadius:22,background:"linear-gradient(130deg,rgba(139,92,246,.24),rgba(59,130,246,.12))",border:"1px solid rgba(139,92,246,.28)"}}>
      <div style={{fontSize:12,letterSpacing:2,color:"#a78bfa",fontWeight:800}}>LOLZ · PERSONAL SPACE</div>
      <h1 style={{fontSize:28,margin:"9px 0 5px"}}>{t.title}</h1>
      <div style={{color:"var(--muted)",fontSize:14}}>{t.subtitle}</div>
    </header>
    {loadingPreferences ? <p>Loading…</p> : <>
      <section style={card}>
        <h3 style={{margin:"0 0 14px"}}>🎨 {t.appearance}</h3>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <button style={button(preferences.theme==="dark")} onClick={()=>change({theme:"dark"})}>🌙 {t.dark}</button>
          <button style={button(preferences.theme==="light")} onClick={()=>change({theme:"light"})}>☀️ {t.light}</button>
        </div>
        <p style={{fontWeight:650,margin:"20px 0 10px"}}>{t.accent}</p>
        <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
          {["#8b5cf6","#3b82f6","#10b981","#f43f5e","#f59e0b"].map(color=><button key={color} aria-label={color} onClick={()=>change({accentColor:color})} style={{width:34,height:34,borderRadius:"50%",background:color,border:preferences.accentColor===color?"3px solid var(--text)":"2px solid transparent",cursor:"pointer"}} />)}
        </div>
      </section>
      <section style={card}>
        <h3 style={{margin:"0 0 14px"}}>🌐 {t.language}</h3>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))",gap:9}}>
          {LANGUAGES.map(([code,name,flag])=><button key={code} onClick={()=>change({language:code})} style={{...button(lang===code),display:"flex",alignItems:"center",gap:9,textAlign:"start"}}><span>{flag}</span><span>{name}</span>{lang===code&&<span style={{marginInlineStart:"auto"}}>✓</span>}</button>)}
        </div>
      </section>
      <section style={card}>
        <h3 style={{margin:"0 0 14px"}}>📞 {t.calls}</h3>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:14}}>
          <div style={{fontSize:13,color:"var(--muted)",lineHeight:1.6,flex:1}}>{t.callsDesc}</div>
          <button role="switch" aria-checked={preferences.backgroundCallsEnabled===true} onClick={()=>toggle("backgroundCallsEnabled")} style={switchStyle(preferences.backgroundCallsEnabled===true)}><span style={{width:22,height:22,borderRadius:"50%",background:"#fff"}} /></button>
        </div>
        <small style={{color:"var(--muted)"}}>{preferences.backgroundCallsEnabled?t.on:t.off}</small>
      </section>
      <section style={card}>
        <h3 style={{margin:"0 0 14px"}}>🔔 {t.alerts}</h3>
        {[["notifyLikes",t.likes],["notifyMessages",t.messages],["notifyCalls",t.callAlerts]].map(([key,label])=><div key={key} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderTop:"1px solid var(--border)"}}><span>{label}</span><button role="switch" aria-checked={preferences[key]!==false} onClick={()=>toggle(key)} style={switchStyle(preferences[key]!==false)}><span style={{width:22,height:22,borderRadius:"50%",background:"#fff"}} /></button></div>)}
      </section>
      <section style={card}>
        <h3 style={{margin:"0 0 14px"}}>♿ {t.font}</h3>
        <div style={{display:"flex",gap:10}}><button style={button((preferences.fontScale||"normal")==="normal")} onClick={()=>change({fontScale:"normal"})}>A {t.normal}</button><button style={button(preferences.fontScale==="large")} onClick={()=>change({fontScale:"large"})}>A+ {t.large}</button></div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:16}}><div><b>{t.motion}</b><div style={{fontSize:12,color:"var(--muted)"}}>{t.motionDesc}</div></div><button role="switch" aria-checked={preferences.reduceMotion===true} onClick={()=>toggle("reduceMotion")} style={switchStyle(preferences.reduceMotion===true)}><span style={{width:22,height:22,borderRadius:"50%",background:"#fff"}} /></button></div>
      </section>
    </>}
    {saving&&<p style={{color:"#a78bfa"}}>{t.save}</p>}
    {error&&<p role="alert" style={{color:"#ef4444"}}>{error}</p>}
  </main>;
}
