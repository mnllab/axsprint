const STORAGE_KEY = 'ax-sprint-control-tower-v6';
const LEGACY_STORAGE_KEYS = ['ax-sprint-control-tower-v5','ax-sprint-control-tower-v4'];
const STATUS_OPTIONS = ['예정','진행 중','협업기관 회신 대기','PM 검토 대기','PM 결정 필요','지연','완료 요청','완료 승인','보류'];
const KPI_STATUS_OPTIONS = ['미측정','준비 중','진행 중','주의','위험','달성','미달'];
const REQUEST_STATUS = ['요청','수신 확인','처리 중','답변 완료','요청자 확인 대기','종결','기한 초과','PM 조정 필요'];
const NAV = [
  ['workboard','▣','기관 업무현황'],['dashboard','▦','PM 대시보드'],['kpis','◎','성과목표'],['institutions','◫','기관 관리'],['actions','✓','실행과제'],
  ['requests','⇄','요청·회신'],['memos','▧','소통 메모'],['timeline','▤','전체 일정'],['records','≡','회의·문서'],['settings','⚙','관리설정']
];
let state = loadState();
let currentView = 'workboard';
let viewFilter = {};

function clone(v){return JSON.parse(JSON.stringify(v));}
function loadState(){
  try {
    const current=localStorage.getItem(STORAGE_KEY);
    let data;
    if(current){
      data=JSON.parse(current);
    }else{
      const legacyRaw=LEGACY_STORAGE_KEYS.map(k=>localStorage.getItem(k)).find(Boolean);
      data=legacyRaw ? JSON.parse(legacyRaw) : clone(window.INITIAL_DATA);
      if(legacyRaw){
        const criteriaById=Object.fromEntries((window.INITIAL_DATA.actions||[]).map(a=>[a.id,a.completionCriteria]));
        (data.actions||[]).forEach(a=>{ if(criteriaById[a.id]) a.completionCriteria=criteriaById[a.id]; });
        data.project=data.project||{};
        data.project.version=window.INITIAL_DATA.project.version;
        data.project.completionCriteriaBasis=window.INITIAL_DATA.project.completionCriteriaBasis;
        localStorage.setItem(STORAGE_KEY,JSON.stringify(data));
      }
    }
    data.requests=data.requests||[]; data.memos=data.memos||[];
    data.requests.forEach(r=>{r.response=r.response||'';r.responseDate=r.responseDate||'';r.requestedAt=r.requestedAt||'';r.confirmation=r.confirmation||'';});
    return data;
  } catch(e){ const data=clone(window.INITIAL_DATA); data.memos=data.memos||[]; return data; }
}
function saveState(){localStorage.setItem(STORAGE_KEY, JSON.stringify(state));}
function esc(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function fmtDate(s){if(!s)return '-';const d=new Date(s+'T00:00:00');return `${d.getMonth()+1}/${d.getDate()}`;}
function daysDiff(a,b){return Math.floor((new Date(b+'T00:00:00')-new Date(a+'T00:00:00'))/86400000);}
function today(){return state.project.asOf || new Date().toISOString().slice(0,10);}
function statusTone(s){if(['완료 승인','달성','종결','답변 완료'].includes(s))return 'good';if(['지연','위험','미달','기한 초과','PM 결정 필요','PM 조정 필요'].includes(s))return 'bad';if(['진행 중','주의','완료 요청','PM 검토 대기','협업기관 회신 대기','처리 중'].includes(s))return 'warn';return 'blue';}
function statusTag(s){return `<span class="tag ${statusTone(s)}"><span class="status-dot ${statusTone(s)}"></span>${esc(s)}</span>`;}
function institutionTags(arr){return (arr||[]).map(x=>`<span class="tag">${esc(x)}</span>`).join('') || '<span class="muted">-</span>';}
function ownerDisplay(x){return x || '<책임기관 미확정>';}
function pct(v){return (v===null||v===''||Number.isNaN(Number(v))) ? null : Math.max(0,Math.min(100,Number(v)));}
function toast(msg){const el=document.getElementById('toast');el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),1800);}

function renderNav(){
  const html=NAV.map(([id,icon,label])=>`<button class="nav-item ${id===currentView?'active':''}" data-view="${id}"><span class="nav-icon">${icon}</span><span class="nav-label">${label}</span></button>`).join('');
  const nav=document.getElementById('nav');
  nav.innerHTML=html;
  const mobile=document.getElementById('mobileNav');
  if(mobile) mobile.innerHTML=html;
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{currentView=b.dataset.view;viewFilter={};render();window.scrollTo({top:0,behavior:'smooth'});});
}
function render(){
  renderNav(); document.getElementById('asOf').textContent=`기준일 ${state.project.asOf}`;
  const titles={workboard:'기관 업무현황',dashboard:'PM 통합 대시보드',kpis:'성과목표',institutions:'기관 관리',actions:'실행과제',requests:'요청·회신 관리',memos:'소통 메모',timeline:'전체 일정',records:'회의·문서',settings:'관리설정'};
  document.getElementById('pageTitle').textContent=titles[currentView];
  const quick=document.getElementById('quickAddBtn'), pmBtn=document.getElementById('pmUpdateBtn');
  if(currentView==='workboard'){quick.style.display='none';pmBtn.style.display='none';}else{quick.style.display='';pmBtn.style.display='';}
  const content=document.getElementById('content');
  if(currentView==='workboard') content.innerHTML=workboardHTML();
  if(currentView==='dashboard') content.innerHTML=dashboardHTML();
  if(currentView==='kpis') content.innerHTML=kpisHTML();
  if(currentView==='institutions') content.innerHTML=institutionsHTML();
  if(currentView==='actions') content.innerHTML=actionsHTML();
  if(currentView==='requests') content.innerHTML=requestsHTML();
  if(currentView==='memos') content.innerHTML=memosHTML();
  if(currentView==='timeline') content.innerHTML=timelineHTML();
  if(currentView==='records') content.innerHTML=recordsHTML();
  if(currentView==='settings') content.innerHTML=settingsHTML();
  bindViewEvents();
}

