import { useState, useEffect, useCallback, useRef } from "react";

const API_URL = "/api/jobs";

// 데모 데이터: 전국, 경남, 이전기관 구분
const DEMO = [
  {id:1,company:"(데모) 한국남동발전",title:"2026 발전설비 기계직 정규직 채용",type:"정규직",isMachine:true,isTransferAgency:true,isGyeongnam:true,category:"기계",location:"이전기관(가점)",address:"경남 고성",startDate:"2026-03-24",endDate:"2026-04-10",people:5,url:"https://job.alio.go.kr",ongoing:true},
  {id:2,company:"(데모) 한국재료연구원",title:"기계설계 정규직 연구원",type:"정규직",isMachine:true,isTransferAgency:false,isGyeongnam:true,category:"기계",location:"경남(근무지)",address:"경남 창원",startDate:"2026-03-25",endDate:"2026-04-15",people:2,url:"https://job.alio.go.kr",ongoing:true},
  {id:3,company:"(데모) 한국철도공사",title:"상반기 기계직 정규직 채용",type:"정규직",isMachine:true,isTransferAgency:false,isGyeongnam:false,category:"기계",location:"대전",address:"대전",startDate:"2026-03-28",endDate:"2026-04-18",people:15,url:"https://job.alio.go.kr",ongoing:true},
];

const DAYS_KR = ["일","월","화","수","목","금","토"];

