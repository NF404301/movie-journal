import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const context=vm.createContext({});
for(const name of ['archive','insights']){
  vm.runInContext(readFileSync(new URL('../public/'+name+'.js',import.meta.url),'utf8'),context);
}
context.historyOrder=(a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id);
const rows=[
  {id:'1',date:'2023',tmdbId:5},
  {id:'2',date:'2024-01-01',tmdbId:5,method:'影院',runtime:102,rating:4},
  {id:'3',date:'2024-02',tmdbId:5,duration_minutes:70,rating:5},
  {id:'4',date:'2024',tmdbId:6,kind:'剧集',runtime:200},
  {id:'5',date:'',tmdbId:6,kind:'剧集'},
  {id:'6',date:'2024-04-04',deleted_at:'2024-05-01'}
];
const r=context.annualSummary(rows,'2024');
assert.equal(r.rows.length,3);assert.equal(r.works,2);assert.equal(r.repeat,2);
assert.equal(r.uncertain,1);assert.equal(r.unknown,1);assert.equal(r.cinema,1);
assert.equal(r.minutes,172);assert.equal(r.estimated,1);assert.equal(r.covered,2);
assert.equal(r.months.reduce((a,b)=>a+b),2);assert.equal(r.best[0].id,'3');
assert.equal(context.annualSummary(rows,'2020').rows.length,0);
assert.throws(()=>context.readCatalog({people:[{id:'a',name:'A'},{id:'a',name:'B'}]}));
console.log('Annual totals, ambiguous chronology, duration coverage and archive checks passed');
