// supabase/functions/get-external-api/index.ts
// KOSPI 지수 데이터(KRX OPEN API) 및 YouTube 트렌드를 반환

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import * as cheerio from "https://esm.sh/cheerio@1.0.0-rc.12"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

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
      const targetUrl = `https://oapi.koreaexim.go.kr/site/program/financial/exchangeJSON?authkey=${apiKey}&searchdate=${date}&data=AP01`;
      
      const exRes = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'ko-KR,ko;q=0.9',
        }
      });
      const exText = await exRes.text();
      let exJson = [];
      try {
           exJson = JSON.parse(exText);
      } catch(e) {}
      
      return new Response(JSON.stringify({ success: true, data: exJson }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ── KOSPI 지수: KRX OPEN API ──
    const today = new Date()
    const basDd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
    const krxApiKey = 'DE9BBB6FBA284DB0968299ABFDAC74C4F98D60C2'
    const krxUrl = `https://data-dbg.krx.co.kr/svc/sample/apis/idx/kospi_dd_trd.json?basDd=${basDd}`

    const res = await fetch(krxUrl, {
      headers: {
        'AUTH_KEY': krxApiKey,
      }
    })

    let kospiData: any[] = []
    let kospiErrorMsg: string | null = null

    if (res.ok) {
      const json = await res.json()
      const rawData = json.OutBlock_1 || []
      // 필요한 필드만 추출 후 등락률 기준 내림차순 정렬
      kospiData = rawData.map((item: any) => ({
        basDd: item.BAS_DD || '',
        idxNm: item.IDX_NM || '',
        clsprcIdx: item.CLSPRC_IDX || '',
        cmpprevddIdx: item.CMPPREVDD_IDX || '',
        flucRt: item.FLUC_RT || '',
      })).sort((a: any, b: any) => parseFloat(b.flucRt) - parseFloat(a.flucRt))
    } else {
      kospiErrorMsg = `KRX API fetch error: ${res.status}`
      console.error(kospiErrorMsg)
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
    return new Response(JSON.stringify({
      success: true,
      apiErrorMsg: kospiErrorMsg || ytErrorMsg,
      data: {
        kospi: kospiData,
        youtube: youtubeTrends
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    })
  }
})
