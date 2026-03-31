import { useState, useEffect, useCallback, useRef } from "react";

const API_URL = "/api/jobs";

const DEMO = [
  {id:1,company:"(데모) 한국남동발전",title:"2026 발전설비 기계직 정규직 채용",type:"정규직",isMachine:true,isTech:true,isTransferAgency:true,isGyeongnam:true,category:"기계",location:"이전기관(가점)",address:"경남 고성",startDate:"2026-03-24",endDate:"2026-04-10",people:5,url:"https://job.alio.go.kr",ongoing:true},
  {id:2,company:"(데모) 한국토지주택공사",title:"상반기 건축/토목 기술직 채용",type:"정규직",isMachine:false,isTech:true,isTransferAgency:true,isGyeongnam:true,category:"건설",location:"이전기관(가점)",address:"경남 진주",startDate:"2026-03-25",endDate:"2026-04-15",people:10,url:"https://job.alio.go.kr",ongoing:true},
  {id:3,company:"(데모) 한국기술교육대학교",title:"학습전략 컨설팅 담당자 모집",type:"정규직",isMachine:false,isTech:false,isTransferAgency:false,isGyeongnam:false,category:"일반",location:"충남",address:"충남 천안",startDate:"2026-03-28",endDate:"2026-04-18",people:3,url:"https://job.alio.go.kr",ongoing:true},
];

const DAYS_KR = ["일","월","화","수","목","금","토"];

function getDIM(y, m) { return new Date(y, m + 1, 0).getDate(); }
function getFD(y, m) { return new Date(y, m, 1).getDay(); }
function inR(d, s, e) {
  const a = new Date(d), b = new Date(s), c = new Date(e);
  a.setHours(0,0,0,0); b.setHours(0,0,0,0); c.setHours(0,0,0,0);
  return a >= b && a <= c;
}
function calcDD(end) {
  const t = new Date(), e = new Date(end);
  t.setHours(0,0,0,0); e.setHours(0,0,0,0);
  const d = Math.ceil((e - t) / 864e5);
  if (d < 0) return { t: "마감", u: false, x: true };
  if (d === 0) return { t: "D-Day", u: true, x: false };
  return { t: `D-${d}`, u: d <= 5, x: false };
}

function loadLocal(key) {
  try { return JSON.parse(window.localStorage.getItem(key) || "{}"); } catch { return {}; }
}
function saveLocal(key, obj) {
  try { window.localStorage.setItem(key, JSON.stringify(obj)); } catch { /* noop */ }
}

