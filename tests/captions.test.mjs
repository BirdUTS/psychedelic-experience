import {test} from 'node:test'; import assert from 'node:assert/strict';
import {talkLanguage, captionLanguage, LINES, line, worldName, decisionCaption} from '../immersive/engine/captions.mjs';

test('the browser language picks the ear: Cantonese for Hong Kong and Taiwan, Mandarin for the mainland, English otherwise',()=>{
  for(const l of ['zh-HK','zh-TW','zh','yue','zh-Hant-HK'])assert.equal(talkLanguage(l),'yue-Hant-HK',l);
  assert.equal(talkLanguage('zh-CN'),'cmn-Hans-CN');assert.equal(talkLanguage('zh-Hans-CN'),'cmn-Hans-CN');
  for(const l of ['en-AU','en','fr',undefined,''])assert.equal(talkLanguage(l),'en-AU',String(l));
});
test('captions are written Chinese for every Chinese ear, English otherwise',()=>{
  for(const l of ['zh-HK','zh-CN','zh','yue-Hant-HK','cmn-Hans-CN'])assert.equal(captionLanguage(l),'zh',l);
  for(const l of ['en-AU','ja',undefined])assert.equal(captionLanguage(l),'en',String(l));
});
test('both languages carry the same lines, and the Chinese ones stay short',()=>{
  assert.deepEqual(Object.keys(LINES.zh).sort(),Object.keys(LINES.en).sort());
  for(const [k,v] of Object.entries(LINES.zh))assert.ok(v.length<=18,`${k}: ${v}`);
  assert.equal(line('start','zh'),'輕觸開始');assert.equal(line('ground','zh'),'我在。慢慢來。');assert.equal(line('start','en'),'Tap to begin');assert.equal(line('vr','zh'),'進入 VR');assert.equal(line('vr','en'),'Enter VR');assert.equal(line('vrGrip','zh'),'低頭兩秒回來 · 輕握音樂');assert.equal(line('vrGrip','en'),'Look down two seconds to come back · squeeze: music');
  assert.equal(line('vrHands','zh'),'左手捏：換世界 · 右手捏：飛');assert.equal(line('vrHands','en'),'Pinch or pull left: next world · right: fly');
  assert.equal(line('noEar','zh'),'這裡聽不到說話');assert.equal(line('noEar','en'),'This browser cannot hear speech');assert.equal(line('hintSwipe','zh'),'左右掃：換個世界');assert.equal(line('hintSwipe','en'),'Swipe left or right: next world');
  assert.equal(line('no-such-line','zh'),'');
});
test('world names are two characters in Chinese and a word in English',()=>{
  assert.deepEqual(['physarum','swarm','boids','life'].map(w=>worldName(w,'zh')),['菌網','螢火','魚群','星球']);
  assert.equal(worldName('life','en'),'planet');assert.equal(worldName('nowhere','zh'),'');
});
test('a decision becomes at most two short tokens: the world when it changes, then mood, palette, energy',()=>{
  const d={version:1,confidence:{},scene:{choice:'life',p:.8},mood:'dream',palette:'ember',energy:.9,view:'satellite'};
  assert.equal(decisionCaption(d,{world:'swarm',lang:'zh',asked:true}),'星球 · 夢');
  assert.equal(decisionCaption(d,{world:'swarm',lang:'en',asked:true}),'planet · dream');
  assert.equal(decisionCaption(d,{world:'life',lang:'zh',asked:true}),'夢 · 燼','same world: no world token');
  assert.equal(decisionCaption({version:1,confidence:{},scene:{choice:'life',p:.55}},{world:'swarm',lang:'zh',asked:false}),'','unasked needs p ≥ .6');
  assert.equal(decisionCaption({version:1,confidence:{},scene:{choice:'life',p:.55}},{world:'swarm',lang:'zh',asked:true}),'星球','asked needs p ≥ .5');
  assert.equal(decisionCaption({version:1,confidence:{},energy:.2},{world:'swarm',lang:'zh'}),'更靜');
  assert.equal(decisionCaption({version:1,confidence:{},energy:.5,hold:.3},{world:'swarm',lang:'zh'}),'','steady energy says nothing');
  assert.equal(decisionCaption(null,{world:'swarm',lang:'zh'}),'');
});

import {beginCaptions} from '../immersive/engine/captions.mjs';
test('a browser with no speech recogniser (the Quest) is told so at the first touch, and shown the swipe instead of the voice hints',()=>{
  assert.deepEqual(beginCaptions({hasEar:false}),['noEar','hintSwipe']);
  assert.deepEqual(beginCaptions({hasEar:true}),[],'with an ear the hints come once it is really listening');
});
