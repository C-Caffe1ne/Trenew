/**
 * loword.co.kr 실시간 검색어 API 호출 스크립트
 * 
 * 실행 방법:
 * node fetchLowordAPI.js
 */

async function fetchRealtimeTrends() {
  // 1. 필요한 날짜 포맷 생성 (YYYYMMDD)
  const today = new Date();
  const formattedDate =
    today.getFullYear() +
    String(today.getMonth() + 1).padStart(2, '0') +
    String(today.getDate()).padStart(2, '0');

  const apiUrl = 'https://loword.co.kr/api/v1/keyword/trend/getList';

  try {
    // 2. POST 요청
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: JSON.stringify({ date: formattedDate })
    });

    const data = await response.json();

    // 3. 성공 여부 확인 및 데이터 가공
    if (data.rsltCd === '00' && data.data) {
      // 네이버 기준 트렌드 정보 추출 (1~10위)
      const naverTrends = data.data.keywordTrend.naver || [];
      const top10 = naverTrends.slice(0, 10);

      console.log('--- 오늘자 네이버 실시간 검색어 TOP 10 (loword 기준) ---');
      top10.forEach(item => {
        console.log(`${item.rank}위: ${item.keyword} (${item.caret === 'NEW' ? 'NEW' : item.pivot})`);
      });

      return top10;
    } else {
      console.error('API 응답 에러:', data.rsltMsg || '알 수 없는 에러');
      return null;
    }

  } catch (error) {
    console.error('네트워크 또는 파싱 오류:', error);
    return null;
  }
}

// 스크립트 단독 실행 시 바로 호출
fetchRealtimeTrends();
