const test=require("node:test");
const assert=require("node:assert/strict");
const {md5}=require("../md5.js");
test("MD5 known vector admin",()=>assert.equal(md5("admin"),"21232f297a57a5a743894a0e4a801fc3"));
test("MD5 known vector empty",()=>assert.equal(md5(""),"d41d8cd98f00b204e9800998ecf8427e"));