let libraryView = 'timeline';
try { libraryView = localStorage.getItem('journal-view') || 'timeline'; } catch {}
let randomId, pageLimit = 36;
function historyOrder(a,b) {
  return b.date.localeCompare(a.date) || String(b.created_at||'').localeCompare(String(a.created_at||'')) || b.id.localeCompare(a.id);
}
function eventLink(r,label) {
  return '<button class="recent-item" data-event="'+escape(r.id)+'">'+poster(r)+'<span><strong>'+escape(label||r.title)+'</strong><small>'+escape([r.date||'日期未知',r.method,people(r),locationText(r)].filter(Boolean).join(' · '))+'</small></span></button>';
}
function renderLibrary(filtered) {
  renderHomeCalendar();
  if($('#work').open)openWork($('#work').dataset.id);
  const active=records.filter(r=>!r.deleted_at).sort(historyOrder);
  const today=new Date().toLocaleDateString('sv-SE');
  const year=today.slice(0,4);
  const metrics=[['all','累计观影',active.length],['year','今年观影',active.filter(r=>r.date.startsWith(year)).length],['cinema','影院观影',active.filter(r=>r.method==='影院').length]];
  $('#metrics').title='累计按实际观看场次计算，重温另计一场。今年按观影年份统计，影院仅计观看方式为影院的记录。';
  $('#metrics').innerHTML=metrics.map(([id,label,n])=>'<button data-metric="'+id+'"><strong>'+n+'</strong>'+label+'</button>').join('');
  $('#recent').innerHTML=active.length?'<h2>最近观影</h2><div class="recent-grid">'+active.slice(0,6).map(r=>eventLink(r)).join('')+'</div>':'<button class="secondary" data-action="new">记下第一场观影</button>';
  const anniversaries=active.filter(r=>r.date.length===10 && r.date.slice(0,4)<year && r.date.slice(5)===today.slice(5));
  $('#memories').closest('details').hidden=!active.length;
  const sameDay=anniversaries.map(r=>eventLink(r)+ (r.memory?'<p>'+escape(r.memory)+'</p>':'')).join('');
  if(!active.some(r=>r.id===randomId)) randomId=active[Math.floor(Math.random()*active.length)]?.id;
  const random=active.find(r=>r.id===randomId);
  $('#memories').innerHTML=(sameDay?'<h2>那年今日</h2>'+sameDay:'')+(random?'<h2>随机拾忆</h2>'+eventLink(random)+(random.memory?'<p>'+escape(random.memory)+'</p>':'')+(active.length>1?'<button id="shuffle" class="secondary">换一段</button>':'<small>目前只有这一场回忆</small>'):'');
  const wall=libraryView==='wall' && !managing;
  $('#wall').hidden=!wall;
  $('#timeline').hidden=wall && filtered.length>0;
  $('#switch-view').textContent=wall?'时间线':'海报墙';
  $('#switch-view').setAttribute('aria-label',wall?'切换到时间线':'切换到海报墙');
  $('#switch-view').disabled=managing;
  const grouped=new Map(), totals=new Map();
  for(const r of active){const id=JournalArchive.movieId(r);totals.set(id,(totals.get(id)||0)+1);}
  for(const r of filtered){const id=JournalArchive.movieId(r);if(!grouped.has(id))grouped.set(id,[]);grouped.get(id).push(r);}
  $('#wall').innerHTML=wall?[...grouped].slice(0,pageLimit).map(([id,rows])=>{
    const r=rows[0],total=totals.get(id);
    return '<button class="work-card" data-work="'+escape(id)+'">'+poster(r)+'<strong>'+escape(r.title)+'</strong><small>'+escape(r.date||'日期未知')+' · '+(total===rows.length?total+' 场':'匹配 '+rows.length+' / 共 '+total+' 场')+'</small></button>';
  }).join(''):'';
  $('#more-items').hidden=(wall?grouped.size:filtered.length)<=pageLimit;
}
function openWork(id){
  const rows=records.filter(r=>!r.deleted_at && JournalArchive.movieId(r)===id).sort(historyOrder);
  const r=rows[0];if(!r){if($('#work').open)$('#work').close();return;}
  const known=rows.filter(row=>row.date);
  $('#work-content').innerHTML='<div class="dialog-heading"><h2>'+escape(r.title)+'</h2><button data-close aria-label="关闭">×</button></div><div class="detail-top">'+poster(r)+'<div>'+escape([r.originalTitle,r.year,r.kind,r.director,...(r.genres||[])].filter(Boolean).join(' · '))+'</div></div>'+overviewMarkup(r)+workFacts(r)+manualMetadataControl(r)+'<p>共 '+rows.length+' 场'+(known.length?' · 首次 '+escape(known.at(-1).date)+' · 最近 '+escape(known[0].date):'')+'</p><button class="primary" data-rewatch="'+escape(r.id)+'">再看一次</button><h3>'+(rows.length>1?'重温历程':'观影记录')+'</h3>'+rows.map((v,i)=>eventLink(v,'第 '+(rows.length-i)+' 场 · '+(v.rating==null?'未评分':v.rating+'/5 分'))+'<p>'+escape([locationText(v),v.memory||v.review].filter(Boolean).join(' · '))+'</p>').join('');
  $('#work').dataset.id=id;
  if(!$('#work').open)$('#work').showModal();
}
document.addEventListener('click',event=>{
  const b=event.target.closest('button');if(!b)return;
  if(b.id==='switch-view'){libraryView=libraryView==='wall'?'timeline':'wall';try{localStorage.setItem('journal-view',libraryView);}catch{} render();}
  if(b.id==='more-items'){pageLimit+=36;render();}
  if(b.id==='shuffle'){const pool=records.filter(r=>!r.deleted_at && r.id!==randomId);if(pool.length)randomId=pool[Math.floor(Math.random()*pool.length)].id;render();}
  if(b.dataset.work)openWork(b.dataset.work);
  if(b.dataset.event)showDetail(b.dataset.event);
  if(b.dataset.rewatch){
    const r=records.find(row=>row.id===b.dataset.rewatch);if(!r)return;

    $('#work').close();showEditor();
    selectedMovie={...r,movie_id:JournalArchive.movieId(r)};$('#record-form').elements.kind.value=r.kind||'电影';$('#movie-title').value=r.title;renderSelected();
  }
  if(b.dataset.metric){
    query='';$('#search').value='';filter=b.dataset.metric==='cinema'?'影院':'全部';$('#year-filter').value=b.dataset.metric==='year'?new Date().getFullYear():'';
    $('#rating-filter').value='';selectedKind='';selection.clear();render();location.hash='library';
  }
});
