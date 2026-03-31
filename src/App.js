import { useState, useEffect, useCallback, useRef } from "react";

const API_URL = "/api/jobs";

const DAYS_KR = ["일","월","화","수","목","금","토"];

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
  const [lu, setLu] = useState(null);
  const [pn, setPn] = useState(false);
  const [applied, setApplied] = useState(() => JSON.parse(localStorage.getItem("applied") || "{}"));
  const [favorites, setFavorites] = useState(() => JSON.parse(localStorage.getItem("favorites") || "{}"));

  const toggleApplied = (id) => {
    setApplied(p => { const n = {...p}; if(n[id]) delete n[id]; else n[id]=true; localStorage.setItem("applied", JSON.stringify(n)); return n; });
  };
  const toggleFavorite = (id) => {
    setFavorites(p => { const n = {...p}; if(n[id]) delete n[id]; else n[id]=true; localStorage.setItem("favorites", JSON.stringify(n)); return n; });
  };

  const load = useCallback(async (isForce = false) => {
    setLd(true);
    try {
      const r = await fetch(isForce ? `${API_URL}?force=true` : API_URL);
      const j = await r.json();
      if (j.success) { setJobs(j.data); setLu(new Date().toISOString()); }
    } catch (e) { console.error(e); } finally { setLd(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const fj = jobs.filter(j => 
    (viewTab === "all" || applied[j.id]) &&
    (lf === "전국" || (lf === "경남(근무지)" && j.isGyeongnam) || (lf === "가점(이전기관)" && j.isTransferAgency)) &&
    (mf === "전체" || (mf === "기술직 전체" && j.isTech) || (mf === "기계직만" && j.isMachine)) &&
    (!showFav || favorites[j.id])
  );

  const jfd = (ds) => fj.filter(j => j.startDate && j.endDate && inR(ds, j.startDate, j.endDate));
  const DIM = new Date(yr, mo + 1, 0).getDate();
  const FD = new Date(yr, mo, 1).getDay();
  const weeks = [];
  let cells = Array(FD).fill(null).concat(Array.from({length: DIM}, (_, i) => i + 1));
  while (cells.length % 7 !== 0) cells.push(null);
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const act = fj.filter(j => !calcDD(j.endDate).x);
  const selectedJobs = sel ? jfd(sel.ds) : [];

  const JobCard = ({ job }) => {
    const d = calcDD(job.endDate);
    return (
      <div className={`modern-card ${applied[job.id] ? "applied-card" : ""}`}>
        <div className="card-accent" style={{ background: job.isMachine ? "#f59e0b" : (job.isTech ? "#8b5cf6" : "#3b82f6") }} />
        <div className="card-header">
          <div className="card-title-group">
            <button onClick={() => toggleFavorite(job.id)} className="fav-btn">{favorites[job.id] ? "⭐" : "☆"}</button>
            <div><h3 className="company-name">{job.company}</h3><p className="job-title">{job.title}</p></div>
          </div>
          <div className="card-action-group">
            <span className={`d-day-badge ${d.u || d.x ? "urgent" : ""}`}>{d.t}</span>
            <button onClick={() => window.open(job.url, "_blank")} className="link-btn">링크</button>
          </div>
        </div>
        <div className="tag-group">
          <span className="tag" style={{ background: "#eff6ff", color: "#2563eb" }}>{job.type}</span>
          {job.isMachine ? <span className="tag" style={{ background: "#fffbeb", color: "#b45309" }}>기계직</span> : job.isTech && <span className="tag" style={{ background: "#f5f3ff", color: "#6d28d9" }}>기술직</span>}
          <span className="tag tag-location">{job.location}</span>
          {job.people > 0 && <span className="people-count">{job.people}명 채용</span>}
        </div>
        <div className="card-footer">
          <span className="date-range">{job.startDate} ~ {job.endDate}</span>
          <label className="checkbox-wrapper"><input type="checkbox" checked={!!applied[job.id]} onChange={() => toggleApplied(job.id)} /><div className="custom-checkbox">{applied[job.id] ? "✓" : ""}</div><span>{applied[job.id] ? "지원완료" : "미지원"}</span></label>
        </div>
      </div>
    );
  };

  return (
    <div className="app-container">
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Pretendard', sans-serif; }
        body { background-color: #f8fafc; color: #0f172a; }
        .header { background: #ffffff; padding: 16px 5%; border-bottom: 1px solid #e2e8f0; sticky; top: 0; z-index: 10; }
        .view-tabs { display: flex; gap: 20px; border-bottom: 2px solid #f1f5f9; margin: 12px 0; }
        .view-tab { padding: 8px 4px; font-size: 15px; font-weight: 700; color: #64748b; cursor: pointer; border-bottom: 2px solid transparent; }
        .view-tab.active { color: #2563eb; border-bottom-color: #2563eb; }
        .filter-row { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
        .filter-btn { padding: 5px 12px; border-radius: 6px; border: 1px solid #cbd5e1; background: #fff; cursor: pointer; font-size: 12px; font-weight: 600; }
        .filter-btn.active { background: #2563eb; color: #fff; border-color: #2563eb; }
        .main-grid { display: grid; grid-template-columns: 2fr 1.2fr; gap: 24px; padding: 24px 5%; max-width: 1400px; margin: 0 auto; }
        .calendar-section { background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 20px; }
        .cal-week-row { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; margin-bottom: 8px; }
        .cal-cell { min-height: 80px; border-radius: 8px; padding: 8px; cursor: pointer; border: 1px solid transparent; display: flex; flex-direction: column; }
        .cal-cell.selected { background: #eff6ff; border-color: #3b82f6; }
        .modern-card { background: #fff; border-radius: 10px; padding: 16px; border: 1px solid #e2e8f0; margin-bottom: 12px; position: relative; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        .card-accent { position: absolute; left: 0; top: 0; bottom: 0; width: 4px; }
        .card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
        .card-title-group { display: flex; gap: 8px; }
        .card-action-group { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
        .tag-group { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; padding-left: 20px; }
        .tag { padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; }
        .card-footer { display: flex; justify-content: space-between; border-top: 1px dashed #e2e8f0; padding-top: 12px; padding-left: 20px; align-items: center; }
        .checkbox-wrapper { display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 12px; }
        .custom-checkbox { width: 18px; height: 18px; border: 2px solid #cbd5e1; border-radius: 4px; display: flex; align-items: center; justify-content: center; }
        .d-day-badge { background: #f1f5f9; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 800; }
        .link-btn { background: #eff6ff; color: #2563eb; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: 800; }
        .fav-btn { background: none; border: none; cursor: pointer; font-size: 18px; }
        .applied-card { opacity: 0.6; }
      `}</style>

      <header className="header">
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <h1>공공기관 정규직 채용 달력</h1>
          <button className="filter-btn" onClick={() => load(true)}>↻ {ld ? "로딩중" : "업데이트"}</button>
        </div>
        <div className="view-tabs">
          <div className={`view-tab ${viewTab === "all" ? "active" : ""}`} onClick={() => setViewTab("all")}>전체 공고</div>
          <div className={`view-tab ${viewTab === "applied" ? "active" : ""}`} onClick={() => setViewTab("applied")}>지원한 공고 ({Object.keys(applied).length})</div>
        </div>
        <div className="filter-row">
          {["전국", "경남(근무지)", "가점(이전기관)"].map(v => <button key={v} className={`filter-btn ${lf===v?"active":""}`} onClick={() => setLf(v)}>{v}</button>)}
          <div style={{ width: 1, background: "#e2e8f0", height: 20 }} />
          {["전체", "기술직 전체", "기계직만"].map(v => <button key={v} className={`filter-btn ${mf===v?"active":""}`} onClick={() => setMf(v)}>{v}</button>)}
          <button className={`filter-btn ${showFav ? "active" : ""}`} onClick={() => setShowFav(!showFav)}>⭐ 관심공고</button>
        </div>
      </header>

      <main className="main-grid">
        <section className="calendar-section">
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
            <button onClick={() => { if(mo===0){setYr(yr-1);setMo(11);}else setMo(mo-1); }}>‹</button>
            <h2>{yr}년 {mo+1}월</h2>
            <button onClick={() => { if(mo===11){setYr(yr+1);setMo(0);}else setMo(mo+1); }}>›</button>
          </div>
          {weeks.map((week, wi) => (
            <div key={wi} className="cal-week-row">
              {week.map((day, di) => {
                const ds = `${yr}-${String(mo+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
                const count = day ? jfd(ds).length : 0;
                return (
                  <div key={di} className={`cal-cell ${sel?.ds === ds ? "selected" : ""}`} onClick={() => day && setSel({day, ds})}>
                    <span>{day}</span>
                    <div style={{ marginTop: "auto", display: "flex", gap: 2 }}>
                      {day && jfd(ds).slice(0, 3).map((j, i) => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: j.isMachine ? "#f59e0b" : "#3b82f6" }} />)}
                      {count > 3 && <span style={{ fontSize: 10 }}>+{count-3}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
          {sel && (
            <div style={{ marginTop: 24, borderTop: "2px dashed #e2e8f0", paddingTop: 24 }}>
              <h3>{sel.day}일 마감 공고 {selectedJobs.length}건</h3>
              {selectedJobs.map(j => <JobCard key={j.id} job={j} />)}
            </div>
          )}
        </section>

        <section>
          <div style={{ marginBottom: 12, fontWeight: 800 }}>진행중 공고 {act.length}건</div>
          <div style={{ height: "calc(100vh - 250px)", overflowY: "auto" }}>
            {act.sort((a,b) => new Date(a.endDate) - new Date(b.endDate)).map(j => <JobCard key={j.id} job={j} />)}
          </div>
        </section>
      </main>
    </div>
  );
}