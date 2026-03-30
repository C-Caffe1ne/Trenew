// supabase/functions/get-external-api/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

serve(async (req) => {
  // CORS preflight request 처리
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Edge Function은 기본적으로 UTC 시간이므로 KST(한국 시간)로 보정하기 위해 9시간을 더합니다.
    const today = new Date();
    const kstTime = new Date(today.getTime() + (9 * 60 * 60 * 1000));

    // YYYYMMDD 포맷 생성
    const formattedDate =
      kstTime.getFullYear() +
      String(kstTime.getMonth() + 1).padStart(2, '0') +
      String(kstTime.getDate()).padStart(2, '0');

    const apiUrl = 'https://loword.co.kr/api/v1/keyword/trend/getList';

    // 2. loword API에 POST 요청
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: JSON.stringify({ date: formattedDate })
    });

    const data = await response.json();
    let rankedList: any[] = [];
    let apiErrorMsg = null;

    // 3. API 응답 성공 여부 확인 및 데이터 가공
    if (data.rsltCd === '00' && data.data) {
      const naverTrends = data.data.keywordTrend.naver || [];
      const top10 = naverTrends.slice(0, 10);

      // index.html에서 기존 UI 스키마 { rank, keyword }를 그대로 따르도록 매핑
      // 트렌드 등락폭(NEW, 상승/하락)을 키워드 뒤에 덧붙여 보여줍니다.
      rankedList = top10.map((item: any) => ({
        rank: parseInt(item.rank, 10),
        keyword: `${item.keyword} ${item.caret === 'NEW' ? '(NEW)' : (item.pivot === '-' || item.pivot === 'n' ? '' : `(${item.caret})`)}`.trim()
      }));
    } else {
      apiErrorMsg = data.rsltMsg || "loword API 에러";
      console.error("loword API Error:", apiErrorMsg);
    }

    // 4. 브라우저(HTML)로 전달
    return new Response(JSON.stringify({
      success: true,
      apiErrorMsg: apiErrorMsg,
      data: rankedList
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
