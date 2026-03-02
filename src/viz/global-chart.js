import * as d3 from 'd3';
import { getTooltip, showTooltip, hideTooltip } from '../utils/tooltip.js';
import { groupColorScale } from '../utils/colors.js';
import { loadCGMacros, loadBio } from '../utils/data-loader.js';
import { parseTimestamp } from '../utils/parse-timestamp.js';

const BASE = import.meta.env.BASE_URL;
const margin = { top: 40, right: 50, bottom: 50, left: 60 };
let activeParticipants = new Set();
let timeRange = [1440, 2880];
let data, processedData, xScale, yScale, colorScale;
let tooltip;
let tooltipDiv;

const diabetic = {
  breakfast: BASE + 'pics/d_breakfast.png',
  lunch: BASE + 'pics/d_lunch.png',
  dinner: BASE + 'pics/d_dinner.png',
  snack: BASE + 'pics/d_snack.png',
};

const prediabetic = {
  breakfast: BASE + 'pics/pd_breakfast.png',
  lunch: BASE + 'pics/pd_lunch.png',
  dinner: BASE + 'pics/pd_dinner.png',
  snack: BASE + 'pics/pd_snack.png'
};

const nondiabetic = {
  breakfast: BASE + 'pics/nd_breakfast.png',
  lunch: BASE + 'pics/nd_lunch.png',
  dinner: BASE + 'pics/nd_dinner.png',
  snack: BASE + 'pics/nd_snack.png'
};

const mealIcons = {
  "Diabetic": diabetic,
  "Pre-diabetic": prediabetic,
  "Non-diabetic": nondiabetic
};

let container, svg, g;

function createParticipantButtons(participants) {
  d3.selectAll('.participant-buttons').selectAll('*').remove();

  participants.forEach(pid => {
    const participant = processedData.find(d => d.pid === pid);
    if (participant) {
      const button = document.createElement('button');
      button.textContent = `${pid}`;
      button.classList.add('participant-btn');
      button.dataset.pid = pid;

      const categoryDiv = document.getElementById(participant.diabetic_level);

      if (categoryDiv) {
        const buttonsDiv = categoryDiv.querySelector('.participant-buttons');
        if (buttonsDiv) {
          buttonsDiv.appendChild(button);

          button.addEventListener('click', function() {
            const isActive = button.classList.contains('active');

            if (isActive) {
              activeParticipants.delete(pid);
              button.classList.remove('active');
            } else {
              activeParticipants.add(pid);
              button.classList.add('active');
            }

            updateVisualization();
          });
        }
      }
    }
  });
}

