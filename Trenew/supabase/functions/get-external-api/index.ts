// supabase/functions/get-external-api/index.ts
// X(트위터) 실시간 트렌드를 trends24.in에서 스크래핑하여 반환

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts"

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
      const doc = new DOMParser().parseFromString(html, 'text/html')

      if (doc) {
        // 첫 번째 trend-card(가장 최신 1시간)의 trend-link 요소들 추출
        const allLinks = doc.querySelectorAll('.trend-link')
        const seen = new Set<string>()

        for (let i = 0; i < allLinks.length && xTrends.length < 5; i++) {
          const el = allLinks[i]
          const keyword = el.textContent?.trim() || ''
          if (keyword && !seen.has(keyword)) {
            seen.add(keyword)
            const href = el.getAttribute('href') || ''
            xTrends.push({
              rank: xTrends.length + 1,
              keyword: keyword,
              meta: 'Trending',
              url: href
            })
          }
        }
      }
    } else {
      xErrorMsg = `trends24 fetch error: ${res.status}`
      console.error(xErrorMsg)
    }

    if (xTrends.length === 0 && !xErrorMsg) {
      xErrorMsg = '트렌드 데이터 파싱 실패'
    }

    // ── Threads 트렌드: 공식 API 부재로 목업 데이터 ──
    const threadsTrends = [
      { rank: 1, keyword: '오늘 날씨 미쳤다', meta: '2,041 replies' },
      { rank: 2, keyword: '스레드 시작', meta: '1,520 replies' },
      { rank: 3, keyword: '일상 기록용', meta: '980 replies' },
      { rank: 4, keyword: '오운완', meta: '840 replies' },
      { rank: 5, keyword: '성수동 맛집', meta: '650 replies' },
    ]

    // ── 통합 응답 ──
    return new Response(JSON.stringify({
      success: true,
      apiErrorMsg: xErrorMsg,
      data: {
        x: xTrends,
        threads: threadsTrends
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
