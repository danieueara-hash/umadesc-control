import { useState, useEffect } from "react";
import { supabase } from "./supabase";

// ─── Helpers ────────────────────────────────────────────────────────────────
const C = {
  bg:"#eef2ff", sideBg:"linear-gradient(180deg,#0b1a3d 0%,#1a3a6e 100%)",
  pri:"#2563eb", priD:"#1d4ed8", card:"#ffffff", text:"#1e293b", muted:"#64748b", border:"#e2e8f0",
};
const fColor = f => f>=75?"#16a34a":f>=50?"#d97706":"#dc2626";
const fBg    = f => f>=75?"#dcfce7":f>=50?"#fef3c7":"#fee2e2";
const fLabel = f => f>=75?"Ótimo":f>=50?"Regular":"Baixo";
const fmtDate  = d => new Date(d+"T12:00:00").toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"long",year:"numeric"});
const fmtShort = d => { const dt=new Date(d+"T12:00:00"); return { day:dt.getDate(), mon:dt.toLocaleDateString("pt-BR",{month:"short"}).replace(".","").toUpperCase() }; };

const STATUS_META = {
  present:   { label:"Presente",         icon:"✅", bg:"#f0fdf4", border:"#bbf7d0", chip_bg:"#dcfce7", chip_c:"#16a34a" },
  absent:    { label:"Falta",            icon:"❌", bg:"#fff5f5", border:"#fecaca", chip_bg:"#fee2e2", chip_c:"#dc2626" },
  justified: { label:"Falta Justificada",icon:"⚠️", bg:"#fffbeb", border:"#fde68a", chip_bg:"#fef3c7", chip_c:"#b45309" },
};

const card = { background:C.card, borderRadius:16, padding:24, boxShadow:"0 1px 16px rgba(0,0,0,0.07)" };
const btnStyle = (v="primary", ex={}) => ({
  padding:"10px 20px", borderRadius:10, border:"none", cursor:"pointer",
  fontWeight:600, fontSize:14, transition:"all 0.2s", fontFamily:"inherit",
  background: v==="primary"?`linear-gradient(135deg,${C.pri},${C.priD})`:v==="danger"?"#fee2e2":"#f1f5f9",
  color: v==="primary"?"white":v==="danger"?"#dc2626":C.text, ...ex,
});
const inp = { width:"100%", padding:"12px 16px", borderRadius:10, border:`1.5px solid ${C.border}`, fontSize:14, outline:"none", boxSizing:"border-box", fontFamily:"inherit", color:C.text, background:"white" };

const Avatar = ({ name, size=40, g=`${C.pri},#7c3aed` }) => (
  <div style={{ width:size, height:size, borderRadius:size/2, background:`linear-gradient(135deg,${g})`, display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontWeight:700, fontSize:size*0.38, flexShrink:0 }}>
    {name?.[0]?.toUpperCase()||"?"}
  </div>
);
const Bar = ({ v, h=6 }) => (
  <div style={{ height:h, background:"#e2e8f0", borderRadius:h/2, overflow:"hidden" }}>
    <div style={{ height:"100%", width:`${v}%`, background:fColor(v), borderRadius:h/2, transition:"width 0.4s" }} />
  </div>
);
const Chip = ({ f }) => (
  <span style={{ padding:"4px 10px", borderRadius:20, fontSize:11, fontWeight:700, background:fBg(f), color:fColor(f), whiteSpace:"nowrap" }}>{f}%</span>
);
const StatusButtons = ({ current, onChange }) => (
  <div style={{display:"flex",gap:6,flexShrink:0,flexWrap:"wrap"}}>
    {Object.entries(STATUS_META).map(([key, m]) => (
      <button key={key} onClick={()=>onChange(key)} style={{
        padding:"7px 12px", borderRadius:8, border:`2px solid ${current===key?m.chip_c:C.border}`,
        cursor:"pointer", fontWeight:700, fontSize:12, fontFamily:"inherit",
        background: current===key ? m.chip_bg : "white",
        color: current===key ? m.chip_c : C.muted,
        transition:"all 0.15s", whiteSpace:"nowrap",
      }}>
        {m.icon} {m.label}
      </button>
    ))}
  </div>
);

