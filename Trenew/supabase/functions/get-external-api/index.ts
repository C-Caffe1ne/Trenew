// supabase/functions/get-external-api/index.ts
// KOSPI 지수 데이터(KRX OPEN API) 및 YouTube 트렌드를 반환

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import * as cheerio from "https://esm.sh/cheerio@1.0.0-rc.12"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const memoryCache = new Map<string, { data: string; expiry: number }>();
const CACHE_DURATION_MS = 20 * 60 * 1000; // 20 minutes

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 요청 바디 파싱 시도 (action 분기를 위해)
    let reqData: any = {};
    if (req.method === 'POST') {
      try {
        reqData = await req.json();
      } catch (e) {
        // body가 비어있는 경우 무시
      }
    }

    if (reqData.action === 'exchange') {
      const { apiKey, date } = reqData;
      
      const cacheKey = `exchange-${date}`;
      const now = Date.now();
      if (memoryCache.has(cacheKey) && memoryCache.get(cacheKey)!.expiry > now) {
         return new Response(memoryCache.get(cacheKey)!.data, {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
         });
      }

      // 등락률 계산을 위해 '어제(직전 영업일)' 날짜를 정확히 계산
      const yyyy = date.substring(0, 4)
      const mm = date.substring(4, 6)
      const dd = date.substring(6, 8)
      const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`)
      
      // 월요일(1)이면 3일 전(금), 일요일(0)이면 2일 전(금), 그 외는 1일 전(어제)
      if (d.getUTCDay() === 1) d.setDate(d.getDate() - 3)
      else if (d.getUTCDay() === 0) d.setDate(d.getDate() - 2)
      else d.setDate(d.getDate() - 1)

      const startDate = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`
      
      // 한국은행 ECOS API (731Y001: 일일 주요국 환율)
      const targetUrl = `https://ecos.bok.or.kr/api/StatisticSearch/${apiKey}/json/kr/1/100/731Y001/D/${startDate}/${date}`;

      try {
        const exRes = await fetch(targetUrl);
        const exJson = await exRes.json();
        
        if (exJson && exJson.StatisticSearch && exJson.StatisticSearch.row) {
          const rows = exJson.StatisticSearch.row;
          
          const codeMap: Record<string, string> = {
            "0000001": "USD",
            "0000002": "JPY(100)",
            "0000003": "EUR",
            "0000012": "GBP",
            "0000053": "CNY"
          };

          const grouped: Record<string, any[]> = {};
          rows.forEach((row: any) => {
             if (codeMap[row.ITEM_CODE1]) {
                const cur = codeMap[row.ITEM_CODE1];
                if (!grouped[cur]) grouped[cur] = [];
                grouped[cur].push(row);
             }
          });

          const mappedData = Object.keys(grouped).map(cur => {
             // TIME 기준 내림차순 정렬 (최신이 0번 인덱스)
             const sorted = grouped[cur].sort((a, b) => b.TIME.localeCompare(a.TIME));
             const current = sorted[0];
             const previous = sorted.length > 1 ? sorted[1] : current;

             const curRate = parseFloat(current.DATA_VALUE);
             const prevRate = parseFloat(previous.DATA_VALUE);
             
             const change = curRate - prevRate;
             const changeRate = prevRate !== 0 ? (change / prevRate) * 100 : 0;
             const dir = change > 0 ? 'up' : change < 0 ? 'down' : 'flat';

             return {
               cur_unit: cur,
               cur_nm: current.ITEM_NAME1,
               deal_bas_r: current.DATA_VALUE,
               change_val: Math.abs(change).toLocaleString('ko-KR', { maximumFractionDigits: 2 }),
               change_rate: Math.abs(changeRate).toFixed(2),
               dir: dir
             };
          });

          const responseText = JSON.stringify({ success: true, data: mappedData });
          memoryCache.set(cacheKey, { data: responseText, expiry: now + CACHE_DURATION_MS });

          return new Response(responseText, {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } else {
           return new Response(JSON.stringify({ success: true, data: [] }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: (e as Error).message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        });
      }
    }

    const cacheKeyCombined = 'kospi-youtube';
    const nowCombined = Date.now();
    if (memoryCache.has(cacheKeyCombined) && memoryCache.get(cacheKeyCombined)!.expiry > nowCombined) {
       return new Response(memoryCache.get(cacheKeyCombined)!.data, {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
       });
    }

    // ── KOSPI 지수: KRX OPEN API ──
    const krxApiKey = 'DE9BBB6FBA284DB0968299ABFDAC74C4F98D60C2'
    let kospiData: any[] = []
    let kospiErrorMsg: string | null = null

    // 1. 현재 시간을 무조건 한국 시간(KST, UTC+9)으로 맞춰서 계산
    const nowUtc = new Date()
    const kstOffset = 9 * 60 * 60 * 1000
    const nowKst = new Date(nowUtc.getTime() + kstOffset)
    
    // 2. 기준일(마지막 영업일) 정확히 셋팅
    let targetKst = new Date(nowKst.getTime())
    const day = targetKst.getDay()
    const hours = targetKst.getHours()

    if (day === 0) { // 일요일
      targetKst.setDate(targetKst.getDate() - 2) // 직전 금요일
    } else if (day === 6) { // 토요일
      targetKst.setDate(targetKst.getDate() - 1) // 직전 금요일
    } else {
      // 평일 (월~금)
      if (hours < 9) { // 1-1. 영업시간 전 (09:00 이전) => 어제 마감시간 종가
        if (day === 1) targetKst.setDate(targetKst.getDate() - 3) // 월요일이면 직전 금요일
        else targetKst.setDate(targetKst.getDate() - 1) // 화~금이면 전 영업일
      }
      // 1-2 & 1-3. 영업시간 중 및 영업마감 이후 => 오늘 날짜 그대로(API가 최신 상태 반영)
    }

    // 3. 공휴일 방어 로직 (계산된 마지막 영업일이 하필 공휴일/대체공휴일인 경우 데이터가 비어있음 -> 이를 대비해 최대 3회 이전 영업일로 백트래킹)
    for (let fallback = 0; fallback < 4; fallback++) {
      const searchDate = new Date(targetKst.getTime())
      searchDate.setDate(searchDate.getDate() - fallback)
      
      // 백트래킹 중 주말에 닿으면 금요일로 한번 더 점프
      if (searchDate.getDay() === 0) searchDate.setDate(searchDate.getDate() - 2)
      else if (searchDate.getDay() === 6) searchDate.setDate(searchDate.getDate() - 1)

      const basDd = `${searchDate.getFullYear()}${String(searchDate.getMonth() + 1).padStart(2, '0')}${String(searchDate.getDate()).padStart(2, '0')}`
      const krxUrl = `https://data-dbg.krx.co.kr/svc/apis/idx/kospi_dd_trd?basDd=${basDd}`

      const res = await fetch(krxUrl, {
        headers: { 'AUTH_KEY': krxApiKey }
      })

      if (res.ok) {
        const json = await res.json()
        const rawData = json.OutBlock_1 || []
        if (rawData.length > 0) {
          kospiData = rawData.map((item: any) => ({
            basDd: item.BAS_DD || '',
            idxNm: item.IDX_NM || '',
            clsprcIdx: item.CLSPRC_IDX || '',
            cmpprevddIdx: item.CMPPREVDD_IDX || '',
            flucRt: item.FLUC_RT || '',
          })).sort((a: any, b: any) => parseFloat(b.flucRt) - parseFloat(a.flucRt))
          break // 실제 데이터가 존재하는 완벽한 "마지막 영업일"을 찾음!
        }
      } else if (fallback === 3) {
        kospiErrorMsg = `KRX API fetch error: ${res.status}`
        console.error(kospiErrorMsg)
      }
    }

    if (kospiData.length === 0 && !kospiErrorMsg) {
      kospiErrorMsg = 'KOSPI 지수 데이터를 가져올 수 없습니다'
    }

    // ── Youtube 트렌드: youtube.trends24.in 스크래핑 ──
    const ytUrl = 'https://youtube.trends24.in/south-korea'
    const ytRes = await fetch(ytUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      }
    })

    let youtubeTrends: any[] = []
    let ytErrorMsg: string | null = null

    if (ytRes.ok) {
      const ytHtml = await ytRes.text()
      const $yt = cheerio.load(ytHtml)
      const videoCards = $yt('ol[aria-labelledby="group-all"] > li.video-item > .video-card')

      videoCards.slice(0, 5).each((i, el) => {
        const rankText = $yt(el).find('.vc-counter').text().trim()
        const rank = parseInt(rankText) || i + 1
        const atag = $yt(el).find('a.video-link')
        const href = atag.attr('href') || ''
        const url = href.startsWith('http') ? href : `https://youtube.com${href}`
        const vMatch = href.match(/v=([^&]+)/)
        const videoId = vMatch ? vMatch[1] : ''
        const thumbnailUrl = videoId ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` : ''

        const keyword = atag.find('.vc-title').text().trim() || ''
        const metaRaw = atag.find('.text-slate-500').text().replace(/\s+/g, ' ').trim()
        const byParts = metaRaw.split(' by ')
        const meta = byParts.length > 1 ? byParts.slice(1).join(' by ').trim() : metaRaw

        youtubeTrends.push({ rank, keyword, meta, url, thumbnailUrl })
      })
    } else {
      ytErrorMsg = `youtube.trends24 fetch error: ${ytRes.status}`
      console.error(ytErrorMsg)
    }

    if (youtubeTrends.length === 0 && !ytErrorMsg) {
      ytErrorMsg = 'Youtube 트렌드 데이터 파싱 실패'
    }

    // ── 통합 응답 ──
    const responseText = JSON.stringify({
      success: true,
      apiErrorMsg: kospiErrorMsg || ytErrorMsg,
      data: {
        kospi: kospiData,
        youtube: youtubeTrends
      }
    });

    memoryCache.set(cacheKeyCombined, { data: responseText, expiry: nowCombined + CACHE_DURATION_MS });

    return new Response(responseText, {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    })
  }
})
