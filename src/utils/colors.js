import * as d3 from 'd3';

export const GROUP_COLORS = {
  'Non-diabetic': '#2ecc71',
  'Pre-diabetic': '#f1c40f',
  'Diabetic': '#4059ad',
};

export const groupColorScale = d3.scaleOrdinal()
  .domain(Object.keys(GROUP_COLORS))
  .range(Object.values(GROUP_COLORS));
