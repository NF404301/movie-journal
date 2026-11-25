const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
function normalize(m){return {tmdbId:m.id,title:m.title||m.name||m.original_title||'未命名电影',originalTitle:m.original_title||m.original_name||'',year:(m.release_date||m.first_air_date||'').slice(0,4),overview:m.overview||'',poster:/^\/[a-zA-Z0-9]+\.(jpg|png)$/.test(m.poster_path||'')?'https://image.tmdb.org/t/p/w500'+m.poster_path:'',runtime:m.runtime||null,genres:(m.genres||[]).map(g=>g.name)};}
export async function handleAPI(request,env,fetcher=fetch){
 const url=new URL(request.url);
 if(request.method!=='GET')return json({error:'仅支持读取电影资料。'},405);
 const q=(url.searchParams.get('q')||'').trim();
 const match=url.pathname.match(/^\/api\/movies\/(\d+)$/);
 if(url.pathname!=='/api/movies/search'&&!match)return json({error:'接口不存在。'},404);
 if(!match&&(!q||q.length>100))return json({error:'请输入 1–100 字的片名。'},400);
 if(!env.TMDB_READ_ACCESS_TOKEN)return json({error:'电影服务暂未配置，请稍后再试。'},503);
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),12000);
 try{
  const type = url.searchParams.get('type') === 'tv' ? 'tv' : 'movie';
  const path = match ? '/' + type + '/' + match[1] : '/search/' + type;
  const upstream=new URL('https://api.themoviedb.org/3'+path);upstream.searchParams.set('language','zh-CN');
  if(!match){upstream.searchParams.set('query',q);upstream.searchParams.set('include_adult','false');}
  const options={headers:{Authorization:'Bearer '+env.TMDB_READ_ACCESS_TOKEN,Accept:'application/json'},signal:controller.signal};
  const response=await fetcher(upstream.toString(),options);
  if(!response.ok)return json({error:response.status===429?'搜索有些频繁，请稍后再试。':'电影服务暂时不可用，你仍可手动记录。'},response.status===429?429:502);
  const data=await response.json();
  if(!match)return json({moreResults:data.total_pages>1||(data.results||[]).length>12,results:(data.results||[]).filter(m=>!m.adult).slice(0,12).map(normalize)});
  let movie=normalize(data);movie.overviewLanguage='zh-CN';
  if(!movie.overview){try{upstream.searchParams.set('language','en-US');const fallback=await fetcher(upstream.toString(),options);if(fallback.ok){const en=await fallback.json();movie.overview=en.overview||'';movie.overviewLanguage=movie.overview?'en-US':'';}}catch{/* Keep the available movie details if translation lookup fails. */}}
  return json({movie});
 }catch{return json({error:'电影搜索暂时连接不上，请稍后重试或手动记录。'},502);}finally{clearTimeout(timeout);}
}
