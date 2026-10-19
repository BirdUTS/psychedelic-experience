import {test} from 'node:test'; import assert from 'node:assert/strict';
import {BeatClock, WorldClock, BeatPredictor} from '../immersive/engine/beat-clock.mjs';
const FPS=60, dt=1/FPS, wrap=x=>((x%1)+1)%1, circ=(a,b)=>{const d=wrap(a-b);return d>.5?d-1:d};
function drive(clock,bpm,seconds,{C=.9,offset=0,extra}={}){const period=Math.round(FPS*60/bpm);for(let k=0;k<seconds*FPS;k++){clock.update(dt,{onset:(k+offset)%period===0?1:0,bpm,C});extra?.(k)}}
test('locks to a 120 BPM click train within 4 s with phase error under 10 %',()=>{const c=new BeatClock();drive(c,120,4,{offset:11});let worst=0;drive(c,120,4,{offset:11,extra:k=>{if((k+11)%30===0)worst=Math.max(worst,c.distanceToBeat())}});assert(worst<.1,`worst ${worst}`)});
test('latency advances the reported phase by exactly latency·bpm/60',()=>{const a=new BeatClock(),b=new BeatClock({latency:.04});drive(a,120,3);drive(b,120,3);assert(Math.abs(circ(b.phase,a.phase)-.08)<1e-6)});
test('beatIndex counts wraps and wrapped is a one-frame flag',()=>{const c=new BeatClock();let flags=0;drive(c,120,10,{extra:()=>{if(c.wrapped)flags++}});assert.equal(c.beatIndex,flags);assert(c.beatIndex>=19&&c.beatIndex<=21,`beats ${c.beatIndex}`)});
test('world clock leads by +phiMax when I=+1 and lags by −phiMax when I=−1',()=>{for(const I of [1,-1]){const w=new WorldClock();let m=0;for(let k=0;k<20*FPS;k++){m=wrap(m+dt*2);w.update(dt,{musicPhase:m,C:1,I,omega:2})}const off=circ(w.phase,m);assert(Math.abs(off-I*.12)<.024,`I ${I} offset ${off}`)}});
test('entrains to a beat far from its natural frequency when coherence is high',()=>{const w=new WorldClock();let m=0;for(let k=0;k<10*FPS;k++){m=wrap(m+dt*2);w.update(dt,{musicPhase:m,C:1,I:0,omega:.35,musicHz:2})}assert(Math.abs(circ(w.phase,m))<.03,`offset ${circ(w.phase,m)}`)});
test('free-runs at omega when C is 0',()=>{const w=new WorldClock();w.omega=.5;for(let k=0;k<2*FPS;k++)w.update(dt,{musicPhase:Math.random(),C:0,I:1});assert(Math.abs(circ(w.phase,0))<2e-3)});
test('pulse is 1 on the beat and 0 half a cycle away',()=>{const w=new WorldClock();w.phase=0;assert(Math.abs(w.pulse()-1)<1e-9);w.phase=.5;assert.equal(w.pulse(),0)});
test('predictor remembers energy per phase bin',()=>{const p=new BeatPredictor(8);assert.equal(p.predict(.1),null);for(let i=0;i<20;i++){p.observe(.01,1);p.observe(.51,.2)}assert(p.predict(.02)>.9);assert(Math.abs(p.predict(.5)-.2)<.05)});
