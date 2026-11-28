let studioTab='年度报告',studioYear=String(new Date().getFullYear()),studioMonth=new Date().toLocaleDateString('sv-SE').slice(0,7);
let entityType='people',entityId='',eventId='',collectionId='',dayFilter='',cityFilter='';
const option=(value,label,current)=>'<option value="'+escape(value)+'"'+(current===value?' selected':'')+'>'+escape(label)+'</option>';
const activeEvents=()=>records.filter(r=>!r.deleted_at).sort(historyOrder);
function picker(id,label,options){return '<label>'+label+'<select id="'+id+'">'+options+'</select></label>';}
function field(id,label,value=''){return '<label>'+label+'<input id="'+id+'" maxlength="200" value="'+escape(value)+'"></label>';}
function button(id,label){return '<button class="secondary" id="'+id+'">'+label+'</button>';}
function personLinks(r){return Array.isArray(r.person_ids)?r.person_ids:[];}
function linked(r,id){return entityType==='people'?personLinks(r).includes(id):r.place_id===id;}
function placeLabel(p){return [p.name,p.city,p.region,p.country].filter(Boolean).join(' · ');}
function organizePanel(){
  const rows=activeEvents(), list=catalog[entityType],item=list.find(x=>x.id===entityId),places=entityType==='places';
  const current=rows.find(x=>x.id===eventId)||rows[0],name=x=>places?placeLabel(x):x.name;
  let html=picker('entity-id','档案',option('','新建档案',entityId)+list.map(x=>option(x.id,name(x),entityId)).join(''))+field('entity-name','名称',item?.name);
  if(places)html+=picker('place-type','地点类型',['影院','家','其他'].map(t=>option(t,t,item?.type||'其他')).join(''))+field('place-city','城市',item?.city)+field('place-region','省 / 行政区',item?.region)+field('place-country','国家 / 地区',item?.country);
  html+=button('save-entity',item?'保存档案':'创建档案');
  if(item){
    html+=button('remove-entity','解除关联并删除档案')+'<h3>关联的观影</h3>'+rows.filter(r=>linked(r,item.id)).map(r=>eventLink(r)).join('');
    if(list.length>1)html+=picker('merge-target','合并到已有档案',list.filter(x=>x.id!==item.id).map(x=>option(x.id,name(x))).join(''))+button('merge-entity','预览合并');
  }
  if(!current)return html;
  html+='<h3>整理一场观影</h3>'+picker('link-event','选择观影',rows.map(r=>option(r.id,(linked(r,item?.id)&&item?'已关联 · ':'')+r.title+' · '+(r.date||'日期未知'),current.id)).join(''))+'<p>原记录 · '+escape([current.people,current.place].filter(Boolean).join(' / ')||'未填写')+'</p>';
  if(places)html+=picker('link-place','关联地点',option('','待整理',current.place_id)+list.map(p=>option(p.id,placeLabel(p),current.place_id)).join(''));
  else html+=picker('link-mode','同行情况',['待整理','独自','与人同行'].map(s=>option(s,s,current.companion_mode||'待整理')).join(''))+'<div class="choices">'+list.map(p=>'<label><input type="checkbox" name="link-person" value="'+escape(p.id)+'"'+(personLinks(current).includes(p.id)?' checked':'')+'>'+escape(p.name)+'</label>').join('')+'</div>';
  return html+button('save-links','保存这场的关联');
}
function collectionPanel(){
  const rows=activeEvents(), works=new Map(rows.map(r=>[JournalArchive.movieId(r),r]));
  const c=catalog.collections.find(x=>x.id===collectionId);
  let html=picker('collection-id','私人电影集',option('','新建电影集',collectionId)+catalog.collections.map(x=>option(x.id,x.name,collectionId)).join(''))+
    field('collection-name','电影集名称',c?.name)+field('collection-desc','收录主题',c?.description)+button('save-collection',c?'保存修改':'创建电影集');
  if(!c)return html;
  const cover=c.items.find(i=>i.movie===c.cover);
  html+=(cover&&works.has(cover.movie)?poster(works.get(cover.movie)):'<p class="collection-cover">映 · '+escape(c.name)+'</p>')+button('remove-collection','删除电影集')+'<h3>收录作品</h3>';
  for(const [i,item] of c.items.entries()){
    const memory=rows.find(r=>r.id===item.event && JournalArchive.movieId(r)===item.movie);
    html+='<section class="collection-item"><strong>'+escape(item.title)+'</strong><p>'+escape(item.reason||'')+'</p>'+(memory?eventLink(memory):'')+
      ['前移','设为封面','移出'].map(action=>'<button class="secondary" data-item="'+i+'" data-item-action="'+action+'">'+action+'</button>').join('')+'</section>';
  }
  const available=[...works].filter(([id])=>!c.items.some(i=>i.movie===id));
  if(available.length)html+=picker('add-work','选择作品',available.map(([id,r])=>option(id,r.title)).join(''))+picker('add-memory','关联一次观看','')+field('collection-reason','收录理由')+button('insert-work','加入电影集');
  else html+='<p>'+ (works.size?'片库作品均已收录。':'记下一场观影后可以收录作品。')+'</p>';
  return html;
}
function memoryChoices(){
  if(!$('#add-work'))return;
  $('#add-memory').innerHTML=option('','只收录作品')+activeEvents().filter(r=>JournalArchive.movieId(r)===$('#add-work').value).map(r=>option(r.id,(r.date||'日期未知')+' · '+(r.memory||r.title))).join('');
}
function calendarPanel(){
  const rows=activeEvents(),month=studioMonth,dated=rows.filter(r=>r.date.startsWith(month)),first=new Date(month+'-01T12:00:00'),days=new Date(first.getFullYear(),first.getMonth()+1,0).getDate();
  let grid=['一','二','三','四','五','六','日'].map(s=>'<small>'+s+'</small>').join('')+'<i></i>'.repeat((first.getDay()+6)%7);
  for(let i=1;i<=days;i++){
    const date=month+'-'+String(i).padStart(2,'0'),n=dated.filter(r=>r.date===date).length;
    grid+='<button aria-label="'+date+'，'+n+' 场" aria-pressed="'+(date===dayFilter)+'" data-day="'+date+'" '+(n?'':'disabled')+'>'+i+(n?'<b>'+n+'场</b>':'')+'</button>';
  }
  return '<div class="month-control"><button aria-label="上个月" data-month-step="-1">‹</button><input id="cal-month" aria-label="日历月份" type="month" value="'+month+'"><button aria-label="下个月" data-month-step="1">›</button></div><div class="calendar-grid">'+grid+'</div><p class="month-summary">本月 '+dated.length+' 场'+(dated.some(r=>r.date.length===7)?'（含仅知月份的记录）':'')+'</p>'+dated.filter(r=>r.date===dayFilter).map(r=>eventLink(r)).join('')+
    (rows.some(r=>r.date.length!==10)?'<details><summary>日期不完整的观影</summary>'+rows.filter(r=>r.date.length!==10).map(r=>eventLink(r)).join('')+'</details>':'');
}
function renderHomeCalendar(){
  const today=new Date().toLocaleDateString('sv-SE');
  const rows=activeEvents();
  const last=rows.find(r=>r.date.length===10 && r.date<=today);
  let label=rows.length?'补上具体日期后，就能看到距上次观影的天数。':'记下第一场观影，日子就会出现在这里。';
  if(last){
    const days=Math.round((Date.parse(today)-Date.parse(last.date))/86400000);
    const incomplete=rows.some(r=>r.date.length!==10 && (!r.date || r.date>=last.date.slice(0,r.date.length)));
    label=(incomplete?'最近有确切日期的一场':'上次观影')+' · '+(days===0?'今天':days===1?'昨天（1 天前）':days+' 天前')+' · 《'+last.title+'》';
  }
  $('#since-watch').textContent=label;
  $('#home-month').innerHTML=calendarPanel();
}
let browseKey='';
function browsePanel(){
  const peopleTab=entityType==='people',groups=new Map();
  const rows=activeEvents();
  for(const r of rows){
    let entries;
    if(peopleTab){
      entries=personLinks(r).map(id=>catalog.people.find(p=>p.id===id)).filter(Boolean).map(p=>[p.id,p.name]);
      if(!entries.length && r.people && r.people!=='独自' && r.companion_mode!=='独自')entries=[['raw:'+r.people,r.people]];
    }else{
      const loc=locationText(r);
      entries=loc?[[r.place_id||'raw:'+loc,loc]]:[];
    }
    for(const [key,name] of entries){
      if(!groups.has(key))groups.set(key,{name,rows:[]});
      groups.get(key).rows.push(r);
    }
  }
  const entries=[...groups].sort((a,b)=>b[1].rows.length-a[1].rows.length);
  const selected=groups.get(browseKey);
  const choices=entries.map(([key,g])=>'<button class="secondary" data-browse="'+escape(key)+'" aria-pressed="'+(key===browseKey)+'">'+escape(g.name)+' · '+g.rows.length+' 场</button>').join('');
  let html='<p>'+(peopleTab?'点一个名字，看看你们一起看过哪些作品。':'点影院或地点，回看在那里看过的作品。')+'</p>'+(choices||'<p>'+ (peopleTab?'记一场时填上「和谁一起」，这里就会出现名字。':'记一场时填上观影地点，这里就会出现记录。')+'</p>');
  if(selected)html+='<h3>'+escape(selected.name)+'</h3>'+selected.rows.map(r=>eventLink(r)).join('');
  if(!peopleTab){
    const cities=new Map();
    for(const r of rows){const loc=viewingLocation(r),key=cityName(loc);if(!cities.has(key))cities.set(key,[]);cities.get(key).push(r);}
    html+='<details><summary>按城市查看</summary>'+[...cities].map(([city,list])=>'<button class="secondary" data-city="'+escape(city)+'">'+escape(city)+' · '+list.length+' 场 / 影院 '+list.filter(r=>r.method==='影院').length+' 场</button>').join('')+(cities.get(cityFilter)||[]).map(r=>eventLink(r)).join('')+'</details>';
  }
  return html+'<details id="manage-archive"><summary>'+(peopleTab?'管理同行人档案':'管理地点档案')+'</summary>'+organizePanel()+'</details>';
}
function renderStudio(){
  const managingArchive=$('#manage-archive')?.open;
  const byCity=$('#studio-body [data-city]')?.closest('details')?.open;
  const panels={'年度报告':annualPanel,'一起看过的人':browsePanel,'去过的地点':browsePanel,'主题片单':collectionPanel};
  $('#studio-tabs').innerHTML=Object.keys(panels).map(s=>'<button class="secondary" aria-pressed="'+(s===studioTab)+'" data-tab="'+s+'">'+s+'</button>').join('');
  $('#studio-body').innerHTML=panels[studioTab]();memoryChoices();
  if(managingArchive && $('#manage-archive'))$('#manage-archive').open=true;
  if(byCity && $('#studio-body [data-city]'))$('#studio-body [data-city]').closest('details').open=true;
}
async function studioSave(rows,next){
  if(await persist(rows,{},next)){render();renderStudio();toast('已保存');}
}