export default function App() {
  const now = new Date();
  const [yr, setYr] = useState(now.getFullYear());
  const [mo, setMo] = useState(now.getMonth());
  const [sel, setSel] = useState(null);
  const [viewTab, setViewTab] = useState("all");
  
  const [lf, setLf] = useState("전국"); 
  const [mf, setMf] = useState("전체"); 
  const [showFav, setShowFav] = useState(false);
  
  const [jobs, setJobs] = useState([]);
  const [ld, setLd] = useState(true);
  const [demo, setDemo] = useState(false);
  const [apiError, setApiError] = useState(null); 
  const [lu, setLu] = useState(null);
  const [pn, setPn] = useState(false);
  
  const [applied, setApplied] = useState(() => loadLocal("applied"));
  const [favorites, setFavorites] = useState(() => loadLocal("favorites"));
  const ref = useRef();

  const toggleApplied = (id) => {
    setApplied(prev => {
      const next = { ...prev };
      if (next[id]) delete next[id]; else next[id] = true;
      saveLocal("applied", next);
      return next;
    });
  };

  const toggleFavorite = (id) => {
    setFavorites(prev => {
      const next = { ...prev };
      if (next[id]) delete next[id]; else next[id] = true;
      saveLocal("favorites", next);
      return next;
    });
  };

  const load = useCallback(async (isForce = false) => {
    setLd(true); setApiError(null);
    try {
      const fetchUrl = isForce ? `${API_URL}?force=true` : API_URL;
      const r = await fetch(fetchUrl);
      if (!r.ok) throw new Error(`서버 응답 오류`);
      const j = await r.json();
      if (!j.success) throw new Error(j.error || "알 수 없는 에러");
      
      if (j.data && j.data.length > 0) { setJobs(j.data); setDemo(false); }
      else { setJobs(DEMO); setDemo(true); }
      setLu(j.lastUpdated || new Date().toISOString());
    } catch (e) {
      setApiError(e.message); 
      setJobs(DEMO); setDemo(true); setLu(new Date().toISOString());
    } finally { setLd(false); }
  }, []);

  useEffect(() => {
    load();
    ref.current = setInterval(() => {
      const n = new Date();
      if ((n.getUTCHours() + 9) % 24 === 9 && n.getMinutes() === 0) load();
    }, 6e4);
    return () => clearInterval(ref.current);
  }, [load]);

  // 필터 로직 업데이트: 기술직, 기계직 분리
  const fj = jobs.filter(j => 
    (viewTab === "all" || (viewTab === "applied" && applied[j.id])) &&
    (lf === "전국" || (lf === "경남(근무지)" && j.isGyeongnam) || (lf === "가점(이전기관)" && j.isTransferAgency)) &&
    (mf === "전체" || (mf === "기술직" && j.isTech) || (mf === "기계직" && j.isMachine)) &&
    (!showFav || favorites[j.id])
  );

  const jfd = (ds) => fj.filter(j => j.startDate && j.endDate && inR(ds, j.startDate, j.endDate));
  
  const DIM = getDIM(yr, mo);
  const FD = getFD(yr, mo);
  const rawCells = Array(FD).fill(null).concat(Array.from({length: DIM}, (_, i) => i + 1));
  while (rawCells.length % 7 !== 0) rawCells.push(null);
  
  const weeks = [];
  for (let i = 0; i < rawCells.length; i += 7) weeks.push(rawCells.slice(i, i + 7));

  const ts = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  const act = fj.filter(j => !calcDD(j.endDate).x);

  const click = (day) => {
    if (!day) return;
    const ds = `${yr}-${String(mo+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    setSel({ day, ds, jobs: jfd(ds) }); setPn(true);
  };
  const pv = () => { if (mo === 0) { setYr(y => y - 1); setMo(11); } else { setMo(m => m - 1); } setPn(false); };
  const nx = () => { if (mo === 11) { setYr(y => y + 1); setMo(0); } else { setMo(m => m + 1); } setPn(false); };

  const JobCard = ({ job, showCheck }) => {
    const d = calcDD(job.endDate);
    const isApplied = applied[job.id];
    const isFav = favorites[job.id];
    const targetUrl = job.url;

    return (
      <div className={`modern-card ${isApplied ? "applied-card" : ""}`}>
        <div className="card-accent" style={{ background: job.isMachine ? "#f59e0b" : (job.isTech ? "#8b5cf6" : "#3b82f6") }} />
        <div className="card-header">
          <div className="card-title-group" style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <button onClick={(e) => { e.stopPropagation(); toggleFavorite(job.id); }} className="fav-btn">
              {isFav ? "⭐" : "☆"}
            </button>
            <div>
              <h3 className="company-name">{job.company}</h3>
              <p className="job-title">{job.title}</p>
            </div>
          </div>
          <div className="card-action-group">
            <span className={`d-day-badge ${d.u || d.x ? "urgent" : ""}`}>{d.t}</span>
            <button onClick={(e) => { e.stopPropagation(); window.open(targetUrl, "_blank"); }} className="link-btn">링크</button>
          </div>
        </div>
        <div className="tag-group">
          <span className="tag" style={{ background: "#eff6ff", color: "#2563eb" }}>{job.type}</span>
          
          {job.isMachine ? (
            <span className="tag" style={{ background: "#fffbeb", color: "#b45309" }}>기계직</span>
          ) : job.isTech ? (
            <span className="tag" style={{ background: "#f5f3ff", color: "#6d28d9" }}>기술직</span>
          ) : null}

          <span className="tag tag-location" style={{ background: job.isTransferAgency ? "#ecfdf5" : (job.isGyeongnam ? "#fefce8" : "#f1f5f9"), color: job.isTransferAgency ? "#059669" : (job.isGyeongnam ? "#a16207" : "#475569") }}>
            {job.location}
          </span>
          {job.people > 0 && <span className="people-count">{job.people}명 채용</span>}
        </div>
        <div className="card-footer">
          <span className="date-range">{job.startDate} ~ {job.endDate}</span>
          <label className="checkbox-wrapper" onClick={(e) => e.stopPropagation()}>
            <input type="checkbox" checked={!!isApplied} onChange={() => toggleApplied(job.id)} />
            <div className="custom-checkbox">{isApplied ? "✓" : ""}</div>
            <span className={`checkbox-label ${isApplied ? "checked-text" : ""}`}>{isApplied ? "지원완료" : "미지원"}</span>
          </label>
        </div>
      </div>
    );
  };

  return (
  <div className="app-container">
  <style>{`
    @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Pretendard', sans-serif; }
    body { background-color: #f8fafc; color: #0f172a; }
    .header { background: #ffffff; padding: 16px 5%; box-shadow: 0 1px 2px rgba(0,0,0,0.04); position: sticky; top: 0; z-index: 10; border-bottom: 1px solid #e2e8f0; }
    .header-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
    .title-area h1 { font-size: 18px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; }
    .title-area span.label { font-size: 11px; color: #64748b; font-weight: 700; }
    .update-info { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #64748b; }
    .update-btn { background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 4px; width: 24px; height: 24px; cursor: pointer; }
    
    .view-tabs { display: flex; gap: 20px; border-bottom: 2px solid #f1f5f9; margin-bottom: 16px; }
    .view-tab { padding: 8px 4px; font-size: 15px; font-weight: 700; color: #64748b; cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.2s; }
    .view-tab.active { color: #2563eb; border-bottom-color: #2563eb; }

    .filter-row { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 12px; }
    .filter-group { display: flex; gap: 4px; }
    .filter-btn { padding: 5px 12px; border-radius: 6px; border: 1px solid #cbd5e1; background: #fff; color: #475569; font-size: 12px; font-weight: 600; cursor: pointer; }
    .filter-btn.active { background: #2563eb; color: #ffffff; border-color: #2563eb; }
    
    .main-grid { display: grid; grid-template-columns: minmax(0, 2fr) minmax(320px, 1.2fr); gap: 24px; padding: 24px 5%; max-width: 1400px; margin: 0 auto; }
    .calendar-section { background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 20px; }
    .cal-header { display: flex; justify-content: center; align-items: center; margin-bottom: 20px; position: relative; }
    .cal-nav-btn { width: 28px; height: 28px; border-radius: 6px; border: 1px solid #e2e8f0; cursor: pointer; position: absolute; }
    .cal-title { font-size: 20px; font-weight: 800; }
    .cal-day-header-row { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; margin-bottom: 12px; text-align: center; font-size: 12px; font-weight: 700; color: #64748b; }
    .cal-week-row { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; margin-bottom: 8px; }
    .cal-cell { min-height: 80px; border-radius: 8px; padding: 8px; cursor: pointer; display: flex; flex-direction: column; background: #fff; border: 1px solid transparent; }
    .cal-cell.today { background: #eff6ff; }
    .cal-cell.selected { background: #eff6ff; border-color: #3b82f6; }
    .date-num { font-size: 13px; font-weight: 700; }
    
    .detail-list-container { margin-top: 24px; padding-top: 24px; border-top: 2px dashed #e2e8f0; }
    .list-section { position: sticky; top: 180px; height: calc(100vh - 200px); display: flex; flex-direction: column; gap: 12px; }
    .scroll-area { overflow-y: auto; padding-right: 8px; flex: 1; }
    .scroll-area::-webkit-scrollbar { width: 5px; }
    .scroll-area::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }

    .modern-card { background: #ffffff; border-radius: 10px; padding: 14px; border: 1px solid #e2e8f0; margin-bottom: 10px; position: relative; overflow: hidden; }
    .applied-card { opacity: 0.6; }
    .card-accent { position: absolute; left: 0; top: 0; bottom: 0; width: 3px; }
    .fav-btn { background: none; border: none; font-size: 16px; cursor: pointer; color: #fbbf24; }
    .tag-group { display: flex; flex-wrap: wrap; gap: 4px; margin: 8px 0; padding-left: 24px; }
    .tag { padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; }
    .people-count { font-size: 11px; color: #64748b; font-weight: 700; margin-left: 4px; }
    .card-footer { display: flex; justify-content: space-between; border-top: 1px dashed #e2e8f0; padding-top: 10px; padding-left: 24px; }
    .checkbox-wrapper { display: flex; align-items: center; gap: 6px; cursor: pointer; }
    .checkbox-wrapper input { display: none; }
    .custom-checkbox { width: 16px; height: 16px; border: 2px solid #cbd5e1; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 12px; }
    input:checked + .custom-checkbox { background: #0f172a; border-color: #0f172a; }

    .error-banner { background: #fef2f2; border-bottom: 1px solid #fca5a5; color: #b91c1c; padding: 10px 5%; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 8px; }

    @media (max-width: 1024px) { .main-grid { grid-template-columns: 1fr; } .list-section { position: static; height: auto; } }
  `}</style>

  {apiError && (
    <div className="error-banner">
      <span style={{ fontSize: 16 }}>🚨</span>
      <span>Vercel 서버 통신 에러 발생! {apiError}</span>
    </div>
  )}

  <header className="header">
    <div className="header-top">
      <div className="title-area">
        <span className="label">JOB ALIO</span>
        <h1>공공기관 정규직 채용 달력</h1>
      </div>
      <div className="update-info">
        {ld ? "업데이트 중..." : `${demo ? "DEMO" : lu ? new Date(lu).toLocaleTimeString("ko-KR", {hour:"2-digit", minute:"2-digit"}) + " 갱신" : ""}`}
        <button className="update-btn" onClick={() => load(true)}>↻</button>
      </div>
    </div>

    <div className="view-tabs">
      <div className={`view-tab ${viewTab === "all" ? "active" : ""}`} onClick={() => setViewTab("all")}>전체 공고</div>
      <div className={`view-tab ${viewTab === "applied" ? "active" : ""}`} onClick={() => setViewTab("applied")}>지원한 공고 ({Object.keys(applied).length})</div>
    </div>
    
    <div className="filter-row">
      <div className="filter-group">
        {["전국", "경남(근무지)", "가점(이전기관)"].map(v => (
          <button key={v} className={`filter-btn ${lf===v?"active":""}`} onClick={() => setLf(v)}>{v}</button>
        ))}
      </div>
      <div style={{ width: 1, background: "#e2e8f0" }}/>
      
      {/* 기술/기계 직무 분리 필터 */}
      <div className="filter-group">
        <button className={`filter-btn ${mf==="전체"?"active":""}`} onClick={() => setMf("전체")}>전체 직무</button>
        <button className={`filter-btn ${mf==="기술직"?"active":""}`} onClick={() => setMf("기술직")}>기술직 전체</button>
        <button className={`filter-btn ${mf==="기계직"?"active":""}`} onClick={() => setMf("기계직")}>기계직만</button>
      </div>
      
      <div style={{ width: 1, background: "#e2e8f0" }}/>
      <button className={`filter-btn ${showFav ? "active" : ""}`} onClick={() => setShowFav(!showFav)} style={{ color: showFav ? "#fff" : "#fbbf24" }}>⭐ 관심공고</button>
    </div>
  </header>

  <main className="main-grid">
    <section className="calendar-section">
      <div className="cal-header">
        <button className="cal-nav-btn" style={{left:0}} onClick={pv}>‹</button>
        <div className="cal-title">{mo+1}월 <span style={{fontSize:14, color:'#94a3b8'}}>{yr}</span></div>
        <button className="cal-nav-btn" style={{right:0}} onClick={nx}>›</button>
      </div>
      <div className="cal-day-header-row">
        {DAYS_KR.map((d, i) => <div key={d} style={{color: i===0?'#ef4444':i===6?'#3b82f6':''}}>{d}</div>)}
      </div>
      <div>
        {(pn && sel ? [weeks.find(w => w.includes(sel.day))] : weeks).map((week, wIdx) => (
          <div key={wIdx} className="cal-week-row">
            {week.map((day, dIdx) => {
              if (!day) return <div key={`e${wIdx}-${dIdx}`} className="cal-cell" style={{background:'transparent'}} />;
              const ds = `${yr}-${String(mo+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
              const dj = jfd(ds);
              const isT = ds === ts;
              const isS = sel?.ds === ds;
              return (
                <div key={day} className={`cal-cell ${isT?'today':''} ${isS?'selected':''}`} onClick={() => click(day)}>
                  <span className="date-num" style={{color: dIdx===0?'#ef4444':dIdx===6?'#3b82f6':''}}>{day}</span>
                  <div style={{ display: "flex", gap: "3px", marginTop: "auto", flexWrap: "wrap" }}>
                    {dj.slice(0, 3).map((job, k) => (
                      <div key={k} style={{ width: "6px", height: "6px", borderRadius: "50%", background: job.isMachine ? "#f59e0b" : (job.isTech ? "#8b5cf6" : "#3b82f6") }} />
                    ))}
                    {dj.length > 3 && <span style={{ fontSize: "10px", fontWeight: "700" }}>+{dj.length - 3}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {pn && sel && (
        <div className="detail-list-container">
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
            <h3 style={{fontSize:18, fontWeight:800}}>{mo+1}/{sel.day} 마감 <span>{sel.jobs.length}건</span></h3>
            <button className="filter-btn" onClick={() => setPn(false)}>전체 달력 보기</button>
          </div>
          {sel.jobs.slice().sort((a,b) => new Date(a.endDate)-new Date(b.endDate)).map(job => <JobCard key={job.id} job={job} showCheck={true} />)}
        </div>
      )}
    </section>

    <section className="list-section">
      <div style={{fontSize:14, fontWeight:800, paddingBottom:8, borderBottom:'2px solid #e2e8f0'}}>
        {viewTab === "applied" ? "지원 완료 목록" : "진행중인 공고"} {act.length}건
      </div>
      <div className="scroll-area">
        {act.slice().sort((a,b) => new Date(a.endDate)-new Date(b.endDate)).map(job => <JobCard key={job.id} job={job} showCheck={true} />)}
      </div>
    </section>
  </main>
  </div>
  );
}