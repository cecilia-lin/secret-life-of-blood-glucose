import * as d3 from 'd3';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { loadCGMacros, loadBio, loadMealData } from '../utils/data-loader.js';

gsap.registerPlugin(ScrollTrigger);

const margin = { top: 50, right: 50, bottom: 70, left: 100 };
const rowHeight = 500;

async function fetchData() {
  try {
    const [bioData, cgmData, mealData] = await Promise.all([
      loadBio(),
      loadCGMacros(),
      loadMealData()
    ]);

    const nonDiabeticParticipants = bioData.filter(p => p["diabetes level"] === "Non-diabetic");

    return { nonDiabeticParticipants, cgmData, mealData };
  } catch (error) {
    console.error('Error loading data:', error);
    throw error;
  }
}

function setActivePhase(phase) {
  const phases = document.querySelectorAll('#explain_text .explain-phase');
  phases.forEach(el => {
    const elPhase = parseInt(el.dataset.phase, 10);
    if (elPhase === phase) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  });
}

function plotData(nonDiabeticParticipants, cgmData, mealData) {
  const pidCounts = {};
  cgmData.forEach(d => {
    if (!pidCounts[d.PID]) pidCounts[d.PID] = 0;
    pidCounts[d.PID]++;
  });

  const pidsWithData = Object.keys(pidCounts).map(pid => Number(pid));
  const nonDiabeticPidsWithData = nonDiabeticParticipants
    .filter(p => pidsWithData.includes(p.PID))
    .map(p => p.PID);

  let selectedPIDs = nonDiabeticPidsWithData.slice(0, 1);

  const container = document.getElementById("explain_graph");

  const style = getComputedStyle(container);
  const paddingX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
  const paddingY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
  const svgWidth = container.clientWidth - paddingX;
  const svgHeight = container.clientHeight - paddingY;

  const svg = d3.select('#explain_graph')
    .append('svg')
    .attr('viewBox', `0 0 ${svgWidth} ${svgHeight}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .style('width', '100%')
    .style('height', '100%')
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const parseTime = (timestamp) => {
    try {
      if (timestamp instanceof Date) {
        const hours = timestamp.getHours();
        const minutes = timestamp.getMinutes();
        const decimalHours = hours + minutes / 60;
        return decimalHours < 12 ? decimalHours : null;
      }
      const str = String(timestamp);
      if (str.includes(":")) {
        const timePart = str.split(" ").find(part => part.includes(":"));
        if (!timePart) return null;
        const timeParts = timePart.split(":");
        const hours = parseInt(timeParts[0]);
        const minutes = parseInt(timeParts[1]);
        const decimalHours = hours + minutes / 60;
        return decimalHours < 12 ? decimalHours : null;
      }
      return null;
    } catch (error) {
      console.error("Error parsing timestamp:", timestamp, error);
      return null;
    }
  };

  const plotWidth = svgWidth - margin.left - margin.right;
  const plotHeight = svgHeight - margin.top - margin.bottom;

  const x = d3.scaleLinear()
    .domain([0, 12])
    .range([0, plotWidth]);

  svg.append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0, ${plotHeight})`)
    .call(d3.axisBottom(x)
      .ticks(12)
      .tickFormat(d => {
        if (d === 0 || d === 24) return "12AM";
        if (d === 12) return "12PM";
        return d < 12 ? `${d}AM` : `${d - 12}PM`;
      }))
    .selectAll("text")
    .style("font-size", "14px");

  // X-axis label
  svg.append("text")
    .attr("class", "x label")
    .attr("text-anchor", "middle")
    .attr("x", plotWidth / 2)
    .attr("y", plotHeight + 40)
    .style("font-size", "14px")
    .text("Time of Day");

  let maxGlucoseValue = 0;
  const participantData = [];

  selectedPIDs.forEach(pid => {
    const participantDayData = cgmData.filter(d =>
      String(d.PID) === String(pid) &&
      (d.Timestamp.startsWith("1 days") || d.Timestamp.startsWith("1 day") || d.Timestamp.includes("Day 1"))
    );

    const processedData = participantDayData.map(d => ({
      time: parseTime(d.Timestamp),
      value: d["Libre GL"] || 0
    })).filter(d => d.time !== null && d.value > 0);

    if (processedData.length > 0) {
      const participantMax = d3.max(processedData, d => d.value);
      if (participantMax > maxGlucoseValue) {
        maxGlucoseValue = participantMax;
      }

      const participant = nonDiabeticParticipants.find(p => p.PID === pid);

      participantData.push({
        pid,
        name: `PID ${pid}`,
        age: participant ? participant.Age : "Unknown",
        gender: participant ? participant.Gender : "Unknown",
        data: processedData
      });
    }
  });

  const y = d3.scaleLinear()
    .domain([0, maxGlucoseValue * 1.1])
    .range([plotHeight, 0]);

  svg.append("g")
    .attr("class", "y-axis")
    .call(d3.axisLeft(y).ticks(5))
    .selectAll("text")
    .style("font-size", "14px");

  for (let i = 0; i <= maxGlucoseValue * 1.1; i += 20) {
    svg.append("line")
      .attr("x1", 0)
      .attr("x2", plotWidth)
      .attr("y1", y(i))
      .attr("y2", y(i))
      .attr("stroke", "#ccc")
      .attr("stroke-width", 1);
  }

  // Y-axis label
  svg.append("text")
    .attr("class", "y label")
    .attr("text-anchor", "middle")
    .attr("x", -(plotHeight / 2))
    .attr("y", -60)
    .attr("transform", "rotate(-90)")
    .style("font-size", "14px")
    .text("Glucose Level (mg/dL)");

  let onlyParticipant = participantData[0];

  // Create the glucose line path
  const path = svg.append("path")
    .datum(onlyParticipant.data)
    .attr("fill", "none")
    .attr("stroke", "steelblue")
    .attr("stroke-width", 3)
    .attr("d", d3.line()
      .x(d => x(d.time))
      .y(d => y(d.value))
      .curve(d3.curveMonotoneX));

  // Set up stroke-dasharray for animation
  const totalLength = path.node().getTotalLength();
  path
    .attr("stroke-dasharray", totalLength)
    .attr("stroke-dashoffset", totalLength);

  // Tracking dot — starts at first data point
  const firstPoint = onlyParticipant.data[0];
  const trackingDot = svg.append("circle")
    .attr("cx", x(firstPoint.time))
    .attr("cy", y(firstPoint.value))
    .attr("r", 4)
    .attr("fill", "steelblue")
    .style("opacity", 0);

  // --- Annotation groups ---
  const mealLinesGroup = svg.append("g")
    .attr("class", "meal-lines-group")
    .style("opacity", 0);

  // Hover group — tooltips + hit rects, hidden until all lines drawn
  const hoverGroup = svg.append("g")
    .attr("class", "hover-group")
    .style("pointer-events", "none");

  // Filter meals for this participant
  const allMealsForPid = mealData.filter(d => String(d.PID) === String(onlyParticipant.pid));

  // Find the earliest date to identify "Day 1"
  const firstMealDate = allMealsForPid.reduce((min, d) => {
    const t = d.Timestamp instanceof Date ? d.Timestamp : new Date(d.Timestamp);
    return t < min ? t : min;
  }, new Date(9999, 0));

  // Helper: check if a timestamp falls on the same calendar day as firstMealDate
  function isDay1(ts) {
    if (typeof ts === 'string') {
      return ts.startsWith("1 days") || ts.startsWith("1 day") || ts.includes("Day 1");
    }
    const d = ts instanceof Date ? ts : new Date(ts);
    return d.getFullYear() === firstMealDate.getFullYear() &&
           d.getMonth() === firstMealDate.getMonth() &&
           d.getDate() === firstMealDate.getDate();
  }

  const mealForParticipant = allMealsForPid.filter(d =>
    isDay1(d.Timestamp) &&
    (d["Meal Type"] === "breakfast" || d["Meal Type"] === "lunch")
  );

  const breakfastMeal = mealForParticipant.find(d => d["Meal Type"] === "breakfast");
  const lunchMeal = mealForParticipant.find(d => d["Meal Type"] === "lunch");

  if (!breakfastMeal || !lunchMeal) {
    console.error('[metrics-explain] Missing meal data. breakfast:', breakfastMeal, 'lunch:', lunchMeal);
    setupScrollAnimation({ path, totalLength, trackingDot, mealLinesGroup, dots: [], excTimeLines: [], excLines: [], recLines: [], hoverGroup });
    return;
  }

  let breakfast_startTime = parseTime(breakfastMeal.Timestamp);
  let lunch_startTime = parseTime(lunchMeal.Timestamp);

  let breakfast_start_glucose_value = onlyParticipant.data
    .find(d => d.time === breakfast_startTime).value;
  let lunch_start_glucose_value = onlyParticipant.data
    .find(d => d.time === lunch_startTime).value;

  let breakfast_glucose_excursion_time = onlyParticipant.data
    .filter(d => d.time >= breakfast_startTime && d.time <= (breakfast_startTime + 3))
    .reduce((acc, d) => d.value > acc.value ? d : acc, { value: 0 }).time;

  let lunch_glucose_excursion_time = onlyParticipant.data
    .filter(d => d.time >= lunch_startTime && d.time <= (lunch_startTime + 3))
    .reduce((acc, d) => d.value > acc.value ? d : acc, { value: 0 }).time;

  let breakfast_glucose_excursion_value = onlyParticipant.data
    .find(d => d.time === breakfast_glucose_excursion_time).value;
  let lunch_glucose_excursion_value = onlyParticipant.data
    .find(d => d.time === lunch_glucose_excursion_time).value;

  let breakfast_recovery_point = onlyParticipant.data
    .filter(d => d.time > breakfast_startTime && d.time <= (breakfast_startTime + 3) && d.value <= breakfast_start_glucose_value)
    .reduce((acc, d) => d.time < acc.time ? d : acc, { time: Infinity, value: 0 });
  let breakfast_glucose_recovery_time = breakfast_recovery_point.time;
  let breakfast_glucose_recovery_value = breakfast_recovery_point.value;

  let lunch_recovery_point = onlyParticipant.data
    .filter(d => d.time > lunch_startTime && d.time <= (lunch_startTime + 3) && d.value <= lunch_start_glucose_value)
    .reduce((acc, d) => d.time < acc.time ? d : acc, { time: Infinity, value: 0 });
  let lunch_glucose_recovery_time = lunch_recovery_point.time;
  let lunch_glucose_recovery_value = lunch_recovery_point.value;

  // --- Meal dashed lines and labels (fade in as group) ---
  mealForParticipant.forEach(d => {
    const mealTime = parseTime(d.Timestamp);
    mealLinesGroup.append("line")
      .attr("x1", x(mealTime))
      .attr("x2", x(mealTime))
      .attr("y1", 0)
      .attr("y2", plotHeight)
      .attr("stroke", "red")
      .attr("stroke-dasharray", "5,5")
      .append("title")
      .text(`Meal: ${d["Meal Type"]}`);

    mealLinesGroup.append("text")
      .attr("x", x(mealTime))
      .attr("y", -10)
      .attr("text-anchor", "middle")
      .attr("fill", "red")
      .style("font-size", "15px")
      .text(d["Meal Type"]);
  });

  // --- Individual dots (start at r=0, pop in via r animation) ---
  const dots = [
    // Breakfast: start, peak, recovery
    svg.append("circle").attr("cx", x(breakfast_startTime)).attr("cy", y(breakfast_start_glucose_value)).attr("r", 0).attr("fill", "red"),
    svg.append("circle").attr("cx", x(breakfast_glucose_excursion_time)).attr("cy", y(breakfast_glucose_excursion_value)).attr("r", 0).attr("fill", "red"),
    svg.append("circle").attr("cx", x(breakfast_glucose_recovery_time)).attr("cy", y(breakfast_glucose_recovery_value)).attr("r", 0).attr("fill", "red"),
    // Lunch: start, peak, recovery
    svg.append("circle").attr("cx", x(lunch_startTime)).attr("cy", y(lunch_start_glucose_value)).attr("r", 0).attr("fill", "red"),
    svg.append("circle").attr("cx", x(lunch_glucose_excursion_time)).attr("cy", y(lunch_glucose_excursion_value)).attr("r", 0).attr("fill", "red"),
    svg.append("circle").attr("cx", x(lunch_glucose_recovery_time)).attr("cy", y(lunch_glucose_recovery_value)).attr("r", 0).attr("fill", "red"),
  ];

  // --- Helper: create a line hidden via stroke-dashoffset for draw animation ---
  function createAnimLine(x1Val, y1Val, x2Val, y2Val, cls) {
    const line = svg.append("line")
      .attr("x1", x1Val).attr("y1", y1Val)
      .attr("x2", x2Val).attr("y2", y2Val)
      .attr("stroke", "red").attr("stroke-width", 2)
      .attr("class", cls);
    const len = Math.sqrt((x2Val - x1Val) ** 2 + (y2Val - y1Val) ** 2);
    line.attr("stroke-dasharray", len).attr("stroke-dashoffset", len);
    return line;
  }

  // Excursion time horizontal lines (drawn first)
  const bfExcTimeLine = createAnimLine(
    x(breakfast_startTime), y(breakfast_start_glucose_value),
    x(breakfast_glucose_excursion_time), y(breakfast_start_glucose_value), "hover-line-ge");
  const luExcTimeLine = createAnimLine(
    x(lunch_startTime), y(lunch_start_glucose_value),
    x(lunch_glucose_excursion_time), y(lunch_start_glucose_value), "hover-line-ge");

  // Excursion vertical lines (drawn second)
  const bfExcLine = createAnimLine(
    x(breakfast_glucose_excursion_time), y(breakfast_start_glucose_value),
    x(breakfast_glucose_excursion_time), y(breakfast_glucose_excursion_value), "hover-line-ex");
  const luExcLine = createAnimLine(
    x(lunch_glucose_excursion_time), y(lunch_start_glucose_value),
    x(lunch_glucose_excursion_time), y(lunch_glucose_excursion_value), "hover-line-ex");

  // Recovery horizontal lines (drawn third)
  const bfRecLine = createAnimLine(
    x(breakfast_glucose_excursion_time), y(breakfast_start_glucose_value),
    x(breakfast_glucose_recovery_time), y(breakfast_glucose_recovery_value), "hover-line-gr");
  const luRecLine = createAnimLine(
    x(lunch_glucose_excursion_time), y(lunch_start_glucose_value),
    x(lunch_glucose_recovery_time), y(lunch_glucose_recovery_value), "hover-line-gr");

  // --- Hover tooltips (in hoverGroup, activated after all lines drawn) ---

  // Tooltip for excursion time
  const hoverTextGroup = hoverGroup.append("g")
    .style("display", "none");

  hoverTextGroup.append("rect")
    .attr("x", 0).attr("y", 0).attr("width", 300).attr("height", 120)
    .attr("fill", "black").attr("opacity", 0.7).attr("rx", 10).attr("ry", 10);

  const textContainer1 = hoverTextGroup.append("g").attr("class", "paragraph");
  textContainer1.append("text")
    .attr("class", "y-section-header").attr("x", 15).attr("y", 30)
    .attr("fill", "white").style("font-size", "20px").text("Glucose Excursion Time");
  const detailsText1 = textContainer1.append("text")
    .attr("class", "details").attr("x", 15).attr("y", 60)
    .attr("fill", "white").style("font-size", "16px");
  detailsText1.append("tspan").attr("x", 15).text("The time it takes to reach");
  detailsText1.append("tspan").attr("x", 15).attr("dy", "1.4em").text("the maximum glucose level after meal");

  // Tooltip for excursion (vertical)
  const hoverTextGroupExcursion = hoverGroup.append("g")
    .style("display", "none");

  hoverTextGroupExcursion.append("rect")
    .attr("x", 0).attr("y", 0).attr("width", 300).attr("height", 120)
    .attr("fill", "black").attr("opacity", 0.7).attr("rx", 10).attr("ry", 10);

  const textContainer = hoverTextGroupExcursion.append("g").attr("class", "paragraph");
  textContainer.append("text")
    .attr("class", "y-section-header").attr("x", 15).attr("y", 30)
    .attr("fill", "white").style("font-size", "20px").text("Glucose Excursion");
  const detailsText = textContainer.append("text")
    .attr("class", "details").attr("x", 15).attr("y", 60)
    .attr("fill", "white").style("font-size", "16px");
  detailsText.append("tspan").attr("x", 15).text("The maximum glucose level");
  detailsText.append("tspan").attr("x", 15).attr("dy", "1.4em").text("reached after having a meal");

  // Tooltip for recovery
  const hoverTextGroupRecovery = hoverGroup.append("g")
    .style("display", "none");

  hoverTextGroupRecovery.append("rect")
    .attr("x", 0).attr("y", 0).attr("width", 300).attr("height", 120)
    .attr("fill", "black").attr("opacity", 0.7).attr("rx", 10).attr("ry", 10);

  const textContainer2 = hoverTextGroupRecovery.append("g").attr("class", "paragraph");
  textContainer2.append("text")
    .attr("class", "y-section-header").attr("x", 15).attr("y", 30)
    .attr("fill", "white").style("font-size", "20px").text("Glucose Recovery");
  const detailsText2 = textContainer2.append("text")
    .attr("class", "details").attr("x", 15).attr("y", 60)
    .attr("fill", "white").style("font-size", "16px");
  detailsText2.append("tspan").attr("x", 15).text("The time it takes to return");
  detailsText2.append("tspan").attr("x", 15).attr("dy", "1.4em").text("to original glucose level");

  // Hit-area rects for each line type
  function addHitRect(lineEl, tooltipGroup) {
    const lx1 = +lineEl.attr("x1"), ly1 = +lineEl.attr("y1");
    const lx2 = +lineEl.attr("x2"), ly2 = +lineEl.attr("y2");
    hoverGroup.append("rect")
      .attr("x", Math.min(lx1, lx2) - 10)
      .attr("y", Math.min(ly1, ly2) - 10)
      .attr("width", Math.abs(lx2 - lx1) + 20)
      .attr("height", Math.abs(ly2 - ly1) + 20)
      .attr("fill", "none")
      .attr("pointer-events", "all")
      .on("mouseover", function() {
        lineEl.attr("stroke-width", 4);
        tooltipGroup.style("display", null);
      })
      .on("mouseout", function() {
        lineEl.attr("stroke-width", 2);
        tooltipGroup.style("display", "none");
      })
      .on("mousemove", function(event) {
        const [mouseX, mouseY] = d3.pointer(event);
        tooltipGroup.attr("transform", `translate(${mouseX + 10},${mouseY - 10})`);
      });
  }

  addHitRect(bfExcTimeLine, hoverTextGroup);
  addHitRect(luExcTimeLine, hoverTextGroup);
  addHitRect(bfExcLine, hoverTextGroupExcursion);
  addHitRect(luExcLine, hoverTextGroupExcursion);
  addHitRect(bfRecLine, hoverTextGroupRecovery);
  addHitRect(luRecLine, hoverTextGroupRecovery);

  // --- Scroll-driven animation via GSAP ScrollTrigger ---
  setupScrollAnimation({
    path, totalLength, trackingDot, mealLinesGroup, dots,
    excTimeLines: [bfExcTimeLine, luExcTimeLine],
    excLines: [bfExcLine, luExcLine],
    recLines: [bfRecLine, luRecLine],
    hoverGroup,
  });
}

