import{w as a}from"./dom-p35nF2Sa.js";/*! All material copyright ESRI, All Rights Reserved, unless otherwise specified.
See https://github.com/Esri/calcite-design-system/blob/dev/LICENSE.md for details.
v3.3.0 */function e(i){return i[i.openProp||"open"]}async function s(i){await i.updateComplete,e(i)?i.onBeforeOpen():i.onBeforeClose(),await i.updateComplete,i.transitionEl&&await a(i.transitionEl,i.transitionProp),e(i)?i.onOpen():i.onClose()}export{s as t};
