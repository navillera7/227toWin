const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const router = express.Router();

router.get('/towns', async (req, res) => {
  try {
    const url = 'http://info.nec.go.kr/electioninfo/electionInfo_report.xhtml';
    
    const response = await axios.get(url, { 
      params: req.query, 
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      }
    });

    const $ = cheerio.load(response.data);
    const results = [];
    
    let countingRate = 0;
    const bodyText = $('body').text();
    const rateMatch = bodyText.match(/개표율\s*[:：]?\s*([0-9.]+)\s*%/);
    if (rateMatch) {
      countingRate = Number(rateMatch[1]);
    } else if (bodyText.includes('개표완료')) {
      countingRate = 100;
    }

    // ✨ 후보자 이름에서 정당명을 깔끔하게 날려버리는 함수
    const getCleanName = (el) => {
      // 1. <br> 태그를 공백으로 바꿔서 정당과 이름을 떨어뜨려 놓습니다.
      let rawHtml = $(el).html() || '';
      let textWithSpaces = rawHtml.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '');
      
      // 2. 띄어쓰기 기준으로 나눈 뒤 가장 마지막 단어(이름)만 가져옵니다.
      let name = textWithSpaces.replace(/\s+/g, ' ').trim().split(' ').pop();
      
      // 3. 만약의 경우를 대비해 주요 정당명이 붙어있다면 강제로 삭제합니다.
      return name.replace(/더불어민주당|국민의힘|정의당|진보당|조국혁신당|개혁신당|새로운미래|무소속/g, '');
    };

    let cand1Name = '후보 1';
    let cand2Name = '후보 2';
    
    const headerCells = $('#table01 thead tr').last().find('th');
    if (headerCells.length >= 2) {
      cand1Name = getCleanName(headerCells[0]);
      cand2Name = getCleanName(headerCells[1]);
    }

    const tableRows = $('#table01 tbody tr');
    
    tableRows.each((index, element) => {
      const columns = $(element).find('th, td');
      
      if (columns.length >= 7) {
        const townName = $(columns[0]).text().replace(/\s+/g, ' ').trim();
        const gubun = $(columns[1]).text().replace(/\s+/g, ''); 
        
        const isTargetRow = gubun === '소계' || gubun === '계';
        const isNotSummary = !townName.includes('합계') && !townName.includes('거소') && !townName.includes('관외') && !townName.includes('잘못');

        if (townName && isNotSummary && isTargetRow) {
          const electorCount = Number($(columns[2]).text().replace(/[^0-9]/g, '')) || 0;
          const totalVote = Number($(columns[3]).text().replace(/[^0-9]/g, '')) || 0;
          const cand1Vote = Number($(columns[4]).text().replace(/[^0-9]/g, '')) || 0;
          const cand2Vote = Number($(columns[5]).text().replace(/[^0-9]/g, '')) || 0;

          const turnout = electorCount > 0 ? ((totalVote / electorCount) * 100).toFixed(1) : 0;
          const cand1Rate = totalVote > 0 ? ((cand1Vote / totalVote) * 100).toFixed(1) : 0;
          const cand2Rate = totalVote > 0 ? ((cand2Vote / totalVote) * 100).toFixed(1) : 0;
          
          results.push({
            townName,
            turnout: Number(turnout),
            cand1Name: cand1Name, 
            cand1Rate: Number(cand1Rate),
            cand1Vote: cand1Vote, 
            cand2Name: cand2Name, 
            cand2Rate: Number(cand2Rate),
            cand2Vote: cand2Vote  
          });
        }
      }
    });

    res.json({ countingRate: countingRate, towns: results });

  } catch (error) {
    console.error('❌ 크롤링 에러 상세:', error.message);
    res.status(500).json({ error: '선관위 데이터를 불러오는데 실패했습니다.' });
  }
});

module.exports = router;