function setupScrollAnimation({ path, totalLength, trackingDot, mealLinesGroup, dots, excTimeLines, excLines, recLines, hoverGroup }) {
  const pathNode = path.node();
  const dotNode = trackingDot.node();
  const mealLinesNode = mealLinesGroup.node();

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: "#glu_metrics_explain",
      start: "top top",
      end: "+=400%",
      scrub: true,
      pin: true,
      pinSpacing: true,
    }
  });

  // Phase 0: Draw the glucose line and move the tracking dot (text phase 0 is already visible)
  tl.fromTo(pathNode,
    { attr: { "stroke-dashoffset": totalLength } },
    {
      attr: { "stroke-dashoffset": 0 },
      duration: 2,
      ease: "none",
      onStart: () => {
        gsap.set(dotNode, { opacity: 1 });
        setActivePhase(0);
      },
      onUpdate: function() {
        const progress = this.progress();
        const length = progress * totalLength;
        const point = pathNode.getPointAtLength(length);
        gsap.set(dotNode, { attr: { cx: point.x, cy: point.y } });
      },
    }
  );

  // Fade out the tracking dot
  tl.to(dotNode, { opacity: 0, duration: 0.2 });

  // Fade in meal dashed lines
  tl.to(mealLinesNode, { opacity: 1, duration: 0.4 });

  // Pop in the 3 key dots per meal (r: 0 -> 5)
  if (dots.length > 0) {
    tl.to(dots.map(d => d.node()), { attr: { r: 5 }, duration: 0.3, stagger: 0.05 });
  }

  // Phase 1: Draw excursion time horizontal lines
  tl.add(() => setActivePhase(1));
  if (excTimeLines.length > 0) {
    tl.to(excTimeLines.map(l => l.node()), { attr: { "stroke-dashoffset": 0 }, duration: 0.5, ease: "none" });
  }

  // Phase 2: Draw excursion vertical lines
  tl.add(() => setActivePhase(2));
  if (excLines.length > 0) {
    tl.to(excLines.map(l => l.node()), { attr: { "stroke-dashoffset": 0 }, duration: 0.5, ease: "none" });
  }

  // Phase 3: Draw recovery horizontal lines
  tl.add(() => setActivePhase(3));
  if (recLines.length > 0) {
    tl.to(recLines.map(l => l.node()), { attr: { "stroke-dashoffset": 0 }, duration: 0.5, ease: "none" });
  }

  // Enable hover tooltips + hold
  tl.add(() => {
    hoverGroup.style("pointer-events", "all");
  });
  tl.to({}, { duration: 1 });

  // Refresh ScrollTrigger since this runs after async data load
  requestAnimationFrame(() => {
    ScrollTrigger.refresh();
  });
}

async function main() {
  try {
    const { nonDiabeticParticipants, cgmData, mealData } = await fetchData();
    plotData(nonDiabeticParticipants, cgmData, mealData);
  } catch (error) {
    console.error('[metrics-explain] Error in main function:', error);
  }
}

export function init() {
  return main();
}
