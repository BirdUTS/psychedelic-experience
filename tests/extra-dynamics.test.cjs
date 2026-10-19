const {test}=require('node:test');
const assert=require('node:assert/strict');
const {LifeGrid,ReactiveDirector}=require('../extra-dynamics.js');
function set(grid,points){for(const [x,y] of points)grid.cells[y*grid.size+x]=1;}
test('B3/S23 block remains stable',()=>{const g=new LifeGrid(8);set(g,[[2,2],[2,3],[3,2],[3,3]]);const before=g.cells.slice();g.step();assert.deepEqual(g.cells,before)});
test('blinker updates synchronously and returns after two generations',()=>{const g=new LifeGrid(8);set(g,[[2,3],[3,3],[4,3]]);const before=g.cells.slice();g.step();assert.equal(g.cells[2*8+3],1);assert.equal(g.cells[3*8+2],0);g.step();assert.deepEqual(g.cells,before)});
test('glider crosses wrapping boundary after four generations',()=>{const g=new LifeGrid(8),points=[[6,5],[7,6],[5,7],[6,7],[7,7]];set(g,points);for(let i=0;i<4;i++)g.step();const expected=new LifeGrid(8);set(expected,points.map(([x,y])=>[(x+1)%8,(y+1)%8]));assert.deepEqual(g.cells,expected.cells)});
test('isolated cell dies, empty board stays empty',()=>{const g=new LifeGrid(8);set(g,[[3,3]]);g.step();assert.equal(g.cells.reduce((a,b)=>a+b),0);g.step();assert.equal(g.cells.reduce((a,b)=>a+b),0)});
test('steady sound does not repeatedly fire onset detector',()=>{const d=new ReactiveDirector();for(let i=0;i<600;i++)d.update(1/60,{bass:.5,mid:.3,treble:.1,active:true});assert.equal(d.beats,1);assert(d.rate>1)});
test('silence still tours but manual never changes scene',()=>{for(const auto of [true,false]){const d=new ReactiveDirector();let switches=0;for(let i=0;i<1800;i++)if(d.update(1/60,{bass:0,mid:0,treble:0,active:false},1,auto).switchDue)switches++;assert.equal(switches,auto?1:0);assert.equal(d.beats,0)}});
test('transient responds then decays without rapid scene switching',()=>{const d=new ReactiveDirector();let switches=0;for(let i=0;i<1200;i++){const hit=i%30===0;const r=d.update(1/60,{bass:hit?.8:.1,mid:.2,treble:.1,active:true});if(r.switchDue)switches++;assert(Number.isFinite(d.zoom));assert(d.zoom>.5&&d.zoom<2)}assert(d.beats>20);assert(switches<=1)});
