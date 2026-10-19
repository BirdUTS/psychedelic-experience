import {test} from 'node:test'; import assert from 'node:assert/strict';
import {Initiative} from '../immersive/engine/initiative.mjs';
import {Agency} from '../immersive/engine/agency.mjs';
const dt=1/60;
test('yields below −0.5 within 2 s of full agency',()=>{const s=new Initiative();for(let i=0;i<2*60;i++)s.update(dt,1);assert(s.I<-.5,`I ${s.I}`)});
test('resumes to within 10 % of I0 between 15 and 25 s after agency stops, and never exceeds I0',()=>{const s=new Initiative(),a=new Agency();for(let i=0;i<3*60;i++){a.update(dt,{speech:1});s.update(dt,a.As)}let at=null;for(let i=0;i<30*60;i++){a.update(dt,{});s.update(dt,a.As);assert(s.I<=s.I0+1e-9);if(at===null&&Math.abs(s.I-s.I0)<=.03)at=i/60}assert(at!==null&&at>=15&&at<=25,`settled at ${at}`)});
test('locked value is untouched by agency for 10 minutes',()=>{const s=new Initiative();s.lock(.73);for(let i=0;i<600*60;i++)s.update(dt,(i%7)/6);assert.equal(s.I,.73);assert.equal(s.locked,true)});
test('baseline and lock values are clamped',()=>{const s=new Initiative();s.setBaseline(2);assert.equal(s.I0,.6);s.lock(-9);assert.equal(s.I,-1);s.unlock();assert.equal(s.locked,false)});
test('lambda maps I to [0,1]',()=>{const s=new Initiative();s.lock(-1);assert.equal(s.lambda,0);s.lock(1);assert.equal(s.lambda,1)});
