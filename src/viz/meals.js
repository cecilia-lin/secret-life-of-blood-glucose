import * as d3 from 'd3';
import { getTooltip, showTooltip, hideTooltip } from '../utils/tooltip.js';
import { GROUP_COLORS } from '../utils/colors.js';
import { loadMealData } from '../utils/data-loader.js';

function getColorForGroup(group) {
  return GROUP_COLORS[group] || '#000000';
}

const steps = ["All", "Breakfast", "Lunch", "Dinner", "Snack", "Analysis"];

const stepNotes = {
  "All": {
    title: "Meal Frequency Overview",
    body: "Each vertical line represents a meal event. Notice how the density and regularity of meals varies across groups over the 10-day period.",
    filter: "All"
  },
  "Breakfast": {
    title: "Protein Shake",
    body: "Identical protein shake for all participants. Controlled morning meal to establish baseline.",
    filter: "Breakfast"
  },
  "Lunch": {
    title: "Chipotle Meal",
    body: "Standardized Chipotle meal for all participants. Controlled portions and ingredients.",
    filter: "Lunch"
  },
  "Dinner": {
    title: "Evening Meal",
    body: "Participants' own choice of dinner. Varied meal compositions.",
    filter: "Dinner"
  },
  "Snack": {
    title: "Snack Frequency",
    body: "This is how often each group snacks between meals over the 10-day period. Take a look at the differences across the three groups.",
    filter: "Snack"
  },
  "Analysis": {
    title: "You might have already noticed",
    body: "<ul><li>Diabetic group rarely eats snacks</li><li>They follow rigid, fixed meal times</li></ul>",
    filter: "Snack"
  }
};

let currentStep = 0;

export function init() {
  const tooltipDiv = getTooltip();

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

    const height = 120;
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

    function updateGraphs(mealType) {
      const filteredData = mealType === "All" ? data : data.filter(d => d["Meal Type"].toLowerCase() === mealType.toLowerCase());

      d3.select("#graph-nondiabetic").html("");
      d3.select("#graph-prediabetic").html("");
      d3.select("#graph-diabetic").html("");
      createGraph(filteredData.filter(d => d['diabetes level'] === 'Non-diabetic'), "graph-nondiabetic", "Non-Diabetic Group");
      createGraph(filteredData.filter(d => d['diabetes level'] === 'Pre-diabetic'), "graph-prediabetic", "Pre-Diabetic Group");
      createGraph(filteredData.filter(d => d['diabetes level'] === 'Diabetic'), "graph-diabetic", "Diabetic Group");
    }

    function goToStep(index) {
      currentStep = index;
      const mealType = steps[currentStep];
      const note = stepNotes[mealType];

      // Update charts
      updateGraphs(note.filter);

      // Update note card
      document.querySelector('.meal-note-title').textContent = note.title;
      document.querySelector('.meal-note-body').innerHTML = note.body;

      // Update step indicator dots
      const indicator = document.querySelector('.meal-step-indicator');
      indicator.innerHTML = steps.map((_, i) =>
        `<span class="dot${i === currentStep ? ' active' : ''}"></span>`
      ).join('');

      // Update button states
      document.getElementById('meal-back').disabled = currentStep === 0;
      document.getElementById('meal-next').disabled = currentStep === steps.length - 1;
    }

    // Nav button listeners
    document.getElementById('meal-back').addEventListener('click', () => {
      if (currentStep > 0) goToStep(currentStep - 1);
    });

    document.getElementById('meal-next').addEventListener('click', () => {
      if (currentStep < steps.length - 1) goToStep(currentStep + 1);
    });

    // Initialize
    goToStep(0);

    let mealsResizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(mealsResizeTimer);
      mealsResizeTimer = setTimeout(() => {
        goToStep(currentStep);
      }, 250);
    });

  }).catch(error => console.error("Error loading the JSON data:", error));
}
