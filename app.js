const STORAGE_KEY = 'ax-sprint-control-tower-v11';
const LEGACY_STORAGE_KEYS = ['ax-sprint-control-tower-v10','ax-sprint-control-tower-v9','ax-sprint-control-tower-v8','ax-sprint-control-tower-v7','ax-sprint-control-tower-v6','ax-sprint-control-tower-v5','ax-sprint-control-tower-v4'];
const STATUS_OPTIONS = ['예정','진행 중','협업기관 회신 대기','PM 검토 대기','PM 결정 필요','지연','완료 요청','완료 승인','보류'];
const KPI_STATUS_OPTIONS = ['미측정','준비 중','진행 중','주의','위험','달성','미달'];
const REQUEST_STATUS = ['요청','수신 확인','처리 중','답변 완료','요청자 확인 대기','종결','기한 초과','PM 조정 필요'];
const ADMIN_PASSWORD = '0000';
const PARTNER_ORDER = ['경복대학교 산학협력단','돌봄과 미래','에임랩'];
const PORTAL_ORDER = ['정션메드',...PARTNER_ORDER];
const DISPLAY_ORDER = [...PARTNER_ORDER,'정션메드'];
const PORTAL_CODE = {'main':'정션메드','kbu':'경복대학교 산학협력단','care':'돌봄과 미래','aimlab':'에임랩'};
const INSTITUTION_CODE = Object.fromEntries(Object.entries(PORTAL_CODE).map(([code,name])=>[name,code]));
const NAV = [
  ['workboard','▣','기관 진행현황'],['dashboard','▦','PM 대시보드'],['kpis','◎','성과목표'],['institutions','◫','기관 관리'],['actions','✓','실행과제'],
  ['requests','⇄','요청·회신'],['memos','▧','협의사항'],['timeline','▤','전체 일정'],['records','≡','회의·문서'],['settings','⚙','관리설정']
];
let state = loadState();
const urlParams = new URLSearchParams(location.search);
let isAdmin = sessionStorage.getItem('ax-sprint-admin-v14') === '1' || sessionStorage.getItem('ax-sprint-admin-v11') === '1' || sessionStorage.getItem('ax-sprint-admin-v10') === '1' || sessionStorage.getItem('ax-sprint-admin-v9') === '1' || sessionStorage.getItem('ax-sprint-admin-v8') === '1' || sessionStorage.getItem('ax-sprint-admin-v7') === '1';
let portalInstitution = PORTAL_CODE[urlParams.get('inst')] || PORTAL_ORDER[0];
let portalDetailTab = 'all';
let portalListFilter = 'all';
let currentView = isAdmin ? 'dashboard' : 'portal';
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
function orderedInstitutions(){
  return DISPLAY_ORDER.map(name=>state.institutions.find(i=>i.name===name)).filter(Boolean);
}
function normalizeInstitutionOrder(){
  const ordered=orderedInstitutions();
  const extra=state.institutions.filter(i=>!DISPLAY_ORDER.includes(i.name));
  state.institutions=[...ordered,...extra];
}
normalizeInstitutionOrder();
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
  const nav=document.getElementById('nav');
  const mobile=document.getElementById('mobileNav');
  if(!isAdmin){nav.innerHTML='';if(mobile)mobile.innerHTML='';return;}
  const html=NAV.map(([id,icon,label])=>`<button class="nav-item ${id===currentView?'active':''}" data-view="${id}"><span class="nav-icon">${icon}</span><span class="nav-label">${label}</span></button>`).join('');
  nav.innerHTML=html;
  if(mobile) mobile.innerHTML=html;
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{currentView=b.dataset.view;viewFilter={};render();window.scrollTo({top:0,behavior:'smooth'});});
}
function setShellMode(){
  document.body.classList.toggle('institution-mode',!isAdmin);
  document.body.classList.toggle('admin-mode',isAdmin);
  document.querySelector('.sidebar-footer strong').textContent='정션메드 PM';
  document.getElementById('adminAccessBtn').textContent=isAdmin?'관리자 종료':'관리자';
}
function render(){
  setShellMode();
  renderNav();
  document.getElementById('asOf').textContent=`기준일 ${state.project.asOf}`;
  const quick=document.getElementById('quickAddBtn'), pmBtn=document.getElementById('pmUpdateBtn');
  const content=document.getElementById('content');
  const eyebrow=document.querySelector('.topbar .eyebrow');
  if(!isAdmin){
    quick.style.display='none';pmBtn.style.display='none';
    eyebrow.textContent='2026 복지분야 AI 응용제품 신속 상용화 지원사업';
    document.getElementById('pageTitle').textContent=`${portalInstitution} 진행현황`;
    content.innerHTML=institutionPortalHTML(portalInstitution);
    bindInstitutionPortalEvents();
    return;
  }
  eyebrow.textContent='2026 복지분야 AI 응용제품 신속 상용화 지원사업 · 관리자';
  const titles={workboard:'기관 진행현황',dashboard:'통합 대시보드',kpis:'성과목표',institutions:'기관 관리',actions:'실행과제',requests:'요청·회신 관리',memos:'협의사항',timeline:'전체 일정',records:'회의·문서',settings:'관리설정'};
  if(currentView==='portal')currentView='dashboard';
  document.getElementById('pageTitle').textContent=titles[currentView]||'통합 대시보드';
  quick.style.display=currentView==='workboard'?'none':'';
  pmBtn.style.display=currentView==='workboard'?'none':'';
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
  if(!a.owner && (a.planInstitutions||[]).includes(name)) return '공동참여';
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
    <div class="work-card-top"><div><span class="tag ${role==='책임'?'blue':role==='공동참여'?'warn':''}">${esc(role||'관련항목')}</span>${statusTag(a.status)}</div>${ddayLabel(a)}</div>
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
function portalActionData(name){
  const allRelevant=state.actions.filter(a=>a.owner===name || (a.collaborators||[]).includes(name) || (!a.owner && (a.planInstitutions||[]).includes(name)));
  const relevant=allRelevant.filter(a=>a.status!=='완료 승인');
  const items=relevant.map(a=>({...a,diff:a.end?daysDiff(today(),a.end):999,startDiff:a.start?daysDiff(today(),a.start):999,portalRole:a.owner===name?'책임항목':'관련항목'}));
  const priority=items.filter(a=>(a.end&&a.diff<0) || (a.end&&a.diff>=0&&a.diff<=7) || (a.start&&a.start<=today()&&(!a.end||a.end>=today())))
    .sort((a,b)=>{const ad=a.diff??999,bd=b.diff??999;if(ad!==bd)return ad-bd;return (a.owner===name?-1:1)-(b.owner===name?-1:1);});
  const current=items.filter(a=>!a.start || a.start<=today()).sort((a,b)=>(a.diff??999)-(b.diff??999));
  const upcoming=items.filter(a=>a.start && a.start>today()).sort((a,b)=>a.start.localeCompare(b.start));
  const requests=state.requests.filter(r=>r.to===name && r.status!=='종결').sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999'));
  const memos=(state.memos||[]).filter(m=>m.institution===name).sort((a,b)=>memoLastDate(b).localeCompare(memoLastDate(a)));
  const done=allRelevant.filter(a=>a.status==='완료 승인').sort((a,b)=>(b.end||'').localeCompare(a.end||''));
  return {items,priority,current,upcoming,requests,memos,done,overdue:items.filter(a=>a.end&&a.diff<0),dueSoon:items.filter(a=>a.end&&a.diff>=0&&a.diff<=7)};
}
function portalStatusMessage(w){
  if(w.overdue.length) return `기한이 지난 항목 ${w.overdue.length}건이 있습니다.`;
  if(w.dueSoon.length) return `7일 이내 마감 항목 ${w.dueSoon.length}건이 있습니다.`;
  if(w.requests.length) return `회신이 필요한 요청사항 ${w.requests.length}건이 있습니다.`;
  return '현재 별도 확인이 필요한 긴급사항은 없습니다.';
}
function portalStageLabels(a){
  const n=(a.name||'');
  if(/설문/.test(n)) return ['초안 작성','기관 검토','최종 수정','확정'];
  if(/IRB/.test(n)) return ['서류 준비','신청','접수 확인'];
  if(/KOLAS|성능 평가/.test(n)) return ['시험항목 확정','시험 의뢰','성능 시험','결과서 확보'];
  if(/키오스크 디자인|규격 논의/.test(n)) return ['요구사항','디자인','규격 검토','확정'];
  if(/하드웨어 설계/.test(n)) return ['구성 확정','설계','검토','설계 확정'];
  if(/완성품 제작/.test(n)) return ['부품 준비','제작','연동 점검','설치 준비'];
  if(/키오스크.*설치|상담센터.*개시|케어콜.*개시/.test(n)) return ['기관 협의','설치·연동 준비','현장 적용','운영 개시'];
  if(/실증 운영|실증기관|대상자 모집|온보딩/.test(n)) return ['기관 준비','대상자·환경 확보','실증 운영','실적 점검'];
  if(/데이터.*표준|표준화|수집 기준/.test(n)) return ['기준 정리','형식 통합','품질 점검','확정'];
  if(/데이터 수집|학습데이터셋/.test(n)) return ['수집체계','데이터 수집','정제·비식별','실적 점검'];
  if(/만족도 조사/.test(n)) return ['설문 확정','조사 실시','응답 회수','결과 집계'];
  if(/타당도|신뢰도|성과 분석|결과 취합/.test(n)) return ['데이터 확보','분석','검토','결과 정리'];
  if(/회의|자문/.test(n)) return ['안건 준비','회의 진행','의견 정리','후속 반영'];
  if(/보고서|보고회|결과 보고/.test(n)) return ['자료 취합','작성','검토','제출·공유'];
  if(/개발|고도화|내부 테스트/.test(n)) return ['요구사항','개발·적용','내부 테스트','반영 완료'];
  return ['준비','진행','검토','완료'];
}
function portalStageIndex(a,steps){
  if(a.status==='완료 승인') return steps.length;
  if(a.status==='예정') return 0;
  if(!a.start||!a.end) return Math.min(1,steps.length-1);
  const start=new Date(a.start+'T00:00:00'), end=new Date(a.end+'T00:00:00'), now=new Date(today()+'T00:00:00');
  if(now<=start) return 0;
  if(now>=end) return Math.max(1,steps.length-1);
  const ratio=(now-start)/Math.max(1,end-start);
  return Math.max(1,Math.min(steps.length-1,Math.floor(ratio*steps.length)));
}
function portalStageFlow(a){
  const steps=portalStageLabels(a), idx=portalStageIndex(a,steps);
  return `<div class="portal-stage-flow" aria-label="진행 단계">${steps.map((label,i)=>{
    const done=i<idx, current=i===idx && idx<steps.length;
    return `<div class="portal-stage ${done?'done':''} ${current?'current':''}"><span class="stage-dot">${done?'●':'○'}</span><span class="stage-label">${esc(label)}</span></div>${i<steps.length-1?'<span class="stage-line">──</span>':''}`;
  }).join('')}</div>`;
}
function portalActionCard(a){
  const criterion=(a.completionCriteria||'').trim();
  return `<article class="portal-task ${a.end&&a.end<today()?'late':''}" data-portal-action="${a.id}">
    <div class="portal-task-primary"><div class="portal-task-dday">${ddayLabel(a)}</div><div class="portal-task-main"><h3>${esc(a.name)}</h3>${portalStageFlow(a)}</div></div>
    <div class="portal-deadline"><span>기한</span><strong>${a.end?`${fmtDate(a.end)}까지`:'기한 미정'}</strong></div>
    <div class="portal-criterion"><span>완료기준</span><p>${esc(criterion||'완료기준 확인 필요')}</p></div>
    ${a.blocker?`<div class="portal-blocker"><strong>확인사항</strong>${esc(a.blocker)}</div>`:''}
  </article>`;
}
function portalTaskList(items,empty){
  return items.length?`<div class="portal-task-list">${items.map(portalActionCard).join('')}</div>`:`<div class="portal-empty">${empty}</div>`;
}
function portalRequestList(items){
  if(!items.length)return '<div class="portal-empty">현재 회신할 요청사항이 없습니다.</div>';
  return `<div class="portal-request-list">${items.map(r=>`<article class="portal-request">
    <div class="portal-request-top"><div><span>${esc(r.from||'요청기관')} 요청</span><h3>${esc(r.title)}</h3></div><strong>${r.due?`${fmtDate(r.due)}까지`:'기한 미정'}</strong></div>
    <p class="portal-request-content">${esc(r.content||'요청내용 미입력')}</p>
    <div class="portal-response"><span>기관 회신</span><p>${r.response?esc(r.response):'아직 회신하지 않았습니다.'}</p></div>
    ${r.confirmation?`<div class="portal-confirmation"><span>정션메드 확인</span><p>${esc(r.confirmation)}</p></div>`:''}
    <button type="button" class="btn secondary portal-reply-btn" data-public-request="${r.id}">${r.response?'회신 수정':'회신 작성'}</button>
  </article>`).join('')}</div>`;
}
function portalMemoList(items){
  if(!items.length)return '<div class="portal-empty">등록된 협의사항이 없습니다.</div>';
  return `<div class="portal-memo-list">${items.slice(0,12).map(m=>{const msgs=m.messages||[],last=msgs[msgs.length-1]||{};return `<button type="button" class="portal-memo" data-public-memo="${m.id}"><div><strong>${esc(m.title)}</strong><p>${esc(last.text||'내용 없음')}</p></div><span>${last.date?fmtDate(last.date):'-'} · ${msgs.length}건</span></button>`}).join('')}</div>`;
}
function portalDoneList(items){
  if(!items.length)return '<div class="portal-empty">완료 승인된 항목이 없습니다.</div>';
  return `<div class="portal-done-list">${items.slice(0,20).map(a=>`<div class="portal-done-row"><div><strong>${esc(a.name)}</strong><span>${a.end?fmtDate(a.end):'-'}</span></div><em>완료</em></div>`).join('')}</div>`;
}
function portalInstitutionTabsHTML(selected){
  return `<div class="portal-inst-selector"><div class="portal-inst-label">기관 선택</div><div class="portal-inst-tabs" role="tablist">${PORTAL_ORDER.map(name=>{const inst=state.institutions.find(i=>i.name===name);const role=inst?.role || (name==='정션메드'?'주관기관':'참여기관');return `<button type="button" class="portal-inst-tab ${name===selected?'active':''}" data-portal-inst="${esc(name)}" role="tab" aria-selected="${name===selected?'true':'false'}"><strong>${esc(name)}</strong><span>${esc(role)}</span></button>`}).join('')}</div></div>`;
}
function portalListCategory(a,w){
  if(a.status==='완료 승인') return 'done';
  if(w.overdue.some(x=>x.id===a.id)) return 'overdue';
  if(w.dueSoon.some(x=>x.id===a.id)) return 'dueSoon';
  if(w.upcoming.some(x=>x.id===a.id)) return 'upcoming';
  return 'active';
}
function portalListCategoryLabel(category){
  return {overdue:'기한 경과',dueSoon:'마감 임박',active:'진행',upcoming:'예정',done:'완료'}[category]||'진행';
}
function portalAllItemsForList(w){
  return [...w.items,...w.done].sort((a,b)=>{
    const ac=portalListCategory(a,w),bc=portalListCategory(b,w);
    const order={overdue:0,dueSoon:1,active:2,upcoming:3,done:4};
    if(order[ac]!==order[bc]) return order[ac]-order[bc];
    if(ac==='done') return (b.end||'').localeCompare(a.end||'');
    return (a.end||a.start||'9999-12-31').localeCompare(b.end||b.start||'9999-12-31');
  });
}
function portalListFilterControl(w){
  const all=portalAllItemsForList(w);
  const counts={all:all.length,overdue:w.overdue.length,dueSoon:w.dueSoon.length,active:all.filter(a=>portalListCategory(a,w)==='active').length,upcoming:w.upcoming.length,done:w.done.length};
  const options=[['all','전체'],['overdue','기한 경과'],['dueSoon','마감 임박'],['active','진행'],['upcoming','예정'],['done','완료']];
  return `<label class="portal-list-filter"><span>보기</span><select id="portalListFilter" aria-label="전체 항목 분류 선택">${options.map(([id,label])=>`<option value="${id}" ${portalListFilter===id?'selected':''}>${label} ${counts[id]}건</option>`).join('')}</select></label>`;
}
function portalCompactAllList(w){
  const all=portalAllItemsForList(w);
  const filtered=portalListFilter==='all'?all:all.filter(a=>portalListCategory(a,w)===portalListFilter);
  if(!filtered.length)return '<div class="portal-empty compact-list-empty">선택한 분류에 해당하는 항목이 없습니다.</div>';
  return `<div class="portal-compact-list">${filtered.map(a=>{
    const category=portalListCategory(a,w);
    const label=portalListCategoryLabel(category);
    return `<button type="button" class="portal-compact-item ${category}" data-portal-item="${a.id}" data-portal-category="${category}" title="${esc(a.name)}">
      <span class="compact-status-tag ${category}">${label}</span>
      <strong>${esc(a.name)}</strong>
      <span class="compact-date">${a.end?fmtDate(a.end):a.start?`${fmtDate(a.start)} 시작`:'기한 미정'}</span>
    </button>`;
  }).join('')}</div>`;
}
function portalDetailTabsHTML(){
  const tabs=[['all','전체 항목'],['overdue','기한 경과'],['dueSoon','마감 임박'],['upcoming','예정 일정'],['requests','요청·회신'],['memos','협의사항'],['done','완료']];
  return `<div class="portal-detail-tabs" role="tablist">${tabs.map(([id,label])=>`<button type="button" class="portal-detail-tab ${portalDetailTab===id?'active':''}" data-portal-detail="${id}" role="tab" aria-selected="${portalDetailTab===id?'true':'false'}">${label}</button>`).join('')}</div>`;
}
function portalDetailContent(w){
  if(portalDetailTab==='overdue') return portalTaskList(w.overdue,'기한이 경과한 항목이 없습니다.');
  if(portalDetailTab==='dueSoon') return portalTaskList(w.dueSoon,'7일 이내 마감되는 항목이 없습니다.');
  if(portalDetailTab==='upcoming') return portalTaskList(w.upcoming,'예정된 항목이 없습니다.');
  if(portalDetailTab==='requests') return portalRequestList(w.requests);
  if(portalDetailTab==='memos') return `<div class="portal-detail-action"><button type="button" class="btn secondary" id="publicAddMemo">협의사항 작성</button></div>${portalMemoList(w.memos)}`;
  if(portalDetailTab==='done') return portalTaskList(w.done,'완료 승인된 항목이 없습니다.');
  return portalTaskList(w.items,'등록된 항목이 없습니다.');
}
function portalDistributionHTML(w){
  const overdue=w.overdue.length;
  const dueSoon=w.dueSoon.length;
  const overdueIds=new Set(w.overdue.map(a=>a.id));
  const dueSoonIds=new Set(w.dueSoon.map(a=>a.id));
  const active=w.current.filter(a=>!overdueIds.has(a.id)&&!dueSoonIds.has(a.id)).length;
  const upcoming=w.upcoming.length;
  const done=w.done.length;
  const total=Math.max(1,overdue+dueSoon+active+upcoming+done);
  const parts=[
    ['done','완료',done],['active','진행',active],['soon','마감 임박',dueSoon],['late','기한 경과',overdue],['upcoming','예정',upcoming]
  ];
  return `<div class="portal-visual">
    <div class="portal-visual-head"><div><span>진행 현황</span><strong>전체 ${overdue+dueSoon+active+upcoming+done}건</strong></div><div class="portal-visual-rate">완료 <b>${done}</b>건</div></div>
    <div class="portal-status-bar" aria-label="진행 현황 시각화">${parts.map(([cls,label,count])=>count?`<span class="status-segment ${cls}" style="width:${(count/total*100).toFixed(2)}%" title="${label} ${count}건"></span>`:'').join('')}</div>
    <div class="portal-status-legend">${parts.map(([cls,label,count])=>`<span><i class="legend-dot ${cls}"></i>${label} <strong>${count}</strong></span>`).join('')}</div>
  </div>`;
}
function institutionPortalHTML(name){
  const w=portalActionData(name);
  const focus=w.priority.slice(0,3);
  const hidden=Math.max(0,w.priority.length-focus.length);
  return `<div class="institution-portal">
    ${portalInstitutionTabsHTML(name)}
    <section class="portal-hero">
      <div><span class="portal-kicker">기관 진행현황</span><h2>${esc(name)}</h2><p>현재 진행사항, 일정 및 협업 요청을 확인합니다.</p></div>
      <div class="portal-date"><span>기준일</span><strong>${fmtDate(today())}</strong></div>
    </section>
    <section class="portal-situation">
      <div class="situation-message">${esc(portalStatusMessage(w))}</div>
      <div class="situation-counts" aria-label="빠른 현황 보기">
        <button type="button" class="situation-count-btn ${w.overdue.length?'has-alert':''}" data-portal-jump="overdue"><span>기한 경과</span><strong>${w.overdue.length}</strong><em>건</em></button>
        <button type="button" class="situation-count-btn" data-portal-jump="dueSoon"><span>마감 임박</span><strong>${w.dueSoon.length}</strong><em>건</em></button>
        <button type="button" class="situation-count-btn" data-portal-jump="requests"><span>회신 필요</span><strong>${w.requests.length}</strong><em>건</em></button>
      </div>
    </section>

    <section class="portal-section portal-focus-section"><div class="portal-section-head"><div><h2>현재 주요 진행사항</h2><p>현재 진행 중이거나 기한이 가까운 항목을 표시합니다.</p></div><strong>${w.priority.length}건</strong></div>${portalTaskList(focus,'현재 표시할 주요 진행사항이 없습니다.')}${hidden?`<div class="portal-more-note">추가 ${hidden}건은 아래 전체 항목에서 확인할 수 있습니다.</div>`:''}</section>

    <section class="portal-section portal-request-summary"><div class="portal-section-head"><div><h2>협업 요청</h2><p>현재 회신이 필요한 요청사항입니다.</p></div><strong>${w.requests.length}건</strong></div>${w.requests.length?portalRequestList(w.requests.slice(0,2)):'<div class="portal-empty">현재 회신할 요청사항이 없습니다.</div>'}</section>

    <section class="portal-section portal-list-section"><div class="portal-section-head portal-list-head"><div><h2>전체 항목</h2><p>분류를 선택하면 해당 항목만 목록으로 표시합니다.</p></div>${portalListFilterControl(w)}</div>${portalCompactAllList(w)}</section>

    <section class="portal-section portal-detail-section"><div class="portal-section-head portal-detail-head"><div><h2>상세 현황</h2><p>필요한 분류를 선택하여 세부 내용을 확인합니다.</p></div></div>${portalDetailTabsHTML()}<div class="portal-detail-content">${portalDetailContent(w)}</div></section>
  </div>`;
}
function workboardHTML(){
  const selected=viewFilter.workInstitution || PARTNER_ORDER[0];
  const inst=state.institutions.find(i=>i.name===selected)||state.institutions[0];
  const w=workboardData(inst.name);
  const now=[...w.overdue,...w.dueSoon,...w.active].filter((a,i,arr)=>arr.findIndex(x=>x.id===a.id)===i);
  const next30=w.upcoming.filter(a=>a.startDiff<=30).slice(0,12);
  const responsibilityOpen=w.open.filter(a=>a.owner===inst.name).length;
  const relatedUnowned=w.open.filter(a=>!a.owner && (a.planInstitutions||[]).includes(inst.name)).length;
  return `<div class="workboard-shell">
    <div class="institution-tabs" role="tablist" aria-label="기관 진행항목 선택">
      ${orderedInstitutions().map(i=>`<button type="button" class="institution-tab ${i.name===inst.name?'active':''}" data-work-inst="${esc(i.name)}" role="tab"><span>${esc(i.name)}</span><small>${esc(i.role)}</small></button>`).join('')}
    </div>
    <div class="workboard-hero"><div><div class="eyebrow">기관별 실행현황</div><h2>${esc(inst.name)}</h2><p>현재 주요 진행사항, 마감일, 완료기준, 요청사항 및 회신내용을 확인합니다.</p></div><div class="workboard-asof"><span>기준일</span><strong>${fmtDate(today())}</strong></div></div>
    <div class="work-summary-grid">${metric('지연',w.overdue.length+'건','기한이 지난 항목',w.overdue.length?'bad':'good')}${metric('7일 이내 마감',w.dueSoon.length+'건','마감 임박 항목')}${metric('현재 진행',responsibilityOpen+'건','책임기관으로 수행 중')}${metric('회신 필요',w.requests.length+'건','해당 기관 답변 필요')}${metric('역할 확인',relatedUnowned+'건','책임기관 미확정',relatedUnowned?'bad':'good')}</div>
    <div class="section-title"><div><h2>현재 주요 진행사항</h2><p>기한 경과, 7일 이내 마감, 진행 중 항목 순으로 표시</p></div><span class="tag blue">${now.length}건</span></div>${workList(now,inst.name,'현재 진행 중이거나 7일 이내 마감되는 항목이 없습니다.')}
    <div class="communication-grid"><div><div class="section-title"><div><h2>요청사항 및 기관 회신</h2></div><button class="btn ghost compact-btn" id="newRequestForInst">+ 요청 등록</button></div>${requestMiniList(w.requests)}</div><div><div class="section-title"><div><h2>협의사항</h2></div><button class="btn ghost compact-btn" id="newMemoForInst">+ 메모 등록</button></div><div class="panel">${memoPreviewList(institutionMemoThreads(inst.name),inst.name)}</div></div></div>
    <div class="section-title"><div><h2>향후 30일 예정 일정</h2></div></div>${workList(next30,inst.name,'30일 이내 새로 시작할 일정이 없습니다.')}
  </div>`;
}

function adminPortalLinksHTML(){
  const files={'정션메드':'junctionmed.html','경복대학교 산학협력단':'kyungbok.html','돌봄과 미래':'carefuture.html','에임랩':'aimlab.html'};
  return `<div class="admin-portal-panel admin-portal-compact"><div class="admin-portal-title"><strong>기관 화면 바로가기</strong><span>각 기관에 보이는 화면을 확인합니다.</span></div><div class="admin-portal-links">${PORTAL_ORDER.map(name=>`<a class="admin-portal-link" href="${files[name]}" target="_blank"><strong>${esc(name)}</strong><span>열기 ↗</span></a>`).join('')}</div></div>`;
}
function dashboardHTML(){
  const am=actionMetrics(), km=kpiMetrics();
  return `
  ${adminPortalLinksHTML()}
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
    <div class="panel"><div class="panel-head"><h3>주요 확인사항</h3><span>기준일 ${fmtDate(today())}</span></div>${urgentListHTML(urgentActions())}</div>
  </div>
  <div class="section-title"><div><h2>기관별 현황</h2><p>책임항목·협업항목·지연·회신요청을 한 번에 확인</p></div></div>
  <div class="institution-grid">${orderedInstitutions().map(i=>institutionCard(i)).join('')}</div>`;
}
function metric(label,value,foot,tone=''){return `<div class="metric-card"><div class="metric-label">${label}</div><div class="metric-value">${value}</div><div class="metric-foot ${tone}">${foot}</div></div>`;}
function institutionCard(i){const s=institutionStats(i.name);return `<div class="institution-card" data-inst="${esc(i.name)}"><span class="role">${esc(i.role)}</span><h3>${esc(i.name)}</h3><div class="mini-stats"><div class="mini-stat"><strong>${s.responsibility}</strong><span>책임항목</span></div><div class="mini-stat"><strong>${s.late}</strong><span>지연</span></div><div class="mini-stat"><strong>${s.req}</strong><span>회신필요</span></div></div></div>`;}
function urgentListHTML(items){if(!items.length)return '<div class="empty">현재 14일 이내 마감 또는 지연 항목이 없습니다.</div>';return `<div class="alert-list">${items.map(a=>`<div class="alert-row" data-action="${a.id}"><div>${a.diff<0?'<span class="tag bad">지연 '+Math.abs(a.diff)+'일</span>':a.diff===0?'<span class="tag warn">오늘 마감</span>':'<span class="tag warn">D-'+a.diff+'</span>'}</div><div class="name">${esc(a.name)}<div class="cell-sub">${esc(ownerDisplay(a.owner))}</div></div><div>${statusTag(a.status)}</div><div class="${a.diff<0?'date-bad':'date-warn'}">${fmtDate(a.end)}</div></div>`).join('')}</div>`;}

function kpisHTML(){
  const cats=['전체',...new Set(state.kpis.map(x=>x.category))];
  return `<div class="toolbar"><input class="input search" id="kpiSearch" placeholder="성과지표 검색"><select class="select filter-select" id="kpiCategory">${cats.map(c=>`<option>${esc(c)}</option>`).join('')}</select><select class="select filter-select" id="kpiStatus"><option>전체 상태</option>${KPI_STATUS_OPTIONS.map(s=>`<option>${s}</option>`).join('')}</select></div><div class="kpi-grid" id="kpiGrid">${renderKpiCards(state.kpis)}</div>`;
}
function renderKpiCards(items){return items.map(k=>`<div class="kpi-card" data-kpi="${k.id}" data-cat="${esc(k.category)}" data-status="${esc(k.status)}" data-search="${esc((k.name+' '+k.target).toLowerCase())}"><span class="tag blue">${esc(k.category)}</span><h3>${esc(k.name)}</h3><div class="kpi-target">${esc(k.target)}</div><div class="kpi-bottom"><div><div class="kpi-progress">${pct(k.progress)===null?'—':pct(k.progress)+'%'}</div><div class="cell-sub">${statusTag(k.status)}</div></div><div class="kpi-owner">책임기관<br><strong>${esc(ownerDisplay(k.owner))}</strong></div></div></div>`).join('');}

function institutionsHTML(){
  const selected=viewFilter.institution || PARTNER_ORDER[0];
  const inst=state.institutions.find(i=>i.name===selected)||state.institutions[0];
  const s=institutionStats(inst.name);
  const responsible=state.actions.filter(a=>a.owner===inst.name);
  const collab=state.actions.filter(a=>(a.collaborators||[]).includes(inst.name));
  const relatedKpi=state.kpis.filter(k=>k.owner===inst.name||(k.collaborators||[]).includes(inst.name));
  return `<div class="institution-grid">${orderedInstitutions().map(i=>institutionCard(i)).join('')}</div>
  <div class="section-title"><div><h2>${esc(inst.name)} 상세</h2><p>${esc(inst.role)} · 책임항목 ${s.responsibility}건 · 협업항목 ${s.collab}건</p></div></div>
  <div class="metric-grid">${metric('책임 실행과제',s.responsibility+'건','완료 책임')}${metric('협업 실행과제',s.collab+'건','지원·검토')}${metric('지연',s.late+'건','책임항목 기준',s.late?'bad':'good')}${metric('회신 필요',s.req+'건','협업요청 수신')}${metric('관련 성과목표',relatedKpi.length+'개','책임 또는 협업')}</div>
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
  if(document.getElementById('newRequestForInst')) document.getElementById('newRequestForInst').onclick=()=>openRequest(null, viewFilter.workInstitution || PARTNER_ORDER[0]);
  if(document.getElementById('newMemoForInst')) document.getElementById('newMemoForInst').onclick=()=>openMemo(null, viewFilter.workInstitution || PARTNER_ORDER[0]);
  if(document.getElementById('addMemo')) document.getElementById('addMemo').onclick=()=>openMemo();
  if(document.getElementById('memoInstitutionFilter')) document.getElementById('memoInstitutionFilter').onchange=e=>{viewFilter.memoInstitution=e.target.value;render();};
  if(document.getElementById('saveProjectSetting')) document.getElementById('saveProjectSetting').onclick=()=>{state.project.asOf=document.getElementById('asOfSetting').value;saveState();toast('기준일을 저장했습니다.');render();};
  if(document.getElementById('exportJson')) document.getElementById('exportJson').onclick=exportJson;
  if(document.getElementById('importJson')) document.getElementById('importJson').onclick=()=>document.getElementById('importInput').click();
  if(document.getElementById('resetData')) document.getElementById('resetData').onclick=()=>{if(confirm('현재 수정 데이터를 모두 지우고 초기 상태로 복원할까요?')){state=clone(window.INITIAL_DATA);normalizeInstitutionOrder();saveState();render();toast('초기 데이터로 복원했습니다.');}};
}
function bindInstitutionPortalEvents(){
  document.querySelectorAll('[data-portal-inst]').forEach(b=>b.onclick=()=>{
    portalInstitution=b.dataset.portalInst;portalDetailTab='all';portalListFilter='all';
    const code=INSTITUTION_CODE[portalInstitution]||'main';
    history.replaceState(null,'',`index.html?inst=${encodeURIComponent(code)}`);
    render();window.scrollTo({top:0,behavior:'smooth'});
  });
  document.querySelectorAll('[data-portal-detail]').forEach(b=>b.onclick=()=>{portalDetailTab=b.dataset.portalDetail;render();setTimeout(()=>document.querySelector('.portal-detail-section')?.scrollIntoView({behavior:'smooth',block:'start'}),20);});
  const portalListFilterEl=document.getElementById('portalListFilter');if(portalListFilterEl)portalListFilterEl.onchange=()=>{portalListFilter=portalListFilterEl.value;render();setTimeout(()=>document.querySelector('.portal-list-section')?.scrollIntoView({behavior:'smooth',block:'start'}),20);};
  document.querySelectorAll('[data-portal-jump]').forEach(b=>b.onclick=()=>{portalDetailTab=b.dataset.portalJump;render();setTimeout(()=>document.querySelector('.portal-detail-section')?.scrollIntoView({behavior:'smooth',block:'start'}),20);});
  document.querySelectorAll('[data-portal-item]').forEach(b=>b.onclick=()=>{const id=b.dataset.portalItem;const category=b.dataset.portalCategory||'active';portalDetailTab=category==='overdue'?'overdue':category==='dueSoon'?'dueSoon':category==='upcoming'?'upcoming':category==='done'?'done':'all';render();setTimeout(()=>{const target=document.querySelector(`[data-portal-action="${id}"]`);(target||document.querySelector('.portal-detail-section'))?.scrollIntoView({behavior:'smooth',block:'center'});if(target){target.classList.add('portal-task-flash');setTimeout(()=>target.classList.remove('portal-task-flash'),1100);}},30);});
  document.querySelectorAll('[data-public-request]').forEach(b=>b.onclick=()=>openInstitutionRequest(b.dataset.publicRequest,portalInstitution));
  document.querySelectorAll('[data-public-memo]').forEach(b=>b.onclick=()=>openInstitutionMemo(b.dataset.publicMemo,portalInstitution));
  const add=document.getElementById('publicAddMemo');if(add)add.onclick=()=>openInstitutionMemo(null,portalInstitution);
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
  openDrawer(isNew?'NEW MEMO':m.id,isNew?'협의사항 등록':m.title,`<div class="form-field"><label>메모 제목</label><input class="input" id="mTitle" value="${esc(m.title)}"></div><div class="form-grid"><div class="form-field"><label>관련 기관</label><select class="select" id="mInstitution"><option value="">기관 선택</option>${state.institutions.map(i=>`<option value="${esc(i.name)}" ${i.name===m.institution?'selected':''}>${esc(i.name)}</option>`).join('')}</select></div><div class="form-field"><label>상태</label><select class="select" id="mStatus"><option ${m.status==='진행'?'selected':''}>진행</option><option ${m.status==='확인 완료'?'selected':''}>확인 완료</option><option ${m.status==='보류'?'selected':''}>보류</option></select></div></div><div class="form-field"><label>관련 실행과제</label><select class="select" id="mAction"><option value="">미연결</option>${state.actions.map(a=>`<option value="${esc(a.id)}" ${a.id===m.relatedAction?'selected':''}>${esc(a.id+' · '+a.name)}</option>`).join('')}</select></div>${isNew?'':`<div class="drawer-section-divider"><span>소통 기록</span></div><div class="message-thread">${messages}</div>`}<div class="drawer-section-divider"><span>${isNew?'첫 메모':'답변·추가 메모'}</span></div><div class="form-grid"><div class="form-field"><label>작성기관</label><select class="select" id="mAuthorInstitution">${state.institutions.map(i=>`<option value="${esc(i.name)}" ${i.name===(isNew?'정션메드':(defaultInstitution||m.institution))?'selected':''}>${esc(i.name)}</option>`).join('')}</select></div><div class="form-field"><label>작성일</label><input type="date" class="input" id="mDate" value="${today()}"></div></div><div class="form-field"><label>내용</label><textarea class="textarea response-textarea" id="mText" placeholder="확인사항, 협의내용, 답변, 후속조치를 입력"></textarea></div><div class="drawer-actions"><button class="btn secondary" id="closeMemo">취소</button><button class="btn primary" id="saveMemo">${isNew?'등록':'답변 저장'}</button></div>`);
  document.getElementById('closeMemo').onclick=closeDrawer;
  document.getElementById('saveMemo').onclick=()=>{m.title=document.getElementById('mTitle').value.trim();m.institution=document.getElementById('mInstitution').value;m.status=document.getElementById('mStatus').value;m.relatedAction=document.getElementById('mAction').value;const text=document.getElementById('mText').value.trim();if(!m.title){alert('메모 제목을 입력하세요.');return;}if(!m.institution){alert('관련 기관을 선택하세요.');return;}if(isNew && !text){alert('메모 내용을 입력하세요.');return;}if(text){m.messages=m.messages||[];m.messages.push({authorInstitution:document.getElementById('mAuthorInstitution').value,date:document.getElementById('mDate').value,text});}if(isNew){state.memos=state.memos||[];state.memos.push(m);}saveState();closeDrawer();render();toast(isNew?'협의사항을 등록했습니다.':'답변을 저장했습니다.');};
}

function openInstitutionRequest(id,institution){
  const r=state.requests.find(x=>x.id===id);if(!r||r.to!==institution)return;
  openDrawer('REQUEST',r.title,`<div class="public-drawer-readonly"><span>요청사항</span><p>${esc(r.content||'')}</p><div><strong>회신기한</strong> ${r.due?fmtDate(r.due):'미정'}</div></div><div class="drawer-section-divider"><span>기관 회신</span></div><div class="form-field"><label>회신내용</label><textarea class="textarea response-textarea" id="publicResponse" placeholder="처리현황, 완료예정일, 확인내용을 입력">${esc(r.response||'')}</textarea></div><div class="form-field"><label>회신일</label><input type="date" class="input" id="publicResponseDate" value="${r.responseDate||today()}"></div>${r.confirmation?`<div class="public-confirm-readonly"><span>정션메드 확인</span><p>${esc(r.confirmation)}</p></div>`:''}<div class="drawer-actions"><button class="btn secondary" id="publicReqCancel">취소</button><button class="btn primary" id="publicReqSave">회신 저장</button></div>`);
  document.getElementById('publicReqCancel').onclick=closeDrawer;
  document.getElementById('publicReqSave').onclick=()=>{const text=document.getElementById('publicResponse').value.trim();if(!text){alert('회신내용을 입력해 주십시오.');return;}r.response=text;r.responseDate=document.getElementById('publicResponseDate').value||today();if(['요청','수신 확인','처리 중','기한 초과'].includes(r.status))r.status='답변 완료';saveState();closeDrawer();render();toast('회신을 저장했습니다.');};
}
function openInstitutionMemo(id,institution){
  let m=id?(state.memos||[]).find(x=>x.id===id):null;const isNew=!m;
  if(m && m.institution!==institution)return;
  if(!m)m={id:'MEM-'+String((state.memos||[]).length+1).padStart(3,'0'),title:'',institution,relatedAction:'',status:'진행',messages:[]};
  const messages=(m.messages||[]).map(msg=>`<div class="message-item ${msg.authorInstitution==='정션메드'?'pm-message':''}"><div class="message-meta"><strong>${esc(msg.authorInstitution||'-')}</strong><span>${msg.date?fmtDate(msg.date):'-'}</span></div><p>${esc(msg.text||'')}</p></div>`).join('')||'<div class="portal-empty">아직 등록된 내용이 없습니다.</div>';
  openDrawer(isNew?'NEW MEMO':m.id,isNew?'협의사항 작성':m.title,`${isNew?`<div class="form-field"><label>제목</label><input class="input" id="publicMemoTitle" placeholder="협의 또는 확인할 사항"></div>`:`<div class="message-thread">${messages}</div>`}<div class="drawer-section-divider"><span>${isNew?'메모 내용':'답변·추가 메모'}</span></div><div class="form-field"><label>내용</label><textarea class="textarea response-textarea" id="publicMemoText" placeholder="확인사항 또는 답변을 입력"></textarea></div><div class="drawer-actions"><button class="btn secondary" id="publicMemoCancel">취소</button><button class="btn primary" id="publicMemoSave">저장</button></div>`);
  document.getElementById('publicMemoCancel').onclick=closeDrawer;
  document.getElementById('publicMemoSave').onclick=()=>{const text=document.getElementById('publicMemoText').value.trim();const title=isNew?document.getElementById('publicMemoTitle').value.trim():m.title;if(!title){alert('제목을 입력해 주십시오.');return;}if(!text){alert('내용을 입력해 주십시오.');return;}m.title=title;m.institution=institution;m.messages=m.messages||[];m.messages.push({authorInstitution:institution,date:today(),text});if(isNew){state.memos=state.memos||[];state.memos.push(m);}saveState();closeDrawer();render();toast('협의사항을 저장했습니다.');};
}
function showAdminLogin(){
  const bg=document.getElementById('loginBackdrop');bg.classList.add('show');bg.setAttribute('aria-hidden','false');const input=document.getElementById('adminPassword');input.value='';document.getElementById('loginError').textContent='';setTimeout(()=>input.focus(),50);
}
function hideAdminLogin(){const bg=document.getElementById('loginBackdrop');bg.classList.remove('show');bg.setAttribute('aria-hidden','true');}
function submitAdminLogin(){
  if(document.getElementById('adminPassword').value===ADMIN_PASSWORD){sessionStorage.setItem('ax-sprint-admin-v14','1');isAdmin=true;currentView='dashboard';hideAdminLogin();render();toast('관리자 화면으로 전환했습니다.');}
  else{document.getElementById('loginError').textContent='비밀번호가 일치하지 않습니다.';document.getElementById('adminPassword').select();}
}
function exitAdmin(){sessionStorage.removeItem('ax-sprint-admin-v14');sessionStorage.removeItem('ax-sprint-admin-v11');sessionStorage.removeItem('ax-sprint-admin-v10');sessionStorage.removeItem('ax-sprint-admin-v9');sessionStorage.removeItem('ax-sprint-admin-v8');sessionStorage.removeItem('ax-sprint-admin-v7');isAdmin=false;currentView='portal';render();window.scrollTo({top:0,behavior:'smooth'});}

function exportJson(){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='AX_Sprint_Control_Tower_backup.json';a.click();URL.revokeObjectURL(a.href);}
document.getElementById('importInput').addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;const reader=new FileReader();reader.onload=()=>{try{state=JSON.parse(reader.result);saveState();render();toast('백업 데이터를 불러왔습니다.');}catch(err){alert('올바른 JSON 백업 파일이 아닙니다.');}};reader.readAsText(f);e.target.value='';});
document.getElementById('drawerClose').onclick=closeDrawer;
document.getElementById('drawerBackdrop').onclick=closeDrawer;
document.getElementById('quickAddBtn').onclick=()=>{if(isAdmin)openAction();};
document.getElementById('pmUpdateBtn').onclick=()=>{if(isAdmin){currentView='requests';render();}};
document.getElementById('adminAccessBtn').onclick=()=>{if(isAdmin)exitAdmin();else showAdminLogin();};
document.getElementById('loginClose').onclick=hideAdminLogin;
document.getElementById('loginBackdrop').onclick=e=>{if(e.target.id==='loginBackdrop')hideAdminLogin();};
document.getElementById('loginSubmit').onclick=submitAdminLogin;
document.getElementById('adminPassword').addEventListener('keydown',e=>{if(e.key==='Enter')submitAdminLogin();});
if(urlParams.get('admin')==='1'&&!isAdmin)setTimeout(showAdminLogin,100);
render();
