
// SMB – Curs Instructor în Poligon — Quiz app (vanilla JS)
(function(){
  'use strict';

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init(){
    // Elements
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

      // module buttons
      mod1: document.getElementById('btn-mod-1'),
      mod2: document.getElementById('btn-mod-2'),
      mod3: document.getElementById('btn-mod-3'),
      mod4: document.getElementById('btn-mod-4'),
      mod5: document.getElementById('btn-mod-5'),
    };

    // Stats
    const stat = {
      total: document.getElementById('stat-total'),
      correct: document.getElementById('stat-correct'),
      wrong: document.getElementById('stat-wrong'),
      picked: document.getElementById('stat-picked'),
    };

    // State
    let questions = [];              // full dataset
    let order = [];                  // indices of current session
    let current = 0;
    let answers = {};                // map questionId -> choiceIndex
    let mode = 'exam';               // 'exam' | 'module'
    let timeExpired = false;

    // Timer
    let timerId = null;
    let timeLeft = 0; // in seconds

    // Helpers
    const show = el => el.classList.remove('hidden');
    const hide = el => el.classList.add('hidden');
    const shuffle = arr => arr.slice().sort(()=>Math.random()-0.5);

    function setStats({ total, correct, wrong, pickedCount }){
      if(total !== undefined) stat.total.textContent = total;
      if(correct !== undefined) stat.correct.textContent = correct;
      if(wrong !== undefined) stat.wrong.textContent = wrong;
      if(pickedCount !== undefined) stat.picked.textContent = pickedCount;
    }

    // Data
    async function loadQuestions(){
      const res = await fetch('questions_full.json');
      if(!res.ok) throw new Error('Nu s-au putut încărca întrebările.');
      return res.json();
    }

    function idsInRange(start, end){
      const indices = [];
      for(let i=0;i<questions.length;i++){
        const id = questions[i].id;
        if(id >= start && id <= end) indices.push(i);
      }
      return indices;
    }

    function prepareExamSet(){
      // Distribuție exactă: 10 (1–90) + 2 (91–108) + 3 (109–134) + 1 (135–141) + 2 (142–157)
      const pick = (start,end,count)=> shuffle(idsInRange(start,end)).slice(0,count);
      order = shuffle([
        ...pick(1,90,10),
        ...pick(91,108,2),
        ...pick(109,134,3),
        ...pick(135,141,1),
        ...pick(142,157,2),
      ]);
      // Dacă dataset-ul nu are suficiente întrebări într-un interval, vom folosi câte există.
      setStats({ pickedCount: order.length });
    }

    function startExam(){
      mode = 'exam';
      answers = {};
      timeExpired = false;
      if(!order.length) prepareExamSet(); // pregătim implicit
      current = 0;
      setStats({correct:0, wrong:0});

      hide(els.start);
      hide(els.result);
      show(els.quiz);

      render();
      startTimer(45*60);
    }

    function startModule(startId, endId){
      mode = 'module';
      answers = {};
      timeExpired = false;
      order = idsInRange(startId, endId);
      if(!order.length){
        alert('Nu există întrebări în intervalul selectat.');
        return;
      }
      order = shuffle(order);
      current = 0;
      setStats({pickedCount: order.length, correct:0, wrong:0});

      hide(els.start);
      hide(els.result);
      show(els.quiz);

      // În antrenament nu folosim timerul.
      stopTimer();
      if(els.timer){
        els.timer.textContent = 'Antrenament';
        els.timer.classList.remove('warning');
      }

      render();
    }

    // Timer
    function startTimer(seconds){
      stopTimer();
      timeLeft = seconds;
      updateTimerDisplay();
      timerId = setInterval(()=>{
        timeLeft--;
        updateTimerDisplay();
        if(timeLeft <= 0){
          stopTimer();
          timeExpired = true;
          finish();
        }
      }, 1000);
    }
    function stopTimer(){ if(timerId){ clearInterval(timerId); timerId = null; } }
    function updateTimerDisplay(){
      if(!els.timer) return;
      const m = Math.floor(Math.max(0,timeLeft)/60);
      const s = Math.max(0,timeLeft) % 60;
      els.timer.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
      if(timeLeft <= 60) els.timer.classList.add('warning'); else els.timer.classList.remove('warning');
    }

    // Render Q
    function render(){
      const q = questions[order[current]];
      if(!q) return;

      els.progress.textContent = `Întrebarea ${current+1}/${order.length}`;

      const liveCorrect = Object.keys(answers).reduce((acc, k)=>{
        const qq = questions.find(x=>x.id == k);
        return acc + (qq && answers[k]===qq.correctIndex ? 1 : 0);
      }, 0);
      if(els.scoreMini) els.scoreMini.textContent = `Corecte: ${liveCorrect}`;

      els.qtext.textContent = q.text;
      els.choices.innerHTML = '';

      q.choices.forEach((label, idx)=>{
        const row = document.createElement('label');
        row.className = 'choice';
        row.setAttribute('role','option');

        const input = document.createElement('input');
        input.type = 'radio';
        input.name = `q_${q.id}`;
        input.value = idx;

        const span = document.createElement('span');
        span.textContent = label;

        input.addEventListener('change', ()=>{
          answers[q.id] = idx;
          const correct = (idx === q.correctIndex);

          row.classList.add(correct ? 'correct' : 'wrong');

          if(!correct){
            const corr = els.choices.querySelector(`input[value="${q.correctIndex}"]`);
            if(corr) corr.parentElement.classList.add('correct');
          }

          els.choices.querySelectorAll(`input[name="q_${q.id}"]`).forEach(el=> el.disabled = true);

          let c=0,w=0;
          Object.keys(answers).forEach(k=>{
            const qq = questions.find(x=>x.id == k);
            if(answers[k] === qq?.correctIndex) c++; else w++;
          });
          setStats({correct:c, wrong:w});

          // Activate Next only after answer
          els.nextBtn.disabled = (current >= order.length - 1);
          // Finalize only when ALL answered
          els.finishBtn.disabled = (Object.keys(answers).length !== order.length);
        });

        row.appendChild(input);
        row.appendChild(span);
        els.choices.appendChild(row);
      });

      // Reset controls
      els.prevBtn.disabled = (current === 0);
      els.nextBtn.disabled = true;
      els.finishBtn.disabled = (Object.keys(answers).length !== order.length);

      // Progress bar
      const bar = document.getElementById('bar');
      if(bar){
        const pct = Math.round(((current) / Math.max(1, order.length)) * 100);
        bar.style.width = pct + '%';
      }
    }

    function next(){
      if(current < order.length - 1){
        current++;
        render();
      }
    }
    function prev(){
      if(current > 0){
        current--;
        render();
      }
    }

    function finish(){
      stopTimer();

      const used = order.map(i=>questions[i]);
      let correct = 0;
      used.forEach(q => { if(answers[q.id] === q.correctIndex) correct++; });

      const total = used.length;
      const pct = Math.round((correct/Math.max(1,total))*100);

      // Exam rule: PASS if >=12/18; Module has no pass/fail rule, only score.
      let passText = '';
      if(mode === 'exam'){
        const pass = (total === 18 && correct >= 12);
        passText = `${pass ? '✅ PASS' : '❌ FAIL'} (Regulă: minim 12/18)`;
      }

      let extra = '';
      if(timeExpired && mode === 'exam') extra = ' (Timp expirat)';

      els.scoreline.textContent = `Scor: ${pct}% — ${correct} din ${total}. ${passText}${extra}`.trim();

      setStats({correct, wrong: total - correct});

      // Review list
      els.reviewList.innerHTML = '';
      used.forEach((q,i)=>{
        const your = answers[q.id];
        const ok = your === q.correctIndex;
        const item = document.createElement('div');
        item.className = 'review-item';
        item.innerHTML = `
          <div class="q"><strong>${i+1}.</strong> ${q.text}</div>
          <div>
            <span class="badge ${ok?'ok':'no'}">${ok?'Corect':'Greșit'}</span>
            <span style="margin-left:8px">Răspunsul tău: ${q.choices[your] ?? '-'}</span>
            <span style="margin-left:8px">Răspuns corect: ${q.choices[q.correctIndex]}</span>
          </div>`;
        els.reviewList.appendChild(item);
      });

      hide(els.quiz);
      show(els.result);

      // CSV cache
      window.__lastCsv = [
        ['#','Întrebare','Răspunsul tău','Răspuns corect','Corect?'],
        ...used.map((q,i)=>[
          i+1,
          q.text,
          q.choices[answers[q.id]] ?? '',
          q.choices[q.correctIndex],
          (answers[q.id]===q.correctIndex ? 'Da' : 'Nu')
        ])
      ];
    }

    function exportCSV(){
      const rows = window.__lastCsv || [];
      if(!rows.length){ alert('Nu există rezultate de exportat.'); return; }
      const csv = rows.map(r=>r.map(field => `"${String(field).replace(/"/g,'""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'rezultate_quiz.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    function exportPDF(){ window.print(); }

    function resetToStart(){
      stopTimer();
      hide(els.quiz);
      hide(els.result);
      show(els.start);
      setStats({correct:0, wrong:0});
      answers = {};
      current = 0;
      timeExpired = false;
      // Reset timer label
      if(els.timer){
        els.timer.textContent = '45:00';
        els.timer.classList.remove('warning');
      }
      // Reset progress bar
      const bar = document.getElementById('bar');
      if(bar) bar.style.width = '0%';
      // Prepare default exam selection again
      prepareExamSet();
      mode = 'exam';
    }

    // Event bindings
    els.startExam?.addEventListener('click', startExam);
    els.nextBtn?.addEventListener('click', next);
    els.prevBtn?.addEventListener('click', prev);
    els.finishBtn?.addEventListener('click', finish);
    els.retryBtn?.addEventListener('click', resetToStart);

    document.getElementById('export-csv')?.addEventListener('click', exportCSV);
    document.getElementById('export-pdf')?.addEventListener('click', exportPDF);

    // Module buttons -> start directly (no timer)
    els.mod1?.addEventListener('click', ()=> startModule(1, 90));
    els.mod2?.addEventListener('click', ()=> startModule(91, 108));
    els.mod3?.addEventListener('click', ()=> startModule(109, 134));
    els.mod4?.addEventListener('click', ()=> startModule(135, 141));
    els.mod5?.addEventListener('click', ()=> startModule(142, 157));

    // Bootstrap
    (async () => {
      try{
        questions = await loadQuestions();
        setStats({ total: questions.length, correct:0, wrong:0, pickedCount:0 });
        // pregătește setul implicit pentru 18 întrebări (nu pornește cronometrul)
        prepareExamSet();
      }catch(err){
        console.error(err);
        alert('Eroare la încărcarea întrebărilor. Verifică găzduirea fișierului questions_full.json.');
      }
    })();
  }
})();
