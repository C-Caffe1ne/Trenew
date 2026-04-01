import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = 'https://zjxpmtmuzfjfvswghtbq.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpqeHBtdG11emZqZnZzd2dodGJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1OTIzMTUsImV4cCI6MjA5MDE2ODMxNX0.4LPWUg-m11NayTxQtg_j90iQ7iuKdrXlzwcu6x-y_3o'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function renderCardNews() {
    const wrapper = document.getElementById('news-wrapper')
    if (!wrapper) return

    try {
        const { data: newsItems, error } = await supabase
            .from('news_articles')
            .select('*')
            .order('pub_date', { ascending: false })
            .limit(10)

        if (error) throw error

        // 캐러셀 구조 생성
        wrapper.innerHTML = `
            <div class="news-carousel">
                <button class="carousel-btn carousel-btn-left" onclick="moveCarousel(-1)">&#8249;</button>
                <div class="carousel-track-wrapper">
                    <div class="carousel-track" id="carousel-track">
                        ${newsItems.map(item => {
            const displayCategory = (item.category && item.category.length > 0)
                ? item.category[0] : '일반'
            return `
                                <div class="card-news-container" onclick="window.open('${item.link}', '_blank')" style="cursor:pointer;">
                                    <div class="news-image-wrapper">
                                        <img src="${item.image_url || 'https://via.placeholder.com/1080'}"
                                             alt="${item.title}" class="news-image">
                                        <div class="news-badge">${displayCategory}</div>
                                    </div>
                                    <div class="news-content">
                                        <div>
                                            <h3 class="news-title clamp-2">${item.title}</h3>
                                            <p class="news-desc clamp-2">${item.description || ''}</p>
                                        </div>
                                        <div class="news-meta">${item.pub_date}</div>
                                    </div>
                                </div>
                            `
        }).join('')}
                    </div>
                </div>
                <button class="carousel-btn carousel-btn-right" onclick="moveCarousel(1)">&#8250;</button>
            </div>
            <div class="carousel-dots" id="carousel-dots">
                ${newsItems.map((_, i) => `
                    <span class="dot ${i === 0 ? 'active' : ''}" onclick="goToSlide(${i})"></span>
                `).join('')}
            </div>
        `

        // 캐러셀 초기화
        window._carouselIndex = 0
        window._carouselTotal = newsItems.length

    } catch (err) {
        console.error('뉴스 로딩 실패:', err.message)
        wrapper.innerHTML = '<p>뉴스를 불러오지 못했습니다.</p>'
    }
}

window.moveCarousel = function (direction) {
    const total = window._carouselTotal
    window._carouselIndex = (window._carouselIndex + direction + total) % total
    updateCarousel()
}

window.goToSlide = function (index) {
    window._carouselIndex = index
    updateCarousel()
}

function updateCarousel() {
    const track = document.getElementById('carousel-track')
    const dots = document.querySelectorAll('.dot')
    const index = window._carouselIndex

    track.style.transform = `translateX(-${index * 100}%)`
    dots.forEach((dot, i) => dot.classList.toggle('active', i === index))
}

renderCardNews()