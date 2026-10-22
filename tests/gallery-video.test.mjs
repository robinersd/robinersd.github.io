import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

class Element extends EventTarget {
  dataset = {};
  props = new Map();
  style = { setProperty: (name,value) => this.props.set(name,value) };
  hidden = false;
  attrs = new Map();
  setAttribute(name,value) { this.attrs.set(name,String(value)); }
  emit(name,values={}) { this.dispatchEvent(Object.assign(new Event(name),values)); }
}
async function harness({ blocked=false, reduced=false, deferredSilence=false, deferredPlay=false, viewport=1280, contentLeft=360, sidebarRight=244 }={}) {
  const video=new Element(), sound=new Element(), motion=new Element(), status=new Element();
  const root=new Element(), doc=new Element(), preference=new Element();
  const copy=new Element();copy.paused=true;copy.muted=true;copy.currentTime=0;copy.readyState=1;
  copy.play=()=>{copy.paused=false;return Promise.resolve();};
  copy.pause=()=>{copy.paused=true;};
  root.querySelectorAll=()=>[copy];
  video.paused=true; video.muted=true;
  const plays=[];
  let resolvePlay;
  video.play=()=>{
    plays.push({muted:video.muted});
    if(blocked && !video.muted)return Promise.reject(new Error('NotAllowedError'));
    if(deferredPlay)return new Promise(resolve=>{resolvePlay=()=>{video.paused=false;video.emit('playing');resolve();};});
    video.paused=false;
    video.emit('playing');
    return Promise.resolve();
  };
  video.pause=()=>{video.paused=true;};
  root.querySelector=selector=>({'[data-gallery-video]':video,'[data-gallery-sound]':sound,'[data-gallery-motion]':motion,'[data-gallery-video-status]':status})[selector];
  const win=new Element();win.innerWidth=viewport;
  doc.documentElement={clientWidth:viewport};
  const sidebar=new Element();sidebar.getBoundingClientRect=()=>({right:sidebarRight});
  root.parentElement={getBoundingClientRect:()=>({left:contentLeft})};
  doc.querySelector=selector=>selector==='#portfolio-sidebar'?sidebar:root;
  preference.matches=reduced;
  const silences=new Set(), takeovers=new Set(), releases=[];
  let held=false, quiet=!deferredSilence, resolveSilence;
  let holds=0;
  const spotify={
    suspendForGallery(){held=true;holds++;return deferredSilence?new Promise(resolve=>{resolveSilence=resolve;}):Promise.resolve(true);},
    galleryIsSilent:()=>held&&quiet,
    releaseGallery(resume){held=false;releases.push(resume);},
    onGallerySilence(listener){silences.add(listener);return()=>silences.delete(listener);},
    onGalleryTakeover(listener){takeovers.add(listener);return()=>takeovers.delete(listener);},
  };
  let observe,disconnected=false;
  const source=(await fs.readFile(new URL('../site/assets/gallery-video.js',import.meta.url),'utf8')).replace('export function','function');
  const context=vm.createContext({document:doc,window:win,matchMedia:()=>preference,AbortController,
    IntersectionObserver:class{constructor(fn){observe=fn;}observe(){}disconnect(){disconnected=true;}}
  });
  vm.runInContext(source+'\nglobalThis.enable=enableGalleryVideo;',context);
  const cleanup=context.enable(spotify);
  const flush=()=>new Promise(resolve=>setImmediate(resolve));
  const view=async ratio=>{observe([{target:root,isIntersecting:ratio>0,intersectionRatio:ratio}]);await flush();};
  return {video,copy,root,sound,motion,status,doc,win,preference,plays,releases,cleanup,view,flush,
    resize(width,left,right){viewport=width;contentLeft=left;sidebarRight=right;win.innerWidth=width;doc.documentElement.clientWidth=width;win.emit('resize');},
    holds:()=>holds,disconnected:()=>disconnected,
    unblock:()=>{blocked=false;},
    acknowledge(){quiet=true;silences.forEach(fn=>fn(true));resolveSilence?.(true);},
    takeover(){held=false;takeovers.forEach(fn=>fn());},
    finishPlay:()=>resolvePlay?.(),
  };
}

