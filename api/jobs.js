let cachedData = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60 * 60 * 1000;

// 경남(진주 혁신도시) 이전 공공기관 리스트
const GYEONGNAM_AGENCIES = [
  "한국토지주택공사", "한국남동발전", "중소벤처기업진흥공단", "주택관리공단",
  "한국산업기술시험원", "한국세라믹기술원", "한국승강기안전공단", "국방기술품질원",
  "한국저작권위원회", "중앙관세분석소", "국방기술진흥연구소"
];

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const forceRefresh = req.query.force === "true";

  try {
    const now = Date.now();
    if (!forceRefresh && cachedData && now - cacheTimestamp < CACHE_TTL) {
      return res.status(200).json({ success: true, cached: true, lastUpdated: new Date(cacheTimestamp).toISOString(), count: cachedData.length, data: cachedData });
    }

    const API_KEY = process.env.ALIO_API_KEY;
    if (!API_KEY) {
      return res.status(500).json({ success: false, error: "ALIO_API_KEY not set" });
    }

    const BASE = "https://opendata.alio.go.kr/new/v1/recruit/list.do";
    let allItems = [];
    let pageNo = 1;
    let totalCount = Infinity;

    while (allItems.length < totalCount && pageNo <= 30) {
      const url = `${BASE}?serviceKey=${encodeURIComponent(API_KEY)}&numOfRows=100&pageNo=${pageNo}&resultType=json`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
        signal: AbortSignal.timeout(15000),
      });
      const text = await resp.text();
      if (text.startsWith("<")) break;

      let json;
      try { json = JSON.parse(text); } catch (e) { break; }

      const code = String(json.resultCode);
      if (code !== "0" && code !== "200") break;

      totalCount = json.totalCount || 0;
      const items = json.result || [];
      if (Array.isArray(items)) { allItems.push(...items); }
      else if (items && typeof items === "object") { allItems.push(items); }
      if (items.length === 0) break;
      pageNo++;
    }

    const filtered = allItems
      .filter((item) => {
        const hireTypes = String(item.hireTypeLst || "");
        const hireNames = String(item.hireTypeNmLst || "");
        const title = String(item.recrutPbancTtl || "");
        
        // 1. 정규직 필터 & 인턴/기간제 제외
        const isRegular = hireTypes.includes("R1010") || hireNames.includes("정규직");
        const isTemp = /인턴|기간제|촉탁/.test(title) || /인턴|기간제|촉탁/.test(hireNames);
        
        // 2. 특수 전형(보훈, 장애, 고졸) 완벽 제외
        const isSpecial = /보훈|장애|고졸/.test(title) || /보훈|장애|고졸/.test(hireNames);

        if (!isRegular || isTemp || isSpecial) return false;
        
        // 전국 데이터를 모두 가져오기 위해 지역 필터 제거 (프론트에서 제어)
        return true;
      })
      .map((item) => {
        const ncsCodes = String(item.ncsCdLst || "");
        const ncsNames = String(item.ncsCdNmLst || "");
        const companyName = String(item.instNm || "");
        const regions = String(item.workRgnLst || "");
        const regionNames = String(item.workRgnNmLst || "");
        
        // 기계직, 이전기관, 경남근무지 독립적 판별
        const isMachine = ncsCodes.includes("R600015") || ncsNames.includes("기계");
        const isTransferAgency = GYEONGNAM_AGENCIES.some(agency => companyName.includes(agency));
        const isGyeongnam = regions.includes("R3022") || regionNames.includes("경남") || regionNames.includes("창원") || regionNames.includes("진주");

        // 카드 노출용 위치 태그 최적화
        let locationTag = regionNames.split(',')[0] || "전국";
        if (isTransferAgency) locationTag = "이전기관(가점)";
        else if (isGyeongnam) locationTag = "경남(근무지)";

        return {
          id: item.recrutPblntSn || 0,
          company: companyName,
          title: item.recrutPbancTtl || "",
          type: "정규직", 
          isMachine,
          isTransferAgency, 
          isGyeongnam,
          category: item.ncsCdNmLst || "",
          location: locationTag,
          address: item.workRgnNmLst || "",
          startDate: normDate(item.pbancBgngYmd),
          endDate: normDate(item.pbancEndYmd),
          people: parseInt(item.recrutNope) || 0,
          url: item.srcUrl || "https://job.alio.go.kr/recruit.do",
          ongoing: item.ongoingYn === "Y",
        };
      });

    cachedData = filtered;
    cacheTimestamp = now;

    return res.status(200).json({ success: true, cached: false, lastUpdated: new Date(now).toISOString(), count: filtered.length, data: filtered });
  } catch (err) {
    if (cachedData) {
      return res.status(200).json({ success: true, cached: true, stale: true, lastUpdated: new Date(cacheTimestamp).toISOString(), count: cachedData.length, data: cachedData });
    }
    return res.status(500).json({ success: false, error: err.message });
  }
}

function normDate(d) {
  if (!d) return "";
  const s = String(d).replace(/[.\-/\s]/g, "");
  if (s.length === 8) return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) return String(d).slice(0,10);
  return String(d);
}