function rendering_timeSlider(startDay, endDay) {
  const sliderContainer = d3.select("#time-range-selector");
  sliderContainer.selectAll("*").remove();

  const style = window.getComputedStyle(sliderContainer.node());
  const paddingLeft = parseFloat(style.paddingLeft);
  const paddingRight = parseFloat(style.paddingRight);

  const width = sliderContainer.node().clientWidth - paddingLeft - paddingRight;
  const height = 50;
  const sliderMargin = { left: 8, right: 8 };
  const sliderWidth = width - sliderMargin.left - sliderMargin.right;

  const fullTimeExtent = [1440, 14385];
  const daysExtent = [1, Math.ceil(fullTimeExtent[1] / 1440)];

  const sliderXScale = d3.scaleLinear()
    .domain(daysExtent)
    .range([sliderMargin.left, sliderWidth + sliderMargin.left])
    .clamp(true);

  const sliderSvg = sliderContainer.append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr('class', 'range-slider');

  sliderSvg.append('line')
    .attr('class', 'track')
    .attr('x1', sliderMargin.left)
    .attr('x2', sliderWidth + sliderMargin.left)
    .attr('y1', height / 2)
    .attr('y2', height / 2)
    .attr('stroke', '#d2d2d7')
    .attr('stroke-width', 4);

  const trackFill = sliderSvg.append('line')
    .attr('class', 'track-fill')
    .attr('x1', sliderXScale(startDay))
    .attr('x2', sliderXScale(endDay))
    .attr('y1', height / 2)
    .attr('y2', height / 2)
    .attr('stroke', '#0071e3')
    .attr('stroke-width', 4);

  const circle_size = 7;

  const handleStart = sliderSvg.append('circle')
    .attr('class', 'handle')
    .attr('cx', sliderXScale(startDay))
    .attr('cy', height / 2)
    .attr('r', circle_size)
    .attr('fill', '#0071e3')
    .call(d3.drag()
      .on('drag', function(event) {
        const day = Math.round(sliderXScale.invert(event.x - sliderMargin.left));
        const end = Math.round(sliderXScale.invert(handleEnd.attr('cx') - sliderMargin.left));
        if (day < end) {
          handleStart.attr('cx', sliderXScale(day));
          trackFill.attr('x1', sliderXScale(day));
          updateTimeRange(day, end);
        }
      }));

  const handleEnd = sliderSvg.append('circle')
    .attr('class', 'handle')
    .attr('cx', sliderXScale(endDay))
    .attr('cy', height / 2)
    .attr('r', circle_size)
    .attr('fill', '#0071e3')
    .call(d3.drag()
      .on('drag', function(event) {
        const day = Math.round(sliderXScale.invert(event.x - sliderMargin.left));
        const start = Math.round(sliderXScale.invert(handleStart.attr('cx') - sliderMargin.left));
        if (day > start) {
          handleEnd.attr('cx', sliderXScale(day));
          trackFill.attr('x2', sliderXScale(day));
          updateTimeRange(start, day);
        }
      }));

  sliderSvg.on("click", function(event) {
    const clickedX = event.offsetX;
    const clickedDay = Math.round(sliderXScale.invert(clickedX - sliderMargin.left));

    const startDayCurrent = Math.round(sliderXScale.invert(handleStart.attr("cx") - sliderMargin.left));
    const endDayCurrent = Math.round(sliderXScale.invert(handleEnd.attr("cx") - sliderMargin.left));

    if (Math.abs(clickedDay - startDayCurrent) < Math.abs(clickedDay - endDayCurrent)) {
      if (clickedDay < endDayCurrent) {
        handleStart.attr('cx', sliderXScale(clickedDay));
        trackFill.attr('x1', sliderXScale(clickedDay));
        updateTimeRange(clickedDay, endDayCurrent);
      }
    } else {
      if (clickedDay > startDayCurrent) {
        handleEnd.attr('cx', sliderXScale(clickedDay));
        trackFill.attr('x2', sliderXScale(clickedDay));
        updateTimeRange(startDayCurrent, clickedDay);
      }
    }
  });

  const xAxis = d3.axisBottom(sliderXScale)
    .ticks(daysExtent[1])
    .tickFormat(d => `${d}d`)
    .tickSize(0);

  const xAxisGroup = sliderSvg.append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0, ${height - 10})`)
    .call(xAxis);

  xAxisGroup.select(".domain").remove();

  function updateTimeRange(start, end) {
    timeRange = [start * 1440, end * 1440];
    updateVisualization();
  }
}

function getTimeRangeExtent(range) {
  if (Array.isArray(range)) {
    if (range[0] > range[1]) {
      throw new Error("Invalid time range: start time is greater than end time.");
    }
    return range;
  }
}

function updateVisualization() {
  const containerWidth = container.node().clientWidth;
  const containerHeight = container.node().clientHeight;

  const width = containerWidth - margin.left - margin.right;
  const height = containerHeight - margin.top - margin.bottom;

  svg.attr('viewBox', `0 0 ${containerWidth} ${containerHeight}`)
    .attr('class', 'main-svg');
  g.attr("transform", `translate(${margin.left}, ${margin.top})`);

  const timeExtent = getTimeRangeExtent(timeRange);

  const filteredData = processedData.map(d => ({
    pid: d.pid,
    diabetic_level: d.diabetic_level,
    values: d.values.filter(v => v.time >= timeExtent[0] && v.time <= timeExtent[1])
  })).filter(d => d.values.length > 0);

  const filteredTimeExtent = [
    d3.min(filteredData, d => d3.min(d.values, v => v.time)),
    d3.max(filteredData, d => d3.max(d.values, v => v.time))
  ];

  xScale.domain(filteredTimeExtent).range([0, width]);
  yScale.range([height, 0]);

  let tickFormat;
  let tickValues = [];
  const timeRangeInMinutes = filteredTimeExtent[1] - filteredTimeExtent[0];
  const startTime = filteredTimeExtent[0];

  if (timeRangeInMinutes <= 1440) {
    tickFormat = d => {
      const hour = Math.floor((d - startTime) / 60);
      return hour === 12 ? 'noon' : `${hour}h`;
    };
    for (let i = filteredTimeExtent[0]; i <= filteredTimeExtent[1]; i += 60) {
      tickValues.push(i);
    }
  } else {
    tickFormat = d => `${Math.floor(d / 1440)}d`;
    for (let i = filteredTimeExtent[0]; i <= filteredTimeExtent[1]; i += 1440) {
      tickValues.push(i);
    }
  }

  g.select(".x-axis")
    .transition()
    .duration(750)
    .call(d3.axisBottom(xScale)
      .tickValues(tickValues)
      .tickFormat(tickFormat));

  g.selectAll(".x-axis .tick text")
    .filter(function(d) { return Math.floor((d - startTime) / 60) === 12; })
    .style("font-weight", "bold");

  g.select(".y-axis")
    .transition()
    .duration(750)
    .call(d3.axisLeft(yScale));

  g.select(".grid")
    .selectAll("line")
    .data(yScale.ticks(5))
    .join("line")
    .transition()
    .duration(750)
    .attr("x1", 0)
    .attr("x2", width)
    .attr("y1", d => yScale(d))
    .attr("y2", d => yScale(d))
    .attr("stroke", "#e0e0e0")
    .attr("stroke-width", 1)
    .attr("stroke-dasharray", "3,3");

  const diabeticLevelColorScale = groupColorScale;

  const lines = g.selectAll(".line")
    .data(filteredData.filter(d => activeParticipants.has(d.pid)));

  lines.exit().remove();

  lines
    .transition()
    .duration(750)
    .attr("d", d => d3.line()
      .x(d => xScale(d.time))
      .y(d => yScale(d.glucose))
      .curve(d3.curveMonotoneX)(d.values))
    .style("stroke-width", 3)
    .style("stroke", d => diabeticLevelColorScale(d.diabetic_level));

  lines.enter()
    .append("path")
    .attr("class", "line")
    .style("stroke", d => diabeticLevelColorScale(d.diabetic_level))
    .style("opacity", 0)
    .attr("d", d => d3.line()
      .x(d => xScale(d.time))
      .y(d => yScale(d.glucose))
      .curve(d3.curveMonotoneX)(d.values))
    .on('mouseover', function(event, d) {
      tooltip.transition()
        .duration(200)
        .style('opacity', .9);

      const [mouseX] = d3.pointer(event, this);
      const hoveredTime = xScale.invert(mouseX);

      const bisect = d3.bisector(d => d.time).left;
      const index = bisect(d.values, hoveredTime);
      const dataPoint = index > 0 ? d.values[index - 1] : d.values[0];

      tooltip.html(`Participant: ${d.pid}<br>Time: ${Math.round(dataPoint.time)} min<br>Glucose: ${dataPoint.glucose}`)
        .style('left', (event.pageX + 5) + 'px')
        .style('top', (event.pageY - 28) + 'px');
    })
    .on('mousemove', function(event, d) {
      const [mouseX] = d3.pointer(event, this);
      const hoveredTime = xScale.invert(mouseX);

      const bisect = d3.bisector(d => d.time).left;
      const index = bisect(d.values, hoveredTime);
      const dataPoint = index > 0 && index < d.values.length ?
                        (hoveredTime - d.values[index-1].time < d.values[index].time - hoveredTime ?
                         d.values[index-1] : d.values[index]) :
                        (index > 0 ? d.values[index-1] : d.values[0]);

      tooltip.html(`Participant: ${d.pid}<br>Time: ${Math.round(dataPoint.time)} min<br>Glucose: ${dataPoint.glucose}`)
        .style('left', (event.pageX + 5) + 'px')
        .style('top', (event.pageY - 28) + 'px');
    })
    .on('mouseout', function() {
      tooltip.transition()
        .duration(500)
        .style('opacity', 0);
    })
    .transition()
    .duration(750)
    .style("opacity", 0.7);

  g.selectAll('.meal-group').remove();
  g.selectAll('.meal-time-line').remove();
  g.selectAll('.meal-time-dot').remove();
  g.selectAll('.meal-dot').remove();

  filteredData.forEach(participant => {
    if (activeParticipants.has(participant.pid)) {
      participant.values.forEach(d => {
        if (d.mealType) {
          const group = g.append('g')
            .attr('class', 'meal-group')
            .attr('transform', `translate(${xScale(d.time)}, ${yScale(d.glucose) * 0.7 - 30})`);

          const isMealIconsVisible = document.getElementById("toggle-meal-icons").checked;

          const line = g.append('line')
            .attr('class', 'meal-time-line')
            .attr('x1', xScale(d.time))
            .attr('x2', xScale(d.time))
            .attr('y1', yScale(d.glucose))
            .attr('y2', yScale(d.glucose) * 0.7)
            .attr('stroke', 'gray')
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', '4,4')
            .style('opacity', isMealIconsVisible ? 1 : 0);

          group.append('image')
              .attr('class', 'meal-dot')
              .attr('xlink:href', mealIcons[participant.diabetic_level][d.mealType])
              .attr('width', 24)
              .attr('height', 24)
              .attr('x', -12)
              .attr('y', -12)
              .style('opacity', isMealIconsVisible ? 1 : 0)
              .transition()
              .duration(750);

          const dot = g.append('circle')
            .attr('class', 'meal-time-dot')
            .attr('cx', xScale(d.time))
            .attr('cy', yScale(d.glucose))
            .attr('r', 3)
            .attr('fill', diabeticLevelColorScale(participant.diabetic_level));

          group.append('rect')
            .attr('width', 20)
            .attr('height', yScale(d.glucose) - (yScale(d.glucose) * 0.7 - 30))
            .attr('x', -10)
            .attr('y', -10)
            .attr('fill', 'transparent')
            .style('pointer-events', 'all')
            .on('mouseover', function (event) {
              showTooltip(`
                  <strong>Meal Type:</strong> ${d.mealType}<br>
                  <strong>Carbs:</strong> ${d.carbs} g<br>
                  <strong>Protein:</strong> ${d.protein} g<br>
                  <strong>Fat:</strong> ${d.fat} g<br>
                  <strong>Fiber:</strong> ${d.fiber} g<br>
              `, event.pageX + 10, event.pageY + 10);
              line.attr('stroke-width', 3);
              dot.attr('r', 5);
            })
            .on('mouseout', function () {
              hideTooltip();
              line.attr('stroke-width', 1);
              dot.attr('r', 3);
            });
        }
      });
    }
  });

  const noDataMessage = g.selectAll(".no-data-message")
    .data(activeParticipants.size === 0 ? [1] : []);

  noDataMessage.exit().remove();

  noDataMessage.enter()
    .append("text")
    .attr("class", "no-data-message")
    .attr("text-anchor", "middle")
    .attr("x", width / 2)
    .attr("y", height / 2)
    .attr("font-size", "14px")
    .text("Select participants to view their glucose data");
}

async function loadData() {
  try {
    let [cgMacrosData, bioData] = await Promise.all([
      loadCGMacros(),
      loadBio()
    ]);

    const bioMap = new Map(bioData.map(d => [d.PID, d['diabetes level']]));
    const participants = [...new Set(cgMacrosData.map(d => d.PID))];

    colorScale = d3.scaleOrdinal()
      .domain(participants)
      .range(d3.schemeCategory10);

    processedData = participants.map(pid => {
      const participantData = cgMacrosData
        .filter(d => d.PID === pid)
        .map(d => ({
          time: parseTimestamp(d.Timestamp),
          glucose: d['Libre GL'],
          mealType: d['Meal Type'],
          calories: d['Calories'],
          carbs: d['Carbs'],
          protein: d['Protein'],
          fat: d['Fat'],
          fiber: d['Fiber'],
          pid: d.PID,
          image: d['Image path']
        }))
        .sort((a, b) => a.time - b.time);

      const glucoseMap = {};
      participantData.forEach(d => {
        glucoseMap[d.time] = d.glucose;
      });

      return {
        pid,
        values: participantData,
        glucoseMap: glucoseMap,
        diabetic_level: bioMap.get(pid)
      };
    });

    return participants;
  } catch (error) {
    console.error('Error loading or processing the data:', error);
    return [];
  }
}

function plotData(participants) {
  const containerWidth = container.node().clientWidth;
  const containerHeight = container.node().clientHeight;
  const width = containerWidth - margin.left - margin.right;

  const legendItemsEl = document.querySelector('#meal-type-legend .legend-items');
  if (legendItemsEl) {
    legendItemsEl.innerHTML = '';

    const legendData = [
      { label: 'Non-diabetic', color: '#2ecc71' },
      { label: 'Pre-diabetic', color: '#f1c40f' },
      { label: 'Diabetic', color: '#4059ad' }
    ];

    legendData.forEach(d => {
      const item = document.createElement('span');
      item.className = 'legend-item';
      item.innerHTML = `<span class="legend-dot" style="background:${d.color}"></span>${d.label}`;
      legendItemsEl.appendChild(item);
    });

    const mealLegendData = [
      { label: 'Breakfast', icon: BASE + 'pics/breakfast.png' },
      { label: 'Lunch',     icon: BASE + 'pics/lunch.png' },
      { label: 'Dinner',    icon: BASE + 'pics/dinner.png' },
      { label: 'Snack',     icon: BASE + 'pics/snack.png' }
    ];

    mealLegendData.forEach(d => {
      const item = document.createElement('span');
      item.className = 'legend-item';
      item.innerHTML = `<img class="legend-icon" src="${d.icon}" alt="${d.label}">${d.label}`;
      legendItemsEl.appendChild(item);
    });
  }

  const timeExtent = [
    d3.min(processedData, d => d3.min(d.values, v => v.time)),
    d3.max(processedData, d => d3.max(d.values, v => v.time))
  ];

  const glucoseExtent = [
    0,
    d3.max(processedData, d => d3.max(d.values, v => v.glucose))
  ];

  xScale = d3.scaleLinear()
    .domain(timeExtent);

  yScale = d3.scaleLinear()
    .domain(glucoseExtent);

  const height = containerHeight - margin.top - margin.bottom;

  g.append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0, ${height})`);

  g.append("g")
    .attr("class", "y-axis");

  g.append("g")
    .attr("class", "grid");

  tooltipDiv = getTooltip();
  tooltip = d3.select(tooltipDiv);

  createParticipantButtons(participants);

  const defaults = window.__quizMatches
    ? [window.__quizMatches["Non-diabetic"], window.__quizMatches["Pre-diabetic"], window.__quizMatches["Diabetic"]]
    : [1, 8, 12];

  defaults.forEach(pid => {
    activeParticipants.add(pid);
    const btn = document.querySelector(`.participant-btn[data-pid="${pid}"]`);
    if (btn) btn.classList.add('active');
  });

  rendering_timeSlider(1, 2);

  updateVisualization();
}

