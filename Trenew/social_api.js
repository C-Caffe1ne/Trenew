// social_api.js
// Supabase Edge Function(get-external-api)을 호출하여 X 트렌드와 Threads 트렌드를 렌더링

const SUPABASE_URL = 'https://zjxpmtmuzfjfvswghtbq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpqeHBtdG11emZqZnZzd2dodGJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1OTIzMTUsImV4cCI6MjA5MDE2ODMxNX0.4LPWUg-m11NayTxQtg_j90iQ7iuKdrXlzwcu6x-y_3o';

async function fetchSocialTrends() {
    try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/get-external-api`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_KEY}`
            }
        });

        if (!res.ok) {
            console.error('Edge Function 오류:', res.status);
            return;
        }

        const json = await res.json();
        if (!json.success || !json.data) {
            console.error('API 응답 오류:', json);
            return;
        }

        renderXTrends(json.data.x || []);
        renderYoutubeTrends(json.data.youtube || []);
    } catch (err) {
        console.error('소셜 트렌드 로딩 실패:', err);
    }
}

function renderXTrends(trends) {
    const list = document.getElementById('x-trend-list');
    if (!list) return;
    list.innerHTML = '';

    if (trends.length === 0) {
        list.innerHTML = '<li class="social-item"><div class="social-info"><span class="keyword">X 트렌드를 가져올 수 없습니다</span></div></li>';
        return;
    }

    trends.forEach(item => {
        const li = document.createElement('li');
        li.className = 'social-item';
        li.style.cursor = 'pointer';
        li.innerHTML = `
            <span class="rank text-blue">${item.rank}</span>
            <div class="social-info">
                <span class="keyword">${item.keyword}</span>
                <span class="meta">${item.meta}</span>
            </div>
        `;
        li.addEventListener('click', () => {
            const searchUrl = item.url || `https://twitter.com/search?q=${encodeURIComponent(item.keyword)}`;
            window.open(searchUrl, '_blank');
        });
        list.appendChild(li);
    });
}

function renderYoutubeTrends(trends) {
    const list = document.getElementById('youtube-trend-list');
    if (!list) return;
    list.innerHTML = '';

    if (trends.length === 0) {
        list.innerHTML = '<li class="social-item"><div class="social-info"><span class="keyword">YouTube 데이터 없음</span></div></li>';
        return;
    }

    trends.forEach(item => {
        const li = document.createElement('li');
        li.className = 'social-item';
        li.style.cursor = 'pointer';
        li.style.alignItems = 'center';

        const thumbHtml = item.thumbnailUrl 
            ? `<div style="flex-shrink: 0; width: 80px; height: 45px; margin: 0 10px; border-radius: 4px; overflow: hidden; background-color: #000;">
                 <img src="${item.thumbnailUrl}" style="width: 100%; height: 100%; object-fit: cover;" alt="thumbnail" />
               </div>`
            : '';

        li.innerHTML = `
            <span class="rank text-red" style="align-self: center;">${item.rank}</span>
            ${thumbHtml}
            <div class="social-info" style="flex: 1; min-width: 0;">
                <span class="keyword" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block;">${item.keyword}</span>
                <span class="meta">${item.meta}</span>
            </div>
        `;
        li.addEventListener('click', () => {
            if (item.url) {
                window.open(item.url, '_blank');
            }
        });
        list.appendChild(li);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    fetchSocialTrends();
    // 5분마다 자동 갱신
    setInterval(fetchSocialTrends, 300000);
});
