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
      return res.status(200).json({ success: true, cached: true, data: cachedData });
    }

    const API_KEY = process.env.ALIO_API_KEY;
    const BASE = "https://opendata.alio.go.kr/new/v1/recruit/list.do";
    let allItems = [];

    // 데이터 누락 방지를 위해 페이지를 충분히 가져옵니다.
    for (let pageNo = 1; pageNo <= 30; pageNo++) {
      const url = `${BASE}?serviceKey=${encodeURIComponent(API_KEY)}&numOfRows=100&pageNo=${pageNo}&resultType=json`;
      const resp = await fetch(url, { method: "POST" });
      const json = await resp.json();
      if (json.resultCode !== "000" && json.resultCode !== "0" && json.resultCode !== "200") break;
      const items = json.result || [];
      allItems.push(...(Array.isArray(items) ? items : [items]));
      if (items.length < 100) break;
    }

    const filtered = allItems
      .filter((item) => {
        const hireNames = String(item.hireTypeNmLst || "");
        const title = String(item.recrutPbancTtl || "");
        
        // 1. 짭규직 암살 (단기, 대체, 계약 등 제목에 있으면 무조건 컷)
        const fakeRegularRegex = /인턴|기간제|촉탁|계약|단기|대체|위촉|별정|일용|노무|알바|수습|체험|휴직/;
        if (fakeRegularRegex.test(title) || fakeRegularRegex.test(hireNames)) return false;

        // 2. 특수 전형 제외
        if (/보훈|장애|고졸/.test(title) || /보훈|장애|고졸/.test(hireNames)) return false;

        return true;
      })
      .map((item) => {
        const ncsCodes = String(item.ncsCdLst || "");
        const ncsNames = String(item.ncsCdNmLst || "");
        const title = String(item.recrutPbancTtl || "");
        const companyName = String(item.instNm || "");
        const regions = String(item.workRgnLst || "");
        const regionNames = String(item.workRgnNmLst || "");
        
        // [수정] 기계직 코드(R600015) 뿐만 아니라 '기술', '설비', '정비' 등 기술직 키워드 포함 시 기계직군으로 분류 
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
          startDate: item.pbancBgngYmd,
          endDate: item.pbancEndYmd,
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