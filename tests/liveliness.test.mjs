import {test} from 'node:test'; import assert from 'node:assert/strict';
import {Liveliness} from '../immersive/engine/liveliness.mjs';
import {Swarmalators, Physarum, Boids} from '../immersive/simulations.mjs';
import {Life} from '../immersive/sims/life.mjs';
const h=1/30;
test('a frozen swarmalator ball reads low, the active phase-wave regime reads high',()=>{const L=new Liveliness();const frozen=new Swarmalators(120,5);frozen.setParams({H:0});L.reset('swarm');let t=0;while(t<90){frozen.step(h,.2,.7);L.observe('swarm',frozen.activity,h);t+=h}const low=L.value('swarm');const wave=new Swarmalators(120,5);wave.setParams({H:1});const M=new Liveliness();M.reset('swarm');t=0;while(t<90){wave.step(h,.2,.7);M.observe('swarm',wave.activity,h);t+=h}assert(low<.1,`frozen ${low}`);assert(M.value('swarm')>.5,`wave ${M.value('swarm')}`)});
test('a fresh physarum reads about 1 and decays below 0.4 after three minutes at H 0.3',()=>{const s=new Physarum(64,600,9);s.setParams({H:.3});const L=new Liveliness();L.reset('physarum');let t=0,early=null;while(t<180){s.step(h,.4);L.observe('physarum',s.activity,h);t+=h;if(early===null&&t>=10)early=L.value('physarum')}assert(early>.8,`early ${early}`);assert(L.value('physarum')<.4,`late ${L.value('physarum')}`)});
test('a slow large drift reads above the band',()=>{const L=new Liveliness({referenceSeconds:1,referenceFrom:0});L.reset('x');for(let i=0;i<30;i++)L.observe('x',1,h);for(let i=0;i<600;i++)L.observe('x',.6,h);assert(L.value('x')>.35)});
test('boids and life report activity; value is 1 before any reference',()=>{const b=new Boids(60,4);b.step(h,.4);assert(b.activity>0);const l=new Life(24,7);l.pure=true;l.step();assert(l.activity>0);assert.equal(new Liveliness().value('new'),1)});
