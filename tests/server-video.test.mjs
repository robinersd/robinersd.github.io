import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

test('local preview handler serves MP4 byte ranges for phone playback',async()=>{
 const serverUrl=new URL('../server.mjs',import.meta.url);
 const source=(await fs.readFile(serverUrl,'utf8'))
   .replace(/^import .*;\r?\n/gm,'')
   .replaceAll('import.meta.url',JSON.stringify(serverUrl.href));
 let handler;
 const server={on(){return server;},listen(){},address(){return{port:8081};}};
 const context=vm.createContext({
   http:{createServer(fn){handler=fn;return server;}},fs,path,fileURLToPath,createHash,
   networkInterfaces:()=>({}),robinerChat:()=>{throw new Error('Unexpected chat call');},
   process:{env:{PORT:'0'},exit(){throw new Error('Unexpected exit');}},
   URL,Buffer,console:{log(){},warn(){},error(){}},
 });
 vm.runInContext(source,context);
 const file=await fs.readFile(new URL('../site/assets/video/gallery-background-120.mp4',import.meta.url));
 async function request(headers={},method='GET'){
   const response={statusCode:200,headers:new Map(),setHeader(name,value){this.headers.set(name.toLowerCase(),String(value));},end(body){this.body=body;return this;}};
   await handler({url:'/assets/video/gallery-background-120.mp4',headers,method},response);
   return response;
 }
 let response=await request({range:'bytes=0-31'});
 assert.equal(response.statusCode,206);assert.equal(response.headers.get('content-type'),'video/mp4');
 assert.equal(response.headers.get('content-range'),`bytes 0-31/${file.length}`);
 assert.deepEqual(response.body,file.subarray(0,32));
 response=await request({range:'bytes=-16'});
 assert.deepEqual(response.body,file.subarray(-16));
 response=await request({},'HEAD');
 assert.equal(response.headers.get('content-length'),String(file.length));
 assert.equal(response.headers.get('accept-ranges'),'bytes');assert.equal(response.body,undefined);
 for(const range of [`bytes=${file.length}-`,'bytes=50-20','bytes=0-1,4-5','bytes=-0']){
   response=await request({range});assert.equal(response.statusCode,416);
   assert.equal(response.headers.get('content-range'),`bytes */${file.length}`);
 }
 response=await request({range:'bytes=0-31','if-range':'different-version'});
 assert.equal(response.statusCode,200);assert.deepEqual(response.body,file);
});
