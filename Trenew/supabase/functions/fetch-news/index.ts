import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  try {
    // 1. 외부 뉴스 API 호출 (제공해주신 키 사용)
    const API_KEY = 'pub_ec7ecaf240684a2cb0c91ae496c6b24e'
    const response = await fetch(`https://newsdata.io/api/1/news?apikey=${API_KEY}&language=ko`)
    const result = await response.json()
    const newsData = result.results // 뉴스 배열 데이터

    // 2. Supabase DB 연결 설정
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // 관리자 권한 키
    )

    // 3. DB에 데이터 넣기 (중복 데이터는 건너뛰거나 업데이트)
    const { data, error } = await supabase
      .from('news_articles')
      .upsert(newsData.map((item: any) => ({
        article_id: item.article_id,
        title: item.title,
        description: item.description,
        image_url: item.image_url,
        link: item.link,
        pubDate: item.pubDate
      })))

    if (error) throw error

    return new Response(JSON.stringify({ message: "성공적으로 저장되었습니다!" }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
