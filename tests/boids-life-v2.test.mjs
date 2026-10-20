import {test} from 'node:test'; import assert from 'node:assert/strict';
import {Boids} from '../immersive/sims/boids.mjs';
import {Life} from '../immersive/sims/life.mjs';
test('wind and gusts rotate the flock drift',()=>{const b=new Boids(60,4);b.wind={x:1,y:0,z:0};b.turnWind(90);assert(Math.abs(b.wind.x)<1e-6&&Math.abs(Math.abs(b.wind.z)-1)<1e-6);b.gust(15,()=>.9);assert(Math.abs(Math.hypot(b.wind.x,b.wind.z)-1)<1e-6)});
test('travel wrap re-enters boids ahead',()=>{const b=new Boids(60,4);b.travel=true;b.p[2]=6.5;b.step(1/30,.4);assert(b.p[2]<-20);for(let i=0;i<b.active;i++)assert(b.p[i*3+2]<=6+1e-6)});
test('edge glider and stripe are variants, off under pure rules',()=>{const l=new Life(24,7);l.grid.cells.fill(0);assert.equal(l.seedEdgeGlider(()=>.5),true);assert.equal(l.grid.cells.reduce((a,c)=>a+c,0),5);l.grid.cells.fill(0);assert.equal(l.stripe('x',()=>.2),true);assert(l.grid.cells.reduce((a,c)=>a+c,0)>0);const p=new Life(24,7);p.pure=true;assert.equal(p.seedEdgeGlider(()=>.5),false);assert.equal(p.stripe('y',()=>.5),false)});
