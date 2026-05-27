const DATA = window.QUIZ_DATA;
const STORAGE_KEY = "rel170-quiz-progress-v1";
let state = { selectedIds: [], pool: [], index: 0, answers: [], lastSettings: null };

const $ = (id) => document.getElementById(id);
function shuffle(arr) { const a=[...arr]; for (let i=a.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
function loadHistory(){ try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch { return []; } }
function saveHistory(items){ localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(-100))); }
function allQuestionsFor(ids){ return DATA.categories.filter(c=>ids.includes(c.id)).flatMap(c=>c.questions.map(q=>({...q, categoryId:c.id, categoryTitle:c.title}))); }
function pct(n,d){ return d ? Math.round((n/d)*100) : 0; }

function renderCategories(){
  const box = $("categoryList"); box.innerHTML = "";
  DATA.categories.forEach(cat => {
    const label = document.createElement("label"); label.className = "category";
    label.innerHTML = `<input type="checkbox" value="${cat.id}"><div><strong>${cat.title}</strong><span>${cat.questions.length} spørsmål</span></div>`;
    label.querySelector("input").addEventListener("change", updateSummary);
    box.appendChild(label);
  });
  document.querySelectorAll("#categoryList input").forEach(cb => cb.checked = true);
  updateSummary();
}

function selectedCategoryIds(){ return [...document.querySelectorAll("#categoryList input:checked")].map(x=>x.value); }
function updateSummary(){
  const ids = selectedCategoryIds();
  const total = allQuestionsFor(ids).length;
  $("selectionSummary").textContent = ids.length ? `${ids.length} pensumspørsmål valgt, ${total} mulige spørsmål.` : "Ingen pensumspørsmål valgt.";
}

function startQuiz(){
  const ids = selectedCategoryIds();
  if(!ids.length){ alert("Velg minst ett pensumspørsmål."); return; }
  let qs = allQuestionsFor(ids);
  const order = $("orderMode").value;
  if(order === "shuffle") qs = shuffle(qs);
  const countVal = $("questionCount").value;
  const count = countVal === "all" ? qs.length : Math.min(Number(countVal), qs.length);
  qs = qs.slice(0, count).map(q => ({...q, displayOptions: shuffle(q.options)}));
  state = { selectedIds: ids, pool: qs, index: 0, answers: [], lastSettings: {ids, countVal, order} };
  $("setup").classList.add("hidden"); $("results").classList.add("hidden"); $("quiz").classList.remove("hidden");
  showQuestion();
}

function showQuestion(){
  const q = state.pool[state.index];
  $("progressText").textContent = `Spørsmål ${state.index+1} av ${state.pool.length}`;
  $("progressFill").style.width = `${((state.index)/state.pool.length)*100}%`;
  $("topicText").textContent = q.subtopic ? `${q.categoryTitle} – ${q.subtopic}` : q.categoryTitle;
  $("questionText").textContent = q.question;
  $("feedback").classList.add("hidden"); $("feedback").textContent = "";
  $("nextQuestion").disabled = true;
  const list = $("answerList"); list.innerHTML = "";
  q.displayOptions.forEach((opt, idx) => {
    const btn = document.createElement("button"); btn.type="button"; btn.className="answer";
    const displayLetter = String.fromCharCode(65+idx);
    btn.innerHTML = `<span class="letter">${displayLetter}</span><span>${opt.text}</span>`;
    btn.addEventListener("click", () => chooseAnswer(btn, opt));
    list.appendChild(btn);
  });
}

function chooseAnswer(button, opt){
  const q = state.pool[state.index];
  const correct = opt.key === q.answer;
  [...document.querySelectorAll(".answer")].forEach(btn => btn.disabled = true);
  button.classList.add(correct ? "correct" : "wrong");
  [...document.querySelectorAll(".answer")].forEach((btn, idx) => {
    if(q.displayOptions[idx].key === q.answer) btn.classList.add("correct");
  });
  const correctText = q.options.find(o=>o.key===q.answer)?.text || "";
  $("feedback").classList.remove("hidden");
  $("feedback").textContent = correct ? "Riktig." : `Ikke helt. Riktig svar er: ${correctText}`;
  state.answers.push({ questionId:q.globalId, categoryId:q.categoryId, categoryTitle:q.categoryTitle, correct, selected: opt.key, answer:q.answer });
  $("nextQuestion").disabled = false;
}

