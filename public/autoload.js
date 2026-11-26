// Only observe rendered journal entries. Search results and unsubmitted forms are independent.
const metadataCache = new Map();
const metadataRequests = new Map();
const waitingMetadata = [];
let activeMetadata = 0;
function lookupKey(row) {
  return JSON.stringify([row.kind||'电影',row.tmdbId||null,row.title,row.year||'']);
}
function availableMetadata(row) {
  const data = metadataCache.get(lookupKey(row))?.data;
  if (!data) return row;
  return {...row,poster:row.poster||data.poster,overview:row.overview||data.overview,
    overviewLanguage:row.overview?row.overviewLanguage:data.overviewLanguage};
}
async function fetchMetadata(row) {
  const type = row.kind==='剧集'?'tv':'movie';
  async function read(path) {
    const response=await fetch(path,{signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw Error('资料服务暂不可用');
    return response.json();
  }
  let id=row.tmdbId, fallback;
  if(!id){
    const title=type==='tv'?row.title.replace(/\s*第[一二三四五六七八九十\d]+季\s*$/,''):row.title;
    const result=await read('/api/movies/search?'+new URLSearchParams({q:title,type}));
    const normalize=s=>String(s||'').normalize('NFKC').trim().toLowerCase();
    const exact=result.results.filter(m=>(!row.year||String(row.year)===m.year) &&
      [m.title,m.originalTitle].some(s=>normalize(s)===normalize(title)));
    if(result.moreResults || exact.length!==1)return null;
    fallback=exact[0];id=fallback.tmdbId;
    if(fallback.poster && fallback.overview)return {...fallback,overviewLanguage:'zh-CN'};
  }
  const data=await read('/api/movies/'+encodeURIComponent(id)+'?type='+type);
  return {...data.movie,poster:data.movie.poster||fallback?.poster,overview:data.movie.overview||fallback?.overview};
}
function drainMetadata(){
  while(activeMetadata<2 && waitingMetadata.length){
    const run=waitingMetadata.shift();activeMetadata++;
    run().finally(()=>{activeMetadata--;drainMetadata();});
  }
}
function requestMetadata(row){
  const key=lookupKey(row),cached=metadataCache.get(key);
  if(cached && Date.now()<cached.until)return Promise.resolve(cached.data);
  if(metadataRequests.has(key))return metadataRequests.get(key);
  const pending=new Promise(resolve=>waitingMetadata.push(async()=>{
    try {
      const data=await fetchMetadata(row);
      metadataCache.set(key,{data,until:Date.now()+(data?86400000:600000)});
      resolve(data);
    } catch {metadataCache.set(key,{data:null,until:Date.now()+30000});resolve(null);}
    finally{metadataRequests.delete(key);}
  }));
  metadataRequests.set(key,pending);drainMetadata();return pending;
}
async function hydrateElement(element){
  const row=records.find(r=>r.id===element.dataset.metadataId && !r.deleted_at);
  if(!row)return;
  const data=await requestMetadata(row);
  if(!element.isConnected)return;
  if(element.classList.contains('poster-placeholder')){
    if(data?.poster)element.outerHTML=poster({...row,poster:data.poster});
  }else{
    element.querySelector('p').textContent=data?.overview||'暂无可自动匹配的简介，可在编辑中选择对应作品。';
    if(data?.overviewLanguage==='en-US')element.querySelector('summary').textContent='电影简介（英文）';
  }
}
const visibleMetadata = new IntersectionObserver(entries=>{
  for(const e of entries)if(e.isIntersecting){visibleMetadata.unobserve(e.target);hydrateElement(e.target);}
},{rootMargin:'100px'});
const newMetadata=new MutationObserver(changes=>{
  for(const change of changes){
    for(const node of change.removedNodes)if(node.nodeType===1){
      visibleMetadata.unobserve(node);
      node.querySelectorAll('[data-metadata-id]').forEach(el=>visibleMetadata.unobserve(el));
    }
    for(const node of change.addedNodes)if(node.nodeType===1){
      if(node.matches('[data-metadata-id]'))visibleMetadata.observe(node);
      node.querySelectorAll('[data-metadata-id]').forEach(el=>visibleMetadata.observe(el));
    }
  }
});
newMetadata.observe(document.body,{childList:true,subtree:true});
