// supabase/functions/get-external-api/index.ts
// X(트위터) 실시간 트렌드를 trends24.in에서 스크래핑하여 반환

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

    // ── X(트위터) 트렌드: trends24.in 스크래핑 ──
    const url = 'https://trends24.in/korea/'
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      }
    })

    let xTrends: any[] = []
    let xErrorMsg: string | null = null

    if (res.ok) {
      const html = await res.text()
      const $ = cheerio.load(html)
      const allLinks = $('.trend-link')
      const seen = new Set<string>()

      allLinks.each((i, el) => {
        if (xTrends.length >= 5) return false

        const keyword = $(el).text().trim() || ''
        if (keyword && !seen.has(keyword)) {
          seen.add(keyword)
          const href = $(el).attr('href') || ''
          xTrends.push({
            rank: xTrends.length + 1,
            keyword: keyword,
            meta: 'Trending',
            url: href
          })
        }
      })
    } else {
      xErrorMsg = `trends24 fetch error: ${res.status}`
      console.error(xErrorMsg)
    }

    if (xTrends.length === 0 && !xErrorMsg) {
      xErrorMsg = '트렌드 데이터 파싱 실패'
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
      apiErrorMsg: xErrorMsg || ytErrorMsg,
      data: {
        x: xTrends,
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
