// CSS imports (order matters — variables first)
import './styles/variables.css';
import './styles/base.css';
import './styles/navbar.css';
import './styles/intro.css';
import './styles/question.css';
import './styles/stats.css';
import './styles/pages.css';
import './styles/quiz.css';
import './styles/meals.css';
import './styles/rolling.css';
import './styles/metrics.css';
import './styles/panel2.css';
import './styles/conclusion.css';
import './styles/tooltip.css';
import './styles/responsive.css';

import { init as initGlobalChart } from './viz/global-chart.js';
import { init as initDistribution } from './viz/distribution.js';
import { init as initRollingGlucose } from './viz/rolling-glucose.js';
import { init as initMeals } from './viz/meals.js';
import { init as initMetricsExplain } from './viz/metrics-explain.js';
import { init as initQuiz } from './viz/quiz.js';
import { init as initScrollAnimations } from './animations/scrolling-animation.js';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

document.addEventListener('DOMContentLoaded', () => {
  initScrollAnimations();
  initGlobalChart();
  initDistribution();
  initRollingGlucose();
  initMeals();
  initMetricsExplain();
  initQuiz();

  // Refresh ScrollTrigger after all modules have initialized and altered the DOM
  requestAnimationFrame(() => {
    ScrollTrigger.refresh();
  });
});