function actionMetrics(){
  const all=state.actions, done=all.filter(x=>x.status==='완료 승인').length;
  const overdue=all.filter(x=>x.status!=='완료 승인' && x.end && x.end<today()).length;
  const pm=all.filter(x=>['PM 결정 필요','PM 검토 대기','완료 요청'].includes(x.status)||x.pmCheck).length;
  const waiting=all.filter(x=>x.status==='협업기관 회신 대기').length;
  return {all:all.length,done,overdue,pm,waiting,rate:all.length?Math.round(done/all.length*100):0};
}
function kpiMetrics(){
  const vals=state.kpis.map(k=>pct(k.progress)).filter(v=>v!==null);
  return {entered:vals.length, total:state.kpis.length, avg:vals.length?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length):null,
    risk:state.kpis.filter(k=>['주의','위험','미달'].includes(k.status)).length};
}
function categoryStats(){
  const map={}; state.kpis.forEach(k=>{map[k.category]??=[];map[k.category].push(k);});
  return Object.entries(map).map(([name,items])=>{const vals=items.map(x=>pct(x.progress)).filter(v=>v!==null);return {name,items:items.length,avg:vals.length?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length):null,entered:vals.length};});
}
function institutionStats(name){
  const responsibility=state.actions.filter(a=>a.owner===name).length;
  const collab=state.actions.filter(a=>(a.collaborators||[]).includes(name)).length;
  const late=state.actions.filter(a=>a.owner===name && a.status!=='완료 승인' && a.end && a.end<today()).length;
  const req=state.requests.filter(r=>r.to===name && !['종결'].includes(r.status)).length;
  return {responsibility,collab,late,req};
}
function urgentActions(){
  return state.actions.filter(a=>a.status!=='완료 승인' && a.end).map(a=>({...a,diff:daysDiff(today(),a.end)})).filter(a=>a.diff<=14).sort((a,b)=>a.diff-b.diff).slice(0,9);
}

function actionTouchesInstitution(a,name){
  return a.owner===name || (a.collaborators||[]).includes(name) || (a.planInstitutions||[]).includes(name);
}
function actionRoleForInstitution(a,name){
  if(a.owner===name) return '책임';
  if((a.collaborators||[]).includes(name)) return '협업';
  if(!a.owner && (a.planInstitutions||[]).includes(name)) return '공동업무';
  if((a.planInstitutions||[]).includes(name)) return '참여';
  return '';
}
function workboardData(name){
  const relevant=state.actions.filter(a=>actionTouchesInstitution(a,name));
  const open=relevant.filter(a=>a.status!=='완료 승인');
  const enriched=open.map(a=>({...a,diff:a.end?daysDiff(today(),a.end):999,startDiff:a.start?daysDiff(today(),a.start):999,role:actionRoleForInstitution(a,name)}));
  const overdue=enriched.filter(a=>a.end && a.diff<0).sort((a,b)=>a.diff-b.diff);
  const dueSoon=enriched.filter(a=>a.end && a.diff>=0 && a.diff<=7).sort((a,b)=>a.diff-b.diff);
  const active=enriched.filter(a=>a.start && a.end && a.start<=today() && a.end>=today() && a.diff>7).sort((a,b)=>a.end.localeCompare(b.end));
  const upcoming=enriched.filter(a=>a.start && a.start>today()).sort((a,b)=>a.start.localeCompare(b.start));
  const requests=state.requests.filter(r=>r.to===name && r.status!=='종결').sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999'));
  const done=relevant.filter(a=>a.status==='완료 승인').sort((a,b)=>(b.end||'').localeCompare(a.end||''));
  return {relevant,open,overdue,dueSoon,active,upcoming,requests,done};
}
function ddayLabel(a){
  if(!a.end) return '<span class="work-dday neutral">기한 미정</span>';
  const d=daysDiff(today(),a.end);
  if(d<0) return `<span class="work-dday bad">D+${Math.abs(d)}</span>`;
  if(d===0) return '<span class="work-dday warn">TODAY</span>';
  if(d<=7) return `<span class="work-dday warn">D-${d}</span>`;
  return `<span class="work-dday">D-${d}</span>`;
}
function workActionCard(a,name){
  const role=actionRoleForInstitution(a,name);
  const criterion=(a.completionCriteria||'').trim();
  const blocker=(a.blocker||'').trim();
  return `<div class="work-card ${a.end&&a.end<today()?'is-overdue':''}" data-action="${a.id}">
    <div class="work-card-top"><div><span class="tag ${role==='책임'?'blue':role==='공동업무'?'warn':''}">${esc(role||'관련업무')}</span>${statusTag(a.status)}</div>${ddayLabel(a)}</div>
    <h3>${esc(a.name)}</h3>
    <div class="work-deadline"><strong>${a.end?fmtDate(a.end):'미정'}</strong>까지${a.start?` · ${fmtDate(a.start)} 시작`:''}</div>
    ${criterion?`<div class="work-criterion"><span>완료기준</span>${esc(criterion)}</div>`:`<div class="work-criterion muted"><span>완료기준</span>아직 입력되지 않음</div>`}
    ${blocker?`<div class="work-blocker">막힘 · ${esc(blocker)}</div>`:''}
  </div>`;
}
function workList(items,name,emptyText){
  if(!items.length) return `<div class="empty compact">${emptyText}</div>`;
  return `<div class="work-card-grid">${items.map(a=>workActionCard(a,name)).join('')}</div>`;
}
function requestMiniList(items){
  if(!items.length) return '<div class="empty compact">현재 회신할 요청사항이 없습니다.</div>';
  return `<div class="request-feedback-list">${items.map(r=>{const replied=(r.response||'').trim();return `<div class="request-feedback-card" data-request="${r.id}">
    <div class="request-feedback-head"><div><span class="request-label">${esc(r.from||'요청기관')} 요청</span><strong>${esc(r.title)}</strong></div><div class="request-feedback-meta"><span>${r.due?'회신 '+fmtDate(r.due)+'까지':'회신기한 미정'}</span>${statusTag(r.status)}</div></div>
    <div class="request-body"><span>요청사항</span><p>${esc(r.content||'요청내용 미입력')}</p></div>
    <div class="feedback-body ${replied?'answered':''}"><span>기관 회신</span><p>${replied?esc(r.response):'회신이 등록되지 않았습니다.'}</p>${r.responseDate?`<small>${fmtDate(r.responseDate)} 회신</small>`:''}</div>
    <div class="request-feedback-foot"><span>${r.relatedAction?`관련과제 ${esc(r.relatedAction)}`:'관련과제 미연결'}</span><button class="mini-btn" type="button">${replied?'회신 확인·수정':'회신 작성'}</button></div>
  </div>`}).join('')}</div>`;
}
function institutionMemoThreads(name){
  return (state.memos||[]).filter(m=>m.institution===name).sort((a,b)=>memoLastDate(b).localeCompare(memoLastDate(a)));
}
function memoLastDate(m){const msgs=m.messages||[];return msgs.length?(msgs[msgs.length-1].date||''):'';}
function memoPreviewList(items,name){
  if(!items.length) return '<div class="empty compact">등록된 소통 메모가 없습니다.</div>';
  return `<div class="memo-preview-list">${items.slice(0,8).map(m=>{const msgs=m.messages||[], last=msgs[msgs.length-1]||{};return `<div class="memo-preview" data-memo="${m.id}"><div class="memo-preview-top"><strong>${esc(m.title)}</strong><span>${esc(m.status||'진행')}</span></div><p>${esc(last.text||'메모 내용 없음')}</p><div class="memo-preview-foot"><span>${last.authorInstitution?esc(last.authorInstitution):'-'} · ${last.date?fmtDate(last.date):'-'}</span><span>${msgs.length}건</span></div></div>`}).join('')}</div>`;
}
function workboardHTML(){
  const selected=viewFilter.workInstitution || state.project.leadInstitution || state.institutions[0].name;
  const inst=state.institutions.find(i=>i.name===selected)||state.institutions[0];
  const w=workboardData(inst.name);
  const now=[...w.overdue,...w.dueSoon,...w.active].filter((a,i,arr)=>arr.findIndex(x=>x.id===a.id)===i);
  const next30=w.upcoming.filter(a=>a.startDiff<=30).slice(0,12);
  const responsibilityOpen=w.open.filter(a=>a.owner===inst.name).length;
  const relatedUnowned=w.open.filter(a=>!a.owner && (a.planInstitutions||[]).includes(inst.name)).length;
  return `<div class="workboard-shell">
    <div class="institution-tabs" role="tablist" aria-label="기관 업무 선택">
      ${state.institutions.map(i=>`<button type="button" class="institution-tab ${i.name===inst.name?'active':''}" data-work-inst="${esc(i.name)}" role="tab" aria-selected="${i.name===inst.name?'true':'false'}"><span>${esc(i.name)}</span><small>${esc(i.role)}</small></button>`).join('')}
    </div>
    <div class="workboard-hero">
      <div>
        <div class="eyebrow">기관별 실행현황</div>
        <h2>${esc(inst.name)}</h2>
        <p>현재 수행업무, 마감일, 완료기준, 요청사항 및 회신내용을 확인합니다.</p>
      </div>
      <div class="workboard-asof"><span>기준일</span><strong>${fmtDate(today())}</strong></div>
    </div>
    <div class="work-summary-grid">
      ${metric('지연',w.overdue.length+'건','기한이 지난 업무',w.overdue.length?'bad':'good')}
      ${metric('7일 이내 마감',w.dueSoon.length+'건','이번 주 우선 확인')}
      ${metric('현재 진행',responsibilityOpen+'건','책임기관으로 수행 중')}
      ${metric('회신 필요',w.requests.length+'건','이 기관이 답해야 하는 요청')}
      ${metric('역할 확정 필요',relatedUnowned+'건','공동업무 중 책임 미확정',relatedUnowned?'bad':'good')}
    </div>

    <div class="section-title"><div><h2>현재 수행업무</h2><p>기한 경과, 7일 이내 마감, 진행 중 업무 순으로 표시</p></div><span class="tag blue">${now.length}건</span></div>
    ${workList(now,inst.name,'현재 수행 중이거나 7일 이내 마감되는 업무가 없습니다.')}

    <div class="communication-grid">
      <div>
        <div class="section-title"><div><h2>요청사항 및 기관 회신</h2><p>정션메드 또는 협업기관의 요청, 회신기한, 기관 답변을 한 화면에서 확인</p></div><button class="btn ghost compact-btn" id="newRequestForInst">+ 요청 등록</button></div>
        ${requestMiniList(w.requests)}
      </div>
      <div>
        <div class="section-title"><div><h2>소통 메모</h2><p>확인사항, 협의내용, 후속 답변을 기록하는 업무 메모</p></div><button class="btn ghost compact-btn" id="newMemoForInst">+ 메모 등록</button></div>
        <div class="panel">${memoPreviewList(institutionMemoThreads(inst.name),inst.name)}</div>
      </div>
    </div>

    <div class="section-title"><div><h2>향후 30일 예정업무</h2><p>30일 이내 착수 예정 업무</p></div></div>
    ${workList(next30,inst.name,'30일 이내 새로 시작할 업무가 없습니다.')}

    <div class="section-title"><div><h2>최근 완료</h2><p>최근 완료 승인된 업무</p></div></div>
    <div class="panel recent-done">${w.done.slice(0,6).map(a=>`<div class="done-row" data-action="${a.id}"><span>✓</span><div><strong>${esc(a.name)}</strong><div class="cell-sub">${a.end?fmtDate(a.end):'-'} 완료</div></div></div>`).join('')||'<div class="empty compact">완료된 업무가 없습니다.</div>'}</div>
  </div>`;
}

