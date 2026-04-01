import { createClient } from '@supabase/supabase-js'

// 1. Supabase 접속 정보 (프로젝트 설정에 맞게 수정)
const SUPABASE_URL = 'https://zjxpmtmuzfjfvswghtbq.supabase.co'
const SUPABASE_KEY = 'sb_publishable_rW3HB8JZHzWsAw__146jxA_rP28BuN6'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function renderCardNews() {
    // 카드를 감싸는 부모 컨테이너 (HTML에 <div id="news-wrapper"></div>가 있다고 가정)
    const wrapper = document.getElementById('news-wrapper');

    try {
        // 2. 데이터 가져오기 (최신순 10개)
        const { data: newsItems, error } = await supabase
            .from('news_articles')
            .select('*')
            .limit(10);

        if (error) throw error;

        // 3. 사용자가 제공한 클래스 구조에 맞게 HTML 생성
        const htmlContent = newsItems.map(item => {
            // 카테고리 배열이 비어있을 경우를 대비한 처리
            const displayCategory = (item.category && item.category.length > 0)
                ? item.category[0]
                : '일반';

            return `
                <div class="card-news-container">
                    <div class="news-image-wrapper">
                        <img src="${item.image_url || 'https://via.placeholder.com/1080'}" 
                             alt="${item.title}" class="news-image">
                        <div class="news-badge">${displayCategory}</div>
                    </div>
                    <div class="news-content">
                        <div>
                            <h3 class="news-title">${item.title}</h3>
                            <p class="news-desc">${item.description}</p>
                        </div>
                        <div class="news-meta">${item.pubDate}</div>
                    </div>
                </div>
            `;
        }).join('');

        // 4. 화면에 결과물 삽입
        wrapper.innerHTML = htmlContent;

    } catch (error) {
        console.error('데이터 로딩 에러:', error.message);
    }
}

// 함수 실행
renderCardNews();