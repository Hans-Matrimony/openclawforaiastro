import assert from 'node:assert/strict';
import test from 'node:test';
import {evidenceFallback} from '../extensions/reviewed-reading/direct/evidence-fallback.mjs';
import {timingCorrection} from '../extensions/reviewed-reading/direct/timing-correction.mjs';

const now = new Date('2026-11-14T00:00:00Z');
const row = {
  engine:'local-sweph-v2', birth_chart:{subject:'synthetic-a'},
  verdict_signals:[{area:'career',trend:'MIXED',positive:['house 10 (Leo) bindus 31/48 = strong support'],negative:['Saturn retrograde hai results me Atkaav']}],
  dasha:{upcoming_antardashas:[{lord:'Mars',from:'2027-09-15',to:'2028-11-14'}]},
};
for(const language of ['english','hinglish']) test(`undetermined career answers timing without an unrelated schedule: ${language}`,()=>{
  const results=[JSON.stringify(row)];
  const correction=timingCorrection(results,'career kab set hoga',language,now);
  const repaired=correction.render({tool_calls:[{function:{name:correction.name,arguments:JSON.stringify({period_id:'none',outlook:'undetermined',factor_ids:['f0']})}}]});
  const fallback=evidenceFallback(results,language,'career kab set hoga',now);
  assert.equal(repaired,fallback);
  assert.doesNotMatch(repaired,/pakki tareekh|not a confirmed date/i);
  assert.doesNotMatch(repaired,/2027|2028|Mars/);
  assert.match(repaired,language==='english'?/does not establish a year/:/saal nahi nikal raha/);
  assert.doesNotMatch(repaired,/career (?:will|hoga|set hoga)|2041|2047/i);
  assert.doesNotMatch(evidenceFallback(results,language,'career fields',now),/2027|2028/);
});

test('missing, invalid, expired, or conflicting career schedules never manufacture dates',()=>{
  for(const altered of [undefined,{upcoming_antardashas:[{lord:'Mars',from:'2027-02-30',to:'2028-11-14'}]},
    {upcoming_antardashas:[{lord:'Mars',from:'2020-09-15',to:'2021-11-14'}]}]) {
    const result=evidenceFallback([JSON.stringify({...row,dasha:altered})],'english','career kab set hoga',now);
    assert.doesNotMatch(result,/20\d{2}/);
  }
  const other={...row,birth_chart:{subject:'synthetic-b'}};
  assert.doesNotMatch(evidenceFallback([JSON.stringify(row),JSON.stringify(other)],'english','career kab set hoga',now),/20\d{2}/);
});

test('a supported career period retains its dates instead of the unavailable response',()=>{
  const supported=structuredClone(row);
  supported.verdict_signals[0].positive=['benefic Mars house 10 mein'];
  const reply=evidenceFallback([JSON.stringify(supported)],'hinglish','career kab set hoga',now);
  assert.match(reply,/September 2027 se November 2028/);
  assert.match(reply,/career sambhavit hai/);
  assert.doesNotMatch(reply,/saal nahi nikal raha/);
});

test('career signal without a period cannot borrow a schedule date',()=>{
  const current=structuredClone(row);
  current.dasha={current_antardasha:{lord:'Mars',from:'2026-01-01',to:'2027-09-15'}};
  const reply=evidenceFallback([JSON.stringify(current)],'hinglish','naukri kab milegi',now);
  assert.match(reply,/saal nahi nikal raha/);
  assert.doesNotMatch(reply,/2027|Mars|pakki tareekh/);
});
