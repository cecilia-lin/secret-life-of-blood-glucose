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

function createGlucoseLineChart(container, data, groupColor, yScale, pid) {
  function formatTime(index) {
    const totalMinutes = index * minutesPerReading;
    const day = Math.floor(totalMinutes / 1440);
    return `Day ${day}`;
  }

  function getTickCount(w) {
    if (w < 100) return 2;
    if (w < 200) return 3;
    if (w < 300) return 4;
    return 4;
  }

  function updateChart() {
    const rect = svgNode.node().getBoundingClientRect();
    innerWidth = Math.max(rect.width - chartMargin.left - chartMargin.right, 50);
    innerHeight = Math.max(rect.height - chartMargin.top - chartMargin.bottom, 50);

    clipPath.attr("width", innerWidth).attr("height", innerHeight);

    xScale.range([0, innerWidth])
        .domain([startTime, startTime + windowSize]);

    localYScale.range([innerHeight, 0]);

    const tickCount = getTickCount(innerWidth);

    xAxisGroup
        .attr("transform", `translate(0, ${innerHeight})`)
        .call(d3.axisBottom(xScale)
          .ticks(tickCount)
          .tickFormat(d => formatTime(d)));

    xAxisGroup.selectAll("text")
        .attr("dy", "0.7em")
        .style("text-anchor", "middle")
        .style("font-size", "7px");

    yAxisGroup.call(d3.axisLeft(localYScale).ticks(5));
    yAxisGroup.selectAll("text").style("font-size", "8px");

    yLabel.attr("x", -innerHeight / 2);

    yGrid.selectAll("line").remove();
    yGrid.selectAll("line")
        .data(localYScale.ticks(5))
        .enter()
        .append("line")
        .attr("x1", 0)
        .attr("x2", innerWidth)
        .attr("y1", d => localYScale(d))
        .attr("y2", d => localYScale(d))
        .attr("stroke", "#ccc")
        .attr("stroke-dasharray", "2,2");

    updateXGrid(tickCount);

    const visibleData = data.slice(startTime, startTime + windowSize);
    path.datum(visibleData).attr("d", line);

    const midIndex = Math.floor(windowSize / 2);
    if (midIndex < visibleData.length) {
      dot.attr("cx", xScale(startTime + midIndex))
          .attr("cy", localYScale(visibleData[midIndex].glucose));
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
        .attr("y2", innerHeight)
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

    const tickCount = getTickCount(innerWidth);

    xAxisGroup.call(d3.axisBottom(xScale)
        .ticks(tickCount)
        .tickFormat(d => formatTime(d)));

    xAxisGroup.selectAll("text")
        .attr("dy", "0.7em")
        .style("text-anchor", "middle")
        .style("font-size", "7px");

    updateXGrid(tickCount);

    const visibleData = data.slice(startTime, startTime + windowSize);
    path.datum(visibleData).attr("d", line);

    const midIndex = Math.floor(windowSize / 2);
    if (midIndex < visibleData.length) {
      dot.attr("cx", xScale(startTime + midIndex))
          .attr("cy", localYScale(visibleData[midIndex].glucose));
    }

    setTimeout(animate, 20);
  }

  const chartMargin = { top: 10, right: 5, bottom: 35, left: 40 };

  const svgNode = container.append("svg")
      .attr('class', 'rolling_glucose_svg')
      .style("width", "100%")
      .style("flex", "1");

  const svgEl = svgNode.append("g")
      .attr("transform", `translate(${chartMargin.left}, ${chartMargin.top})`);

  let innerWidth = 50;
  let innerHeight = 50;

  const clipId = `clip-${pid}`;
  const clipPath = svgEl.append("defs").append("clipPath")
      .attr("id", clipId)
      .append("rect")
      .attr("width", innerWidth)
      .attr("height", innerHeight);

  const chartGroup = svgEl.append("g")
      .attr("clip-path", `url(#${clipId})`);

  let startTime = 0;
  const windowSize = 100;
  const minutesPerReading = 15;

  const xScale = d3.scaleLinear()
      .range([0, innerWidth]);

  const localYScale = d3.scaleLinear()
      .domain(yScale.domain())
      .range([innerHeight, 0]);

  const yGrid = svgEl.append("g")
      .attr("class", "y-grid");

  const xGrid = chartGroup.append("g")
      .attr("class", "x-grid");

  const line = d3.line()
      .x((d, i) => xScale(startTime + i))
      .y(d => localYScale(d.glucose));

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
      .attr("transform", `translate(0, ${innerHeight})`);

  const yAxisGroup = svgEl.append("g")
      .attr("class", "y-axis");

  // Y-axis label
  const yLabel = svgEl.append("text")
      .attr("class", "y-axis-label")
      .attr("text-anchor", "middle")
      .attr("transform", `rotate(-90)`)
      .attr("x", -innerHeight / 2)
      .attr("y", -chartMargin.left + 12)
      .style("font-size", "10px")
      .style("fill", "#666")
      .text("Glucose (mg/dL)");

  let animationRunning = false;

  requestAnimationFrame(function() {
    setTimeout(function() {
      updateChart();
      animationRunning = true;
      animate();
    }, 100);
  });

  let resizeTimer;
  const resizeHandler = function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => updateChart(), 250);
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
      .domain([Math.floor(globalMin / 10) * 10, Math.ceil(globalMax / 10) * 10])
      .range([100 - 5, 5]);

  const groupEntries = Object.entries(groups);
  groupEntries.forEach(([group, participants], groupIdx) => {
    const groupContainer = d3.select(`#${group.replace(" ", "-").toLowerCase()}-vis`)
        .style('position', 'relative');
    Object.entries(participants).forEach(([pid, entries], idx) => {
      const participantDiv = groupContainer.append("div")
          .attr("class", "participant-section")
          .style("display", "flex")
          .style("flex-direction", "column")
          .style("width", `calc(20% - 10px)`)
          .style('height', `100%`)
          .style('padding', '5px')
          .style('position', 'relative');

      participantDiv.append("div")
          .attr("class", "participant-title")
          .style("font-size", "10px")
          .style("font-weight", "bold")
          .style("text-align", "center")
          .style("color", "#555")
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
