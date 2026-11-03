import {test} from 'node:test'; import assert from 'node:assert/strict';
import {headsetLine, triggerAction, nextWorld} from '../immersive/engine/headset.mjs';

test('the VR line shows only where immersive VR runs, and never during a session',()=>{
  assert.equal(headsetLine({supported:true,presenting:false}),true,'a Quest before entering');
  assert.equal(headsetLine({supported:false,presenting:false}),false,'a phone or laptop never sees it');
  assert.equal(headsetLine({supported:true,presenting:true}),false,'gone while presenting');
  assert.equal(headsetLine({supported:true,presenting:false}),true,'back once the session ends, so a second visit needs no ?dev');
  assert.equal(headsetLine(),false);
});
test('in VR the left hand changes the world and the right one flies, by handedness, not by the slot three.js filled first',()=>{
  assert.equal(triggerAction('left',0),'world');assert.equal(triggerAction('right',1),'flight');
  assert.equal(triggerAction('right',0),'flight','a right hand tracked first lands in slot 0 and must still fly');
  assert.equal(triggerAction('left',1),'world','a left hand tracked second still changes the world');
  assert.equal(triggerAction('none',0),'world','no handedness: the slot decides');assert.equal(triggerAction(undefined,1),'flight');
});
test('the next world wraps around, and an unknown start lands on the first',()=>{
  const w=['physarum','swarm','boids','life'];
  assert.equal(nextWorld(w,'physarum'),'swarm');assert.equal(nextWorld(w,'life'),'physarum');assert.equal(nextWorld(w,'nowhere'),'physarum');
});

import {GripHold} from '../immersive/engine/headset.mjs';
test('a short squeeze is music; a squeeze held one second is leave, once, with no music on the release',()=>{
  const g=new GripHold();
  g.down(0,0);assert.equal(g.tick(300),null);assert.equal(g.up(0,400),'music','a short squeeze');
  g.down(1,1000);assert.equal(g.tick(1500),null);assert.equal(g.tick(2000),'leave','either hand, one second');
  assert.equal(g.tick(2100),null,'fires once');assert.equal(g.up(1,2200),null,'the release after a leave is nothing');
  assert.equal(g.up(0,2300),null,'a release with no press is nothing');
  g.down(0,3000);assert.equal(g.up(0,3200),'music','the next squeeze works again');
});
test('a session end can swallow the release: reset clears a held grip so the next session works',()=>{
  const g=new GripHold();g.down(1,0);assert.equal(g.tick(1000),'leave');g.reset();g.down(0,5000);assert.equal(g.up(0,5200),'music');
});

import {foldCount} from '../immersive/engine/headset.mjs';
test('the ?folds load test is 1 unless asked, whole, and never more than 8 (a headset must not be frozen by a typo)',()=>{
  assert.equal(foldCount(null),1);assert.equal(foldCount(''),1);assert.equal(foldCount('4'),4);assert.equal(foldCount('100'),8);
  assert.equal(foldCount('abc'),1);assert.equal(foldCount('0'),1);assert.equal(foldCount('2.7'),2);
});

import {LookDown} from '../immersive/engine/headset.mjs';
test('looking down at your feet for two seconds leaves VR, once; a glance down does nothing',()=>{
  const f=new LookDown();
  assert.deepEqual(f.tick(0,0),{progress:0,leave:false},'looking ahead');
  assert.deepEqual(f.tick(-0.9,1000),{progress:0,leave:false},'the first look down only starts the clock');
  assert.equal(f.tick(-0.9,2000).progress,0.5,'half way: the ring is half closed');
  assert.deepEqual(f.tick(-1,3000),{progress:1,leave:true},'two seconds: leave');
  assert.deepEqual(f.tick(-1,3100),{progress:1,leave:false},'fires once');
});
test('looking up again resets the clock; a shallow look down (30°) and a missing pose never count',()=>{
  const f=new LookDown();
  f.tick(-0.9,0);f.tick(-0.9,1500);
  assert.deepEqual(f.tick(-0.2,1600),{progress:0,leave:false},'looked up');
  f.tick(-0.9,2000);assert.equal(f.tick(-0.9,3000).progress,0.5,'a fresh count');
  assert.equal(f.tick(-0.5,5000).progress,0,'30° below the horizon is just looking at the world');
  assert.equal(f.tick(NaN,6000).progress,0,'no pose yet is not a look down');
});
test('reset clears a look that a session end cut short, so the next session starts clean',()=>{
  const f=new LookDown();f.tick(-1,0);f.tick(-1,2000);f.reset();assert.deepEqual(f.tick(-1,5000),{progress:0,leave:false});
});
