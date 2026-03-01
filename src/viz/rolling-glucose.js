import * as d3 from 'd3';
import { getTooltip } from '../utils/tooltip.js';
import { GROUP_COLORS } from '../utils/colors.js';
import { loadCGMacros, loadBio } from '../utils/data-loader.js';
import { parseTimestamp } from '../utils/parse-timestamp.js';

function getColorForGroup(group) {
  return GROUP_COLORS[group] || '#000000';
}

async function loadData() {
  try {
    const [cgMacrosData, bioData] = await Promise.all([
      loadCGMacros(),
      loadBio()
    ]);

    const bioMap = new Map(bioData.map(d => [d.PID, d['diabetes level']]));

    return [...new Set(cgMacrosData.map(d => d.PID))].map(pid => {
      const values = cgMacrosData
        .filter(d => d.PID === pid)
        .map(d => ({
          time: parseTimestamp(d.Timestamp),
          glucose: +d['Libre GL'],
          pid: d.PID
        }))
        .filter(d => d.time !== null)
        .sort((a, b) => a.time - b.time);

      return { pid, values, diabetic_level: bioMap.get(pid) };
    });
  } catch (error) {
    console.error('Error loading data:', error);
    return [];
  }
}

function createGlucoseLineChart(container, data, groupColor, yScale) {
  function formatTime(index) {
    const totalMinutes = index * minutesPerReading;
    const day = Math.floor(totalMinutes / 1440);
    return `Day ${day}`;
  }

  function getTickCount(width) {
    if (width < 100) return 3;
    if (width < 200) return 4;
    if (width < 300) return 5;
    return 5;
  }

  function updateChart() {
    width = container.node().getBoundingClientRect().width - chartMargin.left - chartMargin.right;
    width = Math.max(width, 150);

    clipPath.attr("width", width);

    xScale.range([0, width])
        .domain([startTime, startTime + windowSize]);

    const tickCount = getTickCount(width);

    xAxisGroup.call(d3.axisBottom(xScale)
        .ticks(tickCount)
        .tickFormat(d => formatTime(d)));

    xAxisGroup.selectAll("text")
        .attr("dy", "1em")
        .attr("transform", "rotate(-25)")
        .style("text-anchor", "end");

    yAxisGroup.call(d3.axisLeft(yScale).ticks(5));

    yGrid.selectAll("line").remove();
    yGrid.selectAll("line")
        .data(yScale.ticks(5))
        .enter()
        .append("line")
        .attr("x1", 0)
        .attr("x2", width)
        .attr("y1", d => yScale(d))
        .attr("y2", d => yScale(d))
        .attr("stroke", "#ccc")
        .attr("stroke-dasharray", "2,2");

    updateXGrid(tickCount);

    const visibleData = data.slice(startTime, startTime + windowSize);
    path.datum(visibleData).attr("d", line);

    const midIndex = Math.floor(windowSize / 2);
    if (midIndex < visibleData.length) {
      dot.attr("cx", xScale(startTime + midIndex))
          .attr("cy", yScale(visibleData[midIndex].glucose));
    }
  }

  function updateXGrid(tickCount) {
    xGrid.selectAll("line").remove();

    xGrid.selectAll("line")
        .data(xScale.ticks(tickCount))
        .enter()
        .append("line")
        .attr("x1", d => xScale(d))
        .attr("x2", d => xScale(d))
        .attr("y1", 0)
        .attr("y2", height)
        .attr("stroke", "#ccc")
        .attr("stroke-dasharray", "2,2");
  }

  function animate() {
    if (!animationRunning) return;

    startTime += 1;
    if (startTime + windowSize >= data.length) {
      startTime = 0;
    }

    xScale.domain([startTime, startTime + windowSize]);

    const tickCount = getTickCount(width);

    xAxisGroup.call(d3.axisBottom(xScale)
        .ticks(tickCount)
        .tickFormat(d => formatTime(d)));

    xAxisGroup.selectAll("text")
        .attr("dy", "1em")
        .attr("transform", "rotate(-25)")
        .style("text-anchor", "end");

    updateXGrid(tickCount);

    const visibleData = data.slice(startTime, startTime + windowSize);
    path.datum(visibleData).attr("d", line);

    const midIndex = Math.floor(windowSize / 2);
    if (midIndex < visibleData.length) {
      dot.attr("cx", xScale(startTime + midIndex))
          .attr("cy", yScale(visibleData[midIndex].glucose));
    }

    setTimeout(animate, 20);
  }

  const chartMargin = { top: -5, right: 10, bottom: 40, left: 50 };
  const svgEl = container.append("svg")
      .attr('class', 'rolling_glucose_svg')
      .attr("width", `100%`)
      .attr("height", `80%`)
      .append("g")
      .attr("transform", `translate(${chartMargin.left}, ${chartMargin.top})`);

  let width = container.node().getBoundingClientRect().width - chartMargin.left - chartMargin.right;
  let height = container.node().getBoundingClientRect().height - chartMargin.top - chartMargin.bottom;
  width = Math.max(width, 150);
  height = Math.max(height, 100);

  const clipPath = svgEl.append("defs").append("clipPath")
      .append("rect")
      .attr("width", width)
      .attr("height", height);

  const chartGroup = svgEl.append("g")
      .attr('width', width)
      .attr('height', height);

  let startTime = 0;
  const windowSize = 100;
  const minutesPerReading = 15;

  const xScale = d3.scaleLinear()
      .range([10, width-10]);

  yScale = d3.scaleLinear()
      .domain([50, 350])
      .range([height * 0.8, 10]);

  const yGrid = svgEl.append("g")
      .attr("class", "y-grid");

  const xGrid = chartGroup.append("g")
      .attr("class", "x-grid");

  const line = d3.line()
      .x((d, i) => xScale(startTime + i))
      .y(d => yScale(d.glucose));

  const path = chartGroup.append("path")
      .attr("class", "glucose-line")
      .attr("stroke", groupColor)
      .attr("fill", "none")
      .attr("stroke-width", 2);

  const dot = chartGroup.append("circle")
      .attr("r", 5)
      .attr("fill", "skyblue");

  const xAxisGroup = svgEl.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0, ${height * 0.8})`);

  const yAxisGroup = svgEl.append("g")
      .attr("class", "y-axis");

  svgEl.append("text")
      .attr("class", "y-axis-label")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2)
      .attr("y", -chartMargin.left + 15)
      .attr("text-anchor", "middle")
      .style("font-family", "Arial, sans-serif")
      .style("font-size", "12px")
      .style("fill", "gray")
      .text("Glucose (mg/dL)");

  let animationRunning = false;

  requestAnimationFrame(function() {
    setTimeout(function() {
      updateChart();
      animationRunning = true;
      animate();
    }, 100);
  });

  const resizeHandler = function() {
    updateChart();
  };

  window.addEventListener('resize', resizeHandler);

  return {
    update: updateChart,
    cleanup: function() {
      window.removeEventListener('resize', resizeHandler);
      animationRunning = false;
    }
  };
}

async function loadDataAndCreateCharts() {
  const data = await loadData();
  if (!data || data.length === 0) {
    console.error("No glucose data loaded!");
    return;
  }

  const groups = {
    "Non-diabetic": {},
    "Pre-diabetic": {},
    "Diabetic": {}
  };

  data.forEach(({ pid, values, diabetic_level }) => {
    if (!groups[diabetic_level][pid]) {
      groups[diabetic_level][pid] = [];
    }
    groups[diabetic_level][pid] = values;
  });

  const charts = [];

  let globalMin = Infinity;
  let globalMax = -Infinity;

  data.forEach(({ values }) => {
    values.forEach(({ glucose }) => {
      globalMin = Math.min(globalMin, glucose);
      globalMax = Math.max(globalMax, glucose);
    });
  });

  const globalYScale = d3.scaleLinear()
      .domain([globalMin, globalMax])
      .range([100 - 5, 5]);

  Object.entries(groups).forEach(([group, participants]) => {
    const groupContainer = d3.select(`#${group.replace(" ", "-").toLowerCase()}-vis`)
        .style('position', 'relative');

    Object.entries(participants).forEach(([pid, entries]) => {
      const participantDiv = groupContainer.append("div")
          .attr("class", "participant-section")
          .style("display", "flex")
          .style("width", `calc(20% - 10px)`)
          .style('height', `100%`)
          .style('padding', '5px')
          .style('position', 'relative');

      groupContainer.append("div")
          .attr("class", "participant-title")
          .style("font-size", "10px")
          .style("font-weight", "bold")
          .style("text-align", "center")
          .style("width", "100%")
          .style("z-index", "3")
          .style("padding", "5px")
          .style("color", "#555")
          .style("margin-top", "-60px")
          .text(`Participant ${pid}`);

      const color = getColorForGroup(group);
      const chart = createGlucoseLineChart(participantDiv, entries, color, globalYScale, pid);
      charts.push(chart);
    });
  });

  setTimeout(function() {
    charts.forEach(chart => chart.update());
  }, 300);
}

export function init() {
  loadDataAndCreateCharts();
}
