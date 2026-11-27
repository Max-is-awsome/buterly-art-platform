import {test} from 'node:test';import assert from 'node:assert/strict';import {artworkSchema,decodeMedia} from './validation.mjs';
test('rejects unparented and empty work',()=>{assert.equal(artworkSchema.safeParse({title:'a',medium:'Writing',parents:[],text:'poem'}).success,false);assert.equal(artworkSchema.safeParse({title:'a',medium:'Writing',parents:[1],text:' '}).success,false)});
test('deduplicates parents and strips client owner/id',()=>{const p=artworkSchema.parse({title:'a',medium:'Writing',parents:[1,1],text:'poem',author_id:2,id:99});assert.deepEqual(p.parents,[1]);assert.equal(p.id,undefined);assert.equal(p.author_id,undefined)});
test('rejects disguised media',()=>assert.throws(()=>decodeMedia('data:image/png;base64,PHNjcmlwdD4=','image/png')));
