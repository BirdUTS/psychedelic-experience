import {test} from 'node:test'; import assert from 'node:assert/strict';
import {Agency} from '../immersive/engine/agency.mjs';
const dt=1/60;
test('an onset on the predicted beat is not agency; the same onset off-beat is',()=>{const on=new Agency().update(dt,{roomOnset:1,beatDistance:.05,C:.8}),off=new Agency().update(dt,{roomOnset:1,beatDistance:.5,C:.8});assert.equal(on.A,0);assert(off.A>.3)});
test('with no beat (C low) every onset counts',()=>{const a=new Agency().update(dt,{roomOnset:1,beatDistance:.05,C:.1});assert(a.A>.3)});
test('speech raises agency regardless of beat',()=>{assert(new Agency().update(dt,{speech:.9,beatDistance:.0,C:.9}).A>.5)});
test('energy surprise counts only beyond the 0.25 dead band',()=>{const a=new Agency().update(dt,{actualE:.9,predictedE:.7}),b=new Agency().update(dt,{actualE:.9,predictedE:.1});assert.equal(a.A,0);assert(b.A>.2)});
test('gestures integrate and leak',()=>{const a=new Agency();a.gesture(3);a.update(dt,{});assert(a.A>.4);for(let i=0;i<5*60;i++)a.update(dt,{});assert(a.A<.05)});
test('As attacks within 2 s and releases to under 2 % within 20 s',()=>{const a=new Agency();for(let i=0;i<2*60;i++)a.update(dt,{speech:1,roomOnset:1});assert(a.As>.9,`As ${a.As}`);for(let i=0;i<20*60;i++)a.update(dt,{});assert(a.As<.02,`As ${a.As}`)});