async function loadDataAndPlot() {
  const participants = await loadData();
  plotData(participants);
}

export function selectParticipants(pids) {
  activeParticipants.clear();
  document.querySelectorAll('.participant-btn').forEach(btn => btn.classList.remove('active'));

  pids.forEach(pid => {
    activeParticipants.add(pid);
    const btn = document.querySelector(`.participant-btn[data-pid="${pid}"]`);
    if (btn) btn.classList.add('active');
  });

  updateVisualization();
}

export function init() {
  container = d3.select('.visualization-wrapper');
  svg = container.append('svg')
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('viewBox', `0 0 ${container.node().clientWidth} ${container.node().clientHeight}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');
  g = svg.append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);

  loadDataAndPlot();

  let chartResizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(chartResizeTimer);
    chartResizeTimer = setTimeout(() => {
      const startDay = Math.round(timeRange[0] / 1440);
      const endDay = Math.round(timeRange[1] / 1440);
      updateVisualization();
      rendering_timeSlider(startDay, endDay);
    }, 250);
  });

  document.getElementById("toggle-meal-icons").addEventListener("change", function() {
    const isChecked = this.checked;

    d3.selectAll(".meal-dot")
        .transition()
        .duration(300)
        .style("opacity", isChecked ? 1 : 0);

    d3.selectAll(".meal-time-line")
        .transition()
        .duration(300)
        .style("opacity", isChecked ? 1 : 0);
  });
}
