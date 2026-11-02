import {test} from 'node:test'; import assert from 'node:assert/strict';
import {FrameMeter, frameLine} from '../immersive/engine/frame-meter.mjs';

test('a steady 72 Hz headset reads 72 fps with no slow frames',()=>{const m=new FrameMeter();for(let i=0;i<720;i++)m.record(1/72);const s=m.summary();assert.equal(s.fps,72);assert.equal(s.slowShare,0);assert.equal(s.worstMs,14);assert.equal(s.seconds,10)});
test('half the frames at 30 Hz drags the average down and counts as slow',()=>{const m=new FrameMeter();for(let i=0;i<50;i++){m.record(1/72);m.record(1/30)}const s=m.summary();assert.equal(s.fps,42);assert.equal(s.slowShare,.5);assert.equal(s.worstMs,33)});
test('pauses and bad deltas are ignored; an empty meter has no summary',()=>{const m=new FrameMeter();assert.equal(m.summary(),null);m.record(0);m.record(-1);m.record(NaN);m.record(2);assert.equal(m.summary(),null);m.record(1/90);assert.equal(m.summary().fps,90);m.reset();assert.equal(m.summary(),null)});
test('the line is short written Chinese or English',()=>{const s={fps:42,worstMs:33,slowShare:.5,seconds:95};assert.equal(frameLine(s,'zh'),'VR 42 fps · 最慢 33 ms · 50% 慢格 · 95 秒');assert.equal(frameLine(s,'en'),'VR 42 fps · worst 33 ms · 50% slow · 95 s');assert.equal(frameLine(null,'zh'),'')});
