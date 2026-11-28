const imageTypes = new Set(['image/jpeg','image/png','image/webp']);
export default {
  async fetch(request) {
    const file = new URL(request.url).searchParams.get('file') || '';
    if (request.method !== 'GET' || !/^[a-zA-Z0-9]{1,128}\.(jpg|png)$/.test(file)) return new Response(null,{status:400});
    try {
      const size = new URL(request.url).searchParams.get('size') === 'w185' ? 'w185' : 'w500';
      const image = await fetch('https://image.tmdb.org/t/p/'+size+'/'+file,{redirect:'error',signal:AbortSignal.timeout(10000)});
      const type = image.headers.get('content-type')?.split(';')[0];
      if (!image.ok || !imageTypes.has(type)) return new Response(null,{status:502});
      return new Response(image.body,{headers:{'Content-Type':type,'Cache-Control':'public, max-age=86400, s-maxage=604800'}});
    } catch { return new Response(null,{status:502}); }
  }
};
