import {test} from 'node:test'; import assert from 'node:assert/strict';
import {AudioFeatures, BANDS} from '../immersive/engine/features.mjs';
const SR=48000, N=1024, FPS=60;
function rng(seed){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}}
function bins(fill, r){const b=new Uint8Array(N);for(let i=0;i<N;i++)b[i]=Math.min(255,Math.max(0,fill(i)+(r?Math.floor(r()*6):0)));return b}
const bassIdx=i=>i*SR/2048>=20&&i*SR/2048<250;
function clickTrain(f,bpm,seconds,seed=1){const r=rng(seed),period=Math.round(FPS*60/bpm);let onsets=0;for(let k=0;k<seconds*FPS;k++){const hit=k%period<2;f.update(bins(i=>hit&&bassIdx(i)?200:10,r),1/FPS);if(f.onset>0)onsets++}return onsets}
test('click train at 120 BPM: bpm within 3, C above .7, roughly one onset per click',()=>{const f=new AudioFeatures({sampleRate:SR,frameRate:FPS});clickTrain(f,120,6);const onsets=clickTrain(f,120,10);assert(Math.abs(f.bpm-120)<=3,`bpm ${f.bpm}`);assert(f.C>.7,`C ${f.C}`);assert(onsets>=17&&onsets<=22,`onsets ${onsets}`)});
test('tempo jump 76 to 108 re-locks within 4 s',()=>{const f=new AudioFeatures({sampleRate:SR,frameRate:FPS});clickTrain(f,76,10);clickTrain(f,108,4);assert(Math.abs(f.bpm-108)<=4,`bpm ${f.bpm}`)});
test('random bins: C below .3, everything finite',()=>{const f=new AudioFeatures({sampleRate:SR,frameRate:FPS});const r=rng(7);for(let k=0;k<10*FPS;k++)f.update(bins(()=>Math.floor(r()*255)),1/FPS);assert(f.C<.3,`C ${f.C}`);for(const v of [f.E,f.onset,f.B,f.speech,f.C,f.bpm,f.flux])assert(Number.isFinite(v))});
test('constant low bins never normalise loud',()=>{const f=new AudioFeatures({sampleRate:SR,frameRate:FPS});for(let k=0;k<20*FPS;k++)f.update(bins(()=>12),1/FPS);assert(f.E<.2,`E ${f.E}`)});
test('null frames decay to zero without NaN',()=>{const f=new AudioFeatures({sampleRate:SR,frameRate:FPS});clickTrain(f,120,4);for(let k=0;k<5*FPS;k++)f.update(null,1/FPS);assert.equal(f.E,0);assert.equal(f.onset,0);assert(f.C<.05);assert(Number.isFinite(f.bpm))});
test('4 Hz modulated voice band reads as speech, steady band does not',()=>{const voice=i=>{const hz=i*SR/2048;return hz>=300&&hz<3000};const a=new AudioFeatures({sampleRate:SR,frameRate:FPS}),b=new AudioFeatures({sampleRate:SR,frameRate:FPS});for(let k=0;k<6*FPS;k++){const t=k/FPS,m=.5+.5*Math.sin(2*Math.PI*4*t);a.update(bins(i=>voice(i)?40+160*m:10),1/FPS);b.update(bins(i=>voice(i)?120:10),1/FPS)}assert(a.speech>.5,`speech ${a.speech}`);assert(b.speech<.2,`speech ${b.speech}`)});
test('a 120 Hz display gives the same tempo and coherence as a 60 Hz one',()=>{const f=new AudioFeatures({sampleRate:SR,frameRate:FPS});const r=rng(5);for(let k=0;k<16*120;k++){const hit=k%60<4;f.update(bins(i=>hit&&bassIdx(i)?200:10,r),1/120)}assert(Math.abs(f.bpm-120)<=3,`bpm ${f.bpm}`);assert(f.C>.7,`C ${f.C}`)});
test('BANDS are the spec ranges',()=>{assert.deepEqual(BANDS,{bass:[20,250],mid:[250,2000],high:[2000,12000],voice:[300,3000]})});
