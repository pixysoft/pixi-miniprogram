/**
 * easing — 缓动函数库（输入 t∈[0,1]，输出比例）
 * 命名对齐 myTween / cocos tweenfunc，供 actions 与 ScrollView 共用
 */

var PI = Math.PI;

function linear(t) { return t; }

function quadIn(t) { return t * t; }
function quadOut(t) { return t * (2 - t); }
function quadInOut(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

function cubicIn(t) { return t * t * t; }
function cubicOut(t) { var p = t - 1; return p * p * p + 1; }
function cubicInOut(t) { return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1; }

function quartOut(t) { var p = t - 1; return 1 - p * p * p * p; }

function quintOut(t) { var p = t - 1; return p * p * p * p * p + 1; }

function sineIn(t) { return 1 - Math.cos(t * PI / 2); }
function sineOut(t) { return Math.sin(t * PI / 2); }
function sineInOut(t) { return -(Math.cos(PI * t) - 1) / 2; }

function expoOut(t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); }

function circOut(t) { var p = t - 1; return Math.sqrt(1 - p * p); }

function backIn(t) { var s = 1.70158; return t * t * ((s + 1) * t - s); }
function backOut(t) { var s = 1.70158; var p = t - 1; return p * p * ((s + 1) * p + s) + 1; }

function elasticOut(t) {
  if (t === 0 || t === 1) { return t; }
  return Math.pow(2, -10 * t) * Math.sin((t - 0.075) * (2 * PI) / 0.3) + 1;
}

function bounceOut(t) {
  if (t < 1 / 2.75) { return 7.5625 * t * t; }
  if (t < 2 / 2.75) { t -= 1.5 / 2.75; return 7.5625 * t * t + 0.75; }
  if (t < 2.5 / 2.75) { t -= 2.25 / 2.75; return 7.5625 * t * t + 0.9375; }
  t -= 2.625 / 2.75;
  return 7.5625 * t * t + 0.984375;
}

module.exports = {
  linear: linear,
  quadIn: quadIn, quadOut: quadOut, quadInOut: quadInOut,
  cubicIn: cubicIn, cubicOut: cubicOut, cubicInOut: cubicInOut,
  quartOut: quartOut,
  quintOut: quintOut,
  sineIn: sineIn, sineOut: sineOut, sineInOut: sineInOut,
  expoOut: expoOut,
  circOut: circOut,
  backIn: backIn, backOut: backOut,
  elasticOut: elasticOut,
  bounceOut: bounceOut
};
