function readCatalog(archive={}) {
  const catalog={};
  for(const key of ['people','places','collections']){
    const list=archive[key]??[];
    if(!Array.isArray(list)||list.some(x=>!x||typeof x.id!=='string'||typeof x.name!=='string')||new Set(list.map(x=>x.id)).size!==list.length)throw Error('整理资料格式有误');
    catalog[key]=list;
  }
  for(const c of catalog.collections)if(!Array.isArray(c.items)||c.items.some(x=>typeof x?.movie!=='string'||typeof x.title!=='string'))throw Error('片单格式有误');
  return catalog;
}
let catalog=readCatalog();
function mergeCatalog(incoming){
  const extra=readCatalog(incoming), merged={};
  for(const key of Object.keys(catalog)){
    const known=new Set(catalog[key].map(x=>x.id));
    merged[key]=[...catalog[key],...extra[key].filter(x=>!known.has(x.id))];
  }
  return merged;
}
function annualSummary(all,year){
  const active=all.filter(r=>!r.deleted_at),rows=active.filter(r=>r.date.slice(0,4)===year);
  const months=Array(12).fill(0),genres=new Map(),best=new Map(),history=new Map();
  let minutes=0,covered=0,estimated=0,repeat=0,uncertain=0;
  for(const r of active){const id=JournalArchive.movieId(r);if(!history.has(id))history.set(id,[]);history.get(id).push(r);}
  for(const r of rows){
    if(r.date.length>=7)months[Number(r.date.slice(5,7))-1]++;
    const id=JournalArchive.movieId(r),others=history.get(id).filter(x=>x.id!==r.id);
    const earlier=others.some(x=>x.date && (x.date.slice(0,Math.min(x.date.length,r.date.length))<r.date.slice(0,Math.min(x.date.length,r.date.length)) || (x.date===r.date && r.date.length===10 && historyOrder(x,r)>0)));
    if(earlier)repeat++;
    else if(others.some(x=>!x.date || ((r.date.startsWith(x.date)||x.date.startsWith(r.date)) && !(x.date===r.date && r.date.length===10))))uncertain++;
    let duration=Number(r.duration_minutes);
    if(!(duration>0) && (r.kind||'电影')==='电影' && Number(r.runtime)>0){duration=Number(r.runtime);estimated++;}
    if(duration>0){minutes+=duration;covered++;}
    for(const g of new Set(Array.isArray(r.genres)?r.genres:[]))genres.set(g,(genres.get(g)||0)+1);
    const prev=best.get(id);
    if(r.rating!=null && (!prev || r.rating>prev.rating || (r.rating===prev.rating && historyOrder(r,prev)<0)))best.set(id,r);
  }
  return {rows,months,genres:[...genres].sort((a,b)=>b[1]-a[1]),best:[...best.values()].sort((a,b)=>b.rating-a.rating||historyOrder(a,b)),works:new Set(rows.map(JournalArchive.movieId)).size,cinema:rows.filter(r=>r.method==='影院').length,minutes,covered,estimated,repeat,uncertain,unknown:active.filter(r=>!r.date).length};
}
function cityName(place){return place?.city?.trim()?[place.country,place.region,place.city].filter(Boolean).join(' / '):'未归类';}
function annualPanel(){
  const now=new Date(),year=studioYear,report=annualSummary(records,year);
  const years=[...new Set([String(now.getFullYear()),...records.filter(r=>!r.deleted_at&&r.date).map(r=>r.date.slice(0,4))])].sort().reverse();
  const freq=new Map();
  for(const r of report.rows){
    const labels=(r.person_ids||[]).map(id=>catalog.people.find(p=>p.id===id)?.name).filter(Boolean);
    if(!labels.length && r.people && r.people!=='独自' && r.companion_mode!=='独自')labels.push(r.people);
    const city=cityName(catalog.places.find(p=>p.id===r.place_id));
    if(city!=='未归类')labels.push(city);
    for(const label of labels)freq.set(label,(freq.get(label)||0)+1);
  }
  return '<label>报告年份<select id="report-year">'+years.map(y=>option(y,y,year)).join('')+'</select></label>'+
    (year===String(now.getFullYear())?'<p>截至今日 · '+escape(now.toLocaleDateString('zh-CN'))+'</p>':'')+
    (report.rows.length?'<div class="report-grid">'+[['场观影',report.rows.length],['部作品',report.works],['场影院',report.cinema],['次可确认重温',report.repeat]].map(([label,n])=>'<div><b>'+n+'</b>'+label+'</div>').join('')+'</div><h3>每月观影</h3><div class="month-bars">'+report.months.map((n,i)=>'<div><small>'+n+'</small><i style="height:'+Math.round(4+42*n/Math.max(1,...report.months))+'px"></i><small>'+(i+1)+'月</small></div>').join('')+'</div><p>仅知年份 '+report.rows.filter(r=>r.date.length===4).length+' 场。已知时长 '+report.minutes+' 分钟，覆盖 '+report.covered+' 场，其中 '+report.estimated+' 场按电影片长估算。重温顺序待定 '+report.uncertain+' 场。</p><h3>作品类型</h3><p>'+escape(report.genres.map(([g,n])=>g+' '+n+' 场').join(' · ')||'暂无类型资料')+'</p><h3>年度高评分</h3>'+report.best.slice(0,5).map(r=>eventLink(r,r.title+' · '+r.rating+'/5')).join('')+'<h3>同行人与城市</h3><p>'+escape([...freq].sort((a,b)=>b[1]-a[1]).slice(0,8).map(([s,n])=>s+' '+n+' 场').join(' · ')||'暂无记录')+'</p>':'<p>这一年还没有观影记录。</p>')+'<p>另有 '+report.unknown+' 场日期未知。</p><label><input type="checkbox" id="share-titles">分享图包含高评分片名</label><button class="secondary" id="preview-png">预览年度分享图</button><div id="png-result"></div>';
}
function shareImage(){
  const r=annualSummary(records,studioYear),titles=$('#share-titles').checked?r.best.slice(0,5):[];
  const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1050+titles.length*100;
  const c=canvas.getContext('2d');c.fillStyle='#f5f6eb';c.fillRect(0,0,canvas.width,canvas.height);
  c.fillStyle='#475b3b';c.font='40px sans-serif';c.fillText('观影手记   /   年度报告',72,115);
  c.font='110px serif';c.fillText(studioYear,68,275);c.font='48px sans-serif';
  [r.rows.length+' 场观影',r.works+' 部作品',r.cinema+' 次走进影院',r.repeat+' 次可确认重温',r.minutes+' 分钟已知时长'].forEach((s,i)=>c.fillText(s,72,395+108*i));
  c.font='36px sans-serif';titles.forEach((v,i)=>c.fillText(v.title+'   '+v.rating+'/5',72,1000+i*100,930));
  c.font='28px serif';c.fillText('电影散场，回忆留下。',72,canvas.height-40);
  const area=$('#png-result');area.replaceChildren(canvas);const a=document.createElement('a');a.href=canvas.toDataURL('image/png');a.download=studioYear+'-观影报告.png';a.textContent='下载这张 PNG';area.append(a);
}

