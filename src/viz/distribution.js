import * as d3 from 'd3';

const metrics = {
  'glucose-excursion': {
    label: 'Glucose Excursion',
    diabetic: { mean: 96.09, std: 46.62 },
    prediabetic: { mean: 47.99, std: 31.13 },
    nondiabetic: { mean: 36.57, std: 30.28 }
  },
  'excursion-time': {
    label: 'Glucose Excursion Time',
    diabetic: { mean: 146.90, std: 38.48 },
    prediabetic: { mean: 130.27, std: 47.85 },
    nondiabetic: { mean: 118.06, std: 48.91 }
  },
  'recovery-time': {
    label: 'Glucose Recovery Time',
    diabetic: { mean: 131.78, std: 67.78 },
    prediabetic: { mean: 145.73, std: 57.99 },
    nondiabetic: { mean: 135.49, std: 58.98 }
  }
};

const groups = ['diabetic', 'prediabetic', 'nondiabetic'];
const TRANSITION_DURATION = 800;

const observations = [
  {
    metric: 'glucose-excursion',
    groups: { diabetic: true, prediabetic: true, nondiabetic: true },
    text: 'The diabetic group shows a much wider distribution in glucose excursion, indicating greater variability and more drastic spikes in glucose levels after meals.'
  },
  {
    metric: 'excursion-time',
    groups: { diabetic: true, prediabetic: true, nondiabetic: true },
    text: 'The diabetic group\'s distribution is shifted to the right, showing that on average, diabetic individuals take longer to reach their peak glucose level after a meal.'
  }
];

function normalDistribution(mean, std, x) {
  return (1 / (std * Math.sqrt(2 * Math.PI))) *
         Math.exp(-0.5 * Math.pow((x - mean) / std, 2));
}

function generateDistributionPoints(mean, std, numPoints = 200) {
  const points = [];
  const range = std * 4;
  const step = (range * 2) / numPoints;

  for (let x = mean - range; x <= mean + range; x += step) {
    points.push({ x, y: normalDistribution(mean, std, x) });
  }

  return points;
}

// Shared state for persistent SVG elements
let svg, xAxisG, yAxisG, xLabelText, yLabelText, plotWidth, plotHeight;
const pathElements = {};

function setupDistributionPlot() {
  const container = d3.select('#distribution-plot');
  const node = container.node();
  const width = node.clientWidth;
  const height = node.clientHeight;
  const margin = { top: 20, right: 80, bottom: 50, left: 80 };

  plotWidth = width - margin.left - margin.right;
  plotHeight = height - margin.top - margin.bottom;

  // Only create SVG once
  if (!svg) {
    const svgEl = container.append('svg')
      .attr('preserveAspectRatio', 'xMidYMid meet');

    svg = svgEl.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    xAxisG = svg.append('g').attr('class', 'x-axis');
    yAxisG = svg.append('g').attr('class', 'y-axis');

    xLabelText = svg.append('text')
      .style('text-anchor', 'middle')
      .style('font-family', '"DM Serif Text", serif')
      .style('font-size', '14px');

    yLabelText = svg.append('text')
      .attr('transform', 'rotate(-90)')
      .style('text-anchor', 'middle')
      .style('font-family', '"DM Serif Text", serif')
      .style('font-size', '14px')
      .text('Probability Density');

    // Create one path per group (persistent)
    groups.forEach(group => {
      pathElements[group] = svg.append('path')
        .attr('class', `distribution-path ${group}`)
        .attr('fill-opacity', 0)
        .attr('stroke-opacity', 0);
    });
  }

  // Update SVG sizing
  container.select('svg')
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('viewBox', `0 0 ${width} ${height}`);

  // Update axis/label positions
  xAxisG.attr('transform', `translate(0,${plotHeight})`);
  xLabelText.attr('x', plotWidth / 2).attr('y', plotHeight + 40);
  yLabelText.attr('x', -plotHeight / 2).attr('y', -60);
}

