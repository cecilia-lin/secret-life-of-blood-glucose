import * as d3 from 'd3';

const BASE = import.meta.env.BASE_URL;
const cache = {};

function cachedJson(key, path) {
  if (!cache[key]) {
    cache[key] = d3.json(BASE + path);
  }
  return cache[key];
}

export function loadCGMacros() {
  return cachedJson('cgmacros', 'vis_data/CGMacros.json');
}

export function loadBio() {
  return cachedJson('bio', 'vis_data/bio.json');
}

export function loadMealData() {
  return cachedJson('meal_data', 'vis_data/meal_data.json');
}

export function loadSampledBio() {
  return cachedJson('sampled_bio', 'vis_data/sampled_bio.json');
}

export function loadMetrics() {
  return cachedJson('metrics', 'vis_data/metrics.json');
}
