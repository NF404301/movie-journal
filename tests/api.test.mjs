import assert from 'node:assert/strict';
import { handleAPI } from '../lib/tmdb.mjs';

const request = (path, method = 'GET') => new Request(`https://example.test${path}`, { method });
const token = { TMDB_READ_ACCESS_TOKEN: 'test-token' };
const json = async response => response.json();

assert.equal((await handleAPI(request('/api/movies/search?q='), token)).status, 400);
assert.equal((await handleAPI(request('/api/movies/abc'), token)).status, 404);
assert.equal((await handleAPI(request('/api/movies/123', 'POST'), token)).status, 405);
assert.equal((await handleAPI(request('/api/movies/123'), {})).status, 503);

let called = 0;
const search = await handleAPI(request('/api/movies/search?q=星际穿越'), token, async (url, options) => {
  called++;
  assert.equal(new URL(url).searchParams.get('query'), '星际穿越');
  assert.equal(options.headers.Authorization, 'Bearer test-token');
  return new Response(JSON.stringify({ results: [
    { id: 1, title: '星际穿越', release_date: '2014-11-07', poster_path: '/abc123.jpg' },
    { id: 2, title: '成人片', adult: true },
  ] }), { status: 200 });
});
assert.equal(called, 1);
assert.deepEqual((await json(search)).results.map(movie => movie.title), ['星际穿越']);

const detail = await handleAPI(request('/api/movies/1'), token, async url => {
  const lang = new URL(url).searchParams.get('language');
  return new Response(JSON.stringify({ id: 1, title: '星际穿越', overview: lang === 'en-US' ? 'A space journey.' : '' }), { status: 200 });
});
assert.equal((await json(detail)).movie.overview, 'A space journey.');
for (const type of ['movie','tv']) {
  const tv=type==='tv';
  const response=await handleAPI(request('/api/movies/7?type='+type),token,async url=>{
    assert.equal(new URL(url).searchParams.get('append_to_response'),tv?'aggregate_credits':'credits');
    return Response.json({id:7,overview:'简介',release_date:'2001-09-01',first_air_date:'2011-02-03',
      runtime:104,episode_run_time:[45],credits:{cast:[{name:'A',character:'角色'}]},
      aggregate_credits:{cast:[{name:'B',roles:[{character:'角色'}]}]}});
  });
  const {movie}=await json(response);
  assert.equal(movie.releaseDate,tv?'2011-02-03':'2001-09-01');
  assert.equal(tv?movie.episodeMinutes[0]:movie.runtime,tv?45:104);
  assert.deepEqual(movie.performers,[{name:tv?'B':'A',role:'角色'}]);
}

const limited = await handleAPI(request('/api/movies/search?q=test'), token, async () => new Response('', { status: 429 }));
assert.equal(limited.status, 429);
console.log('Movie API tests passed');