function updateVisualization(animate = true) {
  setupDistributionPlot();

  const selectedMetric = d3.select('#metric-select').property('value');
  const metricData = metrics[selectedMetric];

  const activeGroups = {
    diabetic: d3.select('#diabetic-toggle').property('checked'),
    prediabetic: d3.select('#prediabetic-toggle').property('checked'),
    nondiabetic: d3.select('#nondiabetic-toggle').property('checked')
  };

  // Compute combined domain across all active groups
  const allPoints = [];
  groups.forEach(group => {
    if (activeGroups[group]) {
      const points = generateDistributionPoints(metricData[group].mean, metricData[group].std);
      allPoints.push(...points);
    }
  });

  // Always compute scales from all groups in this metric so flat-line
  // animations work even when every group is unchecked.
  const allGroupPoints = [];
  groups.forEach(group => {
    const points = generateDistributionPoints(metricData[group].mean, metricData[group].std);
    allGroupPoints.push(...points);
  });

  const xScale = d3.scaleLinear()
    .domain([d3.min(allGroupPoints, d => d.x), d3.max(allGroupPoints, d => d.x)])
    .range([0, plotWidth]);

  const yScale = d3.scaleLinear()
    .domain([0, allPoints.length > 0 ? d3.max(allPoints, d => d.y) : d3.max(allGroupPoints, d => d.y)])
    .range([plotHeight, 0]);

  const t = d3.transition().duration(animate ? TRANSITION_DURATION : 0).ease(d3.easeCubicInOut);

  // Animate axes
  xAxisG.transition(t)
    .call(d3.axisBottom(xScale))
    .selectAll('text')
    .style('font-size', '14px');

  yAxisG.transition(t)
    .call(d3.axisLeft(yScale))
    .selectAll('text')
    .style('font-size', '14px');

  // Update x-axis label
  xLabelText.text(metricData.label);

  const line = d3.line()
    .x(d => xScale(d.x))
    .y(d => yScale(d.y))
    .curve(d3.curveBasis);

  // A flat line at y=0 for enter/exit animations
  const flatLine = d3.line()
    .x(d => xScale(d.x))
    .y(() => yScale(0))
    .curve(d3.curveBasis);

  groups.forEach(group => {
    const path = pathElements[group];
    const isActive = activeGroups[group];

    if (isActive) {
      const points = generateDistributionPoints(metricData[group].mean, metricData[group].std);

      // If currently hidden, start from flat line then animate up
      const currentOpacity = parseFloat(path.attr('fill-opacity'));
      if (currentOpacity === 0) {
        path.datum(points).attr('d', flatLine);
      }

      path.datum(points)
        .transition(t)
        .attr('d', line)
        .attr('fill-opacity', 0.3)
        .attr('stroke-opacity', 1);
    } else {
      // Animate down to flat, then hide
      const currentOpacity = parseFloat(path.attr('fill-opacity'));
      if (currentOpacity > 0) {
        // Generate points for this group so flatLine has data to work with
        const points = generateDistributionPoints(metricData[group].mean, metricData[group].std);
        path.datum(points)
          .transition(t)
          .attr('d', flatLine)
          .attr('fill-opacity', 0)
          .attr('stroke-opacity', 0);
      }
    }
  });
}

function applyObservation(index) {
  const obs = observations[index];

  // Update metric dropdown
  d3.select('#metric-select').property('value', obs.metric);

  // Update checkboxes
  d3.select('#diabetic-toggle').property('checked', obs.groups.diabetic);
  d3.select('#prediabetic-toggle').property('checked', obs.groups.prediabetic);
  d3.select('#nondiabetic-toggle').property('checked', obs.groups.nondiabetic);

  // Update button active states
  d3.selectAll('.observation-btn').classed('active', false);
  d3.select(`.observation-btn[data-observation="${index + 1}"]`).classed('active', true);

  // Update description text
  d3.select('.observation-text').text(obs.text);

  updateVisualization(true);
}

function clearObservationActive() {
  d3.selectAll('.observation-btn').classed('active', false);
}

export function init() {
  // Set observation 1 as default
  d3.select('.observation-text').text(observations[0].text);

  updateVisualization(false);

  // Observation button handlers
  d3.selectAll('.observation-btn').on('click', function () {
    const index = +d3.select(this).attr('data-observation') - 1;
    applyObservation(index);
  });

  // Manual control changes clear observation selection
  d3.select('#metric-select').on('change', () => {
    clearObservationActive();
    updateVisualization(true);
  });
  d3.selectAll('#panel-4 input[type="checkbox"]').on('change', () => {
    clearObservationActive();
    updateVisualization(true);
  });

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      updateVisualization(false);
    }, 250);
  });
}
