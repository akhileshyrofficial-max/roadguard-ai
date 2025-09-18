import{a as o}from"./index-CwGg5qjg.js";/*! All material copyright ESRI, All Rights Reserved, unless otherwise specified.
See https://github.com/Esri/calcite-design-system/blob/dev/LICENSE.md for details.
v3.3.0 */const s=()=>o((c,a)=>{const e=new Set;return a.onDisconnected(()=>{e.forEach(r=>r.cancel())}),{add:r=>{[r].flat().forEach(n=>e.add(n))},resources:e}});export{s as u};
