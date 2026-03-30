// 1. Supabase 설정 (프로젝트 URL과 Public API Key 입력)
const _supabase = supabase.createClient('https://zjxpmtmuzfjfvswghtbq.supabase.co', 'sb_publishable_rW3HB8JZHzWsAw__146jxA_rP28BuN6');

// 네이버 실시간 검색어 데이터 가져오기 (실제로는 데이터랩 트렌드 & Mock 데이터)
async function getNaverTrends() {
    try {
        // 2. 미리 만들어둔 Edge Function 호출 (get-external-api)
        const { data, error } = await _supabase.functions.invoke('get-external-api', {
            method: 'POST' 
        });

        if (error) {
            console.error('Edge Function 에러 발생:', error);
            return;
        }

        if (data && data.success && data.data) {
            renderNaverTrends(data.data);
        } else {
            console.error('API 응답 형식 오류:', data);
        }
    } catch (err) {
        console.error('네트워크 에러:', err);
    }
}

// 3. 가져온 10개의 데이터를 HTML 리스트에 렌더링
function renderNaverTrends(trends) {
    const list1 = document.getElementById('naver-trend-list-1'); // 1~5위 리스트
    const list2 = document.getElementById('naver-trend-list-2'); // 6~10위 리스트

    if (!list1 || !list2) return;

    // 리스트 초기화
    list1.innerHTML = '';
    list2.innerHTML = '';

    trends.forEach((item, index) => {
        const li = document.createElement('li');
        li.className = 'trend-item';
        li.innerHTML = `<span class="rank">${item.rank}</span><span class="keyword">${item.keyword}</span>`;

        if (index < 5) {
            list1.appendChild(li);
        } else if (index < 10) {
            list2.appendChild(li);
        }
    });
}

// 스크립트 로드 시 자동으로 실행
document.addEventListener('DOMContentLoaded', () => {
    getNaverTrends();
});