// namu_api.js
// 나무위키 실시간 검색어 API 호출 및 기존 UI(trend-list) 렌더링 로직

async function getNamuTrends() {
    try {
        const res = await fetch('https://search.namu.wiki/api/ranking', { cache: 'no-store' });
        const data = await res.json();

        // 1위부터 10위 추출 후 데이터 가공
        const trends = data.slice(0, 10).map((keyword, idx) => ({
            rank: idx + 1,
            keyword: keyword.trim()
        }));

        renderNamuTrends(trends);
    } catch (err) {
        console.error('나무위키 랭킹 API 오류:', err);
    }
}

function renderNamuTrends(trends) {
    const list1 = document.getElementById('namu-trend-list-1'); // 1~5위 리스트
    const list2 = document.getElementById('namu-trend-list-2'); // 6~10위 리스트

    if (!list1 || !list2) return;

    list1.innerHTML = '';
    list2.innerHTML = '';

    trends.forEach((item, index) => {
        const li = document.createElement('li');
        li.className = 'trend-item';
        li.innerHTML = `<span class="rank">${item.rank}</span><span class="keyword">${item.keyword}</span>`;

        // 마우스 호버 시 클릭 가능함을 표시하고, 클릭 시 새 창에서 나무위키 검색
        li.style.cursor = 'pointer';
        li.addEventListener('click', () => {
            window.open(`https://namu.wiki/Go?q=${encodeURIComponent(item.keyword)}`, '_blank');
        });

        if (index < 5) {
            list1.appendChild(li);
        } else if (index < 10) {
            list2.appendChild(li);
        }
    });
}

// 스크립트 로드 시 자동으로 실행
document.addEventListener('DOMContentLoaded', () => {
    getNamuTrends();

    // 60초마다 자동 갱신
    setInterval(getNamuTrends, 60000);
});
