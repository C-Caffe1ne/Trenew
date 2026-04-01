import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  try {
    // 1단계: API 호출 테스트
    console.log('1단계: newsdata.io API 호출 시작')
    const API_KEY = 'pub_ec7ecaf240684a2cb0c91ae496c6b24e'
    const response = await fetch(
      `https://newsdata.io/api/1/latest?apikey=${API_KEY}&country=kr&language=ko&timezone=asia/seoul&image=1`
    )
    console.log('API 응답 상태:', response.status)

    const result = await response.json()
    console.log('API 결과 키:', Object.keys(result))
    console.log('뉴스 개수:', result.results?.length)

    if (!result.results) {
      return new Response(JSON.stringify({ error: 'results 없음', raw: result }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      })
    }

    // 2단계: Supabase 연결 테스트
    console.log('2단계: Supabase 연결 시작')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    console.log('URL 존재:', !!supabaseUrl)
    console.log('KEY 존재:', !!supabaseKey)


    const supabase = createClient(supabaseUrl ?? '', supabaseKey ?? '')

    // 3단계: DB 저장
    console.log('3단계: DB 저장 시작')
    const { error } = await supabase
      .from('news_articles')
      .upsert(result.results.map((item: any) => ({
        article_id: item.article_id,
        title: item.title,
        description: item.description ?? '',
        image_url: item.image_url ?? '',
        link: item.link,
        pub_date: item.pubDate,
        category: item.category ?? []
      })), { onConflict: 'article_id' })

    if (error) {
      console.error('DB 에러:', error.message)
      throw error
    }

    console.log('완료!')
    return new Response(JSON.stringify({ message: `${result.results.length}개 저장 완료` }), {
      headers: { "Content-Type": "application/json" }
    })

  } catch (err) {
    console.error('catch 에러:', err.message)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    })
  }
})