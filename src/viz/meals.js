import * as d3 from 'd3';
import { getTooltip, showTooltip, hideTooltip } from '../utils/tooltip.js';
import { GROUP_COLORS } from '../utils/colors.js';
import { loadMealData } from '../utils/data-loader.js';

function getColorForGroup(group) {
  return GROUP_COLORS[group] || '#000000';
}

export function init() {
  const tooltipDiv = getTooltip();

  let mealInfoBox = d3.select("body").append("div")
    .attr("class", "meal-info-box")
    .style("position", "fixed")
    .style("display", "none")
    .style("background", "rgba(0, 0, 0, 0.8)")
    .style("color", "white")
    .style("border-radius", "10px")
    .style("padding", "15px")
    .style("width", "300px")
    .style("pointer-events", "none")
    .style("z-index", "1000");

  const selectContainer = document.querySelector("#select");

  const mealTypes = ["All", "Breakfast", "Lunch", "Dinner", "Snack"];
  const mealDropdown = document.createElement("select");
  mealDropdown.id = "meal-filter";
  mealDropdown.style.marginRight = "10px";

  mealTypes.forEach(type => {
    let option = document.createElement("option");
    option.value = type;
    option.textContent = type;
    mealDropdown.appendChild(option);
  });

  selectContainer.appendChild(mealDropdown);

  loadMealData().then(data => {
    const parseTime = d3.timeParse("%d days %H:%M:%S");

    data.forEach(d => {
      d.Timestamp = parseTime(d.Timestamp);
      d.Timestamp = new Date(d.Timestamp.getTime() + 24 * 60 * 60 * 1000);
    });

    const minTime = new Date(data[0].Timestamp);
    minTime.setHours(0, 0, 0, 0);
    const maxTime = new Date(minTime);
    maxTime.setDate(maxTime.getDate() + 9);
    maxTime.setHours(23, 59, 59, 999);

    const height = 200;
    const margin = {top: 40, right: 50, bottom: 50, left: 60};

    function createGraph(group, graphId, title) {
      const containerEl = document.getElementById(graphId);
      const width = Math.max(containerEl.clientWidth - margin.left - margin.right, 300);
      const svg = d3.select(`#${graphId}`).append("svg")
        .attr("width", "100%")
        .attr("height", height + margin.top + margin.bottom)
        .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      const xScale = d3.scaleTime()
        .domain([minTime, maxTime])
        .range([0, width]);

      const yScale = d3.scaleLinear()
        .domain([0, 600])
        .range([height, 0]);

      svg.append("rect")
        .attr("width", width)
        .attr("height", height)
        .attr("fill", "transparent");

      svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .attr("class", "x-axis")
        .call(d3.axisBottom(xScale)
          .ticks(d3.timeDay.every(1))
          .tickFormat((d, i) => `Day ${i + 1}`));

      svg.append("g")
        .attr("class", "y-axis");

      svg.selectAll("line")
        .data(group)
        .enter()
        .append("line")
        .attr("x1", d => xScale(d.Timestamp))
        .attr("x2", d => xScale(d.Timestamp))
        .attr("y1", 0)
        .attr("y2", height)
        .attr("stroke", d => getColorForGroup(d['diabetes level']))
        .attr("stroke-width", 1)
        .on("mouseover", function(event, d) {
          d3.select(this)
            .attr("stroke-width", 3)
            .attr("stroke", "red");

          showTooltip(`
            <strong>Meal Type:</strong> ${d["Meal Type"] || "No data"}<br>
            <strong>Carbs:</strong> ${d["Carbs"] + ' g' || "No data"}<br>
            <strong>Protein:</strong> ${d["Protein"] + ' g' || "No data"}<br>
            <strong>Fat:</strong> ${d["Fat"] + ' g'|| "No data"}<br>
            <strong>Fiber:</strong> ${d["Fiber"] + ' g' || "No data"}<br>
          `, event.pageX + 10, event.pageY + 10);
        })
        .on("mousemove", function(event) {
          showTooltip(tooltipDiv.innerHTML, event.pageX + 10, event.pageY + 10);
        })
        .on("mouseout", function(event, d) {
          d3.select(this)
            .attr("stroke-width", 1)
            .attr("stroke", d => getColorForGroup(d['diabetes level']));

          hideTooltip();
        })
        .on("click", function(event, d) {
          showTooltip(`
            <strong>Meal Type:</strong> ${d["Meal Type"] || "N/A"}<br>
            <strong>Carbs:</strong> ${d["Carbs"]} g<br>
            <strong>Protein:</strong> ${d["Protein"] || "N/A"} g<br>
            <strong>Fat:</strong> ${d["Fat"] || "N/A"} g<br>
            <strong>Fiber:</strong> ${d["Fiber"] || "N/A"} g<br>
          `, event.pageX + 10, event.pageY + 10);
        });

      svg.append("text")
        .attr("x", width / 2)
        .attr("y", -10)
        .attr("text-anchor", "middle")
        .attr("font-size", "16px")
        .attr("font-weight", "bold")
        .text(title);
    }

    function updateGraphs() {
      const selectedMealType = mealDropdown.value;
      const filteredData = selectedMealType === "All" ? data : data.filter(d => d["Meal Type"].toLowerCase() === selectedMealType.toLowerCase());

      d3.select("#graph-nondiabetic").html("");
      d3.select("#graph-prediabetic").html("");
      d3.select("#graph-diabetic").html("");
      createGraph(filteredData.filter(d => d['diabetes level'] === 'Non-diabetic'), "graph-nondiabetic", "Non-Diabetic Group");
      createGraph(filteredData.filter(d => d['diabetes level'] === 'Pre-diabetic'), "graph-prediabetic", "Pre-Diabetic Group");
      createGraph(filteredData.filter(d => d['diabetes level'] === 'Diabetic'), "graph-diabetic", "Diabetic Group");
    }

    mealDropdown.addEventListener("change", function(event) {
      const selectedMeal = event.target.value;
      if (selectedMeal !== "All") {
        const mealInfo = {
          "Breakfast": {
            title: "Protein Shake",
            details: [
              "Identical protein shake for all participants",
              "Controlled morning meal to establish baseline",
            ]
          },
          "Lunch": {
            title: "Chipotle Meal",
            details: [
              "Standardized Chipotle meal for all participants",
              "Controlled portions and ingredients",
            ]
          },
          "Dinner": {
            title: "Evening Meal",
            details: [
              "Participants' own choice of dinner",
              "Varied meal compositions",
            ]
          },
          "Snack": {
            title: "You might have already noticed",
            details: [
              "Participants with diabetes don't eat snacks very often",
              "It seems like their eating habits is rigid with fixed meal times"
            ]
          }
        };

        const info = mealInfo[selectedMeal];

        const dropdownRect = mealDropdown.getBoundingClientRect();

        mealInfoBox
          .html(`
            <div>
              <div style="font-size: 20px; margin-bottom: 10px;">${info.title}</div>
              <div style="font-size: 16px;">
                ${info.details.map(detail => `<div style="margin: 5px 0;">${detail}</div>`).join('')}
              </div>
            </div>
          `)
          .style("display", "block")
          .style("left", `${dropdownRect.right + 10}px`)
          .style("top", `${dropdownRect.top}px`);
      } else {
        mealInfoBox.style("display", "none");
      }

      updateGraphs();
    });

    updateGraphs();

  }).catch(error => console.error("Error loading the JSON data:", error));

  document.addEventListener("click", function(event) {
    const mealDropdownEl = document.getElementById("meal-filter");
    if (event.target !== mealDropdownEl) {
      d3.select(".meal-info-box").style("display", "none");
    }
  });

  let mealsResizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(mealsResizeTimer);
    mealsResizeTimer = setTimeout(() => {
      d3.select("#graph-nondiabetic").html("");
      d3.select("#graph-prediabetic").html("");
      d3.select("#graph-diabetic").html("");
      const mealDropdownEl = document.getElementById("meal-filter");
      if (mealDropdownEl) {
        mealDropdownEl.dispatchEvent(new Event('change'));
      }
    }, 250);
  });
}
