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

function normalDistribution(mean, std, x) {
  return (1 / (std * Math.sqrt(2 * Math.PI))) *
         Math.exp(-0.5 * Math.pow((x - mean) / std, 2));
}

function generateDistributionPoints(mean, std) {
  const points = [];
  const range = std * 4;
  const step = range / 100;

  for (let x = mean - range; x <= mean + range; x += step) {
    points.push({
      x: x,
      y: normalDistribution(mean, std, x)
    });
  }

  return points;
}

function setupDistributionPlot() {
  const container = d3.select('#distribution-plot');
  const width = container.node().clientWidth;
  const height = 330;
  const margin = {
    top: 20,
    right: 80,
    bottom: 50,
    left: 80
  };

  container.selectAll('svg').remove();

  const svg = container.append('svg')
    .attr('width', '100%')
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  return {
    svg,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom
  };
}

function updateVisualization() {
  const { svg, width, height } = setupDistributionPlot();
  const selectedMetric = d3.select('#metric-select').property('value');
  const metricData = metrics[selectedMetric];

  const activeGroups = {
    diabetic: d3.select('#diabetic-toggle').property('checked'),
    prediabetic: d3.select('#prediabetic-toggle').property('checked'),
    nondiabetic: d3.select('#nondiabetic-toggle').property('checked')
  };

  const allPoints = [];
  Object.entries(activeGroups).forEach(([group, isActive]) => {
    if (isActive && metricData[group]) {
      const points = generateDistributionPoints(
        metricData[group].mean,
        metricData[group].std
      );
      allPoints.push(...points.map(p => ({ ...p, group })));
    }
  });

  const xScale = d3.scaleLinear()
    .domain([
      d3.min(allPoints, d => d.x),
      d3.max(allPoints, d => d.x)
    ])
    .range([0, width]);

  const yScale = d3.scaleLinear()
    .domain([0, d3.max(allPoints, d => d.y)])
    .range([height, 0]);

  svg.append('g')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(xScale));

  svg.append('g')
    .call(d3.axisLeft(yScale));

  svg.append('text')
    .attr('x', width / 2)
    .attr('y', height + 40)
    .style('text-anchor', 'middle')
    .style('font-family', '"DM Serif Text", serif')
    .text(metricData.label);

  svg.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -height / 2)
    .attr('y', -45)
    .style('text-anchor', 'middle')
    .style('font-family', '"DM Serif Text", serif')
    .text('Probability Density');

  const line = d3.line()
    .x(d => xScale(d.x))
    .y(d => yScale(d.y))
    .curve(d3.curveBasis);

  Object.entries(activeGroups).forEach(([group, isActive]) => {
    if (isActive && metricData[group]) {
      const points = generateDistributionPoints(
        metricData[group].mean,
        metricData[group].std
      );

      svg.append('path')
        .datum(points)
        .attr('class', `distribution-path ${group}`)
        .attr('d', line);
    }
  });
}

export function init() {
  updateVisualization();

  d3.select('#metric-select').on('change', updateVisualization);
  d3.selectAll('#panel-4 input[type="checkbox"]').on('change', updateVisualization);

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      updateVisualization();
    }, 250);
  });
}
