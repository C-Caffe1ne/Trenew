const API_KEY = 'sVIrKI2kS1XiE9CZH9vPPdJOtNAlHlLl';

async function fetchExchangeRate() {
    const contentBox = document.querySelector('#exchange-wrapper .exchange-content');
    if (!contentBox) return;

    try {
        let exchangeData = null;
        let searchDate = new Date();
        
        // 주말인 경우 금요일로 날짜를 우선 점프시켜 불필요한 요청(Rate limit) 방지
        const dayOfWeek = searchDate.getDay();
        if (dayOfWeek === 0) searchDate.setDate(searchDate.getDate() - 2); // 일요일 -> 금요일
        else if (dayOfWeek === 6) searchDate.setDate(searchDate.getDate() - 1); // 토요일 -> 금요일

        const SUPABASE_URL = 'https://zjxpmtmuzfjfvswghtbq.supabase.co';
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpqeHBtdG11emZqZnZzd2dodGJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1OTIzMTUsImV4cCI6MjA5MDE2ODMxNX0.4LPWUg-m11NayTxQtg_j90iQ7iuKdrXlzwcu6x-y_3o';

        // 대상 통화 목록 (미국 달러, 일본 엔, 유럽 유로, 중국 위안)
        const targetCurrencies = ["USD", "JPY(100)", "EUR", "CNH"];

        for (let i = 0; i < 5; i++) {
            const dateStr = searchDate.toISOString().slice(0, 10).replace(/-/g, '');
            
            try {
                const response = await fetch(`${SUPABASE_URL}/functions/v1/get-external-api`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${SUPABASE_KEY}`
                    },
                    body: JSON.stringify({
                        action: 'exchange',
                        apiKey: API_KEY,
                        date: dateStr
                    })
                });
                
                if (!response.ok) throw new Error('Supabase Edge Function 오류');
                
                const resJson = await response.json();
                
                if (resJson.success && Array.isArray(resJson.data)) {
                    const parsedData = resJson.data;
                    
                    if (parsedData.length > 0) {
                        const foundData = parsedData.filter(item => targetCurrencies.includes(item.cur_unit));
                        if (foundData.length > 0) {
                            // 순서 유지
                            exchangeData = targetCurrencies.map(cur => {
                                const matched = foundData.find(item => item.cur_unit === cur);
                                if (!matched) return null;
                                return {
                                    ...matched,
                                    date: `${searchDate.getFullYear()}.${String(searchDate.getMonth() + 1).padStart(2, '0')}.${String(searchDate.getDate()).padStart(2, '0')}`
                                };
                            }).filter(Boolean);
                            break; 
                        }
                    }
                }
            } catch (e) {
                console.warn(`[Proxy Warning] ${dateStr} 데이터 조회 실패`, e.message);
            }

            if (exchangeData) break;
            searchDate.setDate(searchDate.getDate() - 1);
            await new Promise(r => setTimeout(r, 300));
        }

        // 실패 시 오픈 API 보조 로직
        if (!exchangeData) {
            console.warn("한국수출입은행 API 조회 실패. 보조 환율 API로 Fallback 합니다.");
            const fallbackRes = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/krw.json');
            if (fallbackRes.ok) {
                const fallbackData = await fallbackRes.json();
                let fbDate = fallbackData.date || new Date().toISOString().slice(0, 10);
                fbDate = fbDate.replace(/-/g, '.');
                
                exchangeData = [];
                const krwData = fallbackData.krw;
                
                const targets = [
                    { ext: "USD", fb: "usd", nm: "미국 달러" },
                    { ext: "JPY(100)", fb: "jpy", nm: "일본 옌", mult: 100 },
                    { ext: "EUR", fb: "eur", nm: "유로" },
                    { ext: "CNH", fb: "cny", nm: "위안화" }
                ];

                for (const t of targets) {
                    if (krwData[t.fb]) {
                        const rate = (1 / krwData[t.fb]) * (t.mult || 1);
                        exchangeData.push({
                            cur_unit: t.ext,
                            cur_nm: t.nm,
                            deal_bas_r: rate.toLocaleString('ko-KR', { maximumFractionDigits: 2 }),
                            ttb: (rate * 0.99).toLocaleString('ko-KR', { maximumFractionDigits: 2 }),
                            tts: (rate * 1.01).toLocaleString('ko-KR', { maximumFractionDigits: 2 }),
                            date: fbDate
                        });
                    }
                }
            }
        }

        if (exchangeData && exchangeData.length > 0) {
            
            const getCurName = (code) => {
                if(code === 'USD') return '🇺🇸 미국 달러 (USD)';
                if(code === 'JPY(100)') return '🇯🇵 일본 엔 (JPY 100)';
                if(code === 'EUR') return '🇪🇺 유럽 유로 (EUR)';
                if(code === 'CNH') return '🇨🇳 중국 위안 (CNY)';
                return code;
            };

            contentBox.innerHTML = `
                <div style="position: relative; width: 100%; display: flex; align-items: center; justify-content: space-between;">
                    <button id="exc-prev" style="background: none; border: none; cursor: pointer; font-size: 2rem; color: #94a3b8; padding: 0.5rem; transition: color 0.2s; z-index: 2;">&#8249;</button>
                    <div style="flex: 1; overflow: hidden; position: relative;">
                        <!-- 슬라이드 트랙 -->
                        <div id="exchange-track" style="display: flex; transition: transform 0.4s cubic-bezier(0.25, 0.8, 0.25, 1); width: 100%;">
                            ${exchangeData.map(data => `
                                <div style="min-width: 100%; padding: 0 0.5rem; box-sizing: border-box; text-align: center;">
                                    <div style="font-size: 0.95rem; font-weight: 600; color: #15803d; margin-bottom: 0.5rem;">${getCurName(data.cur_unit)}</div>
                                    <div style="font-size: 2.2rem; font-weight: 800; color: #111; letter-spacing: -1px; line-height: 1.2;">
                                        ${data.deal_bas_r} <span style="font-size: 1rem; font-weight: 500; color: #666; vertical-align: baseline;">KRW</span>
                                    </div>
                                    <div style="margin-top: 1.2rem; display: flex; gap: 0.5rem; justify-content: center;">
                                        <div style="background: rgba(239, 246, 255, 0.6); padding: 0.7rem; border-radius: 8px; flex: 1; max-width: 130px;">
                                            <span style="display: block; font-size: 0.8rem; color: #64748b; margin-bottom: 0.1rem;">송금 받을 때</span>
                                            <span style="display: block; font-size: 1rem; font-weight: 700; color: #0f172a;">${data.tts}</span>
                                        </div>
                                        <div style="background: rgba(254, 242, 242, 0.6); padding: 0.7rem; border-radius: 8px; flex: 1; max-width: 130px;">
                                            <span style="display: block; font-size: 0.8rem; color: #64748b; margin-bottom: 0.1rem;">송금 보낼 때</span>
                                            <span style="display: block; font-size: 1rem; font-weight: 700; color: #0f172a;">${data.ttb}</span>
                                        </div>
                                    </div>
                                    <div style="margin-top: 1rem; font-size: 0.75rem; color: #94a3b8;">
                                        수출입은행 고시 기준 (${data.date})
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    <button id="exc-next" style="background: none; border: none; cursor: pointer; font-size: 2rem; color: #94a3b8; padding: 0.5rem; transition: color 0.2s; z-index: 2;">&#8250;</button>
                </div>
                <div id="exc-dots" style="display: flex; justify-content: center; gap: 8px; margin-top: 0.8rem;">
                    ${exchangeData.map((_, i) => `<span class="exc-dot" data-idx="${i}" style="width: 6px; height: 6px; border-radius: 50%; background: ${i === 0 ? '#15803d' : '#cbd5e1'}; cursor: pointer; transition: background 0.3s; padding: 3px; background-clip: content-box; display: inline-block; box-sizing: content-box;"></span>`).join('')}
                </div>
            `;

            const track = document.getElementById('exchange-track');
            const dots = document.querySelectorAll('.exc-dot');
            const btnPrev = document.getElementById('exc-prev');
            const btnNext = document.getElementById('exc-next');
            
            let currentSlide = 0;
            const totalSlides = exchangeData.length;
            let slideInterval;

            const updateSlide = () => {
                track.style.transform = `translateX(-${currentSlide * 100}%)`;
                dots.forEach((dot, i) => {
                    dot.style.backgroundColor = i === currentSlide ? '#15803d' : '#cbd5e1';
                });
            };

            const resetAutoSlide = () => {
                clearInterval(slideInterval);
                slideInterval = setInterval(() => {
                    currentSlide = (currentSlide + 1) % totalSlides;
                    updateSlide();
                }, 4000);
            };

            btnPrev.onclick = () => {
                currentSlide = (currentSlide - 1 + totalSlides) % totalSlides;
                updateSlide();
                resetAutoSlide();
            };
            btnPrev.addEventListener('mouseover', () => btnPrev.style.color = '#15803d');
            btnPrev.addEventListener('mouseout', () => btnPrev.style.color = '#94a3b8');

            btnNext.onclick = () => {
                currentSlide = (currentSlide + 1) % totalSlides;
                updateSlide();
                resetAutoSlide();
            };
            btnNext.addEventListener('mouseover', () => btnNext.style.color = '#15803d');
            btnNext.addEventListener('mouseout', () => btnNext.style.color = '#94a3b8');

            dots.forEach(dot => {
                dot.onclick = (e) => {
                    currentSlide = parseInt(e.target.dataset.idx);
                    updateSlide();
                    resetAutoSlide();
                };
            });

            // 초기 인터벌 시작
            resetAutoSlide();

        } else {
            throw new Error("최근 7일간 주요 환율 데이터를 찾을 수 없습니다.");
        }

    } catch (err) {
        console.error('환율 로딩 실패:', err.message);
        contentBox.innerHTML = `
            <div style="text-align: center; color: #ef4444; padding: 2rem;">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin: 0 auto 1rem;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                <p>환율 정보를 불러오지 못했습니다.</p>
                <p style="font-size: 0.8rem; margin-top: 0.5rem;">${err.message}</p>
            </div>
        `;
    }
}

fetchExchangeRate();
