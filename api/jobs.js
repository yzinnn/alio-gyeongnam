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
    const BASE = "https://opendata.alio.go.kr/new/v1/recruit/list.do";

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
      } catch (e) { return []; }
    };

    const pages = Array.from({ length: 10 }, (_, i) => i + 1);
    const results = await Promise.all(pages.map(fetchPage));
    const allItems = results.flat();

    const filtered = allItems
      .filter((item) => {
        if (!item) return false;
        const hireTypes = String(item.hireTypeLst || "");
        const hireNames = String(item.hireTypeNmLst || "");
        const title = String(item.recrutPbancTtl || "");
        
        const isRegular = hireTypes.includes("R1010") || hireNames.includes("정규직");
        const fakeRegularRegex = /인턴|기간제|촉탁|계약|단기|대체|위촉|별정|일용|노무|알바|수습|체험|휴직/;
        const isFake = fakeRegularRegex.test(title) || fakeRegularRegex.test(hireNames);
        const isSpecial = /보훈|장애|고졸|석사|박사/.test(title) || /보훈|장애|고졸|석사|박사/.test(hireNames);

        return isRegular && !isFake && !isSpecial;
      })
      .map((item) => {
        const ncsCodes = String(item.ncsCdLst || "");
        const companyName = String(item.instNm || "");
        const regions = String(item.workRgnLst || "");
        const regionNames = String(item.workRgnNmLst || "");
        
        // ⭐️ 기계직 (NCS R600015) 
        const isMachine = ncsCodes.includes("R600015");
        
        // ── 기술직: 기계직 가능성 있는 공고 포착 ──
        // 조건1: 제목/내용에 기계 관련 키워드 포함
        const techInclude = /기계|설비|플랜트|용접|배관|금형|자동화|메카|열처리|유압|공압|냉동|냉각|보일러|터빈|엔진|정비|생산기술|품질관리|비파괴|CAD|CAM/;
        // 조건2: 다른 직렬 키워드가 없어야 함 (오탐 방지)
        const techExclude = /전기|전자|통신|화학|건축|토목|환경|IT|소프트웨어|SW|ICT/;

        const hasTechKeyword = techInclude.test(title);
        const hasOtherField = techExclude.test(title);

        const isTechnical = hasTechKeyword && !hasOtherField;
        
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
          isTech,
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

    const uniqueFiltered = Array.from(new Map(filtered.map(item => [item.id, item])).values());
    cachedData = uniqueFiltered;
    cacheTimestamp = now;
    return res.status(200).json({ success: true, data: uniqueFiltered });
  } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
}