// ─── Main Component ──────────────────────────────────────────────────────────
export default function App() {
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [saveMsg, setSaveMsg] = useState(""); // "" | "ok" | "err"
  const [page,    setPage]    = useState("dashboard");
  const [selGid,  setSelGid]  = useState(null);
  const [selMid,  setSelMid]  = useState(null);
  const [gTab,    setGTab]    = useState("members");
  const [rGid,    setRGid]    = useState(null);
  const [side,    setSide]    = useState(true);
  const [groups,  setGroups]  = useState([]);
  const [members, setMembers] = useState([]);
  const [meetings,setMeetings]= useState([]);
  const [att,     setAtt]     = useState([]);
  const [modal,   setModal]   = useState(null);
  const [form,    setForm]    = useState({});

  // ── Load all data from Supabase on mount ──
  useEffect(() => {
    async function fetchAll() {
      const [{ data: g }, { data: m }, { data: mt }, { data: a }] = await Promise.all([
        supabase.from("groups").select("*").order("id"),
        supabase.from("members").select("*").order("id"),
        supabase.from("meetings").select("*").order("date", { ascending: false }),
        supabase.from("attendance").select("*"),
      ]);
      setGroups(g || []);
      setMembers(m || []);
      setMeetings(mt || []);
      setAtt(a || []);
      if (g?.length) setRGid(g[0].id);
      setLoading(false);
    }
    fetchAll();
  }, []);

  const flash = ok => { setSaveMsg(ok?"ok":"err"); setTimeout(()=>setSaveMsg(""),2000); };

  // ── Derived data ──
  const gMems  = gid => members.filter(m => m.gid===gid);
  const gMeets = gid => meetings.filter(m => m.gid===gid).sort((a,b)=>new Date(b.date)-new Date(a.date));
  const getStatus = (mid, mbid) => att.find(a=>a.mid===mid&&a.mbid===mbid)?.status || "absent";
  const mFreq = (mbid, gid) => { const mts=meetings.filter(m=>m.gid===gid); if(!mts.length)return 0; return Math.round(mts.filter(mt=>getStatus(mt.id,mbid)==="present").length/mts.length*100); };
  const gFreq = gid => { const mts=meetings.filter(m=>m.gid===gid), mbs=members.filter(m=>m.gid===gid); if(!mts.length||!mbs.length)return 0; return Math.round(att.filter(a=>mbs.some(m=>m.id===a.mbid)&&mts.some(m=>m.id===a.mid)&&a.status==="present").length/(mts.length*mbs.length)*100); };
  const mtCounts = (mid, gid) => { const mbs=members.filter(m=>m.gid===gid); return { present:mbs.filter(mb=>getStatus(mid,mb.id)==="present").length, absent:mbs.filter(mb=>getStatus(mid,mb.id)==="absent").length, justified:mbs.filter(mb=>getStatus(mid,mb.id)==="justified").length, total:mbs.length }; };
  const mtFreq = (mid, gid) => { const mbs=members.filter(m=>m.gid===gid); if(!mbs.length)return 0; return Math.round(mbs.filter(mb=>getStatus(mid,mb.id)==="present").length/mbs.length*100); };

  // ── CRUD: Groups ──
  const addGroup = async () => {
    if (!form.name?.trim()) return;
    setSaving(true);
    const { data, error } = await supabase.from("groups").insert({ name:form.name.trim(), description:form.desc?.trim()||"" }).select().single();
    if (!error) { setGroups(g=>[...g,data]); if(!rGid)setRGid(data.id); flash(true); }
    else flash(false);
    setSaving(false); setModal(null); setForm({});
  };
  const delGroup = async id => {
    const { error } = await supabase.from("groups").delete().eq("id", id);
    if (!error) {
      const mids = meetings.filter(m=>m.gid===id).map(m=>m.id);
      setGroups(g=>g.filter(g=>g.id!==id));
      setMembers(m=>m.filter(m=>m.gid!==id));
      setMeetings(m=>m.filter(m=>m.gid!==id));
      setAtt(a=>a.filter(a=>!mids.includes(a.mid)));
      flash(true);
    } else flash(false);
  };

  // ── CRUD: Members ──
  const addMember = async () => {
    if (!form.name?.trim()) return;
    setSaving(true);
    const { data, error } = await supabase.from("members").insert({ gid:selGid, name:form.name.trim(), phone:form.phone?.trim()||"" }).select().single();
    if (!error) { setMembers(m=>[...m,data]); flash(true); }
    else flash(false);
    setSaving(false); setModal(null); setForm({});
  };
  const delMember = async id => {
    const { error } = await supabase.from("members").delete().eq("id", id);
    if (!error) { setMembers(m=>m.filter(m=>m.id!==id)); setAtt(a=>a.filter(a=>a.mbid!==id)); flash(true); }
    else flash(false);
  };

  // ── CRUD: Meetings ──
  const addMeeting = async () => {
    if (!form.date) return;
    setSaving(true);
    const { data: mt, error } = await supabase.from("meetings").insert({ gid:selGid, date:form.date, description:form.desc?.trim()||"Encontro" }).select().single();
    if (!error) {
      setMeetings(m=>[mt,...m]);
      const mbs = gMems(selGid);
      if (mbs.length) {
        const rows = mbs.map(mb=>({ mid:mt.id, mbid:mb.id, status:"absent" }));
        const { data: attData } = await supabase.from("attendance").insert(rows).select();
        if (attData) setAtt(a=>[...a,...attData]);
      }
      flash(true);
    } else flash(false);
    setSaving(false); setModal(null); setForm({});
  };
  const delMeeting = async id => {
    const { error } = await supabase.from("meetings").delete().eq("id", id);
    if (!error) { setMeetings(m=>m.filter(m=>m.id!==id)); setAtt(a=>a.filter(a=>a.mid!==id)); flash(true); }
    else flash(false);
  };

  // ── Attendance ──
  const setStatus = async (mid, mbid, status) => {
    const ex = att.find(a=>a.mid===mid&&a.mbid===mbid);
    if (ex) {
      const { error } = await supabase.from("attendance").update({ status }).eq("id", ex.id);
      if (!error) setAtt(a=>a.map(a=>a.id===ex.id?{...a,status}:a));
    } else {
      const { data, error } = await supabase.from("attendance").insert({ mid, mbid, status }).select().single();
      if (!error) setAtt(a=>[...a,data]);
    }
  };

  const selGroup   = groups.find(g=>g.id===selGid);
  const selMeeting = meetings.find(m=>m.id===selMid);
  const rGroup     = groups.find(g=>g.id===rGid);
  const navItems   = [{id:"dashboard",label:"Dashboard",icon:"📊"},{id:"groups",label:"Grupos",icon:"👥"},{id:"reports",label:"Relatórios",icon:"📋"}];
  const navActive  = id => (id==="groups"&&["group-detail","attendance"].includes(page))||page===id;

  // ── Loading screen ──
  if (loading) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:C.bg,flexDirection:"column",gap:16}}>
      <div style={{width:56,height:56,borderRadius:18,background:`linear-gradient(135deg,${C.pri},#7c3aed)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28}}>🎯</div>
      <div style={{fontWeight:800,fontSize:18,color:C.text}}>UMADESC Control</div>
      <div style={{color:C.muted,fontSize:14}}>Carregando dados...</div>
    </div>
  );

  // ── Modal ──
  const renderModal = () => {
    if (!modal) return null;
    const titles={a:"Novo Grupo",b:"Novo Membro",c:"Novo Encontro"};
    const saves={a:addGroup,b:addMember,c:addMeeting};
    return (
      <div style={{position:"fixed",inset:0,background:"rgba(11,26,61,0.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999}} onClick={()=>setModal(null)}>
        <div style={{background:"white",borderRadius:20,padding:32,width:420,maxWidth:"90vw",boxShadow:"0 24px 80px rgba(0,0,0,0.25)"}} onClick={e=>e.stopPropagation()}>
          <h2 style={{fontSize:20,fontWeight:700,color:C.text,margin:"0 0 24px"}}>{titles[modal]}</h2>
          <div style={{display:"grid",gap:14}}>
            {(modal==="a"||modal==="b")&&<div><div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:6,letterSpacing:0.5}}>NOME *</div><input style={inp} placeholder="Digite o nome..." value={form.name||""} onChange={e=>setForm({...form,name:e.target.value})} autoFocus /></div>}
            {modal==="b"&&<div><div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:6,letterSpacing:0.5}}>TELEFONE</div><input style={inp} placeholder="(00) 99999-9999" value={form.phone||""} onChange={e=>setForm({...form,phone:e.target.value})} /></div>}
            {(modal==="a"||modal==="c")&&<div><div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:6,letterSpacing:0.5}}>DESCRIÇÃO</div><input style={inp} placeholder="Descrição..." value={form.desc||""} onChange={e=>setForm({...form,desc:e.target.value})} /></div>}
            {modal==="c"&&<div><div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:6,letterSpacing:0.5}}>DATA *</div><input type="date" style={inp} value={form.date||""} onChange={e=>setForm({...form,date:e.target.value})} /></div>}
          </div>
          <div style={{display:"flex",gap:10,marginTop:24}}>
            <button style={btnStyle("secondary",{flex:1})} onClick={()=>setModal(null)}>Cancelar</button>
            <button style={btnStyle("primary",{flex:1})} onClick={saves[modal]} disabled={saving}>{saving?"Salvando...":"Salvar"}</button>
          </div>
        </div>
      </div>
    );
  };

  // ── Dashboard ──
  const renderDashboard = () => {
    const avg=groups.length?Math.round(groups.reduce((s,g)=>s+gFreq(g.id),0)/groups.length):0;
    return (
      <div>
        <div style={{marginBottom:28}}><h1 style={{fontSize:28,fontWeight:800,color:C.text,margin:0}}>Dashboard</h1><p style={{color:C.muted,margin:"4px 0 0"}}>Bem-vindo ao UMADESC Control</p></div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,marginBottom:24}}>
          {[{l:"Grupos",v:groups.length,i:"👥",c:C.pri,bg:"#dbeafe"},{l:"Membros",v:members.length,i:"👤",c:"#7c3aed",bg:"#ede9fe"},{l:"Encontros",v:meetings.length,i:"📅",c:"#0891b2",bg:"#cffafe"},{l:"Freq. Média",v:`${avg}%`,i:"📈",c:"#059669",bg:"#d1fae5"}].map(s=>(
            <div key={s.l} style={{...card,display:"flex",alignItems:"center",gap:14}}>
              <div style={{width:52,height:52,borderRadius:16,background:s.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>{s.i}</div>
              <div><div style={{fontSize:26,fontWeight:800,color:s.c,lineHeight:1}}>{s.v}</div><div style={{fontSize:12,color:C.muted,marginTop:2}}>{s.l}</div></div>
            </div>
          ))}
        </div>
        <div style={card}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
            <h2 style={{fontSize:17,fontWeight:700,color:C.text,margin:0}}>Frequência por Grupo</h2>
            <button style={btnStyle("secondary",{padding:"8px 16px",fontSize:13})} onClick={()=>setPage("groups")}>Ver todos →</button>
          </div>
          {groups.length===0?<div style={{textAlign:"center",padding:"32px 0",color:C.muted}}><div style={{fontSize:40,marginBottom:8}}>👥</div>Nenhum grupo cadastrado.</div>
          :groups.map(g=>{const f=gFreq(g.id),mbs=gMems(g.id),mts=gMeets(g.id);return(
            <div key={g.id} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 0",borderBottom:`1px solid ${C.border}`}}>
              <Avatar name={g.name} size={44}/>
              <div style={{flex:1}}><div style={{fontWeight:600,color:C.text,marginBottom:2}}>{g.name}</div><div style={{fontSize:12,color:C.muted}}>{mbs.length} membros · {mts.length} encontros</div></div>
              <Chip f={f}/><div style={{width:100}}><Bar v={f} h={8}/></div>
              <button style={btnStyle("secondary",{padding:"6px 14px",fontSize:13})} onClick={()=>{setSelGid(g.id);setGTab("members");setPage("group-detail");}}>Abrir</button>
            </div>
          );})}
        </div>
      </div>
    );
  };

  // ── Groups ──
  const renderGroups = () => (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
        <div><h1 style={{fontSize:28,fontWeight:800,color:C.text,margin:0}}>Grupos</h1><p style={{color:C.muted,margin:"4px 0 0"}}>Gerencie seus grupos</p></div>
        <button style={btnStyle()} onClick={()=>{setModal("a");setForm({});}}>+ Novo Grupo</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:16}}>
        {groups.map(g=>{const f=gFreq(g.id),mbs=gMems(g.id),mts=gMeets(g.id);return(
          <div key={g.id} style={card}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
              <Avatar name={g.name} size={48}/>
              <button style={{background:"none",border:"none",cursor:"pointer",fontSize:16,color:C.muted,padding:4}} onClick={()=>delGroup(g.id)}>🗑️</button>
            </div>
            <h3 style={{fontWeight:700,fontSize:17,color:C.text,margin:"0 0 4px"}}>{g.name}</h3>
            <p style={{color:C.muted,fontSize:13,margin:"0 0 14px"}}>{g.description||"Sem descrição"}</p>
            <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
              <span style={{background:"#dbeafe",color:C.pri,borderRadius:20,padding:"3px 10px",fontSize:12,fontWeight:600}}>👤 {mbs.length} membros</span>
              <span style={{background:"#dbeafe",color:C.pri,borderRadius:20,padding:"3px 10px",fontSize:12,fontWeight:600}}>📅 {mts.length} encontros</span>
            </div>
            <div style={{marginBottom:16}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:C.muted,marginBottom:6}}><span>Frequência geral</span><span style={{fontWeight:700,color:fColor(f)}}>{f}%</span></div>
              <Bar v={f} h={8}/>
            </div>
            <button style={{...btnStyle(),width:"100%",fontSize:13}} onClick={()=>{setSelGid(g.id);setGTab("members");setPage("group-detail");}}>Gerenciar Grupo →</button>
          </div>
        );})}
        {groups.length===0&&<div style={{...card,textAlign:"center",padding:48,gridColumn:"1/-1"}}><div style={{fontSize:48,marginBottom:16}}>👥</div><h3 style={{color:C.text}}>Nenhum grupo ainda</h3><p style={{color:C.muted}}>Crie seu primeiro grupo!</p></div>}
      </div>
    </div>
  );

  // ── Group Detail ──
  const renderGroupDetail = () => {
    if (!selGroup) return null;
    const mbs=gMems(selGroup.id), mts=gMeets(selGroup.id);
    return (
      <div>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
          <button style={btnStyle("secondary",{padding:"8px 16px",fontSize:13})} onClick={()=>setPage("groups")}>← Voltar</button>
          <Avatar name={selGroup.name} size={44}/>
          <div><h1 style={{fontSize:22,fontWeight:800,color:C.text,margin:0}}>{selGroup.name}</h1><p style={{color:C.muted,margin:0,fontSize:13}}>{selGroup.description}</p></div>
        </div>
        <div style={{display:"flex",gap:8,marginBottom:20,background:"white",borderRadius:12,padding:6,width:"fit-content",boxShadow:"0 1px 8px rgba(0,0,0,0.07)"}}>
          {["members","meetings"].map(t=>(
            <button key={t} onClick={()=>setGTab(t)} style={{padding:"10px 24px",borderRadius:8,border:"none",cursor:"pointer",fontWeight:600,fontSize:14,fontFamily:"inherit",background:gTab===t?`linear-gradient(135deg,${C.pri},${C.priD})`:"transparent",color:gTab===t?"white":C.muted,transition:"all 0.2s"}}>
              {t==="members"?`👤 Membros (${mbs.length})`:`📅 Encontros (${mts.length})`}
            </button>
          ))}
        </div>
        {gTab==="members"&&<div>
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}><button style={btnStyle()} onClick={()=>{setModal("b");setForm({});}}>+ Adicionar Membro</button></div>
          {mbs.length===0?<div style={{...card,textAlign:"center",padding:32,color:C.muted}}>Nenhum membro. Adicione o primeiro!</div>
          :mbs.map(mb=>{const f=mFreq(mb.id,selGroup.id);return(
            <div key={mb.id} style={{...card,display:"flex",alignItems:"center",gap:14,padding:"16px 20px",marginBottom:10}}>
              <Avatar name={mb.name} size={44}/>
              <div style={{flex:1}}><div style={{fontWeight:600,color:C.text}}>{mb.name}</div><div style={{fontSize:12,color:C.muted}}>{mb.phone||"Sem telefone"}</div></div>
              <Chip f={f}/>
              <span style={{padding:"4px 10px",borderRadius:20,fontSize:11,fontWeight:700,background:fBg(f),color:fColor(f)}}>{fLabel(f)}</span>
              <div style={{width:80}}><Bar v={f}/></div>
              <button style={{background:"none",border:"none",cursor:"pointer",color:C.muted,fontSize:16}} onClick={()=>delMember(mb.id)}>🗑️</button>
            </div>
          );})}
        </div>}
        {gTab==="meetings"&&<div>
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}><button style={btnStyle()} onClick={()=>{setModal("c");setForm({});}}>+ Novo Encontro</button></div>
          {mts.length===0?<div style={{...card,textAlign:"center",padding:32,color:C.muted}}>Nenhum encontro. Adicione o primeiro!</div>
          :mts.map(mt=>{const f=mtFreq(mt.id,selGroup.id),cn=mtCounts(mt.id,selGroup.id),{day,mon}=fmtShort(mt.date);return(
            <div key={mt.id} style={{...card,display:"flex",alignItems:"center",gap:14,padding:"16px 20px",marginBottom:10,flexWrap:"wrap"}}>
              <div style={{width:52,height:52,borderRadius:14,background:`linear-gradient(135deg,#0891b2,${C.pri})`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",color:"white",flexShrink:0}}>
                <div style={{fontSize:18,fontWeight:800,lineHeight:1}}>{day}</div><div style={{fontSize:9,opacity:0.9}}>{mon}</div>
              </div>
              <div style={{flex:1}}><div style={{fontWeight:600,color:C.text}}>{mt.description}</div><div style={{fontSize:12,color:C.muted,textTransform:"capitalize"}}>{fmtDate(mt.date)}</div></div>
              <div style={{display:"flex",gap:8,fontSize:12}}>
                <span style={{background:"#dcfce7",color:"#16a34a",borderRadius:20,padding:"3px 10px",fontWeight:700}}>✅ {cn.present}</span>
                <span style={{background:"#fee2e2",color:"#dc2626",borderRadius:20,padding:"3px 10px",fontWeight:700}}>❌ {cn.absent}</span>
                <span style={{background:"#fef3c7",color:"#b45309",borderRadius:20,padding:"3px 10px",fontWeight:700}}>⚠️ {cn.justified}</span>
              </div>
              <Chip f={f}/>
              <button style={btnStyle("primary",{fontSize:13,padding:"8px 16px"})} onClick={()=>{setSelMid(mt.id);setPage("attendance");}}>Presença →</button>
              <button style={{background:"none",border:"none",cursor:"pointer",color:C.muted,fontSize:16}} onClick={()=>delMeeting(mt.id)}>🗑️</button>
            </div>
          );})}
        </div>}
      </div>
    );
  };

  // ── Attendance ──
  const renderAttendance = () => {
    if (!selMeeting) return null;
    const gid=selMeeting.gid, group=groups.find(g=>g.id===gid), mbs=gMems(gid);
    const cn = { present:mbs.filter(mb=>getStatus(selMeeting.id,mb.id)==="present").length, absent:mbs.filter(mb=>getStatus(selMeeting.id,mb.id)==="absent").length, justified:mbs.filter(mb=>getStatus(selMeeting.id,mb.id)==="justified").length };
    const {day,mon}=fmtShort(selMeeting.date);
    return (
      <div>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:24}}>
          <button style={btnStyle("secondary",{padding:"8px 16px",fontSize:13})} onClick={()=>{setSelGid(gid);setPage("group-detail");}}>← Voltar</button>
          <div style={{width:52,height:52,borderRadius:14,background:`linear-gradient(135deg,#0891b2,${C.pri})`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",color:"white",flexShrink:0}}>
            <div style={{fontSize:18,fontWeight:800,lineHeight:1}}>{day}</div><div style={{fontSize:9}}>{mon}</div>
          </div>
          <div><h1 style={{fontSize:22,fontWeight:800,color:C.text,margin:0}}>Controle de Presença</h1><p style={{color:C.muted,margin:0,fontSize:13,textTransform:"capitalize"}}>{group?.name} · {fmtDate(selMeeting.date)}</p></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,marginBottom:24}}>
          {[{l:"Presentes",v:cn.present,c:"#16a34a",bg:"#dcfce7",i:"✅"},{l:"Faltas",v:cn.absent,c:"#dc2626",bg:"#fee2e2",i:"❌"},{l:"Justificadas",v:cn.justified,c:"#b45309",bg:"#fef3c7",i:"⚠️"},{l:"Total",v:mbs.length,c:C.pri,bg:"#dbeafe",i:"👥"}].map(s=>(
            <div key={s.l} style={{...card,textAlign:"center",padding:20}}>
              <div style={{width:52,height:52,borderRadius:16,background:s.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,margin:"0 auto 12px"}}>{s.i}</div>
              <div style={{fontSize:32,fontWeight:800,color:s.c,lineHeight:1}}>{s.v}</div>
              <div style={{color:C.muted,fontSize:12,marginTop:4}}>{s.l}</div>
            </div>
          ))}
        </div>
        <div style={card}>
          <h2 style={{fontSize:17,fontWeight:700,color:C.text,marginBottom:16}}>Lista de Membros</h2>
          {mbs.length===0?<p style={{color:C.muted,textAlign:"center",padding:24}}>Nenhum membro neste grupo.</p>
          :mbs.map(mb=>{
            const s=getStatus(selMeeting.id,mb.id), m=STATUS_META[s];
            return(
              <div key={mb.id} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 16px",borderRadius:12,marginBottom:10,background:m.bg,border:`2px solid ${m.border}`,transition:"all 0.2s",flexWrap:"wrap"}}>
                <Avatar name={mb.name} size={42} g={s==="present"?"#22c55e,#16a34a":s==="justified"?"#f59e0b,#d97706":"#94a3b8,#64748b"}/>
                <div style={{flex:1,minWidth:120}}><div style={{fontWeight:600,color:C.text}}>{mb.name}</div><div style={{fontSize:12,color:C.muted}}>{mb.phone||"Sem telefone"}</div></div>
                <span style={{padding:"5px 12px",borderRadius:20,fontSize:12,fontWeight:700,background:m.chip_bg,color:m.chip_c,whiteSpace:"nowrap"}}>{m.icon} {m.label}</span>
                <StatusButtons current={s} onChange={ns=>setStatus(selMeeting.id,mb.id,ns)}/>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── Reports ──
  const renderReports = () => {
    const mbs=rGroup?gMems(rGroup.id):[], mts=rGroup?[...gMeets(rGroup.id)].sort((a,b)=>new Date(a.date)-new Date(b.date)):[], f=rGroup?gFreq(rGroup.id):0;
    return (
      <div>
        <div style={{marginBottom:24}}><h1 style={{fontSize:28,fontWeight:800,color:C.text,margin:0}}>Relatórios</h1><p style={{color:C.muted,margin:"4px 0 0"}}>Análise detalhada de frequência</p></div>
        <div style={{...card,marginBottom:20}}>
          <div style={{fontSize:11,fontWeight:700,color:C.muted,marginBottom:10,letterSpacing:0.5}}>SELECIONAR GRUPO</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {groups.map(g=>(
              <button key={g.id} onClick={()=>setRGid(g.id)} style={{padding:"9px 18px",borderRadius:10,border:"none",cursor:"pointer",fontWeight:600,fontSize:14,fontFamily:"inherit",background:rGid===g.id?`linear-gradient(135deg,${C.pri},${C.priD})`:"#f1f5f9",color:rGid===g.id?"white":C.text,transition:"all 0.2s"}}>{g.name}</button>
            ))}
            {groups.length===0&&<p style={{color:C.muted,margin:0}}>Nenhum grupo disponível.</p>}
          </div>
        </div>
        {rGroup&&<>
          <div style={{...card,marginBottom:20,display:"flex",gap:24,alignItems:"center",flexWrap:"wrap"}}>
            <Avatar name={rGroup.name} size={56}/>
            <div style={{flex:1}}><h2 style={{margin:"0 0 4px",fontSize:20,fontWeight:700,color:C.text}}>{rGroup.name}</h2><p style={{margin:"0 0 10px",color:C.muted,fontSize:13}}>{mbs.length} membros · {mts.length} encontros</p><Bar v={f} h={10}/></div>
            <div style={{textAlign:"center"}}><div style={{fontSize:44,fontWeight:900,color:fColor(f),lineHeight:1}}>{f}%</div><div style={{color:C.muted,fontSize:13,marginTop:4}}>frequência geral</div></div>
          </div>
          <div style={{...card,marginBottom:20}}>
            <h3 style={{fontSize:16,fontWeight:700,color:C.text,marginBottom:16}}>📅 Frequência por Encontro</h3>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:12}}>
              {mts.map(mt=>{const f=mtFreq(mt.id,rGroup.id),cn=mtCounts(mt.id,rGroup.id),{day,mon}=fmtShort(mt.date);return(
                <div key={mt.id} style={{background:"#f8faff",borderRadius:12,padding:14,textAlign:"center",border:`1px solid ${C.border}`}}>
                  <div style={{width:36,height:36,borderRadius:10,background:`linear-gradient(135deg,#0891b2,${C.pri})`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",color:"white",margin:"0 auto 10px"}}>
                    <div style={{fontSize:13,fontWeight:800,lineHeight:1}}>{day}</div><div style={{fontSize:8}}>{mon}</div>
                  </div>
                  <div style={{fontSize:11,color:C.muted,marginBottom:6,fontWeight:600}}>{mt.description}</div>
                  <div style={{fontSize:24,fontWeight:800,color:fColor(f)}}>{f}%</div>
                  <div style={{display:"flex",justifyContent:"center",gap:4,marginTop:6,flexWrap:"wrap"}}>
                    <span style={{fontSize:10,background:"#dcfce7",color:"#16a34a",borderRadius:20,padding:"2px 7px",fontWeight:700}}>✅{cn.present}</span>
                    <span style={{fontSize:10,background:"#fee2e2",color:"#dc2626",borderRadius:20,padding:"2px 7px",fontWeight:700}}>❌{cn.absent}</span>
                    <span style={{fontSize:10,background:"#fef3c7",color:"#b45309",borderRadius:20,padding:"2px 7px",fontWeight:700}}>⚠️{cn.justified}</span>
                  </div>
                  <div style={{marginTop:8}}><Bar v={f} h={4}/></div>
                </div>
              );})}
              {mts.length===0&&<p style={{color:C.muted}}>Nenhum encontro cadastrado.</p>}
            </div>
          </div>
          <div style={card}>
            <h3 style={{fontSize:16,fontWeight:700,color:C.text,marginBottom:8}}>👤 Frequência Individual</h3>
            <div style={{display:"flex",gap:12,marginBottom:16,flexWrap:"wrap",fontSize:12,fontWeight:600}}>
              <span style={{color:"#16a34a"}}>✅ Presente</span><span style={{color:"#dc2626"}}>❌ Falta</span><span style={{color:"#b45309"}}>⚠️ Falta Justificada</span>
            </div>
            {mbs.length===0?<p style={{color:C.muted}}>Nenhum membro neste grupo.</p>
            :<div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:14,minWidth:360}}>
                <thead>
                  <tr>
                    <th style={{padding:"10px 14px",textAlign:"left",color:C.muted,fontWeight:600,fontSize:11,background:"#f8faff",borderRadius:"8px 0 0 8px",letterSpacing:0.5}}>MEMBRO</th>
                    {mts.map(mt=>{const {day,mon}=fmtShort(mt.date);return(<th key={mt.id} style={{padding:"10px 8px",color:C.muted,fontWeight:600,fontSize:11,textAlign:"center",background:"#f8faff",whiteSpace:"nowrap"}}>{day} {mon}</th>);})}
                    <th style={{padding:"10px 14px",color:C.muted,fontWeight:600,fontSize:11,textAlign:"center",background:"#f8faff",borderRadius:"0 8px 8px 0",letterSpacing:0.5}}>FREQ.</th>
                  </tr>
                </thead>
                <tbody>
                  {[...mbs].sort((a,b)=>mFreq(b.id,rGroup.id)-mFreq(a.id,rGroup.id)).map(mb=>{const f=mFreq(mb.id,rGroup.id);return(
                    <tr key={mb.id} style={{borderBottom:`1px solid ${C.border}`}}>
                      <td style={{padding:"12px 14px"}}><div style={{display:"flex",alignItems:"center",gap:10}}><Avatar name={mb.name} size={32}/><div style={{fontWeight:600,color:C.text,fontSize:13}}>{mb.name}</div></div></td>
                      {mts.map(mt=>{const s=getStatus(mt.id,mb.id);return(<td key={mt.id} style={{padding:"12px 8px",textAlign:"center",fontSize:16}} title={STATUS_META[s].label}>{STATUS_META[s].icon}</td>);})}
                      <td style={{padding:"12px 14px",textAlign:"center"}}><span style={{fontWeight:800,fontSize:15,color:fColor(f)}}>{f}%</span><div style={{width:60,margin:"4px auto 0"}}><Bar v={f} h={4}/></div></td>
                    </tr>
                  );})}
                </tbody>
              </table>
            </div>}
          </div>
        </>}
      </div>
    );
  };

  // ── Layout ──
  return (
    <div style={{display:"flex",minHeight:"100vh",fontFamily:"'Inter','Segoe UI',sans-serif",background:C.bg}}>
      {/* Sidebar */}
      <div style={{width:side?228:64,background:C.sideBg,display:"flex",flexDirection:"column",transition:"width 0.3s ease",overflow:"hidden",flexShrink:0,boxShadow:"4px 0 24px rgba(0,0,0,0.18)"}}>
        <div style={{padding:side?"24px 20px":"24px 12px",borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
          {side?<div><div style={{fontWeight:900,fontSize:17,color:"white",letterSpacing:-0.5,lineHeight:1.2}}>UMADESC</div><div style={{fontSize:10,color:"#93c5fd",fontWeight:600,letterSpacing:1.5,marginTop:2}}>CONTROL SYSTEM</div></div>
          :<div style={{textAlign:"center",fontSize:20}}>🎯</div>}
        </div>
        <nav style={{flex:1,padding:"12px 8px"}}>
          {navItems.map(item=>(
            <div key={item.id} onClick={()=>setPage(item.id)} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 14px",borderRadius:10,cursor:"pointer",marginBottom:4,background:navActive(item.id)?"rgba(59,130,246,0.22)":"transparent",color:navActive(item.id)?"#93c5fd":"rgba(255,255,255,0.55)",fontWeight:600,fontSize:14,transition:"all 0.2s",whiteSpace:"nowrap",overflow:"hidden"}}>
              <span style={{fontSize:18,flexShrink:0}}>{item.icon}</span>{side&&item.label}
            </div>
          ))}
        </nav>
        <div style={{padding:"10px 16px",borderTop:"1px solid rgba(255,255,255,0.08)",minHeight:40,display:"flex",alignItems:"center",justifyContent:side?"flex-start":"center"}}>
          {saveMsg==="ok" ? <span style={{fontSize:12,color:"#86efac",fontWeight:600,display:"flex",alignItems:"center",gap:6}}>✓{side&&" Salvo!"}</span>
          : saveMsg==="err" ? <span style={{fontSize:12,color:"#fca5a5",fontWeight:600,display:"flex",alignItems:"center",gap:6}}>⚠️{side&&" Erro ao salvar"}</span>
          : saving ? <span style={{fontSize:11,color:"rgba(255,255,255,0.45)",display:"flex",alignItems:"center",gap:6}}>⏳{side&&" Salvando..."}</span>
          : <span style={{fontSize:11,color:"rgba(255,255,255,0.25)",display:"flex",alignItems:"center",gap:6}}>☁️{side&&" Supabase"}</span>}
        </div>
        <div style={{padding:"8px 8px 16px"}}>
          <div onClick={()=>setSide(!side)} style={{display:"flex",alignItems:"center",justifyContent:side?"flex-end":"center",padding:"8px 14px",cursor:"pointer",color:"rgba(255,255,255,0.35)",borderRadius:8,fontSize:18}}>
            {side?"◀":"▶"}
          </div>
        </div>
      </div>
      {/* Main */}
      <main style={{flex:1,padding:28,overflowY:"auto",maxHeight:"100vh"}}>
        {page==="dashboard"&&renderDashboard()}
        {page==="groups"&&renderGroups()}
        {page==="group-detail"&&renderGroupDetail()}
        {page==="attendance"&&renderAttendance()}
        {page==="reports"&&renderReports()}
      </main>
      {renderModal()}
    </div>
  );
}