test('gallery starts only when sufficiently visible, takes audio, and releases on exit',async()=>{
 const h=await harness();
 assert.equal(h.plays.length,0);
 await h.view(.2);assert.equal(h.plays.length,0);
 await h.view(.6);assert.equal(h.holds(),1);assert.equal(h.video.muted,false);assert.equal(h.video.paused,false);
 await h.view(0);assert.equal(h.video.muted,true);assert.equal(h.video.paused,true);assert.deepEqual(h.releases,[true]);
 h.cleanup();
});
test('audible autoplay rejection keeps a muted loop and recovers on the sound button',async()=>{
 const h=await harness({blocked:true});await h.view(.6);
 assert.deepEqual(h.plays.map(play=>play.muted),[false,true]);
 assert.equal(h.sound.attrs.get('aria-label'),'Enable gallery video sound');assert.equal(h.video.paused,false);
 h.unblock();h.sound.emit('click');await h.flush();
 assert.equal(h.video.muted,false);assert.equal(h.sound.attrs.get('aria-label'),'Mute gallery video');
 h.sound.emit('click');assert.equal(h.video.muted,true);
 h.cleanup();
});
test('video stays muted until Spotify confirms silence; late acknowledgements cannot restart an exited gallery',async()=>{
 const h=await harness({deferredSilence:true});await h.view(.6);
 assert.equal(h.video.muted,true);
 h.acknowledge();await h.flush();assert.equal(h.video.muted,false);
 h.cleanup();
 const late=await harness({deferredSilence:true});await late.view(.6);await late.view(0);
 const count=late.plays.length;late.acknowledge();await late.flush();
 assert.equal(late.plays.length,count);assert.equal(late.video.paused,true);late.cleanup();
});
test('hidden tabs pause without restarting Spotify; return and route cleanup settle audio correctly',async()=>{
 const h=await harness();await h.view(.6);h.doc.hidden=true;h.doc.emit('visibilitychange');
 assert.equal(h.video.paused,true);assert.equal(h.releases.length,0);
 h.doc.hidden=false;h.doc.emit('visibilitychange');await h.flush();assert.equal(h.video.paused,false);
 h.cleanup();assert.equal(h.video.paused,true);assert.equal(h.disconnected(),true);
 const count=h.plays.length;await h.view(.6);h.sound.emit('click');await h.flush();assert.equal(h.plays.length,count);
});
test('reduced motion requires explicit play and manual pause stays respected',async()=>{
 const h=await harness({reduced:true});await h.view(.6);assert.equal(h.plays.length,0);
 h.cleanup.togglePlayback();await h.flush();assert.equal(h.video.paused,false);
 h.cleanup.togglePlayback();assert.equal(h.video.paused,true);
 await h.view(0);await h.view(.6);assert.equal(h.video.paused,true);h.cleanup();
});
test('manual Spotify takeover mutes the video and video errors restore the prior music',async()=>{
 const h=await harness();await h.view(.6);h.takeover();assert.equal(h.video.muted,true);
 await h.view(0);assert.equal(h.releases.length,0);h.cleanup();
 const failed=await harness();await failed.view(.6);failed.video.emit('error');
 assert.equal(failed.video.paused,true);assert.equal(failed.sound.disabled,true);assert.deepEqual(failed.releases,[true]);failed.cleanup();
});
test('a late play promise cannot start audio after leaving the gallery',async()=>{
 const h=await harness({deferredPlay:true});await h.view(.6);await h.view(0);
 h.finishPlay();await h.flush();assert.equal(h.video.muted,true);assert.equal(h.video.paused,true);h.cleanup();
});

test('the marquee copy stays muted, follows video time, and pauses with the primary',async()=>{
 const h=await harness();await h.view(.6);
 assert.equal(h.copy.paused,false);assert.equal(h.copy.muted,true);
 h.video.currentTime=4.25;h.copy.currentTime=1;h.video.emit('timeupdate');
 assert.equal(h.copy.currentTime,4.25);
 h.cleanup.togglePlayback();assert.equal(h.video.paused,true);assert.equal(h.copy.paused,true);
 assert.equal(h.root.dataset.videoPlaying,'false');
 h.cleanup.togglePlayback();await h.flush();assert.equal(h.root.dataset.videoPlaying,'true');
 await h.view(0);assert.equal(h.copy.paused,true);h.cleanup();
});

test('Space on the gallery toggles playback while controls retain their own keys',async()=>{
 const h=await harness();await h.view(.6);
 h.root.emit('keydown',{key:' '});assert.equal(h.video.paused,true);
 h.root.emit('keydown',{key:' '});await h.flush();assert.equal(h.video.paused,false);h.cleanup();
});

test('the gallery reaches the viewport edge and clips exactly at the sidebar across sizes',async()=>{
 for(const [viewport,contentLeft,sidebarRight] of [[1920,692,244],[1280,360,244],[820,208,192],[390,24,0]]){
  const h=await harness({viewport,contentLeft,sidebarRight});
  const width=parseFloat(h.root.props.get('--gallery-width'));
  const shift=parseFloat(h.root.props.get('--gallery-shift'));
  assert.equal(contentLeft+shift,sidebarRight,'left edge meets the sidebar, never enters it');
  assert.equal(contentLeft+shift+width,viewport,'right edge has no unused gutter');
  h.cleanup();
 }
 const h=await harness();h.resize(390,24,244);
 assert.equal(h.root.props.get('--gallery-width'),'390px');assert.equal(h.root.props.get('--gallery-shift'),'-24px');
 h.cleanup();const before=h.root.props.get('--gallery-width');h.resize(820,208,192);assert.equal(h.root.props.get('--gallery-width'),before);
});
