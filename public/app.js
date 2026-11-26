const key='movie-journal-v2';
let records,storageFailed=false,loadedSnapshot;
try { const saved=localStorage.getItem(key);loadedSnapshot=saved;const source=JSON.parse(saved || localStorage.getItem('movie-journal-v1') || '[]');records=JournalArchive.unpack(source);catalog=readCatalog(source);if(!Array.isArray(records)||records.some(r=>!r||typeof r.title!=='string'||typeof r.date!=='string'||typeof r.id!=='string'))throw new Error('invalid'); } catch {records=[];storageFailed=true;}
let filter='全部',query='',editing=null,toastTimer;
let selectedMovie=null,searchResults=[],searchTimer,searchController,searchVersion=0,detailVersion=0;
const $=s=>document.querySelector(s);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3200);}
let saving = false;
async function persist(next, change, nextCatalog=catalog) {
  if (saving) return false;
  saving = true;
  next=next.map(availableMetadata);
  try {
    if (document.documentElement.hasAttribute('data-cloud')) {
      if (!window.journalCloud) throw new Error('云端连接尚未就绪，请刷新页面。');
      await window.journalCloud.write(next,nextCatalog);
    } else {
      if(storageFailed) throw Error('现有手记无法读取，请先备份浏览器数据，再重试。');
      if (localStorage.getItem(key)!==loadedSnapshot) throw Error('另一页面已保存新记录，请复制未保存的内容，刷新后再保存。');
      const serialized=JSON.stringify({...JournalArchive.pack(next),...nextCatalog});
      localStorage.setItem(key,serialized);
      loadedSnapshot=serialized;
    }
    records = next;
    catalog = nextCatalog;
    return true;
  } catch (error) {
    toast(error.message || '保存失败，请重试。');
    return false;
  } finally {
    saving = false;
  }
}
document.addEventListener('error',event=>{const img=event.target;if(img.matches?.('img.poster')){if(!img.dataset.retried && img.src.startsWith('https://image.tmdb.org/t/p/w500/')){img.dataset.retried='1';img.src='/api/movies/poster?file='+encodeURIComponent(img.src.split('/').pop());return;}const alt=document.createElement('div');alt.className='poster poster-placeholder';alt.textContent=img.alt;img.replaceWith(alt);}},true);
function poster(r){r=availableMetadata(r);const valid=/^https:\/\/image\.tmdb\.org\/t\/p\/w500\/[a-zA-Z0-9]+\.(jpg|png)$/.test(r.poster||'');return valid?`<img class="poster" src="${escape(r.poster)}" alt="${escape(r.title)}海报" loading="lazy">`:`<div class="poster poster-placeholder" ${r.id && !valid?'data-metadata-id="'+escape(r.id)+'"':''} aria-label="暂无海报">${escape(r.title)}</div>`;}
function people(r){
 if(r.companion_mode==='独自')return '独自';
 const names=(r.person_ids||[]).map(id=>catalog.people.find(p=>p.id===id)?.name).filter(Boolean);
 if(names.length)return '和'+names.join('、');
 return !r.people?'':r.people==='独自'?'独自':'和'+r.people;
}
function repeat(r){const watches=records.filter(x=>!x.deleted_at && JournalArchive.movieId(x)===JournalArchive.movieId(r) && x.date.length===10 && r.date.length===10).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));const n=watches.findIndex(x=>x.id===r.id)+1;return n>1?` · 第${n===2?'二':n}次看`:'';}
let managing = false;
const selection = new Set();
let visibleIds = [];
function info(r) {
  return [r.kind || '电影', r.rating != null ? r.rating + '/5 分' : '', r.platform || r.method].filter(Boolean).join(' · ');
}
let selectedKind = '';
function render(){
 document.querySelectorAll('[data-kind]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.kind === selectedKind)));
 renderFacets();
 const filtered=records.filter(r=>!r.deleted_at && (!$('#year-filter').value || (r.date.slice(0,4)||'unknown')===$('#year-filter').value) && (!$('#rating-filter').value || ($('#rating-filter').value==='none' ? r.rating==null : r.rating!=null && r.rating>=Number($('#rating-filter').value))) && (!selectedKind || (r.kind||'电影')===selectedKind)&&(filter==='全部'||r.method===filter)&&[r.title,r.originalTitle,...(Array.isArray(r.aliases)?r.aliases:[]),r.people,people(r),r.place,catalog.places.find(p=>p.id===r.place_id)?.name,r.memory,r.review,r.tags,r.platform,r.date].some(v=>String(v||'').toLowerCase().includes(query))).sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
 renderLibrary(filtered);
 if($('#studio').open)renderStudio();
 visibleIds = filtered.map(r => r.id);
 $('#batch-actions').hidden = !managing;
 $('#manage').textContent = managing ? '取消管理' : '批量管理';
 $('#bulk-delete').textContent = '删除所选（' + selection.size + '）';
 $('#bulk-delete').disabled = !selection.size || saving;
 $('#count').textContent=`${filtered.length} 场回忆`;
 let month=null,html='';
 for(const r of filtered.slice(0,pageLimit)){const m=r.date.slice(0,7);if(m!==month){month=m;html+=`<div class="month"><h2>${escape(m.length===7?m.replace("-"," 年 ")+" 月":m?m+" 年 · 月份未知":"日期未知")}</h2><span class="line"></span><small>THE DAYS WE KEEP</small></div>`;}
 const day=new Date(r.date+'T12:00:00');const weekday=r.date.length===10 && Number.isFinite(+day)?day.toLocaleDateString('zh-CN',{weekday:'short'}):'';
 html+=`<article class="entry" role="button" tabindex="0" data-id="${escape(r.id)}" aria-label="查看${escape(r.title)}，${escape(r.date)}的回忆"><div class="date">${managing?(selection.has(r.id)?"☑ ":"☐ "):""}${escape(r.date.length===10?r.date.slice(5).replace('-','.'):r.date||'未知')}<small>${weekday}</small></div><div class="entry-body"><h3 class="entry-title">${escape(r.title)}<span class="year">${escape(r.year||'')}</span></h3><div class="meta"><span>${escape(people(r))}</span>${r.place?`<span class="sep">·</span><span>${escape(r.place)}</span>`:''}</div><span class="tag">${escape(info(r))}${repeat(r)}</span><p class="memory">${escape(r.memory||r.review||'')}</p></div>${poster(r)}</article>`;
 }
 $('#timeline').innerHTML=html||`<div class="empty"><span>✧</span><h3>${records.some(r=>!r.deleted_at)?'还没找到这段回忆':'从一场电影开始'}</h3><p>${records.length?'试试其他片名、人物或地点。':'记下电影，也记下那天的自己。'}</p><button class="secondary" data-action="${records.length?'clear':'new'}">${records.length?'查看全部回忆':'记第一场电影'}</button></div>`;
 document.querySelectorAll('[data-filter]').forEach(b=>{b.classList.toggle('active',b.dataset.filter===filter);b.setAttribute('aria-pressed',String(b.dataset.filter===filter));});
}
$('#manage').onclick = () => { managing = !managing; selection.clear(); render(); };
$('#select-visible').onclick = () => { visibleIds.forEach(id => selection.add(id)); render(); };
$('#kind-filter').onclick = event => {
  const button = event.target.closest('button[data-kind]');
  if (!button) return;
  selectedKind = selectedKind === button.dataset.kind ? '' : button.dataset.kind;
  selection.clear();
  render();
};
function activateRow(id) {
  if (!managing) return showDetail(id);
  if (selection.has(id)) selection.delete(id); else selection.add(id);
  render();
}
$('#bulk-delete').onclick = async () => {
  const ids = [...selection];
  if (!ids.length || !confirm('移入回收站，共 ' + ids.length + ' 条观影记录？')) return;
  if (await persist(records.map(r => selection.has(r.id)?{...r,deleted_at:new Date().toISOString()}:r), {ids})) {
    selection.clear(); managing = false; render(); toast('已删除所选记录');
  }
};
let formRecordId;
function precisionOf(date) {
  return ({10:'day',7:'month',4:'year'})[date?.length] || 'unknown';
}
function setDateControl() {
  const {precision,date} = $('#record-form').elements;
  date.type = ({day:'date',month:'month',year:'number',unknown:'text'})[precision.value];
  date.hidden = precision.value === 'unknown';
  date.required = !date.hidden;
  if (precision.value==='year') {date.min='1000'; date.max=String(new Date().getFullYear());}
  else {date.removeAttribute('min');date.removeAttribute('max');}
}
$('#record-form').elements.precision.onchange = setDateControl;
let openFacet = null;
const facets = [$('#year-filter'), $('#rating-filter')];
function renderFacets(){
  const panel = $('#facet-options');
  panel.hidden = !openFacet;
  for(const control of facets){
    const isYear = control.id === 'year-filter';
    const value = control.value;
    const label = isYear ? '年份' : '评分';
    const describe = v => isYear ? (v === 'unknown' ? '年份未知' : v+' 年') :
      (v === 'none' ? '未评分' : v === '5' ? '5 分' : v+' 分及以上');
    control.textContent = value ? describe(value) : label;
    control.setAttribute('aria-label',label+'筛选，'+(value ? describe(value) : '不限'));
    control.setAttribute('aria-expanded',String(openFacet===control));
    control.classList.toggle('has-value',Boolean(value));
    if(openFacet!==control)continue;
    const active = records.filter(r=>!r.deleted_at);
    const years = [...new Set(active.map(r=>r.date.slice(0,4)).filter(Boolean))].sort().reverse();
    if(active.some(r=>!r.date))years.push('unknown');
    const options = isYear ? years : ['5','4.5','4','3','none'];
    panel.setAttribute('aria-label',label+'选项');
    panel.innerHTML = ['',...options].map(v=>'<button type="button" data-facet-value="'+escape(v)+'" aria-pressed="'+(v===value)+'">'+escape(v?describe(v):'不限'+label)+'</button>').join('');
  }
}
for(const control of facets){
  control.onclick=()=>{openFacet=openFacet===control?null:control;renderFacets();};
}
$('#facet-options').onclick=e=>{
  const option=e.target.closest('[data-facet-value]');
  if(!option || !openFacet)return;
  const control=openFacet;
  control.value=option.dataset.facetValue===control.value?'':option.dataset.facetValue;
  openFacet=null;selection.clear();render();control.focus();
};
document.addEventListener('click',e=>{
  if(openFacet && !e.target.closest('.facet-toggle,#facet-options')){openFacet=null;renderFacets();}
});
document.addEventListener('keydown',e=>{
  if(openFacet && e.key==='Escape'){const control=openFacet;openFacet=null;renderFacets();control.focus();}
});
function renderTrash() {
  const list = $('#trashed');
  list.replaceChildren();
  for (const row of records.filter(r=>r.deleted_at)) {
    const p=document.createElement('p');
    p.append(row.title+' · '+(row.date||'日期未知')+' ');
    for (const action of ['恢复','永久删除']) {
      const btn=document.createElement('button');
      btn.className='secondary'; btn.textContent=action;
      btn.onclick=async()=>{
        const purge=action==='永久删除';
        if(purge && !confirm('永久删除《'+row.title+'》？此操作无法撤销。'))return;
        const next=purge?records.filter(r=>r.id!==row.id):records.map(r=>r.id===row.id?{...r,deleted_at:null}:r);
        const keptCatalog=purge?{...catalog,collections:catalog.collections.map(c=>({...c,items:c.items.map(i=>i.event===row.id?{...i,event:null}:i)}))}:catalog;
        if(await persist(next,{},keptCatalog)){if(purge)await removeEventPhotos(row.id);renderTrash();render();}
      };
      p.append(btn);
    }
    list.append(p);
  }
  if(!list.children.length)list.textContent='回收站为空';
}
$('#open-trash').onclick=()=>{renderTrash();$('#settings').close();$('#trash').showModal();};
$('#restore-file').onchange=async e=>{
  const file=e.target.files[0]; e.target.value='';
  if(!file)return;
  try {
    if(file.size>256*1024*1024)throw Error('请选择小于 256 MB 的备份');
    const archive=JSON.parse(await file.text());
    const incoming=JournalArchive.unpack(archive);
    const seen=new Set(records.map(r=>r.id));
    const fresh=incoming.filter(r=>!seen.has(r.id));
    const merged=mergeCatalog(archive);
    const added=Object.keys(merged).reduce((n,k)=>n+merged[k].length-catalog[k].length,0);
    if(!confirm('新增 '+added+' 份人物、地点或片单档案；导入 '+fresh.length+' 条，保留并跳过已有 '+(incoming.length-fresh.length)+' 条？'))return;
    const combined=merged;
    await restorePhotos(archive,fresh);
    if(await persist([...records,...fresh],{},combined)){render();$('#settings').close();toast('导入完成');}
  } catch {toast('无法导入，请检查文件格式、大小及作品关联');}
};
function showEditor(id){editing=id||null;const r=records.find(x=>x.id===id);const form=$('#record-form');form.reset();form.elements.kind.value=r?.kind||'电影';form.elements.rating.value=r?.rating??'';$('#editor-title').textContent=r?'编辑这段回忆':'记一场电影';const today=new Date().toLocaleDateString('sv-SE');form.elements.precision.value=r?precisionOf(r.date):'day';setDateControl();$('#more-fields').open=!!r;formRecordId=id||crypto.randomUUID();for(const k of ['title','date','method','people','place','memory'])form.elements[k].value=r?.[k]||(k==='date'&&!r?today:'');
 $('#people-list').innerHTML=[...new Set(['独自',...records.map(x=>x.people).filter(Boolean)])].map(v=>`<option value="${escape(v)}">`).join('');
 $('#place-list').innerHTML=[...new Set(records.map(x=>x.place).filter(Boolean))].map(v=>`<option value="${escape(v)}">`).join('');
 cancelSearch();selectedMovie=r?{originalTitle:r.originalTitle,title:r.title,year:r.year,poster:r.poster,tmdbId:r.tmdbId,overview:r.overview,overviewLanguage:r.overviewLanguage,runtime:r.runtime,genres:r.genres}:null;renderSelected();$('#movie-options').innerHTML='';$('#movie-status').textContent=r?'可以修改观影信息，也可以重新搜索电影。':'输入片名，联网寻找那部电影。';
 $('#editor').showModal();}
function cancelSearch(){clearTimeout(searchTimer);searchController?.abort();searchVersion++;detailVersion++;$('#record-form button[type="submit"]').disabled=false;}
function renderSelected(){const m=selectedMovie;$('#selected-movie').innerHTML=m?`<div class="selected-movie">${poster(m)}<div><strong>${escape(m.title)}</strong><p>${escape(m.year||'年份未知')}${m.runtime?' · '+escape(m.runtime)+' 分钟':''}</p><small>${m.tmdbId?'已选中 · 电影资料来自 TMDB':'手动记录'}</small></div></div>${overviewMarkup(m)}`:'';}
function overviewMarkup(m){m=availableMetadata(m);return `<details class="movie-overview" ${m.id?'open':''} ${m.id && !m.overview?'data-metadata-id="'+escape(m.id)+'"':''}>` + `<summary>电影简介${m.overviewLanguage==='en-US'?'（暂无中文，显示英文）':''}</summary><p>${escape(m.overview||(m.id?'正在查找简介…':'暂无简介。'))}</p>${m.tmdbId?`<a href="https://www.themoviedb.org/${(m.kind||$("#record-form").elements.kind.value)==="剧集"?"tv":"movie"}/${Number(m.tmdbId)}" target="_blank" rel="noopener noreferrer">在 TMDB 查看电影资料</a>`:''}</details>`;}
function typeQuery(separator) {
  return separator + 'type=' + ($('#record-form').elements.kind.value === '剧集' ? 'tv' : 'movie');
}
function updateOptions(){cancelSearch();selectedMovie=null;renderSelected();searchResults=[];$('#movie-options').innerHTML='';const term=$('#movie-title').value.trim();if(!term){$('#movie-status').textContent='输入片名，联网寻找那部电影。';return;}const version=searchVersion;$('#movie-status').textContent='正在搜索…';searchTimer=setTimeout(()=>searchMovies(term,version),350);}
async function searchMovies(term,version){searchController=new AbortController();try{const response=await fetch('/api/movies/search?q='+encodeURIComponent(term)+typeQuery("&"),{signal:searchController.signal});const data=await response.json();if(version!==searchVersion)return;if(!response.ok)throw new Error(data.error||'电影搜索暂时不可用。');searchResults=data.results||[];$('#movie-options').innerHTML=searchResults.map((m,i)=>`<button type="button" class="movie-result" data-result="${i}">${poster(m)}<span><strong>${escape(m.title)}</strong><small>${escape(m.year||'年份未知')} · ${escape(m.originalTitle||m.title)}</small></span></button>`).join('');$('#movie-status').textContent=searchResults.length?'选择对应的电影；也可以保留输入的片名，直接记录。':'没有找到，试试原名；也可以直接保存片名。';}catch(error){if(version===searchVersion&&error.name!=='AbortError')$('#movie-status').textContent=error.message==='Failed to fetch'?'网络暂时不可用，你仍可手动记录。':error.message;}}
async function selectMovie(index){const m=searchResults[index];if(!m)return;cancelSearch();selectedMovie={...m};$('#movie-title').value=m.title;$('#movie-options').innerHTML='';renderSelected();const version=detailVersion;$('#movie-status').textContent='正在获取完整电影资料…';$('#record-form button[type="submit"]').disabled=true;try{const response=await fetch('/api/movies/'+m.tmdbId+typeQuery('?'));const data=await response.json();if(version!==detailVersion)return;if(!response.ok)throw new Error();selectedMovie=data.movie;renderSelected();$('#movie-status').textContent='已记录 '+records.filter(r=>!r.deleted_at&&r.tmdbId===m.tmdbId&&(r.kind||'电影')===$('#record-form').elements.kind.value).length+' 次，可保存本次观看。';}catch{if(version===detailVersion)$('#movie-status').textContent='完整资料暂未获取，已保留搜索结果中的海报与简介。';}finally{if(version===detailVersion)$('#record-form button[type="submit"]').disabled=false;}}
function showDetail(id){const r=records.find(x=>x.id===id && !x.deleted_at);if(!r)return;$('#detail-content').innerHTML=`<div class="dialog-heading"><span class="eyebrow">A DAY TO REMEMBER</span><button class="icon-button" data-close aria-label="关闭">×</button></div><div class="detail-top">${poster(r)}<div><p class="detail-date">${escape(r.date.replaceAll('-',' / '))}</p><h2 id="detail-title">${escape(r.title)}</h2><div class="meta">${escape(people(r))}${r.place?` · ${escape(r.place)}`:''}</div><span class="tag">${escape(info(r))}${repeat(r)}</span></div></div><p class="detail-memory">${escape(r.memory||r.review||'')}</p>${r.review&&r.memory?`<p>${escape(r.review)}</p>`:""}<p>${escape([r.status,r.endDate&&"看完于 "+r.endDate,r.tags,r.list].filter(Boolean).join(" · "))}</p>${overviewMarkup({...r,kind:r.kind||"电影"})}${manualMetadataControl(r)}<div class="detail-actions"><button class="danger" data-delete="${escape(r.id)}">删除记录</button><button class="secondary" data-edit="${escape(r.id)}">编辑回忆</button></div><div id="delete-confirm"></div>`;$('#detail').showModal();renderAttachments(r.id);}
function settings(){const active=records.filter(r=>!r.deleted_at);const cinema=active.filter(r=>r.method==='影院').length;$('#stats').innerHTML=`<div><strong>${active.length}</strong><span>场回忆</span></div><div><strong>${new Set(active.map(JournalArchive.movieId)).size}</strong><span>部作品</span></div><div><strong>${cinema}</strong><span>次走进影院</span></div>`;$('#settings').showModal();}
document.addEventListener('click',async e=>{const b=e.target.closest('button');const row=e.target.closest('.entry');if(row){activateRow(row.dataset.id);return;}if(!b)return;
 if(b.hasAttribute('data-close'))b.closest('dialog').close();
 if(b.dataset.filter){filter=b.dataset.filter;selection.clear();render();}
 if(b.dataset.result!==undefined)selectMovie(Number(b.dataset.result));
 if(b.dataset.action==='new')showEditor();
 if(b.dataset.action==='settings')settings();
 if(b.dataset.action==='home'||b.dataset.action==='clear'){query='';filter='全部';$('#year-filter').value='';$('#rating-filter').value='';selectedKind='';selection.clear();$('#search').value='';render();window.scrollTo({top:0,behavior:'smooth'});}
 if(b.dataset.edit){$('#detail').close();showEditor(b.dataset.edit);}
 if(b.dataset.delete){$('#delete-confirm').innerHTML=`<div class="delete-confirm">将这条回忆移入回收站？<br><button class="secondary" data-cancel-delete>保留</button><button class="danger" data-confirm-delete="${escape(b.dataset.delete)}">确认删除</button></div>`;}
 if(b.hasAttribute('data-cancel-delete'))$('#delete-confirm').innerHTML='';
 if(b.dataset.confirmDelete){if(await persist(records.map(r=>r.id===b.dataset.confirmDelete?{...r,deleted_at:new Date().toISOString()}:r),{remove:b.dataset.confirmDelete})){$('#detail').close();render();toast('这条回忆已删除');}}
});
$('#timeline').addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('.entry')){e.preventDefault();activateRow(e.target.dataset.id);}});
$('#search').addEventListener('input',e=>{selection.clear();query=e.target.value.trim().toLowerCase();render();});
$('#record-form').elements.kind.onchange=updateOptions;
$('#movie-title').addEventListener('input',updateOptions);
let resolvingTitle = false;
async function matchTitle(title, kind) {
  const params = new URLSearchParams({q:title, type:kind === '剧集' ? 'tv' : 'movie'});
  try {
    const response = await fetch('/api/movies/search?' + params);
    if (!response.ok) return null;
    const data = await response.json();
    const normalized = value => (value || '').normalize('NFKC').trim().toLowerCase();
    const exact = data.results.filter(m => [m.title, m.originalTitle].some(name => normalized(name) === normalized(title)));
    if (data.moreResults || exact.length !== 1) return null;
    const details = await fetch('/api/movies/' + exact[0].tmdbId + '?type=' + params.get('type'));
    return details.ok ? (await details.json()).movie : exact[0];
  } catch { return null; }
}
$('#record-form').addEventListener('submit',async e=>{e.preventDefault();const data=new FormData(e.target);const title=data.get('title').trim();if(!title){toast('先写下电影的名字');return;}if (resolvingTitle) return;
const editorVersion = detailVersion;
let movie = selectedMovie?.title === title ? selectedMovie : null;
if (!movie?.tmdbId && !document.documentElement.hasAttribute('data-v2')) {
  resolvingTitle = true;
  $('#movie-status').textContent = '正在匹配作品资料…';
  try { movie = await matchTitle(title, data.get('kind')) || movie; }
  finally { resolvingTitle = false; }
  if (editorVersion !== detailVersion || !$('#editor').open) return;
}
const r={...records.find(x=>x.id===editing),movie_id:movie?.movie_id || (editing?records.find(x=>x.id===editing)?.movie_id:undefined),kind:data.get('kind'),rating:data.get('rating')===''?null:Number(data.get('rating')),id:formRecordId,created_at:records.find(x=>x.id===editing)?.created_at||new Date().toISOString(),updated_at:new Date().toISOString(),title,year:movie?.year||'',poster:movie?.poster||'',tmdbId:movie?.tmdbId||null,originalTitle:movie?.originalTitle||'',overview:movie?.overview||'',overviewLanguage:movie?.overviewLanguage||'',runtime:movie?.runtime||null,genres:movie?.genres||[],date:data.get('precision')==='unknown'?'':data.get('date'),method:data.get('method'),people:data.get('people').trim(),place:data.get('place').trim(),memory:data.get('memory').trim()};if(r.date && r.date > new Date().toLocaleDateString('sv-SE').slice(0,r.date.length) && r.date!==records.find(x=>x.id===editing)?.date){toast('请选择今天或更早的日期');return;}
if (!editing && records.some(x=>!x.deleted_at && x.date===r.date && x.method===r.method && (r.tmdbId ? JournalArchive.movieId(x)===JournalArchive.movieId(r) : x.title===r.title)) && !confirm('已有相似记录，仍保存为另一次观看？')) return;
const next=editing?records.map(x=>x.id===editing?r:x):[r,...records];if(await persist(next,{record:r,previousId:editing})){const wasEdit=!!editing;$('#editor').close();render();toast(wasEdit?'回忆已更新':'这一天，记住了。');}});
$('#export').addEventListener('click',async()=>{try{const data={...JournalArchive.pack(records.map(availableMetadata)),...catalog};await archivePhotos(data);const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='观影手记-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('备份已导出');}catch{toast('导出失败，请检查附件存储并重试。');}});
$('#editor').addEventListener('close',cancelSearch);
if (!document.documentElement.hasAttribute('data-cloud')) render();if(storageFailed)toast('暂时无法读取或保存本地记录，请检查浏览器存储权限。');
