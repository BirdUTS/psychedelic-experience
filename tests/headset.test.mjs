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
