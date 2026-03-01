import * as d3 from 'd3';
import { loadCGMacros, loadBio, loadMealData } from '../utils/data-loader.js';

const margin = { top: 50, right: 50, bottom: 50, left: 100 };
const rowHeight = 500;
const plotGap = 20;

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

  const totalHeight = (selectedPIDs.length * (rowHeight + plotGap)) - plotGap + margin.top + margin.bottom;

  const container = document.getElementById("explain_graph");

  const svgWidth = container.clientWidth;
  const svgHeight = container.clientHeight;

  const svg = d3.select('#explain_graph')
    .append('svg')
    .attr('width', svgWidth)
    .attr('height', svgHeight)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  const parseTime = (timestamp) => {
    try {
      let timeParts;
      if (timestamp.includes(":")) {
        if (timestamp.split(" ").length >= 3) {
          timeParts = timestamp.split(" ")[2].split(":");
        } else {
          timeParts = timestamp.split(" ").find(part => part.includes(":")).split(":");
        }
        const hours = parseInt(timeParts[0]);
        const minutes = parseInt(timeParts[1]);
        const decimalHours = hours + minutes / 60;
        return decimalHours < 12 ? decimalHours : null;
      } else {
        return null;
      }
    } catch (error) {
      console.error("Error parsing timestamp:", timestamp, error);
      return null;
    }
  };

  const x = d3.scaleLinear()
    .domain([0, 14])
    .range([0, svgWidth]);

  svg.append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0, ${svgHeight - margin.bottom - margin.top})`)
    .call(d3.axisBottom(x)
      .ticks(12)
      .tickFormat(d => {
        if (d === 0 || d === 24) return "12AM";
        if (d === 12) return "12PM";
        return d < 12 ? `${d}AM` : `${d - 12}PM`;
      }));

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
    })).filter(d => d.value > 0);

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
    .range([svgHeight - margin.top - margin.bottom, 0]);

  svg.append("g")
    .attr("class", "y-axis")
    .call(d3.axisLeft(y).ticks(5));

  for (let i = 0; i <= maxGlucoseValue * 1.1; i += 20) {
    svg.append("line")
      .attr("x1", 0)
      .attr("x2", svgWidth)
      .attr("y1", y(i))
      .attr("y2", y(i))
      .attr("stroke", "#ccc")
      .attr("stroke-width", 1);
  }

  svg.append("text")
    .attr("class", "y label")
    .attr("text-anchor", "end")
    .attr("y", 0)
    .attr("dy", "-2.5em")
    .attr("transform", "rotate(-90)")
    .style("font-size", "12px")
    .text("Glucose Level (mg/dL)");

  let onlyParticipant = participantData[0];

  svg.append("path")
    .datum(onlyParticipant.data)
    .attr("fill", "none")
    .attr("stroke", "steelblue")
    .attr("stroke-width", 2)
    .attr("d", d3.line()
      .x(d => x(d.time))
      .y(d => y(d.value))
      .curve(d3.curveMonotoneX));

  const mealForParticipant = mealData.filter(d =>
    String(d.PID) === String(onlyParticipant.pid) &&
    (d.Timestamp.startsWith("1 days") || d.Timestamp.startsWith("1 day") || d.Timestamp.includes("Day 1")) &&
    (d["Meal Type"] === "breakfast" || d["Meal Type"] === "lunch")
  );

  let breakfast_startTime = parseTime(mealForParticipant.find(d => d["Meal Type"] === "breakfast").Timestamp);
  let lunch_startTime = parseTime(mealForParticipant.find(d => d["Meal Type"] === "lunch").Timestamp);

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

  let breakfast_glucose_recovery_time = onlyParticipant.data
    .filter(d => d.time > breakfast_startTime && d.time <= (breakfast_startTime + 3) && d.value <= breakfast_start_glucose_value)
    .reduce((acc, d) => d.time < acc.time ? d : acc, { time: Infinity }).time;
  let lunch_glucose_recovery_time = onlyParticipant.data
    .filter(d => d.time > lunch_startTime && d.time <= (lunch_startTime + 3) && d.value <= lunch_start_glucose_value)
    .reduce((acc, d) => d.time < acc.time ? d : acc, { time: Infinity }).time;
  let breakfast_glucose_recovery_value = onlyParticipant.data
    .find(d => d.time === breakfast_glucose_recovery_time).value;
  let lunch_glucose_recovery_value = onlyParticipant.data
    .find(d => d.time === lunch_glucose_recovery_time).value;

  mealForParticipant.forEach(d => {
    const mealTime = parseTime(d.Timestamp);
    svg.append("line")
      .attr("x1", x(mealTime))
      .attr("x2", x(mealTime))
      .attr("y1", 0)
      .attr("y2", rowHeight)
      .attr("stroke", "red")
      .attr("stroke-dasharray", "5,5")
      .append("title")
      .text(`Meal: ${d["Meal Type"]}`);

    svg.append("text")
      .attr("x", x(mealTime))
      .attr("y", -10)
      .attr("text-anchor", "middle")
      .attr("fill", "red")
      .style("font-size", "15px")
      .text(d["Meal Type"]);
  });

  // Glucose excursion time lines
  svg.append("line")
    .attr("x1", x(breakfast_startTime))
    .attr("x2", x(breakfast_glucose_excursion_time))
    .attr("y1", y(breakfast_start_glucose_value))
    .attr("y2", y(breakfast_start_glucose_value))
    .attr("stroke", "red")
    .attr("stroke-width", 2)
    .attr("class", "hover-line-ge");

  svg.append("line")
    .attr("x1", x(lunch_startTime))
    .attr("x2", x(lunch_glucose_excursion_time))
    .attr("y1", y(lunch_start_glucose_value))
    .attr("y2", y(lunch_start_glucose_value))
    .attr("stroke", "red")
    .attr("stroke-width", 2)
    .attr("class", "hover-line-ge");

  // Dots for excursion time
  svg.append("circle").attr("cx", x(breakfast_startTime)).attr("cy", y(breakfast_start_glucose_value)).attr("r", 5).attr("fill", "red");
  svg.append("circle").attr("cx", x(breakfast_glucose_excursion_time)).attr("cy", y(breakfast_start_glucose_value)).attr("r", 5).attr("fill", "red");
  svg.append("circle").attr("cx", x(lunch_startTime)).attr("cy", y(lunch_start_glucose_value)).attr("r", 5).attr("fill", "red");
  svg.append("circle").attr("cx", x(lunch_glucose_excursion_time)).attr("cy", y(lunch_start_glucose_value)).attr("r", 5).attr("fill", "red");

  // Hover text for glucose excursion time
  const hoverTextGroup = svg.append("g")
    .style("display", "none")
    .attr("transform", `translate(${margin.left + 20}, ${margin.top + 20})`);

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

  svg.selectAll(".hover-line-ge")
    .on("mouseover", function() {
      d3.select(this).attr("stroke-width", 4);
      hoverTextGroup.style("display", null);
    })
    .on("mouseout", function() {
      d3.select(this).attr("stroke-width", 2);
      hoverTextGroup.style("display", "none");
    })
    .on("mousemove", function(event) {
      const [mouseX, mouseY] = d3.pointer(event);
      hoverTextGroup.attr("transform", `translate(${mouseX + 10},${mouseY - 10})`);
    });

  svg.selectAll(".hover-line-ge")
    .each(function() {
      const lineEl = d3.select(this);
      const x1 = lineEl.attr("x1");
      const x2 = lineEl.attr("x2");
      const y1 = lineEl.attr("y1");
      const y2 = lineEl.attr("y2");

      svg.append("rect")
        .attr("x", Math.min(x1, x2) - 10)
        .attr("y", Math.min(y1, y2) - 10)
        .attr("width", Math.abs(x2 - x1) + 20)
        .attr("height", Math.abs(y2 - y1) + 20)
        .attr("fill", "none")
        .attr("pointer-events", "all")
        .on("mouseover", function() { lineEl.dispatch("mouseover"); })
        .on("mouseout", function() { lineEl.dispatch("mouseout"); })
        .on("mousemove", function(event) { lineEl.dispatch("mousemove", { detail: event }); });
    });

  // Glucose recovery time lines
  svg.append("line")
    .attr("x1", x(breakfast_glucose_excursion_time))
    .attr("x2", x(breakfast_glucose_recovery_time))
    .attr("y1", y(breakfast_start_glucose_value))
    .attr("y2", y(breakfast_start_glucose_value))
    .attr("stroke", "red").attr("stroke-width", 2).attr("class", "hover-line-gr");

  svg.append("line")
    .attr("x1", x(lunch_glucose_excursion_time))
    .attr("x2", x(lunch_glucose_recovery_time))
    .attr("y1", y(lunch_start_glucose_value))
    .attr("y2", y(lunch_start_glucose_value))
    .attr("stroke", "red").attr("stroke-width", 2).attr("class", "hover-line-gr");

  // Dots for recovery
  svg.append("circle").attr("cx", x(breakfast_glucose_excursion_time)).attr("cy", y(breakfast_start_glucose_value)).attr("r", 5).attr("fill", "red");
  svg.append("circle").attr("cx", x(breakfast_glucose_recovery_time)).attr("cy", y(breakfast_start_glucose_value)).attr("r", 5).attr("fill", "red");
  svg.append("circle").attr("cx", x(lunch_glucose_excursion_time)).attr("cy", y(lunch_start_glucose_value)).attr("r", 5).attr("fill", "red");
  svg.append("circle").attr("cx", x(lunch_glucose_recovery_time)).attr("cy", y(lunch_start_glucose_value)).attr("r", 5).attr("fill", "red");

  // Hover text for recovery
  const hoverTextGroupRecovery = svg.append("g")
    .style("display", "none")
    .attr("transform", `translate(${margin.left + 20}, ${margin.top + 20})`);

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

  svg.selectAll(".hover-line-gr")
    .on("mouseover", function() {
      d3.select(this).attr("stroke-width", 4);
      hoverTextGroupRecovery.style("display", null);
    })
    .on("mouseout", function() {
      d3.select(this).attr("stroke-width", 2);
      hoverTextGroupRecovery.style("display", "none");
    })
    .on("mousemove", function(event) {
      const [mouseX, mouseY] = d3.pointer(event);
      hoverTextGroupRecovery.attr("transform", `translate(${mouseX + 10},${mouseY - 10})`);
    });

  svg.selectAll(".hover-line-gr")
    .each(function() {
      const lineEl = d3.select(this);
      const x1 = lineEl.attr("x1");
      const x2 = lineEl.attr("x2");
      const y1 = lineEl.attr("y1");
      const y2 = lineEl.attr("y2");

      svg.append("rect")
        .attr("x", Math.min(x1, x2) - 10)
        .attr("y", Math.min(y1, y2) - 10)
        .attr("width", Math.abs(x2 - x1) + 20)
        .attr("height", Math.abs(y2 - y1) + 20)
        .attr("fill", "none")
        .attr("pointer-events", "all")
        .on("mouseover", function() { lineEl.dispatch("mouseover"); })
        .on("mouseout", function() { lineEl.dispatch("mouseout"); })
        .on("mousemove", function(event) { lineEl.dispatch("mousemove", { detail: event }); });
    });

  // Glucose excursion (vertical) lines
  svg.append("line")
    .attr("x1", x(breakfast_glucose_excursion_time))
    .attr("x2", x(breakfast_glucose_excursion_time))
    .attr("y1", y(breakfast_start_glucose_value))
    .attr("y2", y(breakfast_glucose_excursion_value))
    .attr("stroke", "red").attr("stroke-width", 2).attr("class", "hover-line-ex");

  svg.append("line")
    .attr("x1", x(lunch_glucose_excursion_time))
    .attr("x2", x(lunch_glucose_excursion_time))
    .attr("y1", y(lunch_start_glucose_value))
    .attr("y2", y(lunch_glucose_excursion_value))
    .attr("stroke", "red").attr("stroke-width", 2).attr("class", "hover-line-ex");

  // Dots for excursion
  svg.append("circle").attr("cx", x(breakfast_glucose_excursion_time)).attr("cy", y(breakfast_glucose_excursion_value)).attr("r", 5).attr("fill", "red");
  svg.append("circle").attr("cx", x(lunch_glucose_excursion_time)).attr("cy", y(lunch_glucose_excursion_value)).attr("r", 5).attr("fill", "red");

  // Hover text for excursion
  const hoverTextGroupExcursion = svg.append("g")
    .style("display", "none")
    .attr("transform", `translate(${margin.left + 20}, ${margin.top + 20})`);

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

  svg.selectAll(".hover-line-ex")
    .on("mouseover", function() {
      d3.select(this).attr("stroke-width", 4);
      hoverTextGroupExcursion.style("display", null);
    })
    .on("mouseout", function() {
      d3.select(this).attr("stroke-width", 2);
      hoverTextGroupExcursion.style("display", "none");
    });
}

async function main() {
  try {
    const { nonDiabeticParticipants, cgmData, mealData } = await fetchData();
    plotData(nonDiabeticParticipants, cgmData, mealData);
  } catch (error) {
    console.error('Error in main function:', error);
  }
}

export function init() {
  main();
}
