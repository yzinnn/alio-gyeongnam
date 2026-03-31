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
    if (!API_KEY) throw new Error("API_KEY not set");

    const BASE = "https://opendata.alio.go.kr/new/v1/recruit/list.do";

    // ⭐️ Vercel 10초 타임아웃 방지: 병렬(동시) 렌더링 함수
    const fetchPage = async (pageNo) => {
      try {
        const url = `${BASE}?serviceKey=${encodeURIComponent(API_KEY)}&numOfRows=100&pageNo=${pageNo}&resultType=json`;
        const resp = await fetch(url, { method: "POST" });
        const text = await resp.text();
        if (text.startsWith("<")) return [];
        const json = JSON.parse(text);
        if (String(json.resultCode) !== "0" && String(json.resultCode) !== "200") return [];
        const items = json.result || [];
        return Array.isArray(items) ? items : [items];
      } catch (e) {
        return [];
      }
    };

    // 1~10페이지(진행 중인 공고 1000건)를 동시에 가져와서 1~2초 컷
    const pages = Array.from({ length: 10 }, (_, i) => i + 1);
    const results = await Promise.all(pages.map(fetchPage));
    const allItems = results.flat();

    const filtered = allItems
      .filter((item) => {
        if (!item) return false;
        const hireTypes = String(item.hireTypeLst || "");
        const hireNames = String(item.hireTypeNmLst || "");
        const title = String(item.recrutPbancTtl || "");
        
        // 정규직 필터
        const isRegular = hireTypes.includes("R1010") || hireNames.includes("정규직");
        // 짭규직 컷
        const fakeRegularRegex = /인턴|기간제|촉탁|계약|단기|대체|위촉|별정|일용|노무|알바|수습|체험|휴직/;
        const isFake = fakeRegularRegex.test(title) || fakeRegularRegex.test(hireNames);
        // 특수 전형 컷
        const isSpecial = /보훈|장애|고졸/.test(title) || /보훈|장애|고졸/.test(hireNames);

        if (!isRegular || isFake || isSpecial) return false;
        return true;
      })
      .map((item) => {
        const ncsCodes = String(item.ncsCdLst || "");
        const companyName = String(item.instNm || "");
        const regions = String(item.workRgnLst || "");
        const regionNames = String(item.workRgnNmLst || "");
        
        // 오직 R600015 코드만 살림
        const isMachine = ncsCodes.includes("R600015");
        
        const isTransferAgency = GYEONGNAM_AGENCIES.some(agency => companyName.includes(agency));
        const isGyeongnam = regions.includes("R3022") || regionNames.includes("경남") || regionNames.includes("창원") || regionNames.includes("진주");

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
          location: locationTag,
          startDate: normDate(item.pbancBgngYmd),
          endDate: normDate(item.pbancEndYmd),
          people: parseInt(item.recrutNope) || 0,
          url: item.srcUrl || `https://job.alio.go.kr/recruitView.do?recrutPblntSn=${item.recrutPblntSn}`,
          ongoing: item.ongoingYn === "Y",
        };
      });

    // 중복 제거
    const uniqueFiltered = Array.from(new Map(filtered.map(item => [item.id, item])).values());

    cachedData = uniqueFiltered;
    cacheTimestamp = now;
    return res.status(200).json({ success: true, data: uniqueFiltered, lastUpdated: new Date(now).toISOString() });
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