function nextQuestion(){
  if(state.index < state.pool.length-1){ state.index++; showQuestion(); }
  else finishQuiz();
}

function finishQuiz(){
  $("progressFill").style.width = "100%";
  const correct = state.answers.filter(a=>a.correct).length;
  const total = state.answers.length;
  const percent = pct(correct,total);
  const history = loadHistory();
  const comparable = history.filter(h => JSON.stringify(h.selectedIds) === JSON.stringify(state.selectedIds) && h.total === total);
  const bestBefore = comparable.length ? Math.max(...comparable.map(h=>h.percent)) : null;
  const record = { date: new Date().toISOString(), selectedIds: state.selectedIds, total, correct, percent };
  history.push(record); saveHistory(history);
  $("quiz").classList.add("hidden"); $("results").classList.remove("hidden");
  $("scoreText").textContent = `${correct} av ${total} riktige (${percent} %).`;
  $("progressComparison").textContent = bestBefore === null ? "Dette er første registrerte forsøk med samme utvalg i denne nettleseren." : percent > bestBefore ? `Ny personlig forbedring: tidligere beste var ${bestBefore} %.` : `Tidligere beste med samme utvalg var ${bestBefore} %.`;
  renderBreakdown(); renderHistory();
}

function renderBreakdown(){
  const box=$("topicBreakdown"); box.innerHTML='<h3>Fordeling per pensumspørsmål</h3>';
  const by = new Map();
  state.answers.forEach(a => { if(!by.has(a.categoryTitle)) by.set(a.categoryTitle,{c:0,t:0}); const x=by.get(a.categoryTitle); x.t++; if(a.correct)x.c++; });
  [...by.entries()].forEach(([title,x]) => { const row=document.createElement('div'); row.className='breakdown-row'; row.innerHTML=`<span>${title}</span><strong>${x.c}/${x.t} (${pct(x.c,x.t)} %)</strong>`; box.appendChild(row); });
}

function renderHistory(){
  const history = loadHistory().slice(-10).reverse();
  const box=$("historyBox");
  if(!history.length){ box.innerHTML='<p class="muted">Ingen registrerte forsøk ennå.</p>'; return; }
  box.innerHTML = '<table><thead><tr><th>Dato</th><th>Utvalg</th><th>Resultat</th></tr></thead><tbody></tbody></table>';
  const tb=box.querySelector('tbody');
  history.forEach(h => { const d=new Date(h.date); const tr=document.createElement('tr'); tr.innerHTML=`<td>${d.toLocaleString('no-NO')}</td><td>${h.selectedIds.length} pensumspørsmål</td><td>${h.correct}/${h.total} (${h.percent} %)</td>`; tb.appendChild(tr); });
}

function backToSetup(){ $("quiz").classList.add("hidden"); $("results").classList.add("hidden"); $("setup").classList.remove("hidden"); renderHistory(); }
function retrySame(){
  document.querySelectorAll("#categoryList input").forEach(cb => cb.checked = state.lastSettings.ids.includes(cb.value));
  $("questionCount").value = state.lastSettings.countVal; $("orderMode").value = state.lastSettings.order; updateSummary(); startQuiz();
}

$("selectAll").addEventListener("click",()=>{ document.querySelectorAll("#categoryList input").forEach(cb=>cb.checked=true); updateSummary(); });
$("clearAll").addEventListener("click",()=>{ document.querySelectorAll("#categoryList input").forEach(cb=>cb.checked=false); updateSummary(); });
$("startQuiz").addEventListener("click", startQuiz);
$("nextQuestion").addEventListener("click", nextQuestion);
$("backToSetup").addEventListener("click", backToSetup);
$("resultsToSetup").addEventListener("click", backToSetup);
$("retrySame").addEventListener("click", retrySame);
$("questionCount").addEventListener("change", updateSummary);
$("clearHistory").addEventListener("click",()=>{ if(confirm("Slette lokal progresjon i denne nettleseren?")){ localStorage.removeItem(STORAGE_KEY); renderHistory(); } });

renderCategories(); renderHistory();