function getDIM(y, m) { return new Date(y, m + 1, 0).getDate(); }
function getFD(y, m) { return new Date(y, m, 1).getDay(); }
function fmt(d) { const x = new Date(d); return `${x.getMonth()+1}/${x.getDate()}`; }
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
      if (!r.ok) throw new Error(`서버 응답 오류 (HTTP ${r.status})`);
      const j = await r.json();
      if (!j.success) throw new Error(`API 내부 오류: ${j.error || "알 수 없는 에러"}`);
      
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

  // 독립적 필터링 적용 (전국 / 경남근무지 / 이전기관)
  const fj = jobs.filter(j => 
    (lf === "전국" || (lf === "경남(근무지)" && j.isGyeongnam) || (lf === "가점(이전기관)" && j.isTransferAgency)) &&
    (mf === "전체" || (mf === "기계직" && j.isMachine)) &&
    (!showFav || favorites[j.id])
  );

  const jfd = (ds) => fj.filter(j => j.startDate && j.endDate && inR(ds, j.startDate, j.endDate));
  
  const DIM = getDIM(yr, mo);
  const FD = getFD(yr, mo);
  const rawCells = Array(FD).fill(null).concat(Array.from({length: DIM}, (_, i) => i + 1));
  while (rawCells.length % 7 !== 0) rawCells.push(null);
  
  const weeks = [];
  for (let i = 0; i < rawCells.length; i += 7) {
    weeks.push(rawCells.slice(i, i + 7));
  }

  const ts = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  const act = fj.filter(j => !calcDD(j.endDate).x);

  let selectedWeekIdx = -1;
  if (pn && sel) {
    selectedWeekIdx = weeks.findIndex(week => week.includes(sel.day));
  }
  const visibleWeeks = selectedWeekIdx !== -1 ? [weeks[selectedWeekIdx]] : weeks;

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
    const targetUrl = (job.url && job.url !== "https://job.alio.go.kr/recruit.do") 
      ? job.url : `https://job.alio.go.kr/recruitView.do?pageNo=1&recrutPblntSn=${job.id}`;

    return (
      <div className={`modern-card ${isApplied ? "applied-card" : ""}`}>
        <div className="card-accent" style={{ background: job.isMachine ? "#f59e0b" : "#3b82f6" }} />
        <div className="card-header">
          <div className="card-title-group" style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <button onClick={(e) => { e.stopPropagation(); toggleFavorite(job.id); }} className="fav-btn" title="관심공고 등록">
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
          {job.isMachine && <span className="tag" style={{ background: "#fffbeb", color: "#b45309" }}>기계직</span>}
          <span className="tag tag-location" style={{ background: job.isTransferAgency ? "#ecfdf5" : (job.isGyeongnam ? "#fefce8" : "#f1f5f9"), color: job.isTransferAgency ? "#059669" : (job.isGyeongnam ? "#a16207" : "#475569") }}>
            {job.location}
          </span>
          {job.people > 0 && <span className="people-count">{job.people}명</span>}
        </div>
        
        <div className="card-footer">
          <span className="date-range">{fmt(job.startDate)} ~ {fmt(job.endDate)}</span>
          {showCheck && (
            <label className="checkbox-wrapper" onClick={(e) => e.stopPropagation()}>
              <input type="checkbox" checked={!!isApplied} onChange={() => toggleApplied(job.id)} />
              <div className="custom-checkbox">{isApplied ? "✓" : ""}</div>
              <span className={`checkbox-label ${isApplied ? "checked-text" : ""}`}>{isApplied ? "지원완료" : "미지원"}</span>
            </label>
          )}
        </div>
      </div>
    );
  };

  return (
  <div className="app-container">
  <style>{`
    @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Pretendard', -apple-system, sans-serif; }
    body { background-color: #f8fafc; color: #0f172a; }
    .app-container { min-height: 100vh; display: flex; flex-direction: column; }
    
    .header { background: #ffffff; padding: 16px 5%; box-shadow: 0 1px 2px rgba(0,0,0,0.04); position: sticky; top: 0; z-index: 10; display: flex; flex-direction: column; gap: 12px; border-bottom: 1px solid #e2e8f0; }
    .header-top { display: flex; justify-content: space-between; align-items: flex-start; width: 100%; }
    .title-area h1 { font-size: 18px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; margin-top: 2px; }
    .title-area span.label { font-size: 11px; color: #64748b; font-weight: 700; letter-spacing: 1px; }
    
    .update-info { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #64748b; font-weight: 500; }
    .update-btn { background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 4px; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #64748b; font-size: 12px; transition: all 0.2s; }
    .update-btn:hover { background: #e2e8f0; color: #0f172a; }

    .stats-group { display: flex; gap: 6px; margin-bottom: 6px; }
    .stat-pill { padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 700; display: flex; gap: 4px; align-items: center; }
    .stat-blue { background: #eff6ff; color: #2563eb; }
    .stat-orange { background: #fffbeb; color: #b45309; }

    .filter-row { display: flex; gap: 12px; flex-wrap: wrap; }
    .filter-group { display: flex; gap: 4px; }
    .filter-btn { padding: 5px 12px; border-radius: 6px; border: 1px solid #cbd5e1; background: #fff; color: #475569; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
    .filter-btn:hover { background: #f8fafc; border-color: #94a3b8; }
    .filter-btn.active { background: #2563eb; color: #ffffff; border-color: #2563eb; }
    
    .error-banner { background: #fef2f2; border-bottom: 1px solid #fca5a5; color: #b91c1c; padding: 10px 5%; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 8px; }

    .main-grid { display: grid; grid-template-columns: minmax(0, 2fr) minmax(320px, 1.2fr); gap: 24px; padding: 24px 5%; max-width: 1400px; margin: 0 auto; width: 100%; align-items: start; }
    
    .calendar-section { background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 2px 4px -1px rgba(0,0,0,0.02); padding: 20px; width: 100%; transition: all 0.3s ease; }
    .cal-header { display: flex; justify-content: center; align-items: center; margin-bottom: 20px; position: relative; }
    .cal-nav-btn { width: 28px; height: 28px; border-radius: 6px; border: 1px solid #e2e8f0; background: #fff; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; position: absolute; color: #64748b; transition: all 0.2s; }
    .cal-nav-btn:hover { background: #f1f5f9; color: #0f172a; }
    .btn-prev { left: 0; }
    .btn-next { right: 0; }
    .cal-title { font-size: 20px; font-weight: 800; color: #0f172a; }
    .cal-title span { font-size: 14px; color: #94a3b8; font-weight: 600; margin-left: 6px; }
    
    .cal-day-header-row { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; margin-bottom: 12px; }
    .cal-day-header { text-align: center; font-size: 12px; font-weight: 700; color: #64748b; }
    .cal-day-header.sun { color: #ef4444; }
    .cal-day-header.sat { color: #3b82f6; }
    
    .cal-week-row { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; margin-bottom: 8px; }
    .cal-cell { min-height: 80px; border-radius: 8px; padding: 8px; border: 1px solid transparent; cursor: pointer; transition: all 0.15s; display: flex; flex-direction: column; gap: 2px; background: #fff; }
    .cal-cell:hover { background: #f8fafc; border-color: #e2e8f0; }
    .cal-cell.today { background: #eff6ff; }
    .cal-cell.selected { background: #eff6ff; border-color: #3b82f6; box-shadow: 0 0 0 1px #3b82f6; }
    .date-num { font-size: 13px; font-weight: 700; color: #334155; }
    .date-num.sun { color: #ef4444; }
    .date-num.sat { color: #3b82f6; }

    .detail-list-container { margin-top: 24px; padding-top: 24px; border-top: 2px dashed #e2e8f0; animation: fadeIn 0.3s ease-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
    .detail-list-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .detail-title { font-size: 18px; font-weight: 800; color: #0f172a; }
    .detail-title span { color: #2563eb; font-size: 16px; margin-left: 6px; }
    .view-month-btn { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; padding: 6px 14px; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s; }
    .view-month-btn:hover { background: #e2e8f0; color: #0f172a; }

    .list-section { position: sticky; top: 100px; display: flex; flex-direction: column; gap: 12px; height: calc(100vh - 120px); }
    .list-header { font-size: 14px; font-weight: 800; color: #0f172a; display: flex; justify-content: space-between; align-items: center; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0; }
    .scroll-area { overflow-y: auto; padding-right: 8px; padding-bottom: 20px; }
    .scroll-area::-webkit-scrollbar { width: 5px; }
    .scroll-area::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }

    .modern-card { background: #ffffff; border-radius: 10px; padding: 14px; position: relative; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 1px 2px rgba(0,0,0,0.02); transition: transform 0.15s, box-shadow 0.15s; margin-bottom: 10px; }
    .modern-card:hover { transform: translateY(-1px); box-shadow: 0 4px 6px -2px rgba(0,0,0,0.05); border-color: #cbd5e1; }
    .applied-card { opacity: 0.55; background: #f8fafc; }
    .card-accent { position: absolute; left: 0; top: 0; bottom: 0; width: 3px; }
    
    .fav-btn { background: none; border: none; font-size: 16px; cursor: pointer; padding: 0 4px 0 0; color: #fbbf24; transition: transform 0.2s; margin-top: -2px; }
    .fav-btn:hover { transform: scale(1.15); }

    .card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; gap: 10px; }
    .card-title-group { flex: 1; }
    .company-name { font-size: 14px; font-weight: 800; color: #0f172a; margin-bottom: 3px; line-height: 1.3; word-break: keep-all; }
    .job-title { font-size: 12px; color: #475569; line-height: 1.3; word-break: keep-all; }
    
    .card-action-group { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0; }
    .d-day-badge { background: #f1f5f9; color: #475569; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 800; text-align: center; min-width: 48px; }
    .d-day-badge.urgent { background: #fef2f2; color: #dc2626; }
    .link-btn { background: #eff6ff; color: #2563eb; border: none; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 800; cursor: pointer; transition: background 0.15s; width: 100%; text-align: center; }
    .link-btn:hover { background: #dbeafe; }

    .tag-group { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 12px; align-items: center; padding-left: 20px; }
    .tag { padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; }
    .tag-location { background: #f1f5f9; color: #475569; }
    .people-count { font-size: 11.5px; color: #94a3b8; font-weight: 600; margin-left: 2px; }

    .card-footer { display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed #e2e8f0; padding-top: 10px; padding-left: 20px; }
    .date-range { font-size: 11px; color: #64748b; font-family: monospace; letter-spacing: -0.3px; font-weight: 500; }
    
    .checkbox-wrapper { display: flex; align-items: center; gap: 6px; cursor: pointer; }
    .checkbox-wrapper input { display: none; }
    .custom-checkbox { width: 16px; height: 16px; border: 2px solid #cbd5e1; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; color: white; transition: all 0.15s; }
    .checkbox-wrapper input:checked + .custom-checkbox { background: #0f172a; border-color: #0f172a; }
    .checkbox-label { font-size: 12px; color: #64748b; font-weight: 600; transition: color 0.15s; }
    .checked-text { color: #0f172a; }

    @media (max-width: 1024px) {
      .main-grid { grid-template-columns: 1fr; gap: 20px; padding: 16px 5%; }
      .list-section { position: relative; top: 0; height: auto; }
    }
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
        {ld ? (
          <span>업데이트 중...</span>
        ) : (
          <>
            <span>{demo ? "DEMO 모드" : (lu ? `오후 ${new Date(lu).toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit", hour12: false}).replace(/^1[2-9]|2[0-3]/, (m) => m-12)} 갱신` : "")}</span>
            <button className="update-btn" onClick={() => load(true)}>↻</button>
          </>
        )}
      </div>
    </div>
    
    <div>
      <div className="stats-group">
        <div className="stat-pill stat-blue"><span>{act.length}</span>건</div>
        <div className="stat-pill stat-orange"><span>{act.filter(j=>j.isMachine).length}</span>기계직</div>
      </div>
      <div className="filter-row">
        <div className="filter-group">
          <button className={`filter-btn ${lf==="전국"?"active":""}`} onClick={() => setLf("전국")}>전국</button>
          <button className={`filter-btn ${lf==="경남(근무지)"?"active":""}`} onClick={() => setLf("경남(근무지)")}>경남(근무지)</button>
          <button className={`filter-btn ${lf==="가점(이전기관)"?"active":""}`} onClick={() => setLf("가점(이전기관)")}>가점(이전기관)</button>
        </div>
        <div style={{ width: 1, background: "#e2e8f0" }}/>
        <div className="filter-group">
          <button className={`filter-btn ${mf==="전체"?"active":""}`} onClick={() => setMf("전체")}>전체 직무</button>
          <button className={`filter-btn ${mf==="기계직"?"active":""}`} onClick={() => setMf("기계직")}>기계직만 보기</button>
        </div>
        <div style={{ width: 1, background: "#e2e8f0" }}/>
        <div className="filter-group">
          <button className={`filter-btn ${!showFav ? "active" : ""}`} onClick={() => setShowFav(false)}>전체 목록</button>
          <button className={`filter-btn ${showFav ? "active" : ""}`} onClick={() => setShowFav(true)} style={{ color: showFav ? "#fff" : "#fbbf24", borderColor: showFav ? "#2563eb" : "#fde68a", background: showFav ? "#2563eb" : "#fffbeb" }}>⭐ 관심공고</button>
        </div>
      </div>
    </div>
  </header>

  <main className="main-grid">
    <section className="calendar-section">
      <div className="cal-header">
        <button className="cal-nav-btn btn-prev" onClick={pv}>‹</button>
        <div className="cal-title">{mo+1}월<span>{yr}</span></div>
        <button className="cal-nav-btn btn-next" onClick={nx}>›</button>
      </div>

      <div className="cal-day-header-row">
        {DAYS_KR.map((d, i) => <div key={d} className={`cal-day-header ${i===0?'sun':i===6?'sat':''}`}>{d}</div>)}
      </div>

      <div>
        {visibleWeeks.map((week, wIdx) => (
          <div key={wIdx} className="cal-week-row">
            {week.map((day, dIdx) => {
              if (!day) return <div key={`e${wIdx}-${dIdx}`} className="cal-cell" style={{ background: "transparent", border: "none", cursor: "default" }} />;
              
              const ds = `${yr}-${String(mo+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
              const dj = jfd(ds);
              const isT = ds === ts;
              const isS = sel?.ds === ds;
              const dow = (FD + day - 1) % 7;
              
              return (
                <div key={day} className={`cal-cell ${isT?'today':''} ${isS?'selected':''}`} onClick={() => click(day)}>
                  <span className={`date-num ${dow===0?'sun':dow===6?'sat':''}`}>{day}</span>
                  
                  <div style={{ display: "flex", alignItems: "center", gap: "3px", marginTop: "auto", flexWrap: "wrap" }}>
                    {dj.slice(0, 3).map((job, k) => (
                      <div key={k} style={{ width: "6px", height: "6px", borderRadius: "50%", background: job.isMachine ? "#f59e0b" : "#3b82f6" }} />
                    ))}
                    {dj.length > 3 && (
                      <span style={{ fontSize: "11px", color: "#64748b", fontWeight: "700", marginLeft: "1px" }}>+{dj.length - 3}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {pn && sel && (
        <div className="detail-list-container">
          <div className="detail-list-header">
            <h3 className="detail-title">
              {mo+1}월 {sel.day}일 마감 공고 <span>{sel.jobs.length}건</span>
            </h3>
            <button className="view-month-btn" onClick={() => setPn(false)}>전체 달력 보기</button>
          </div>
          <div>
            {sel.jobs.length === 0 ? (
              <div style={{ padding: "40px 0", textAlign: "center", color: "#94a3b8", fontSize: 13, fontWeight: 600 }}>해당 날짜에 마감되는 공고가 없습니다.</div>
            ) : (
              sel.jobs.slice().sort((a, b) => new Date(a.endDate) - new Date(b.endDate)).map(job => <JobCard key={job.id} job={job} showCheck={true} />)
            )}
          </div>
        </div>
      )}
    </section>

    <section className="list-section">
      <div className="list-header">
        <span>{showFav ? "관심 공고" : "진행중인 공고"} {act.length}건</span>
        <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>지원 체크는 저장됩니다</span>
      </div>
      <div className="scroll-area" style={{ paddingTop: 8 }}>
        {act.length === 0 ? (
          <div style={{ padding: "50px 0", textAlign: "center", color: "#94a3b8", fontSize: 13, fontWeight: 600 }}>
            {showFav ? "등록된 관심 공고가 없습니다." : "진행중인 공고가 없습니다."}
          </div>
        ) : (
          act.slice().sort((a, b) => new Date(a.endDate) - new Date(b.endDate)).map(job => <JobCard key={job.id} job={job} showCheck={true} />)
        )}
      </div>
    </section>
  </main>
  </div>
  );
}