let cachedData = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60 * 60 * 1000;

const GYEONGNAM_AGENCIES = [
  "한국토지주택공사", "한국남동발전", "중소벤처기업진흥공단", "주택관리공단",
  "한국산업기술시험원", "한국세라믹기술원", "한국승강기안전공단", "국방기술품질원",
  "한국저작권위원회", "중앙관세분석소", "국방기술진흥연구소"
];

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const forceRefresh = req.query.force === "true";

  try {
    const now = Date.now();
    if (!forceRefresh && cachedData && now - cacheTimestamp < CACHE_TTL) {
      return res.status(200).json({ success: true, data: cachedData });
    }

    const API_KEY = process.env.ALIO_API_KEY;
    if (!API_KEY) {
      return res.status(500).json({ success: false, error: "ALIO_API_KEY not set" });
    }

    const BASE = "https://opendata.alio.go.kr/new/v1/recruit/list.do";
    let allItems = [];

    // 가장 안정적이었던 원조 통신 방식으로 복구 (강제 문자열 변환 및 헤더 추가)
    for (let pageNo = 1; pageNo <= 30; pageNo++) {
      const url = `${BASE}?serviceKey=${encodeURIComponent(API_KEY)}&numOfRows=100&pageNo=${pageNo}&resultType=json`;
      const resp = await fetch(url, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
        signal: AbortSignal.timeout(15000),
      });
      const text = await resp.text();
      if (text.startsWith("<")) break; // XML 에러 뱉으면 스탑

      let json;
      try { json = JSON.parse(text); } catch (e) { break; }

      // 숫자로 오든 문자로 오든 강제로 문자로 바꿔서 0인지 체크
      const code = String(json.resultCode);
      if (code !== "0" && code !== "200") break;

      const items = json.result || [];
      if (Array.isArray(items)) { allItems.push(...items); }
      else if (items && typeof items === "object") { allItems.push(items); }
      
      if (items.length === 0) break;
    }

    const filtered = allItems
      .filter((item) => {
        const hireTypes = String(item.hireTypeLst || "");
        const hireNames = String(item.hireTypeNmLst || "");
        const title = String(item.recrutPbancTtl || "");
        
        // 1. 진짜 정규직 필터
        const isRegular = hireTypes.includes("R1010") || hireNames.includes("정규직");
        
        // 2. 짭규직 암살
        const fakeRegularRegex = /인턴|기간제|촉탁|계약|단기|대체|위촉|별정|일용|노무|알바|수습|체험|휴직/;
        const isFake = fakeRegularRegex.test(title) || fakeRegularRegex.test(hireNames);

        // 3. 특수 전형 제외
        const isSpecial = /보훈|장애|고졸/.test(title) || /보훈|장애|고졸/.test(hireNames);

        if (!isRegular || isFake || isSpecial) return false;

        return true;
      })
      .map((item) => {
        const ncsCodes = String(item.ncsCdLst || "");
        const ncsNames = String(item.ncsCdNmLst || "");
        const title = String(item.recrutPbancTtl || "");
        const companyName = String(item.instNm || "");
        const regions = String(item.workRgnLst || "");
        const regionNames = String(item.workRgnNmLst || "");
        
        const isMachine = ncsCodes.includes("R600015") || /기계|기술|설비|정비|엔지니어|플랜트/.test(title) || ncsNames.includes("기계");
        
        const isTransferAgency = GYEONGNAM_AGENCIES.some(agency => companyName.includes(agency));
        const isGyeongnam = regions.includes("R3022") || regionNames.includes("경남") || regionNames.includes("창원") || regionNames.includes("진주");

        let locationTag = regionNames.split(',')[0] || "전국";
        if (isTransferAgency) locationTag = "이전기관(가점)";
        else if (isGyeongnam) locationTag = "경남(근무지)";

        return {
          id: item.recrutPblntSn || 0,
          company: companyName,
          title: title,
          type: "정규직", 
          isMachine,
          isTransferAgency, 
          isGyeongnam,
          location: locationTag,
          startDate: normDate(item.pbancBgngYmd),
          endDate: normDate(item.pbancEndYmd),
          people: parseInt(item.recrutNope) || 0,
          url: item.srcUrl || `https://job.alio.go.kr/recruitView.do?recrutPblntSn=${item.recrutPblntSn}`,
          ongoing: item.ongoingYn === "Y",
        };
      });

    cachedData = filtered;
    cacheTimestamp = now;
    return res.status(200).json({ success: true, data: filtered, lastUpdated: new Date(now).toISOString() });
  } catch (err) {
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