function dashboardHTML(){
  const am=actionMetrics(), km=kpiMetrics();
  return `
  <div class="metric-grid">
    ${metric('성과 달성률',km.avg===null?'입력 필요':km.avg+'%',km.avg===null?`21개 지표 중 현재값 ${km.entered}개 입력`:`${km.entered}/${km.total}개 지표 반영`)}
    ${metric('실행과제 완료율',am.rate+'%',`${am.done}/${am.all}개 완료 승인`)}
    ${metric('지연 실행과제',am.overdue+'건','기한 경과·미완료','bad')}
    ${metric('협업 회신 대기',am.waiting+'건','기관 간 응답 필요')}
    ${metric('PM 확인 필요',am.pm+'건','결정·검토·완료승인')}
  </div>
  <div class="section-title"><div><h2>성과영역 현황</h2><p>성과값이 입력된 지표 기준. 미입력 지표는 별도 표시</p></div><button class="btn ghost" data-go="kpis">전체 성과목표 보기</button></div>
  <div class="grid-2">
    <div class="panel">${categoryStats().map(c=>`<div class="category-row"><div><strong>${esc(c.name)}</strong><div class="cell-sub">${c.items}개 지표 · 현재값 ${c.entered}개 입력</div></div><div class="progress-track"><div class="progress-fill ${c.avg===null?'neutral':''}" style="width:${c.avg||0}%"></div></div><div class="progress-number">${c.avg===null?'미측정':c.avg+'%'}</div></div>`).join('')}</div>
    <div class="panel"><div class="panel-head"><h3>지금 확인할 업무</h3><span>기준일 ${fmtDate(today())}</span></div>${urgentListHTML(urgentActions())}</div>
  </div>
  <div class="section-title"><div><h2>기관별 현황</h2><p>책임업무·협업업무·지연·회신요청을 한 번에 확인</p></div></div>
  <div class="institution-grid">${state.institutions.map(i=>institutionCard(i)).join('')}</div>`;
}
function metric(label,value,foot,tone=''){return `<div class="metric-card"><div class="metric-label">${label}</div><div class="metric-value">${value}</div><div class="metric-foot ${tone}">${foot}</div></div>`;}
function institutionCard(i){const s=institutionStats(i.name);return `<div class="institution-card" data-inst="${esc(i.name)}"><span class="role">${esc(i.role)}</span><h3>${esc(i.name)}</h3><div class="mini-stats"><div class="mini-stat"><strong>${s.responsibility}</strong><span>책임업무</span></div><div class="mini-stat"><strong>${s.late}</strong><span>지연</span></div><div class="mini-stat"><strong>${s.req}</strong><span>회신필요</span></div></div></div>`;}
function urgentListHTML(items){if(!items.length)return '<div class="empty">현재 14일 이내 마감 또는 지연 업무가 없습니다.</div>';return `<div class="alert-list">${items.map(a=>`<div class="alert-row" data-action="${a.id}"><div>${a.diff<0?'<span class="tag bad">지연 '+Math.abs(a.diff)+'일</span>':a.diff===0?'<span class="tag warn">오늘 마감</span>':'<span class="tag warn">D-'+a.diff+'</span>'}</div><div class="name">${esc(a.name)}<div class="cell-sub">${esc(ownerDisplay(a.owner))}</div></div><div>${statusTag(a.status)}</div><div class="${a.diff<0?'date-bad':'date-warn'}">${fmtDate(a.end)}</div></div>`).join('')}</div>`;}

