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
    // 1. 네이버 API 키 설정 (직접 입력한 키 적용)
    const clientId = 'LHHLUvminUf60faVLi0Z'
    const clientSecret = 'aHwMIp1bTS'

    // 네이버 데이터랩 API는 실시간 검색어가 아닌 트렌드 데이터를 제공합니다.
    // 5개의 키워드 그룹을 지정하여 현재 트렌드를 비교합니다.
    const today = new Date();
    // 데이터랩은 보통 전날까지의 데이터만 제공하므로 어제 날짜를 endDate로 설정
    const endDateObj = new Date(today);
    endDateObj.setDate(today.getDate() - 1);
    const endDate = endDateObj.toISOString().split('T')[0];
    
    // 30일 전
    const startDateObj = new Date(today);
    startDateObj.setDate(today.getDate() - 31);
    const startDate = startDateObj.toISOString().split('T')[0];

    const requestBody1 = {
      startDate: startDate,
      endDate: endDate,
      timeUnit: "date",
      keywordGroups: [
        { groupName: "코로나", keywords: ["코로나19", "코로나"] },
        { groupName: "올림픽", keywords: ["파리올림픽", "올림픽 금메달"] },
        { groupName: "날씨", keywords: ["오늘 날씨", "미세먼지"] },
        { groupName: "넷플릭스", keywords: ["넷플릭스 신작", "넷플릭스 영화"] },
        { groupName: "비트코인", keywords: ["비트코인 시세", "암호화폐"] }
      ]
    };

    const requestBody2 = {
      startDate: startDate,
      endDate: endDate,
      timeUnit: "date",
      keywordGroups: [
        { groupName: "주식", keywords: ["국내 주식시장", "코스피"] },
        { groupName: "인공지능", keywords: ["인공지능 챗봇", "챗GPT"] },
        { groupName: "아이폰", keywords: ["아이폰 신모델", "애플 이벤트"] },
        { groupName: "전기차", keywords: ["전기차 보조금", "테슬라"] },
        { groupName: "주말", keywords: ["주말 가볼만한곳", "여행추천"] }
      ]
    };

    let allResults: any[] = [];
    let apiErrorMsg = null;

    if (clientId && clientSecret) {
      const fetchOptions = {
        method: 'POST',
        headers: {
          'X-Naver-Client-Id': clientId,
          'X-Naver-Client-Secret': clientSecret,
          'Content-Type': 'application/json',
        }
      };

      const [res1, res2] = await Promise.all([
        fetch('https://openapi.naver.com/v1/datalab/search', { ...fetchOptions, body: JSON.stringify(requestBody1) }),
        fetch('https://openapi.naver.com/v1/datalab/search', { ...fetchOptions, body: JSON.stringify(requestBody2) })
      ]);

      if (res1.ok && res2.ok) {
        const data1 = await res1.json();
        const data2 = await res2.json();
        allResults = [...(data1.results || []), ...(data2.results || [])];
      } else {
        apiErrorMsg = await (!res1.ok ? res1.text() : res2.text());
        console.error("Naver API Error:", apiErrorMsg);
      }
    }

    let rankedList = [];

    // DataLab API 요청 성공 시 10개의 그룹을 최근 트렌드 비율 기준으로 정렬
    if (allResults.length > 0) {
      rankedList = allResults.map((item: any) => {
        const latestData = item.data[item.data.length - 1] || { ratio: 0 };
        return {
          // 사용자가 원한 keywordGroups.keywords 값을 쉼표로 연결하여 화면에 노출
          keyword: item.keywords.join(', '),
          ratio: latestData.ratio
        };
      })
      .sort((a: any, b: any) => b.ratio - a.ratio)
      .map((item: any, index: number) => ({
        rank: index + 1,
        keyword: item.keyword
      }));
    } else {
      // 에러 발생 시 UI 에러 표시를 위해 빈 배열 반환 또는 백업 데이터 반환
      for(let i=1; i<=10; i++) {
         rankedList.push({ rank: i, keyword: `트렌드 로딩 실패 (${i})` });
      }
    }

    // 3. 브라우저(HTML)로 가공된 결과 전달
    return new Response(JSON.stringify({
      success: true,
      apiErrorMsg: apiErrorMsg,
      data: rankedList.slice(0, 10)
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
