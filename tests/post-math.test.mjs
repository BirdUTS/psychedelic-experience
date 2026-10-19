import {test} from 'node:test'; import assert from 'node:assert/strict';
import {mixFeedback, MAX_DECAY} from '../immersive/engine/feedback-math.mjs';
import {paletteHSL, PALETTES, PALETTE_MODES} from '../immersive/engine/palettes.mjs';
test('ten thousand frames of maximum feedback never reach white',()=>{let prev=0,maxv=0;for(let i=0;i<10000;i++){prev=mixFeedback(prev,1,1);maxv=Math.max(maxv,prev);assert(prev<=maxv+1e-12)}assert(maxv<.999,`max ${maxv}`);assert.equal(MAX_DECAY,.96)});
test('no previous frame reproduces the tone-mapped current frame',()=>{assert(Math.abs(mixFeedback(0,.5,.9)-(1-Math.exp(-.5)))<1e-12)});
test('palette modes order saturation and respect lightness ranges',()=>{assert.deepEqual(PALETTE_MODES,['ink','silk','ember','neon']);const s=m=>paletteHSL(m,.3,.5,.5)[1];assert(s('ink')<s('silk')&&s('silk')<s('ember')&&s('ember')<=s('neon'));for(const m of PALETTE_MODES)for(const v of [0,.5,1]){const [h,,l]=paletteHSL(m,.3,.2,v);assert(h>=0&&h<1);assert(l>=PALETTES[m].light[0]-1e-9&&l<=PALETTES[m].light[1]+1e-9)}assert(Math.abs(paletteHSL('ember',.9,.5,.5)[0]-.06)<1e-9)});