function kpisHTML(){
  const cats=['전체',...new Set(state.kpis.map(x=>x.category))];
  return `<div class="toolbar"><input class="input search" id="kpiSearch" placeholder="성과지표 검색"><select class="select filter-select" id="kpiCategory">${cats.map(c=>`<option>${esc(c)}</option>`).join('')}</select><select class="select filter-select" id="kpiStatus"><option>전체 상태</option>${KPI_STATUS_OPTIONS.map(s=>`<option>${s}</option>`).join('')}</select></div><div class="kpi-grid" id="kpiGrid">${renderKpiCards(state.kpis)}</div>`;
}
function renderKpiCards(items){return items.map(k=>`<div class="kpi-card" data-kpi="${k.id}" data-cat="${esc(k.category)}" data-status="${esc(k.status)}" data-search="${esc((k.name+' '+k.target).toLowerCase())}"><span class="tag blue">${esc(k.category)}</span><h3>${esc(k.name)}</h3><div class="kpi-target">${esc(k.target)}</div><div class="kpi-bottom"><div><div class="kpi-progress">${pct(k.progress)===null?'—':pct(k.progress)+'%'}</div><div class="cell-sub">${statusTag(k.status)}</div></div><div class="kpi-owner">책임기관<br><strong>${esc(ownerDisplay(k.owner))}</strong></div></div></div>`).join('');}

function institutionsHTML(){
  const selected=viewFilter.institution || state.institutions[0].name;
  const inst=state.institutions.find(i=>i.name===selected)||state.institutions[0];
  const s=institutionStats(inst.name);
  const responsible=state.actions.filter(a=>a.owner===inst.name);
  const collab=state.actions.filter(a=>(a.collaborators||[]).includes(inst.name));
  const relatedKpi=state.kpis.filter(k=>k.owner===inst.name||(k.collaborators||[]).includes(inst.name));
  return `<div class="institution-grid">${state.institutions.map(i=>institutionCard(i)).join('')}</div>
  <div class="section-title"><div><h2>${esc(inst.name)} 상세</h2><p>${esc(inst.role)} · 책임업무 ${s.responsibility}건 · 협업업무 ${s.collab}건</p></div></div>
  <div class="metric-grid">${metric('책임 실행과제',s.responsibility+'건','완료 책임')}${metric('협업 실행과제',s.collab+'건','지원·검토')}${metric('지연',s.late+'건','책임업무 기준',s.late?'bad':'good')}${metric('회신 필요',s.req+'건','협업요청 수신')}${metric('관련 성과목표',relatedKpi.length+'개','책임 또는 협업')}</div>
  <div class="section-title"><div><h2>책임 실행과제</h2></div></div>${actionTableHTML(responsible)}
  <div class="section-title"><div><h2>협업 실행과제</h2></div></div>${actionTableHTML(collab)}`;
}

function actionsHTML(){
  const insts=['전체 기관','책임기관 미확정',...state.institutions.map(x=>x.name)];
  return `<div class="toolbar"><input class="input search" id="actionSearch" placeholder="실행과제 검색"><select class="select filter-select" id="actionInst">${insts.map(x=>`<option>${esc(x)}</option>`).join('')}</select><select class="select filter-select" id="actionStatus"><option>전체 상태</option>${STATUS_OPTIONS.map(s=>`<option>${s}</option>`).join('')}</select><button class="btn primary" id="addAction">+ 실행과제 추가</button></div><div id="actionTableHolder">${actionTableHTML(state.actions)}</div>`;
}
function actionTableHTML(items){if(!items.length)return '<div class="empty panel">조건에 맞는 실행과제가 없습니다.</div>';return `<div class="table-wrap"><table class="data-table"><thead><tr><th>실행과제</th><th>책임기관</th><th>협업기관</th><th>기간</th><th>상태</th><th>PM</th></tr></thead><tbody>${items.map(a=>`<tr data-action="${a.id}"><td><div class="cell-title">${esc(a.name)}</div><div class="cell-sub">${esc(a.relatedKpi||'성과목표 연결 필요')}</div></td><td>${esc(ownerDisplay(a.owner))}</td><td>${institutionTags(a.collaborators)}</td><td>${fmtDate(a.start)} ~ ${fmtDate(a.end)}${a.end && a.end<today() && a.status!=='완료 승인'?'<div class="cell-sub date-bad">기한 경과</div>':''}</td><td>${statusTag(a.status)}</td><td>${a.pmCheck?'<span class="tag bad">확인 필요</span>':'-'}</td></tr>`).join('')}</tbody></table></div>`;}

