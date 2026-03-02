import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import { Observer } from 'gsap/Observer';

gsap.registerPlugin(ScrollToPlugin, Observer, ScrollTrigger);

export function init() {
  let $path = document.querySelector(".mat"),
      $plate = document.querySelector(".plate"),
      $fork = document.querySelector(".fork"),
      $knife = document.querySelector(".knife"),
      introSection = document.querySelector("#intro");

  function playAnimation() {
    let tl = gsap.timeline({ repeat: 0, repeatDelay: 0 });
    const start = "M 0 100 V 50 Q 50 0 100 50 V 100 z";
    const end = "M 0 100 V 0 Q 50 0 100 0 V 100 z";

    gsap.set($fork, { x: "-100%", opacity: 0 });
    gsap.set($knife, { x: "100%", opacity: 0 });

    tl.to($path, { duration: 0.8, attr: { d: start }, ease: "power2.in" })
      .to($path, { duration: 0.4, attr: { d: end }, ease: "power2.out" })
      .from($plate, { duration: 0.8, y: 75, opacity: 1 }, "-=0.8")
      .to([$fork, $knife], { duration: 0.8, x: 0, opacity: 1 }, "-=0.3");

    tl.play();
  }

  const progressBar = document.querySelector('progress');
  window.addEventListener('scroll', () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    progressBar.value = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
  }, { passive: true });

  window.onload = playAnimation;

  ScrollTrigger.create({
    trigger: introSection,
    start: "top 50%",
    onEnterBack: () => {
      playAnimation();
    },
  });

  // === #question pin + dot animation ===
  let q = document.getElementById('question'),
  title = document.getElementById('title'),
  mark = title.querySelector("span"),
  dot = document.querySelector(".dot");

  gsap.set(dot, {
    width: "140vmax",
    height: "140vmax",
    xPercent: -50,
    yPercent: -50,
    top: "50%",
    left: "50%"
  });

  let tl1 = gsap.timeline({
    scrollTrigger: {
      trigger: q,
      start: "top top",
      end: "+=150%",
      scrub: true,
      pin: true,
      pinSpacing: true,
    },
    defaults: { ease: "none" }
  });

  tl1
  .to(title, {
    opacity: 1,
  })
  .fromTo(dot, {
    scale: 0,
    x: () => {
      let markBounds = mark.getBoundingClientRect(),
          px = markBounds.left + markBounds.width * 0.40;
      return px - q.getBoundingClientRect().width / 2;
    },
    y: () => {
      let markBounds = mark.getBoundingClientRect(),
          py = markBounds.top + markBounds.height * 0.73;
      return py - q.getBoundingClientRect().height / 2;
    }
  }, {
    x: 0,
    y: 0,
    ease: "power1.in",
    scale: 1,
  });

  // === Typing effect ===
  const text = " is a chronic (long-lasting) health condition that affects how your body turns food into energy.";
  let index = 0;
  const typingText = document.getElementById("typing-text");
  let hasTyped = false;

  function type() {
    if (index < text.length) {
      typingText.innerHTML += text.charAt(index);
      index++;
      setTimeout(type, 50);
    }
  }

  function handleIntersection(entries, observer) {
    entries.forEach(entry => {
      if (entry.isIntersecting && !hasTyped) {
        hasTyped = true;
        type();
        observer.unobserve(entry.target);
      }
    });
  }

  const observer = new IntersectionObserver(handleIntersection, {
    root: null,
    threshold: 0.5
  });

  observer.observe(document.getElementById("diabeties_description"));

  // === Counter animation ===
  const counters = document.querySelectorAll(".count");
  const stat = document.getElementById("hook");

  const animateCounter = (counter) => {
    const target = +counter.getAttribute("data-target");
    const duration = 2000;
    const increment = target / (duration / 16);

    let current = 0;
    const updateCount = () => {
      current += increment;
      if (current < target) {
        counter.textContent = current.toFixed(1);
        requestAnimationFrame(updateCount);
      } else {
        counter.textContent = target;
      }
    };
    updateCount();
  };

  const observer1 = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        counters.forEach(counter => animateCounter(counter));
        observer.disconnect();
      }
    });
  }, { threshold: 0.5 });

  observer1.observe(stat);

  // === Page transition ===
  let trans = document.querySelector("#transition");
  let tl = gsap.timeline();
  let gp2 = document.querySelector("#goPage2");
  let gb = document.querySelector("#goBack");
  let page1 = document.querySelector(".page1");
  let page2 = document.querySelector(".page2");

  gsap.set(page2, { opacity: 0, display: "none" });
  gsap.set(gb, { opacity: 1, display: "block" });

  gp2.addEventListener("click", function () {
    tl.to(trans, { opacity: 1, duration: 0})
      .to(trans, { scale: 1000, duration: 0.5 })
      .set(page1, { opacity: 0, display: "none" })
      .set(page2, { opacity: 1, display: "flex" })
      .to(trans, { scale: 1, duration: 0.3, backgroundColor: "#6b9ac4" })
      .to(trans, { opacity: 0, duration: 0});
  });

  gb.addEventListener("click", function () {
    tl.to(trans, { opacity: 1, duration: 0 })
      .to(trans, { scale: 1000, duration: 0.5 })
      .set(page2, { opacity: 0, display: "none" })
      .set(page1, { opacity: 1, display: "flex" })
      .to(trans, { scale: 1, duration: 0.3, backgroundColor: "#f4b942" })
      .to(trans, { opacity: 0, duration: 0 });
  });

  // Quiz hint blink stopper
  document.querySelectorAll(".quiz-question").forEach((container, index) => {
    container.addEventListener("click", function () {
      let hints = document.querySelectorAll(".hint p");
      if (hints[index]) {
        hints[index].classList.add("no-blink");
      }
    });
  });

  // === Meal question → answer scroll-reveal ===
  let mealTl = gsap.timeline({
    scrollTrigger: {
      trigger: "#meal-qa",
      start: "top top",
      end: "+=300%",
      scrub: true,
      pin: true,
      pinSpacing: true,
    }
  });

  mealTl
    .to({}, { duration: 1 })                                    // hold question visible
    .to("#meal-question", { opacity: 0, y: -30, duration: 0.5 })
    .fromTo("#meal-answer",
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 0.5 },
      "<"
    )
    .to({}, { duration: 1 });                                   // hold answer visible

  // === Glucose text slide crossfade ===
  let gluTl = gsap.timeline({
    scrollTrigger: {
      trigger: "#rollig_glu_dot",
      start: "top top",
      end: "+=500%",
      scrub: true,
      pin: true,
      pinSpacing: true,
    }
  });

  gluTl
    .to({}, { duration: 1 })                                        // hold slide 1
    .to("#glu-slide-1", { opacity: 0, y: -30, duration: 0.5 })
    .fromTo("#glu-slide-2", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.5 }, "<")
    .to({}, { duration: 1 })                                        // hold slide 2
    .to("#glu-slide-2", { opacity: 0, y: -30, duration: 0.5 })
    .fromTo("#glu-slide-3", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.5 }, "<")
    .to({}, { duration: 1 })                                        // hold slide 3
    .to("#glu-slide-3", { opacity: 0, y: -30, duration: 0.5 })
    .fromTo("#glu-slide-4", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.5 }, "<")
    .to({}, { duration: 1 })                                        // hold slide 4
    .to("#glu-slide-4", { opacity: 0, y: -30, duration: 0.5 })
    .fromTo("#glu-slide-5", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.5 }, "<")
    .to({}, { duration: 1 });                                       // hold slide 5
}

// Separate export — must be called AFTER async modules (metrics-explain)
// have created their ScrollTriggers + pin-spacers.
export function initPanel2() {
  const panel2 = document.getElementById("panel-2");
  const panel2Overlay = document.getElementById("panel2-overlay");
  const panel2CloseBtn = panel2Overlay.querySelector(".panel2-notification-close");

  // Once dismissed, the overlay never reappears until a full page refresh
  let dismissed = false;

  panel2CloseBtn.addEventListener("click", () => {
    panel2Overlay.classList.add("hidden");
    dismissed = true;
  });

  ScrollTrigger.create({
    trigger: panel2,
    start: "top top",
    end: "+=100%",
    pin: true,
    pinSpacing: true,
    onUpdate: (self) => {
      if (!dismissed && self.progress > 0.3 && panel2Overlay.classList.contains("hidden")) {
        panel2Overlay.classList.remove("hidden");
      }
    },
  });
}
