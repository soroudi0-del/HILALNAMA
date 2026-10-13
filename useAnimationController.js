import { useState, useEffect, useRef } from 'react';
var Engine = require('../calculations/crescentAnalysisEngine');

// ============================================================
// useAnimationController — SECTION 4 + SECTION 10 سند طراحی.
//
// «Add a timeline slider. When user drags it, everything updates:
// Sky Simulation, Timeline cursor, Moon position, Sun position,
// All numerical values, Current visibility, Best Time marker.
// Animation must also use this controller.»
//
// این هوک state واحد زمان‌سنج (cursorTime) را نگه می‌دارد و منطق
// Play/Pause را کپسوله می‌کند، تا هم اسکراب دستی (از Timeline یا
// SkySimulation) و هم انیمیشن خودکار از یک مسیر واحد رد شوند —
// دقیقاً همان چیزی که SECTION 10 با «Separate ... AnimationController»
// می‌خواهد: منطق UI (کدام کامپوننت لمس شد) از منطق زمان (چه زمانی
// الان فعال است) جدا بماند.
//
// استفاده:
//   var anim = useAnimationController(points, bestTime);
//   anim.cursorTime, anim.cursorPoint, anim.playing,
//   anim.play(), anim.pause(), anim.toggle(), anim.scrub(date)
// ============================================================

var FRAME_MS = 120; // سرعت انیمیشن (هر فریم = ۱ نمونه‌ی ۱-دقیقه‌ای)

function useAnimationController(points, initialTime) {
  var s1 = useState(initialTime || null);
  var cursorTime = s1[0];
  var setCursorTime = s1[1];
  var s2 = useState(false);
  var playing = s2[0];
  var setPlaying = s2[1];

  var timerRef = useRef(null);

  // اگر points عوض شود (روز/شهر/معیار جدید) و cursorTime دیگر در
  // بازه نباشد، آن را به initialTime (معمولاً bestTime) برمی‌گردانیم.
  useEffect(function () {
    if (!points || points.length === 0) return;
    var inRange = cursorTime &&
      cursorTime.getTime() >= points[0].time.getTime() &&
      cursorTime.getTime() <= points[points.length - 1].time.getTime();
    if (!inRange) {
      setCursorTime(initialTime && initialTime.getTime ? initialTime : points[0].time);
    }
    // eslint-disable-next-line
  }, [points]);

  useEffect(function () {
    if (!playing || !points || points.length === 0) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    var idx = 0;
    if (cursorTime) {
      for (var i = 0; i < points.length; i++) {
        if (points[i].time.getTime() >= cursorTime.getTime()) { idx = i; break; }
      }
    }
    timerRef.current = setInterval(function () {
      idx += 1;
      if (idx >= points.length) {
        setPlaying(false);
        clearInterval(timerRef.current);
        return;
      }
      setCursorTime(points[idx].time);
    }, FRAME_MS);
    return function () { clearInterval(timerRef.current); };
    // eslint-disable-next-line
  }, [playing]);

  var cursorPoint = Engine.findPointNear(points, cursorTime);

  return {
    cursorTime: cursorTime,
    cursorPoint: cursorPoint,
    playing: playing,
    play: function () { setPlaying(true); },
    pause: function () { setPlaying(false); },
    toggle: function () { setPlaying(function (p) { return !p; }); },
    scrub: function (date) { setPlaying(false); setCursorTime(date); },
  };
}

module.exports = useAnimationController;