function requestsHTML(){
  return `<div class="toolbar"><button class="btn primary" id="addRequest">+ 요청사항 등록</button><span class="toolbar-note">요청사항 → 기관 회신 → 요청기관 확인 순서로 관리합니다.</span></div>
  ${state.requests.length?`<div class="table-wrap"><table class="data-table"><thead><tr><th>요청사항</th><th>요청기관</th><th>수신기관</th><th>회신기한</th><th>기관 회신</th><th>상태</th></tr></thead><tbody>${state.requests.map(r=>`<tr data-request="${r.id}"><td><div class="cell-title">${esc(r.title)}</div><div class="cell-sub">${esc(r.content||'')}</div></td><td>${esc(r.from)}</td><td>${esc(r.to)}</td><td>${fmtDate(r.due)}</td><td>${r.response?`<strong class="response-yes">회신 등록</strong><div class="cell-sub">${esc(r.response)}</div>`:'<span class="response-no">회신 대기</span>'}</td><td>${statusTag(r.status)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty panel">등록된 요청사항이 없습니다.</div>'}`;
}

function memosHTML(){
  const insts=['전체 기관',...state.institutions.map(x=>x.name)];
  const selected=viewFilter.memoInstitution||'전체 기관';
  const items=(state.memos||[]).filter(m=>selected==='전체 기관'||m.institution===selected);
  return `<div class="toolbar"><select class="select filter-select" id="memoInstitutionFilter">${insts.map(x=>`<option ${x===selected?'selected':''}>${esc(x)}</option>`).join('')}</select><button class="btn primary" id="addMemo">+ 소통 메모 등록</button><span class="toolbar-note">확인사항, 협의내용, 답변을 한 흐름으로 기록합니다.</span></div>
  <div class="memo-board">${items.length?items.map(m=>memoThreadCard(m)).join(''):'<div class="empty panel">등록된 소통 메모가 없습니다.</div>'}</div>`;
}
function memoThreadCard(m){const msgs=m.messages||[],last=msgs[msgs.length-1]||{};return `<div class="memo-thread-card" data-memo="${m.id}"><div class="memo-thread-head"><div><span class="tag blue">${esc(m.institution||'기관 미지정')}</span><h3>${esc(m.title)}</h3></div><span class="memo-status">${esc(m.status||'진행')}</span></div><div class="memo-last-message"><span>${esc(last.authorInstitution||'-')}</span><p>${esc(last.text||'메모 내용 없음')}</p></div><div class="memo-thread-foot"><span>${last.date?fmtDate(last.date):'-'} · 대화 ${msgs.length}건</span><span>${m.relatedAction?`관련과제 ${esc(m.relatedAction)}`:'관련과제 미연결'}</span></div></div>`;}

function timelineHTML(){
  const start='2026-06-01', end='2026-12-31'; const total=daysDiff(start,end)+1;
  const rows=state.actions.filter(a=>a.start&&a.end).sort((a,b)=>a.start.localeCompare(b.start));
  return `<div class="toolbar"><span class="tag blue">Master Schedule</span><span class="muted">실행과제의 시작일·종료일을 자동으로 표시</span></div><div class="gantt"><div class="gantt-header"><div>실행과제</div>${['6월','7월','8월','9월','10월','11월','12월'].map(m=>`<div>${m}</div>`).join('')}</div>${rows.map(a=>{const left=Math.max(0,daysDiff(start,a.start))/total*100;const width=Math.max(1,(daysDiff(a.start,a.end)+1)/total*100);const overdue=a.status!=='완료 승인'&&a.end<today();return `<div class="gantt-row" data-action="${a.id}"><div class="gantt-name"><strong>${esc(a.name)}</strong><span>${esc(ownerDisplay(a.owner))} · ${fmtDate(a.start)}~${fmtDate(a.end)}</span></div>${Array(7).fill('<div></div>').join('')}<div class="gantt-track"><span class="gantt-bar ${a.status==='완료 승인'?'done':overdue?'overdue':''}" style="left:${left}%;width:${width}%"></span></div></div>`}).join('')}</div>`;
}

function recordsHTML(){return `<div class="grid-2"><div><div class="section-title"><div><h2>회의</h2><p>회의 결과는 실행과제로 전환하는 구조를 전제로 함</p></div></div><div class="table-wrap"><table class="data-table" style="min-width:600px"><thead><tr><th>회의명</th><th>일자</th><th>참여</th><th>장소</th></tr></thead><tbody>${state.meetings.map(m=>`<tr><td class="cell-title">${esc(m.name)}</td><td>${fmtDate(m.date)}</td><td>${esc(m.participants||'-')}</td><td>${esc(m.location||'-')}</td></tr>`).join('')}</tbody></table></div></div><div><div class="section-title"><div><h2>공유 문서</h2><p>현재 Notion export 문서 목록</p></div></div><div class="panel">${state.documents.map(d=>`<div class="category-row" style="grid-template-columns:1fr 90px"><div><strong>${esc(d.name)}</strong><div class="cell-sub">${esc(d.type)}</div></div><div>${fmtDate(d.date)}</div></div>`).join('')||'<div class="empty">문서 없음</div>'}</div></div></div>`;}

function settingsHTML(){return `<div class="settings-grid">
  <div class="setting-card"><h3>프로젝트 기본정보</h3><p>기준일과 사업기간은 대시보드·지연판정·간트에 즉시 반영됩니다.</p><div class="form-field"><label>기준일</label><input type="date" class="input" id="asOfSetting" value="${state.project.asOf}"></div><button class="btn primary" id="saveProjectSetting">저장</button></div>
  <div class="setting-card"><h3>데이터 백업</h3><p>별도 개발 없이 운영 데이터를 JSON으로 백업·복원할 수 있습니다.</p><div class="toolbar"><button class="btn secondary" id="exportJson">JSON 내보내기</button><button class="btn secondary" id="importJson">JSON 불러오기</button></div></div>
  <div class="setting-card"><h3>초기 데이터</h3><p>업로드된 사업계획·Notion export 자료를 기준으로 만든 초기 상태로 되돌립니다. 입력한 수정내용은 삭제됩니다.</p><button class="btn danger" id="resetData">초기 데이터로 복원</button></div>
  <div class="setting-card"><h3>운영 원칙</h3><div class="code-note">참여기관: 진행상황·실적·증빙·요청 제출\n정션메드 PM: 검토 → 승인 → 공식 데이터 반영\n성과목표/실행과제/기관/간트: 하나의 데이터에서 자동 생성</div></div>
  <div class="setting-card"><h3>현재 MVP 범위</h3><p>이 버전은 브라우저 LocalStorage를 사용하는 1차 작동 프로토타입입니다. 다음 단계에서 로그인·DB·파일저장·기관별 권한·승인 워크플로를 서버형으로 전환할 수 있습니다.</p></div>
  <div class="setting-card"><h3>기관</h3><p>${state.institutions.map(i=>`<span class="tag ${i.role==='주관기관'?'blue':''}">${esc(i.name)} · ${esc(i.role)}</span>`).join(' ')}</p></div>
  </div>`;}

function bindViewEvents(){
  document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{currentView=b.dataset.go;render();});
  document.querySelectorAll('[data-kpi]').forEach(x=>x.onclick=()=>openKpi(x.dataset.kpi));
  document.querySelectorAll('[data-action]').forEach(x=>x.onclick=()=>openAction(x.dataset.action));
  document.querySelectorAll('[data-request]').forEach(x=>x.onclick=()=>openRequest(x.dataset.request));
  document.querySelectorAll('[data-memo]').forEach(x=>x.onclick=()=>openMemo(x.dataset.memo));
  document.querySelectorAll('[data-inst]').forEach(x=>x.onclick=()=>{viewFilter.institution=x.dataset.inst;currentView='institutions';render();});
  document.querySelectorAll('[data-work-inst]').forEach(b=>b.onclick=()=>{viewFilter.workInstitution=b.dataset.workInst;render();window.scrollTo({top:0,behavior:'smooth'});});
  if(document.getElementById('kpiSearch')){['input','change'].forEach(evt=>{document.getElementById('kpiSearch').addEventListener(evt,filterKpis);document.getElementById('kpiCategory').addEventListener(evt,filterKpis);document.getElementById('kpiStatus').addEventListener(evt,filterKpis);});}
  if(document.getElementById('actionSearch')){['input','change'].forEach(evt=>{document.getElementById('actionSearch').addEventListener(evt,filterActions);document.getElementById('actionInst').addEventListener(evt,filterActions);document.getElementById('actionStatus').addEventListener(evt,filterActions);});document.getElementById('addAction').onclick=()=>openAction();}
  if(document.getElementById('addRequest')) document.getElementById('addRequest').onclick=()=>openRequest();
  if(document.getElementById('newRequestForInst')) document.getElementById('newRequestForInst').onclick=()=>openRequest(null, viewFilter.workInstitution || state.project.leadInstitution);
  if(document.getElementById('newMemoForInst')) document.getElementById('newMemoForInst').onclick=()=>openMemo(null, viewFilter.workInstitution || state.project.leadInstitution);
  if(document.getElementById('addMemo')) document.getElementById('addMemo').onclick=()=>openMemo();
  if(document.getElementById('memoInstitutionFilter')) document.getElementById('memoInstitutionFilter').onchange=e=>{viewFilter.memoInstitution=e.target.value;render();};
  if(document.getElementById('saveProjectSetting')) document.getElementById('saveProjectSetting').onclick=()=>{state.project.asOf=document.getElementById('asOfSetting').value;saveState();toast('기준일을 저장했습니다.');render();};
  if(document.getElementById('exportJson')) document.getElementById('exportJson').onclick=exportJson;
  if(document.getElementById('importJson')) document.getElementById('importJson').onclick=()=>document.getElementById('importInput').click();
  if(document.getElementById('resetData')) document.getElementById('resetData').onclick=()=>{if(confirm('현재 수정 데이터를 모두 지우고 초기 상태로 복원할까요?')){state=clone(window.INITIAL_DATA);saveState();render();toast('초기 데이터로 복원했습니다.');}};
}
function filterKpis(){const q=document.getElementById('kpiSearch').value.trim().toLowerCase(),cat=document.getElementById('kpiCategory').value,st=document.getElementById('kpiStatus').value;const list=state.kpis.filter(k=>(!q||(k.name+' '+k.target).toLowerCase().includes(q))&&(cat==='전체'||k.category===cat)&&(st==='전체 상태'||k.status===st));document.getElementById('kpiGrid').innerHTML=renderKpiCards(list);document.querySelectorAll('[data-kpi]').forEach(x=>x.onclick=()=>openKpi(x.dataset.kpi));}
function filterActions(){const q=document.getElementById('actionSearch').value.trim().toLowerCase(),inst=document.getElementById('actionInst').value,st=document.getElementById('actionStatus').value;const list=state.actions.filter(a=>(!q||a.name.toLowerCase().includes(q))&&(inst==='전체 기관'||(inst==='책임기관 미확정'&&!a.owner)||a.owner===inst||(a.collaborators||[]).includes(inst))&&(st==='전체 상태'||a.status===st));document.getElementById('actionTableHolder').innerHTML=actionTableHTML(list);document.querySelectorAll('[data-action]').forEach(x=>x.onclick=()=>openAction(x.dataset.action));}

function openDrawer(eyebrow,title,body){document.getElementById('drawerEyebrow').textContent=eyebrow;document.getElementById('drawerTitle').textContent=title;document.getElementById('drawerBody').innerHTML=body;document.getElementById('drawer').classList.add('open');document.getElementById('drawerBackdrop').classList.add('open');}
function closeDrawer(){document.getElementById('drawer').classList.remove('open');document.getElementById('drawerBackdrop').classList.remove('open');}
function instOptions(selected='',allowBlank=true){return `${allowBlank?`<option value="">책임기관 미확정</option>`:''}${state.institutions.map(i=>`<option value="${esc(i.name)}" ${i.name===selected?'selected':''}>${esc(i.name)}</option>`).join('')}`;}
function multiInstChecks(selected=[]){return state.institutions.map(i=>`<label class="tag"><input type="checkbox" name="collab" value="${esc(i.name)}" ${selected.includes(i.name)?'checked':''}> ${esc(i.name)}</label>`).join('');}
function checkedValues(name){return [...document.querySelectorAll(`input[name="${name}"]:checked`)].map(x=>x.value);}

function openKpi(id){const k=state.kpis.find(x=>x.id===id);if(!k)return;openDrawer(k.id,k.name,`<div class="detail-block"><h4>협약 목표</h4><p>${esc(k.target)}</p></div><div class="form-grid"><div class="form-field"><label>현재값</label><input class="input" id="kCurrent" value="${esc(k.currentValue)}" placeholder="예: 430명 / 1,280건"></div><div class="form-field"><label>달성률 (%)</label><input type="number" min="0" max="100" class="input" id="kProgress" value="${k.progress??''}" placeholder="0~100"></div></div><div class="form-grid"><div class="form-field"><label>성과 상태</label><select class="select" id="kStatus">${KPI_STATUS_OPTIONS.map(s=>`<option ${s===k.status?'selected':''}>${s}</option>`).join('')}</select></div><div class="form-field"><label>증빙 상태</label><select class="select" id="kEvidence"><option ${k.evidenceStatus==='미등록'?'selected':''}>미등록</option><option ${k.evidenceStatus==='준비 중'?'selected':''}>준비 중</option><option ${k.evidenceStatus==='확보'?'selected':''}>확보</option><option ${k.evidenceStatus==='PM 승인'?'selected':''}>PM 승인</option></select></div></div><div class="form-field"><label>책임기관</label><select class="select" id="kOwner">${instOptions(k.owner)}</select><div class="form-help">원자료에 여러 기관이 함께 표기된 경우 초기값을 미확정으로 두었습니다.</div></div><div class="form-field"><label>협업기관</label><div>${multiInstChecks(k.collaborators)}</div></div><div class="form-field"><label>남아있는 과정 / 다음 단계</label><textarea class="textarea" id="kNext" placeholder="예: 기관확보 → 온보딩 → 사전조사 → 실증 → 사후조사 → 분석">${esc(k.nextStep)}</textarea></div><div class="form-field"><label>PM 메모</label><textarea class="textarea" id="kPm">${esc(k.pmNote)}</textarea></div><div class="detail-block"><h4>주요내용 및 산출물</h4><p>${esc(k.deliverable)}</p></div><div class="detail-block"><h4>평가기준</h4><p>${esc(k.evaluation)}</p></div><div class="drawer-actions"><button class="btn secondary" id="closeKpi">취소</button><button class="btn primary" id="saveKpi">저장</button></div>`);document.getElementById('closeKpi').onclick=closeDrawer;document.getElementById('saveKpi').onclick=()=>{k.currentValue=document.getElementById('kCurrent').value;k.progress=document.getElementById('kProgress').value===''?null:Number(document.getElementById('kProgress').value);k.status=document.getElementById('kStatus').value;k.evidenceStatus=document.getElementById('kEvidence').value;k.owner=document.getElementById('kOwner').value;k.collaborators=checkedValues('collab').filter(x=>x!==k.owner);k.nextStep=document.getElementById('kNext').value;k.pmNote=document.getElementById('kPm').value;saveState();closeDrawer();render();toast('성과목표를 업데이트했습니다.');};}

function openAction(id){let a=id?state.actions.find(x=>x.id===id):null;const isNew=!a;if(!a)a={id:'ACT-'+String(Math.max(0,...state.actions.map(x=>Number(x.id.split('-')[1])||0))+1).padStart(3,'0'),name:'',owner:'',collaborators:[],start:today(),end:today(),status:'예정',priority:'보통',completionCriteria:'',evidence:'',blocker:'',pmCheck:false,relatedKpi:'',note:'',planInstitutions:[]};openDrawer(isNew?'NEW ACTION':a.id,isNew?'새 실행과제':a.name,`<div class="form-field"><label>실행과제명</label><input class="input" id="aName" value="${esc(a.name)}"></div><div class="form-grid"><div class="form-field"><label>책임기관</label><select class="select" id="aOwner">${instOptions(a.owner)}</select></div><div class="form-field"><label>상태</label><select class="select" id="aStatus">${STATUS_OPTIONS.map(s=>`<option ${s===a.status?'selected':''}>${s}</option>`).join('')}</select></div></div><div class="form-field"><label>협업기관</label><div>${multiInstChecks(a.collaborators)}</div></div><div class="form-grid"><div class="form-field"><label>시작일</label><input type="date" class="input" id="aStart" value="${a.start||''}"></div><div class="form-field"><label>종료일</label><input type="date" class="input" id="aEnd" value="${a.end||''}"></div></div><div class="form-field"><label>관련 성과목표</label><select class="select" id="aKpi"><option value="">미연결</option>${state.kpis.map(k=>`<option value="${esc(k.name)}" ${k.name===a.relatedKpi?'selected':''}>${esc(k.name)}</option>`).join('')}</select></div><div class="form-field"><label>완료기준</label><textarea class="textarea" id="aCriteria">${esc(a.completionCriteria)}</textarea></div><div class="form-field"><label>필요 증빙</label><input class="input" id="aEvidence" value="${esc(a.evidence)}"></div><div class="form-field"><label>현재 이슈 / 막힘</label><textarea class="textarea" id="aBlocker">${esc(a.blocker)}</textarea></div><div class="form-field"><label><input type="checkbox" id="aPm" ${a.pmCheck?'checked':''}> PM 확인 필요</label></div><div class="drawer-actions">${!isNew?'<button class="btn danger" id="deleteAction">삭제</button>':''}<button class="btn secondary" id="closeAction">취소</button><button class="btn primary" id="saveAction">저장</button></div>`);document.getElementById('closeAction').onclick=closeDrawer;if(document.getElementById('deleteAction'))document.getElementById('deleteAction').onclick=()=>{if(confirm('이 실행과제를 삭제할까요?')){state.actions=state.actions.filter(x=>x.id!==a.id);saveState();closeDrawer();render();toast('삭제했습니다.');}};document.getElementById('saveAction').onclick=()=>{a.name=document.getElementById('aName').value.trim();if(!a.name){alert('실행과제명을 입력하세요.');return;}a.owner=document.getElementById('aOwner').value;a.status=document.getElementById('aStatus').value;a.collaborators=checkedValues('collab').filter(x=>x!==a.owner);a.start=document.getElementById('aStart').value;a.end=document.getElementById('aEnd').value;a.relatedKpi=document.getElementById('aKpi').value;a.completionCriteria=document.getElementById('aCriteria').value;a.evidence=document.getElementById('aEvidence').value;a.blocker=document.getElementById('aBlocker').value;a.pmCheck=document.getElementById('aPm').checked;if(isNew)state.actions.push(a);saveState();closeDrawer();render();toast(isNew?'실행과제를 추가했습니다.':'실행과제를 업데이트했습니다.');};}

function openRequest(id,defaultTo=''){let r=id?state.requests.find(x=>x.id===id):null;const isNew=!r;if(!r)r={id:'REQ-'+String(state.requests.length+1).padStart(3,'0'),title:'',from:'정션메드',to:defaultTo||'',content:'',requestedAt:today(),due:today(),status:'요청',response:'',responseDate:'',confirmation:'',relatedAction:''};
  const responseBlock=isNew?'':`<div class="drawer-section-divider"><span>기관 회신</span></div><div class="form-field"><label>회신내용</label><textarea class="textarea response-textarea" id="rResponse" placeholder="요청사항에 대한 처리결과, 일정, 확인내용을 입력">${esc(r.response||'')}</textarea></div><div class="form-grid"><div class="form-field"><label>회신일</label><input type="date" class="input" id="rResponseDate" value="${r.responseDate||''}"></div><div class="form-field"><label>처리상태</label><select class="select" id="rStatus">${REQUEST_STATUS.map(s=>`<option ${s===r.status?'selected':''}>${s}</option>`).join('')}</select></div></div><div class="form-field"><label>요청기관 확인 메모</label><textarea class="textarea" id="rConfirmation" placeholder="회신 확인 후 추가 요청 또는 종결 여부 기록">${esc(r.confirmation||'')}</textarea></div>`;
  openDrawer(isNew?'NEW REQUEST':r.id,isNew?'요청사항 등록':r.title,`<div class="request-flow-note"><strong>처리 절차</strong><span>요청 등록</span><b>→</b><span>기관 회신</span><b>→</b><span>요청기관 확인</span></div><div class="form-field"><label>요청 제목</label><input class="input" id="rTitle" value="${esc(r.title)}"></div><div class="form-grid"><div class="form-field"><label>요청기관</label><select class="select" id="rFrom">${instOptions(r.from,false)}</select></div><div class="form-field"><label>수신기관</label><select class="select" id="rTo">${instOptions(r.to,false)}</select></div></div><div class="form-field"><label>요청사항</label><textarea class="textarea" id="rContent" placeholder="확인 또는 조치가 필요한 내용을 구체적으로 입력">${esc(r.content)}</textarea></div><div class="form-grid"><div class="form-field"><label>요청일</label><input type="date" class="input" id="rRequestedAt" value="${r.requestedAt||today()}"></div><div class="form-field"><label>회신기한</label><input type="date" class="input" id="rDue" value="${r.due||''}"></div></div><div class="form-field"><label>관련 실행과제</label><select class="select" id="rAction"><option value="">미연결</option>${state.actions.map(a=>`<option value="${esc(a.id)}" ${a.id===r.relatedAction?'selected':''}>${esc(a.id+' · '+a.name)}</option>`).join('')}</select></div>${responseBlock}${isNew?`<div class="form-field"><label>상태</label><select class="select" id="rStatus">${REQUEST_STATUS.map(s=>`<option ${s===r.status?'selected':''}>${s}</option>`).join('')}</select></div>`:''}<div class="drawer-actions"><button class="btn secondary" id="closeReq">취소</button><button class="btn primary" id="saveReq">저장</button></div>`);
  document.getElementById('closeReq').onclick=closeDrawer;
  document.getElementById('saveReq').onclick=()=>{r.title=document.getElementById('rTitle').value.trim();if(!r.title){alert('요청 제목을 입력하세요.');return;}r.from=document.getElementById('rFrom').value;r.to=document.getElementById('rTo').value;r.content=document.getElementById('rContent').value;r.requestedAt=document.getElementById('rRequestedAt').value;r.due=document.getElementById('rDue').value;r.status=document.getElementById('rStatus').value;r.relatedAction=document.getElementById('rAction').value;if(!isNew){r.response=document.getElementById('rResponse').value;r.responseDate=document.getElementById('rResponseDate').value;r.confirmation=document.getElementById('rConfirmation').value;if(r.response.trim() && ['요청','수신 확인','처리 중'].includes(r.status))r.status='답변 완료';}if(isNew)state.requests.push(r);saveState();closeDrawer();render();toast(isNew?'요청사항을 등록했습니다.':'요청·회신 내용을 저장했습니다.');};
}

function openMemo(id,defaultInstitution=''){let m=id?(state.memos||[]).find(x=>x.id===id):null;const isNew=!m;if(!m)m={id:'MEM-'+String((state.memos||[]).length+1).padStart(3,'0'),title:'',institution:defaultInstitution||'',relatedAction:'',status:'진행',messages:[]};
  const messages=(m.messages||[]).map(msg=>`<div class="message-item ${msg.authorInstitution==='정션메드'?'pm-message':''}"><div class="message-meta"><strong>${esc(msg.authorInstitution||msg.author||'-')}</strong><span>${msg.date?fmtDate(msg.date):'-'}</span></div><p>${esc(msg.text||'')}</p></div>`).join('') || '<div class="empty compact">아직 작성된 메모가 없습니다.</div>';
  openDrawer(isNew?'NEW MEMO':m.id,isNew?'소통 메모 등록':m.title,`<div class="form-field"><label>메모 제목</label><input class="input" id="mTitle" value="${esc(m.title)}"></div><div class="form-grid"><div class="form-field"><label>관련 기관</label><select class="select" id="mInstitution"><option value="">기관 선택</option>${state.institutions.map(i=>`<option value="${esc(i.name)}" ${i.name===m.institution?'selected':''}>${esc(i.name)}</option>`).join('')}</select></div><div class="form-field"><label>상태</label><select class="select" id="mStatus"><option ${m.status==='진행'?'selected':''}>진행</option><option ${m.status==='확인 완료'?'selected':''}>확인 완료</option><option ${m.status==='보류'?'selected':''}>보류</option></select></div></div><div class="form-field"><label>관련 실행과제</label><select class="select" id="mAction"><option value="">미연결</option>${state.actions.map(a=>`<option value="${esc(a.id)}" ${a.id===m.relatedAction?'selected':''}>${esc(a.id+' · '+a.name)}</option>`).join('')}</select></div>${isNew?'':`<div class="drawer-section-divider"><span>소통 기록</span></div><div class="message-thread">${messages}</div>`}<div class="drawer-section-divider"><span>${isNew?'첫 메모':'답변·추가 메모'}</span></div><div class="form-grid"><div class="form-field"><label>작성기관</label><select class="select" id="mAuthorInstitution">${state.institutions.map(i=>`<option value="${esc(i.name)}" ${i.name===(isNew?'정션메드':(defaultInstitution||m.institution))?'selected':''}>${esc(i.name)}</option>`).join('')}</select></div><div class="form-field"><label>작성일</label><input type="date" class="input" id="mDate" value="${today()}"></div></div><div class="form-field"><label>내용</label><textarea class="textarea response-textarea" id="mText" placeholder="확인사항, 협의내용, 답변, 후속조치를 입력"></textarea></div><div class="drawer-actions"><button class="btn secondary" id="closeMemo">취소</button><button class="btn primary" id="saveMemo">${isNew?'등록':'답변 저장'}</button></div>`);
  document.getElementById('closeMemo').onclick=closeDrawer;
  document.getElementById('saveMemo').onclick=()=>{m.title=document.getElementById('mTitle').value.trim();m.institution=document.getElementById('mInstitution').value;m.status=document.getElementById('mStatus').value;m.relatedAction=document.getElementById('mAction').value;const text=document.getElementById('mText').value.trim();if(!m.title){alert('메모 제목을 입력하세요.');return;}if(!m.institution){alert('관련 기관을 선택하세요.');return;}if(isNew && !text){alert('메모 내용을 입력하세요.');return;}if(text){m.messages=m.messages||[];m.messages.push({authorInstitution:document.getElementById('mAuthorInstitution').value,date:document.getElementById('mDate').value,text});}if(isNew){state.memos=state.memos||[];state.memos.push(m);}saveState();closeDrawer();render();toast(isNew?'소통 메모를 등록했습니다.':'답변을 저장했습니다.');};
}

function exportJson(){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='AX_Sprint_Control_Tower_backup.json';a.click();URL.revokeObjectURL(a.href);}
document.getElementById('importInput').addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;const reader=new FileReader();reader.onload=()=>{try{state=JSON.parse(reader.result);saveState();render();toast('백업 데이터를 불러왔습니다.');}catch(err){alert('올바른 JSON 백업 파일이 아닙니다.');}};reader.readAsText(f);e.target.value='';});
document.getElementById('drawerClose').onclick=closeDrawer;document.getElementById('drawerBackdrop').onclick=closeDrawer;document.getElementById('quickAddBtn').onclick=()=>openAction();document.getElementById('pmUpdateBtn').onclick=()=>{currentView='requests';render();toast('현재는 협업요청 화면으로 이동합니다. 서버형 버전에서 기관 제출 승인함으로 확장합니다.');};
render();
