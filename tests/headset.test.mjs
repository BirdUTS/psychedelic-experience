import {test} from 'node:test'; import assert from 'node:assert/strict';
import {headsetLine, triggerAction, nextWorld} from '../immersive/engine/headset.mjs';

test('the VR line shows only where immersive VR runs, and never during a session',()=>{
  assert.equal(headsetLine({supported:true,presenting:false}),true,'a Quest before entering');
  assert.equal(headsetLine({supported:false,presenting:false}),false,'a phone or laptop never sees it');
  assert.equal(headsetLine({supported:true,presenting:true}),false,'gone while presenting');
  assert.equal(headsetLine({supported:true,presenting:false}),true,'back once the session ends, so a second visit needs no ?dev');
  assert.equal(headsetLine(),false);
});
test('in VR the left trigger changes the world and the right one flies or hovers',()=>{
  assert.equal(triggerAction(0),'world');assert.equal(triggerAction(1),'flight');
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
