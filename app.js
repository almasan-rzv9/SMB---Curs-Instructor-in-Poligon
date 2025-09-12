// SMB – Curs Instructor în Poligon — suportă N opțiuni, include toate întrebările în module
(function(){
  'use strict';
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }

  function init(){
    const els = {
      start: document.getElementById('start-screen'),
      quiz: document.getElementById('quiz-screen'),
      result: document.getElementById('result-screen'),
      startExam: document.getElementById('start-exam'),
      nextBtn: document.getElementById('next-btn'),
      prevBtn: document.getElementById('prev-btn'),
      finishBtn: document.getElementById('finish-btn'),
      retryBtn: document.getElementById('retry-btn'),
      qtext: document.getElementById('question-text'),
      choices: document.getElementById('choices'),
      progress: document.getElementById('progress'),
      timer: document.getElementById('timer'),
      scoreMini: document.getElementById('score-mini'),
      scoreline: document.getElementById('scoreline'),
      reviewList: document.getElementById('review-list'),
      mod1: document.getElementById('btn-mod-1'),
      mod2: document.getElementById('btn-mod-2'),
      mod3: document.getElementById('btn-mod-3'),
      mod4: document.getElementById('btn-mod-4'),
      mod5: document.getElementById('btn-mod-5'),
    };
    const stat = {
      total: document.getElementById('stat-total'),
      correct: document.getElementById('stat-correct'),
      wrong: document.getElementById('stat-wrong'),
      picked: document.getElementById('stat-picked'),
    };

    let questions = [], order = [], current = 0, answers = {};
    let mode = 'exam', timeExpired = false, timerId = null, timeLeft = 0;

    const show = el => el.classList.remove('hidden');
    const hide = el => el.classList.add('hidden');
    const shuffle = arr => arr.slice().sort(()=>Math.random()-0.5);

    function setStats({ total, correct, wrong, pickedCount }){
      if(total !== undefined) stat.total.textContent = total;
      if(correct !== undefined) stat.correct.textContent = correct;
      if(wrong !== undefined) stat.wrong.textContent = wrong;
      if(pickedCount !== undefined) stat.picked.textContent = pickedCount;
    }

    async function loadQuestions(){
      let file = [];
      try{ const res = await fetch('questions_full.json', { cache: 'no-store' }); if(res.ok) file = await res.json(); }catch{}
      let embed = [];
      try{ const tag = document.getElementById('qdata'); if(tag && tag.textContent.trim()) embed = JSON.parse(tag.textContent); }catch{}
      const chosen = (embed.length > file.length) ? embed : file;
      if(!(Array.isArray(chosen) && chosen.length)){ throw new Error('Nu s-au putut încărca întrebările.'); }

      const norm = [];
      let fixed = 0, dropped = 0;
      for(const q of chosen){
        const id = Number(q.id);
        const text = String(q.text || '');
        let choices = Array.isArray(q.choices) ? q.choices.map(x=>String(x)) : [];
        let correctIndex = Number(q.correctIndex);
        if(!id || !text || choices.length < 2){ dropped++; continue; }
        if(!(correctIndex >= 0 && correctIndex < choices.length)){ correctIndex = 0; fixed++; }
        norm.push({ id, text, choices, correctIndex });
      }
      console.log(`[SMB] Întrebări încărcate: ${norm.length} (corectate index: ${fixed}, eliminate: ${dropped})`);
      return norm;
    }

    function idsInRange(start, end){
      const list = [];
      for(let i=0;i<questions.length;i++){
        const id = questions[i].id;
        if(id >= start && id <= end) list.push(i);
      }
      return list.sort((a,b)=> questions[a].id - questions[b].id);
    }

    function pickFromRange(start,end,count,excludeSet){
      const pool = idsInRange(start,end).filter(i=> !excludeSet.has(i));
      const take = shuffle(pool).slice(0, Math.min(count, pool.length));
      take.forEach(i=> excludeSet.add(i));
      return take;
    }

    function fillTo18(picked, excludeSet){
      if(picked.length >= 18) return picked;
      const all = questions.map((_,i)=>i).filter(i=> !excludeSet.has(i));
      const extra = shuffle(all).slice(0, Math.max(0, 18 - picked.length));
      return picked.concat(extra);
    }

    function prepareExamSet(){
      const used = new Set();
      let picked = [];
      picked = picked.concat(pickFromRange(1,90,10,used));
      picked = picked.concat(pickFromRange(91,108,2,used));
      picked = picked.concat(pickFromRange(109,134,3,used));
      picked = picked.concat(pickFromRange(135,141,1,used));
      picked = picked.concat(pickFromRange(142,157,2,used));
      picked = fillTo18(picked, used);
      order = shuffle(picked);
      setStats({ pickedCount: order.length });
    }

    function startExam(){
      mode = 'exam'; answers = {}; timeExpired = false;
      if(!order.length) prepareExamSet();
      current = 0; setStats({correct:0, wrong:0});
      hide(els.start); hide(els.result); show(els.quiz);
      render(); startTimer(45*60);
    }

    function startModule(startId, endId){
      mode = 'module'; answers = {}; timeExpired = false;
      order = idsInRange(startId, endId);
      current = 0; setStats({pickedCount: order.length, correct:0, wrong:0});
      hide(els.start); hide(els.result); show(els.quiz);
      stopTimer(); if(els.timer){ els.timer.textContent = 'Antrenament'; els.timer.classList.remove('warning'); }
      render();
    }

    function startTimer(seconds){
      stopTimer(); timeLeft = seconds; updateTimerDisplay();
      timerId = setInterval(()=>{ timeLeft--; updateTimerDisplay(); if(timeLeft <= 0){ stopTimer(); timeExpired = true; finish(); } }, 1000);
    }
    function stopTimer(){ if(timerId){ clearInterval(timerId); timerId = null; } }
    function updateTimerDisplay(){
      if(!els.timer) return;
      const m = Math.floor(Math.max(0,timeLeft)/60);
      const s = Math.max(0,timeLeft) % 60;
      els.timer.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
      if(timeLeft <= 60) els.timer.classList.add('warning'); else els.timer.classList.remove('warning');
    }

    function render(){
      const q = questions[order[current]]; if(!q) return;
      els.progress.textContent = `Întrebarea ${current+1}/${order.length}`;
      const liveCorrect = Object.keys(answers).reduce((acc, k)=>{ const qq = questions.find(x=>x.id == k); return acc + (qq && answers[k]===qq.correctIndex ? 1 : 0); }, 0);
      if(els.scoreMini) els.scoreMini.textContent = `Corecte: ${liveCorrect}`;
      els.qtext.textContent = q.text; els.choices.innerHTML = '';
      q.choices.forEach((label, idx)=>{
        const row = document.createElement('label'); row.className = 'choice'; row.setAttribute('role','option');
        const input = document.createElement('input'); input.type = 'radio'; input.name = `q_${q.id}`; input.value = idx;
        const span = document.createElement('span'); span.textContent = label;
        input.addEventListener('change', ()=>{
          answers[q.id] = idx;
          const correct = (idx === q.correctIndex);
          row.classList.add(correct ? 'correct' : 'wrong');
          if(!correct){ const corr = els.choices.querySelector(`input[value="${q.correctIndex}"]`); if(corr) corr.parentElement.classList.add('correct'); }
          els.choices.querySelectorAll(`input[name="q_${q.id}"]`).forEach(el=> el.disabled = true);
          let c=0,w=0; Object.keys(answers).forEach(k=>{ const qq = questions.find(x=>x.id == k); if(answers[k] === qq?.correctIndex) c++; else w++; });
          setStats({correct:c, wrong:w});
          els.nextBtn.disabled = (current >= order.length - 1);
          els.finishBtn.disabled = (Object.keys(answers).length !== order.length);
        });
        row.appendChild(input); row.appendChild(span); els.choices.appendChild(row);
      });
      els.prevBtn.disabled = (current === 0);
      els.nextBtn.disabled = true;
      els.finishBtn.disabled = (Object.keys(answers).length !== order.length);
      const bar = document.getElementById('bar'); if(bar){ const pct = Math.round(((current) / Math.max(1, order.length)) * 100); bar.style.width = pct + '%'; }
    }

    function next(){ if(current < order.length - 1){ current++; render(); } }
    function prev(){ if(current > 0){ current--; render(); } }

    function finish(){
      stopTimer();
      const used = order.map(i=>questions[i]);
      let correct = 0; used.forEach(q => { if(answers[q.id] === q.correctIndex) correct++; });
      const total = used.length; const pct = Math.round((correct/Math.max(1,total))*100);
      let passText = ''; if(mode === 'exam'){ const pass = (total >= 18 ? (correct >= 12) : false); passText = (total >= 18) ? `${pass ? '✅ PASS' : '❌ FAIL'} (Regulă: minim 12/18)` : '(Set incomplet pentru regulă 12/18)'; }
      let extra = ''; if(timeExpired && mode === 'exam') extra = ' (Timp expirat)';
      els.scoreline.textContent = `Scor: ${pct}% — ${correct} din ${total}. ${passText}${extra}`.trim();
      setStats({correct, wrong: total - correct});
      els.reviewList.innerHTML = '';
      used.forEach((q,i)=>{
        const your = answers[q.id]; const ok = your === q.correctIndex;
        const item = document.createElement('div'); item.className = 'review-item';
        item.innerHTML = `
          <div class="q"><strong>${i+1}.</strong> ${q.text}</div>
          <div>
            <span class="badge ${ok?'ok':'no'}">${ok?'Corect':'Greșit'}</span>
            <span style="margin-left:8px">Răspunsul tău: ${q.choices[your] ?? '-'}</span>
            <span style="margin-left:8px">Răspuns corect: ${q.choices[q.correctIndex]}</span>
          </div>`;
        els.reviewList.appendChild(item);
      });
      hide(els.quiz); show(els.result);
      window.__lastCsv = [['#','Întrebare','Răspunsul tău','Răspuns corect','Corect?'], ...used.map((q,i)=>[i+1,q.text,q.choices[answers[q.id]] ?? '',q.choices[q.correctIndex],(answers[q.id]===q.correctIndex ? 'Da' : 'Nu')])];
    }

    function exportCSV(){
      const rows = window.__lastCsv || []; if(!rows.length){ alert('Nu există rezultate de exportat.'); return; }
      const csv = rows.map(r=>r.map(field => `"${String(field).replace(/"/g,'""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'}); const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'rezultate_quiz.csv'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    }
    function exportPDF(){ window.print(); }

    function resetToStart(){
      stopTimer(); hide(els.quiz); hide(els.result); show(els.start); setStats({correct:0, wrong:0});
      answers = {}; current = 0; timeExpired = false; if(els.timer){ els.timer.textContent = '45:00'; els.timer.classList.remove('warning'); }
      const bar = document.getElementById('bar'); if(bar) bar.style.width = '0%'; prepareExamSet(); mode = 'exam';
    }

    els.startExam?.addEventListener('click', startExam);
    els.nextBtn?.addEventListener('click', next);
    els.prevBtn?.addEventListener('click', prev);
    els.finishBtn?.addEventListener('click', finish);
    els.retryBtn?.addEventListener('click', resetToStart);
    document.getElementById('export-csv')?.addEventListener('click', exportCSV);
    document.getElementById('export-pdf')?.addEventListener('click', exportPDF);
    els.mod1?.addEventListener('click', ()=> startModule(1, 90));
    els.mod2?.addEventListener('click', ()=> startModule(91, 108));
    els.mod3?.addEventListener('click', ()=> startModule(109, 134));
    els.mod4?.addEventListener('click', ()=> startModule(135, 141));
    els.mod5?.addEventListener('click', ()=> startModule(142, 157));

    (async () => {
      try{
        questions = await loadQuestions();
        setStats({ total: questions.length, correct:0, wrong:0, pickedCount:0 });
        const cnt=(a,b)=>questions.filter(x=>x.id>=a && x.id<=b).length;
        console.log('[SMB] Distribuție:', { '1–90':cnt(1,90), '91–108':cnt(91,108), '109–134':cnt(109,134), '135–141':cnt(135,141), '142–157':cnt(142,157) });
        prepareExamSet();
      }catch(err){
        console.error(err);
        alert('Eroare la încărcarea întrebărilor. Asigură-te că questions_full.json sau qdata există și au format valid.');
      }
    })();
  }
})();