const cheerio = require('cheerio');
fetch('https://finance.naver.com/sise/sise_index.naver', { headers: { 'Accept-Language': 'ko-KR' }})
  .then(res => res.arrayBuffer())
  .then(buf => {
     const text = new TextDecoder('euc-kr').decode(buf);
     const $ = cheerio.load(text);
     const items = [];
     $('.box_type_m tbody tr').each((i, el) => {
       const tdList = $(el).find('td');
       if (tdList.length >= 4) {
         const idxNm = $(tdList[0]).text().trim();
         const clsprcIdx = $(tdList[1]).text().trim();
         let cmpprevddIdx = $(tdList[2]).text().trim();
         let flucRt = $(tdList[3]).text().trim();
         if (idxNm && clsprcIdx && idxNm !== '지수명') {
           items.push({ idxNm, clsprcIdx, cmpprevddIdx, flucRt });
         }
       }
     });
     console.log(JSON.stringify(items.slice(0, 10), null, 2));
  });
