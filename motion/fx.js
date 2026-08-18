/* ------------------------------------------------------------------
   Elderly · Motion FX
   Built on Motion (motion.dev), MIT, vendored at /motion/motion.js.
   Patterns taken from the official docs via the Motion AI Kit MCP:
   inView (scroll-triggered), stagger, scroll (scroll-linked), animate.

   Principles for this site:
   - Nothing is ever hidden by CSS. If this file fails to load or throws,
     the page renders complete. Hiding happens in JS, right before the
     observer that will undo it.
   - prefers-reduced-motion turns the whole layer off.
   - Elements that already own an animation (hero phones, marquee, flip
     cards, carousels) are left alone.
   ------------------------------------------------------------------ */

(function () {
  "use strict";

  var M = window.Motion;
  if (!M) return;

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;

  var animate = M.animate,
      inView = M.inView,
      stagger = M.stagger,
      scroll = M.scroll;

  var hidden = [];   // everything we dimmed, for the failsafe
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  /* ---------------- reveal on scroll ---------------- */

  // Hide now, animate back in when the block reaches the viewport.
  // `y` is the travel in px, `step` the stagger between siblings.
  function reveal(sel, opts) {
    var els = $$(sel).filter(function (el) {
      return !el.hasAttribute("data-fx-done");
    });
    if (!els.length) return;

    opts = opts || {};
    var y = opts.y == null ? 16 : opts.y;
    var step = opts.step == null ? 0.07 : opts.step;

    // Hidden with plain inline CSS, and revealed from explicit keyframes,
    // so Motion never has to read back a half-applied initial state.
    els.forEach(function (el) {
      el.setAttribute("data-fx-done", "");
      el.style.willChange = "opacity, transform";
      el.style.opacity = "0";
      el.style.transform = "translateY(" + y + "px)";
      hidden.push(el);
    });

    // `each` is for elements scattered down a long page — an article's
    // headings and callouts — where each one waits for its own cue.
    // Otherwise the group reveals together, staggered, when its first
    // element lands, so a row of cards cascades instead of firing card
    // by card as each one crosses the line.
    if (opts.each) {
      els.forEach(function (el) { armGroup([el], y, 0); });
      return;
    }
    armGroup(els, y, step);
  }

  function armGroup(els, y, step) {
    inView(
      els[0],
      function () {
        var run = animate(
          els,
          { opacity: [0, 1], y: [y, 0] },
          { type: "spring", duration: 0.6, bounce: 0, delay: stagger(step) }
        );
        // Hand the transform back to CSS so :hover lifts still work.
        if (run && run.then) {
          run.then(function () {
            // A frame later, so the cleanup lands after Motion commits its
            // own final values and does not leave an inline transform
            // sitting on top of the :hover rules.
            window.requestAnimationFrame(function () {
              els.forEach(function (el) {
                el.style.willChange = "";
                el.style.transform = "";
                el.style.opacity = "";
              });
            });
          });
        }
      },
      { margin: "0px 0px -10% 0px" }
    );
  }

  /* ---------------- reading progress ---------------- */

  function progress() {
    if (document.body.scrollHeight < window.innerHeight * 2.5) return;
    var bar = document.createElement("div");
    bar.className = "fx-progress";
    bar.setAttribute("aria-hidden", "true");
    document.body.appendChild(bar);
    // ScrollTimeline where the browser supports it: no scroll listener.
    scroll(animate(bar, { scaleX: [0, 1] }, { ease: "linear" }));
  }

  /* ---------------- hero parallax ---------------- */

  function parallax() {
    var hero = $(".hero");
    var art = $(".hero .duo-wrap") || $(".hero .phone-wrap");
    if (!hero || !art) return;
    if (window.innerWidth < 1000) return;  // no parallax on small screens

    scroll(animate(art, { y: [0, -60] }, { ease: "linear" }), {
      target: hero,
      offset: ["start start", "end start"]
    });
  }

  /* ---------------- counting numbers ---------------- */

  // "50%", "$4.9B", "48M" -> counts the numeric part, keeps prefix/suffix.
  function counters() {
    $$(".stats .stat b").forEach(function (el) {
      var raw = el.textContent.trim();
      var m = raw.match(/^([^0-9]*)([0-9][0-9.,]*)(.*)$/);
      if (!m) return;

      var pre = m[1], num = m[2], suf = m[3];
      var target = parseFloat(num.replace(/,/g, ""));
      if (!isFinite(target)) return;
      var decimals = (num.split(".")[1] || "").length;

      // Hold the final width so the row does not reflow while counting.
      el.style.minWidth = el.getBoundingClientRect().width + "px";
      el.style.display = "block";

      inView(
        el,
        function () {
          animate(0, target, {
            duration: 1.1,
            ease: "easeOut",
            onUpdate: function (v) { el.textContent = pre + v.toFixed(decimals) + suf; },
            onComplete: function () { el.textContent = raw; el.style.minWidth = ""; }
          });
        },
        { amount: 0.6 }
      );
    });
  }

  /* ---------------- FAQ panel swap ---------------- */

  // The tabs already work on their own; this only softens the swap.
  function faq() {
    var tabs = $$(".faq .ftab");
    if (!tabs.length) return;
    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        window.requestAnimationFrame(function () {
          var panel = $(".faq .fgroup-panel.on");
          if (!panel) return;
          animate(
            panel,
            { opacity: [0, 1], y: [8, 0] },
            { type: "spring", duration: 0.45, bounce: 0 }
          );
        });
      });
    });
  }

  /* ---------------- failsafe ---------------- */

  // Drop our inline styles and hand the element back to the stylesheet.
  // Deliberately independent of Motion: this is the path that has to work
  // when something else has already gone wrong.
  function force(el) {
    el.classList.add("fx-shown");
    el.style.opacity = "";
    el.style.transform = "";
    el.style.willChange = "";
  }

  function visible(el) {
    return parseFloat(window.getComputedStyle(el).opacity) >= 0.9;
  }

  // A fast scroll — End, a jump to #faq, a flicked trackpad — can move a
  // whole section past the viewport between two frames, and the observer
  // never sees it intersect. Anything left behind above the fold is shown
  // outright: it is off screen, so there is nothing to animate.
  function sweep() {
    var h = window.innerHeight || 0;
    hidden = hidden.filter(function (el) {
      if (visible(el)) return false;
      if (el.getBoundingClientRect().bottom < 0) { force(el); return false; }
      return true;
    });
    return hidden.length;
  }

  // On screen and still at zero well after its cue: the observer never
  // fired for it. Anything mid-reveal is above 0.02 and is left alone.
  function rescueVisible() {
    var h = window.innerHeight || 0;
    hidden.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > h) return;
      if (parseFloat(window.getComputedStyle(el).opacity) < 0.02) force(el);
    });
  }

  function failsafe() {
    window.setTimeout(rescueVisible, 2500);

    var last = 0, pending = null;
    function onScroll() {
      var now = Date.now();
      if (now - last < 250) return;
      last = now;
      if (!sweep()) {
        window.removeEventListener("scroll", onScroll);
        return;
      }
      window.clearTimeout(pending);
      pending = window.setTimeout(rescueVisible, 900);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---------------- what gets revealed ---------------- */

  function start() {
    try { progress(); } catch (e) {}
    try { parallax(); } catch (e) {}
    try { counters(); } catch (e) {}
    try { faq(); } catch (e) {}

    // --- landing (index.html) ---
    // The hero is deliberately untouched: it animates itself and it is
    // the first thing a visitor sees.
    reveal(".how .builder-head > *", { y: 14 });
    reveal(".how .how-shell", { y: 18, step: 0 });
    reveal(".how .how-dots", { y: 10, step: 0 });
    reveal(".trust .trust-photo", { y: 20, step: 0 });
    reveal(".trust .trust-grid > div > *", { y: 16, step: 0.08 });
    reveal(".trust .honest-note", { y: 12, step: 0 });
    reveal(".trust .fullcall", { y: 22, step: 0 });
    reveal(".asked .asked-head > *", { y: 14, step: 0.08 });
    reveal(".asked .asked-more", { y: 12, step: 0 });
    reveal(".pfsec .pf-card", { y: 22, step: 0 });
    reveal(".closing .closing-photo", { y: 22, step: 0 });
    reveal(".closing .cslider", { y: 18, step: 0 });
    reveal(".stats .call-line", { y: 16, step: 0 });
    reveal(".stats .stats-grid .stat", { y: 20, step: 0.09 });
    reveal(".faq .wide > h2", { y: 16, step: 0 });
    reveal(".faq .faq-tabs", { y: 12, step: 0 });
    reveal("footer .wrap", { y: 12, step: 0 });

    // --- blog ---
    reveal(".blist .bc", { y: 20, step: 0.09 });
    reveal(".head > *", { y: 14, step: 0.07 });
    // Article: the masthead as one group, then the callouts one at a time
    // on the way down. Body paragraphs are left alone — text you are
    // there to read should not have to arrive first.
    reveal("article > .cat, article > h1, article > .meta", { y: 14, step: 0.07 });
    reveal("article > h2, article > .stat, article > .solve, article > .src, article > .endcta",
           { y: 18, each: true });

    failsafe();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
