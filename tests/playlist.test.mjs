import {test} from 'node:test'; import assert from 'node:assert/strict';
import {Playlist} from '../immersive/engine/playlist.mjs';
const tracks=[{id:'a',src:'a.mp3'},{id:'b',src:'b.mp3'},{id:'c',src:'c.mp3'}];
test('advances, wraps when looping, stops when not',()=>{const p=new Playlist(tracks);assert.equal(p.current().id,'a');assert.equal(p.next().id,'b');assert.equal(p.next().id,'c');assert.equal(p.next().id,'a');p.loop=false;p.select(2);assert.equal(p.next(),null);assert.equal(p.current().id,'c')});
test('empty playlist is safe',()=>{const p=new Playlist();assert.equal(p.current(),null);assert.equal(p.next(),null);assert.equal(p.select(3),null)});
