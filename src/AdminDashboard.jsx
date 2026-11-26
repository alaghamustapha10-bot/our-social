import {useCallback,useEffect,useState} from "react";
import {Activity,Ban,CheckCircle2,Crown,RefreshCw,Search,ShieldCheck,UserRound,UserX} from "lucide-react";
import VerifiedBadge from "./VerifiedBadge";
import "./AdminDashboard.css";
async function request(supabase,body){
 const {data,error}=await supabase.functions.invoke("lolz-admin",{body});
 if(error||data?.error){let message=data?.error||"";const response=error?.context;if(!message&&response&&typeof response.clone==="function"){const json=await response.clone().json().catch(()=>null);message=json?.error||json?.message||"";}if(!message&&error?.name==="FunctionsFetchError")message="تعذر الوصول إلى lolz-admin. انشر الدالة وتأكد من تطبيق ترحيل قاعدة البيانات.";throw new Error(message||error?.message||"Admin action failed.");}
 return data||{};
}
export default function AdminDashboard({supabase,user,isArabic=false}){
 const [stats,setStats]=useState(null),[query,setQuery]=useState(""),[users,setUsers]=useState([]),[loading,setLoading]=useState(true),[searching,setSearching]=useState(false),[busy,setBusy]=useState(""),[notice,setNotice]=useState("");
 const t=(en,ar)=>isArabic?ar:en;
 const refresh=useCallback(async()=>{setLoading(true);try{const r=await request(supabase,{action:"overview"});setStats(r.stats||{});setNotice("");}catch(e){setNotice(e.message);}finally{setLoading(false);}},[supabase]);
 useEffect(()=>{void refresh();},[refresh]);
 async function searchUsers(e){e?.preventDefault();if(query.trim().length<2){setNotice(t("Enter at least 2 characters.","اكتب حرفين على الأقل."));return;}setSearching(true);setNotice("");try{const r=await request(supabase,{action:"search_users",query:query.trim()});setUsers(r.users||[]);if(!(r.users||[]).length)setNotice(t("No accounts found.","لم يتم العثور على حسابات."));}catch(e){setNotice(e.message);}finally{setSearching(false);}}
 async function update(person,action,enabled){setBusy(person.id);setNotice("");try{await request(supabase,{action,target_user_id:person.id,enabled});setUsers(rows=>rows.map(p=>p.id!==person.id?p:{...p,...(action==="set_verified"?{is_verified:enabled}:{}),...(action==="set_premium"?{is_premium:enabled}:{}),...(action==="set_ban"?{is_banned:enabled}:{})}));setNotice(t("Account updated.","تم تحديث الحساب."));}catch(e){setNotice(e.message);}finally{setBusy("");}}
 const cards=[["users",t("Members","الأعضاء"),UserRound],["posts",t("Posts","المنشورات"),Activity],["videos",t("LOLZ videos","فيديوهات LOLZ"),Activity],["pending_reports",t("Pending reports","البلاغات المعلقة"),ShieldCheck]];
 return <div className="lolz-admin-page" dir={isArabic?"rtl":"ltr"}>
  <header className="lolz-admin-header"><div><span className="eyebrow">{t("OWNER CONTROL CENTER","مركز تحكم المالك")}</span><h1>{t("LOLZ administration","إدارة LOLZ")}</h1><p>{t("Manage accounts, verification, Premium and safety.","تحكم بالحسابات والتوثيق وPremium وسلامة المستخدمين.")}</p></div><button className="secondary-button" onClick={()=>void refresh()} disabled={loading}><RefreshCw size={16}/>{t("Refresh","تحديث")}</button></header>
  {notice&&<div className="lolz-admin-notice" role="status">{notice}</div>}
  <section className="lolz-admin-stats">{cards.map(([key,label,Icon])=><article className="lolz-admin-stat" key={key}><Icon/><span>{label}</span><strong>{loading?"…":stats?.[key]??"—"}</strong></article>)}</section>
  <section className="lolz-admin-section"><span className="eyebrow">{t("MEMBER MANAGEMENT","إدارة الأعضاء")}</span><h2>{t("Find an account","ابحث عن حساب")}</h2>
   <form className="lolz-admin-search" onSubmit={searchUsers}><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={t("Search by username or name…","ابحث باسم المستخدم أو الاسم الظاهر…")}/><button type="submit" className="primary-button" disabled={searching}>{searching?t("Searching…","جارٍ البحث…"):t("Search","بحث")}</button></form>
   {users.map(p=>{const protectedRole=["admin","owner"].includes(p.role),owner=user?.app_metadata?.role==="owner",name=p.display_name||p.username||"Member";return <article className="lolz-admin-user" key={p.id}><div className="lolz-admin-user-heading"><div className="lolz-admin-avatar">{p.avatar_url?<img src={p.avatar_url} alt=""/>:name.slice(0,1).toUpperCase()}</div><div><strong>{name} <VerifiedBadge verified={p.is_verified}/></strong><span>@{p.username||"member"}{protectedRole?" · "+p.role:""}</span><div className="lolz-admin-tags">{p.is_premium&&<span><Crown size={12}/> Premium</span>}{p.is_banned&&<span className="banned"><Ban size={12}/> {t("Suspended","موقوف")}</span>}</div></div></div><div className="lolz-admin-actions">
    <button type="button" className="primary-button" disabled={busy===p.id||(protectedRole&&p.id!==user?.id&&!owner)} onClick={()=>void update(p,"set_verified",!p.is_verified)}><ShieldCheck size={15}/>{p.is_verified?t("Remove badge","إزالة الشارة"):t("Verify","توثيق")}</button>
    <button type="button" className="secondary-button" disabled={busy===p.id||protectedRole} onClick={()=>void update(p,"set_premium",!p.is_premium)}><Crown size={15}/>{p.is_premium?t("Remove Premium","إزالة Premium"):t("Give Premium","منح Premium")}</button>
    <button type="button" className="secondary-button" disabled={busy===p.id||protectedRole||p.id===user?.id} onClick={()=>{const next=!p.is_banned;if(window.confirm(next?t("Suspend this account?","هل تريد تعليق هذا الحساب؟"):t("Restore this account?","هل تريد إعادة تفعيل هذا الحساب؟")))void update(p,"set_ban",next);}}>{p.is_banned?<CheckCircle2 size={15}/>:<UserX size={15}/>} {p.is_banned?t("Restore","إعادة"):t("Suspend","تعليق")}</button>
   </div></article>;})}
   {!users.length&&!searching&&<div className="lolz-admin-empty"><ShieldCheck size={28}/><strong>{t("Your control panel","لوحة التحكم الخاصة بك")}</strong><span>{t("Search for a member to verify them, give Premium or suspend the account.","ابحث عن عضو لمنحه التوثيق أو Premium أو تعليق حسابه.")}</span></div>}
  </section>
  <p className="lolz-admin-security-note"><ShieldCheck size={18}/>{t("Sensitive actions are checked by the server and require a trusted admin or owner account.","يتم التحقق من صلاحيات كل إجراء حساس من الخادم، ولا يعمل إلا للمدير أو المالك.")}</p>
 </div>;
}
