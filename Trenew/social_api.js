// social_api.js
// Supabase Edge Function(get-external-api)을 호출하여 KOSPI 지수와 YouTube 트렌드를 렌더링

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

        renderKospiCarousel(json.data.kospi || []);
        renderYoutubeTrends(json.data.youtube || []);
    } catch (err) {
        console.error('소셜 트렌드 로딩 실패:', err);
    }
}

// ── KOSPI 캐러셀 ──
let kospiCurrentPage = 0;
let kospiTotalPages = 0;

function renderKospiCarousel(data) {
    const track = document.getElementById('kospi-carousel-track');
    const dotsContainer = document.getElementById('kospi-dots');
    const prevBtn = document.getElementById('kospi-prev');
    const nextBtn = document.getElementById('kospi-next');
    if (!track || !dotsContainer) return;

    if (data.length === 0) {
        track.innerHTML = '<div class="kospi-page"><p style="text-align:center; color:#9ca3af; padding:2rem;">KOSPI 지수 데이터를 가져올 수 없습니다</p></div>';
        dotsContainer.innerHTML = '';
        return;
    }

    if (data[0] && data[0].basDd) {
        const d = data[0].basDd; // e.g. "20260409"
        const formattedDate = `${d.substring(0,4)}.${d.substring(4,6)}.${d.substring(6,8)} 기준`;
        const dateLabel = document.getElementById('kospi-date-label');
        if (dateLabel) dateLabel.innerText = formattedDate;
    }

    // 8개씩 페이지 분할
    const pageSize = 8;
    const pages = [];
    for (let i = 0; i < data.length; i += pageSize) {
        pages.push(data.slice(i, i + pageSize));
    }
    kospiTotalPages = pages.length;
    kospiCurrentPage = 0;

    // 트랙에 페이지 삽입
    track.innerHTML = pages.map((pageData, pageIdx) => {
        const rows = pageData.map(item => {
            const flucVal = parseFloat(item.flucRt);
            const cmpprevVal = parseFloat(item.cmpprevddIdx);
            let flucClass = 'kospi-neutral';
            let arrow = '';
            if (flucVal > 0) { flucClass = 'kospi-up'; arrow = '▲'; }
            else if (flucVal < 0) { flucClass = 'kospi-down'; arrow = '▼'; }

            let cmpprevClass = 'kospi-neutral';
            let cmpprevArrow = '';
            if (cmpprevVal > 0) { cmpprevClass = 'kospi-up'; cmpprevArrow = '▲'; }
            else if (cmpprevVal < 0) { cmpprevClass = 'kospi-down'; cmpprevArrow = '▼'; }

            return `<tr>
                <td class="kospi-name">${item.idxNm}</td>
                <td class="kospi-price">${item.clsprcIdx}</td>
                <td class="${cmpprevClass}">${cmpprevArrow} ${item.cmpprevddIdx}</td>
                <td class="${flucClass}">${arrow} ${item.flucRt}%</td>
            </tr>`;
        }).join('');

        return `<div class="kospi-page" data-page="${pageIdx}">
            <table class="kospi-table">
                <thead>
                    <tr>
                        <th>지수명</th>
                        <th>종가</th>
                        <th>대비</th>
                        <th>등락률</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;
    }).join('');

    // 점(dot) 인디케이터 생성
    dotsContainer.innerHTML = pages.map((_, i) =>
        `<button class="kospi-dot${i === 0 ? ' active' : ''}" data-page="${i}" aria-label="페이지 ${i + 1}"></button>`
    ).join('');

    // 이벤트 바인딩
    updateCarouselView();

    prevBtn.onclick = () => {
        if (kospiCurrentPage > 0) {
            kospiCurrentPage--;
            updateCarouselView();
        }
    };
    nextBtn.onclick = () => {
        if (kospiCurrentPage < kospiTotalPages - 1) {
            kospiCurrentPage++;
            updateCarouselView();
        }
    };
    dotsContainer.querySelectorAll('.kospi-dot').forEach(dot => {
        dot.addEventListener('click', () => {
            kospiCurrentPage = parseInt(dot.dataset.page);
            updateCarouselView();
        });
    });
}

function updateCarouselView() {
    const track = document.getElementById('kospi-carousel-track');
    const dots = document.querySelectorAll('.kospi-dot');
    const prevBtn = document.getElementById('kospi-prev');
    const nextBtn = document.getElementById('kospi-next');
    if (!track) return;

    track.style.transform = `translateX(-${kospiCurrentPage * 100}%)`;

    dots.forEach((dot, i) => {
        dot.classList.toggle('active', i === kospiCurrentPage);
    });

    if (prevBtn) prevBtn.disabled = kospiCurrentPage === 0;
    if (nextBtn) nextBtn.disabled = kospiCurrentPage === kospiTotalPages - 1;
}

// ── YouTube 트렌드 ──
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
