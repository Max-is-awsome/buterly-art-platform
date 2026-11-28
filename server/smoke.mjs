import assert from 'node:assert/strict';
const base=process.env.API_ORIGIN;if(!base)throw Error('Set API_ORIGIN');
const get=async(path)=>{const r=await fetch(base+path);return {status:r.status,data:await r.json()}};
const health=await get('/api/health');assert.equal(health.status,200);assert.equal(health.data.ok,true);
const graph=await get('/api/nodes');assert.equal(graph.status,200);assert.ok(graph.data.some(n=>n.id===1000001&&n.medium==='Spark'));assert.ok(graph.data.some(n=>n.id===1000017&&n.mime==='video/mp4'));const ids=new Set(graph.data.map(n=>n.id));for(const node of graph.data){assert.equal(node.author_id,undefined);assert.equal(node.email,undefined);assert.ok(node.parents.every(id=>ids.has(id)))}
const privateData=await get('/api/private');assert.equal(privateData.status,401);
const write=await fetch(base+'/api/nodes',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({title:'Unauthorized attempt',medium:'Writing',text:'Not published',parents:[0]})});assert.equal(write.status,401);
const forged=await fetch(base+'/api/draft',{method:'PUT',headers:{Origin:'https://untrusted.example','Content-Type':'application/json'},body:'{}'});assert.equal(forged.status,403);
console.log('PASS: database health, public graph, references, private-data protection, anonymous publish denial, origin protection');
