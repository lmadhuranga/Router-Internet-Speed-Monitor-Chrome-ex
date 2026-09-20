const test=require("node:test");
const assert=require("node:assert/strict");
global.RouterCore=require("../core.js");
const Store=require("../storage.js");

function memoryStorage(initial={}){
  const data={...initial};
  return {
    async get(keys){const out={}; for(const k of keys) if(k in data) out[k]=data[k]; return out;},
    async set(values){Object.assign(data,values);},
    data
  };
}
test("initializes only missing settings",async()=>{
  const s=memoryStorage({routerOrigin:"http://192.168.1.1"});
  await Store.initializeSettings(s);
  assert.equal(s.data.routerOrigin,"http://192.168.1.1");
  assert.equal(s.data.theme,"dark");
});
test("does not persist plaintext password field",async()=>{
  const s=memoryStorage();
  await Store.initializeSettings(s);
  assert.equal("routerPassword" in s.data,false);
  assert.ok(s.data.routerPasswordHash);
});