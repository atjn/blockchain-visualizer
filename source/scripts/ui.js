/**
 * @file
 * This is the main script file.
 */

import { Simulation, SimulationTime, EventDispatcher } from "./simulationHandlers.js"
import { EventDrawer } from "./simulationDrawers.js"

globalThis.settings = {};

const allInputs = {
	network: {
		type: "box",
		children: {
			algorithms: {
				type: "select",
				label: "Verification",
				options: [
					"Bitcoin",
					"PrebenCoin",
				],
				default: "Bitcoin",
			},
			nodes: {
				type: "range",
				min: 5,
				max: 100,
				default: 20,
			},
			speed: {
				type: "range",
				min: 500,
				max: 5000,
				default: 1000,
				unit: "ms",
			},
		},
	},
	seed: {
		type: "range",
		min: 1,
		max: 10000,
		step: 1,
		default: Math.random() * 10000,
	},
	attackers: {
		type: "range",
		min: 0,
		max: 100,
		unit: "%",
		default: 50,
	},
	time: {
		type: "range",
		min: 0.5,
		max: 2,
		step: 0.1,
		unit: "x",
		default: 1,
	},
};

/**.
 *
 * Generates all input elements for the simulation
 *
 * @param {object} inputData - Description of the input elements to generate
 * @param {object} parent - Parent element to append input elements to
 */
function generateInputs(inputData, parent){
	for (const [name, data] of Object.entries(inputData)) {
		const label = document.createElement("label");
		label.innerHTML = `${data.label || name[0].toUpperCase() + name.slice(1)}:`;
		label.for = name;

		parent.appendChild(label);

		switch (data.type) {
			case "box": {
				const box = document.createElement("div");
				box.id = name;
				box.classList.add("controlBox");

				parent.appendChild(box);
				generateInputs(data.children, box);
				break;
			}

			case "select": {
				const select = document.createElement("select");
				select.name = name;
				select.id = name;

				for (const optionName of data.options) {
					const option = document.createElement("option");
					option.value = optionName;
					option.innerHTML = optionName;
					select.appendChild(option);
				}

				parent.appendChild(select);
				appendDataReader(select);
				select.value = data.default;

				select.dispatchEvent(new InputEvent("input"));
				break;
			}

			case "range": {
				const range = document.createElement("input");
				range.type = data.type;
				range.name = name;
				range.id = name;
				range.dataset.unit = data.unit || "";

				for (const key of ["min", "max", "step"]) {
					if (data[key]) range[key] = data[key];
				}

				parent.appendChild(range);
				appendDataReader(range);
				range.value = data.default;

				const output = document.createElement("output");

				parent.appendChild(output);

				range.dispatchEvent(new InputEvent("input"));
				break;
			}
		}
	}

	/**.
	 *
	 * Handles inputs from control elements
	 *
	 * @param {object} element - Element to listen to.
	 */
	function appendDataReader(element){
		element.addEventListener("input", e => {
			const scopes = [];
			let domScope = e.target;

			while (domScope.parentElement.classList.contains("controlBox")) {
				domScope = domScope.parentElement;

				scopes.push(domScope.id);
			}

			scopes.reverse();

			let settingsScope = globalThis.settings;
			for (const scope of scopes) {
				settingsScope[scope] ??= {};
				settingsScope = settingsScope[scope];
			}

			settingsScope[e.target.name] = e.target.value;

			if (e.target.nextElementSibling?.tagName === "OUTPUT") {
				e.target.nextElementSibling.value = e.target.value + e.target.dataset.unit;
			}

			resetSimulation();
		});
	}
}

globalThis.eventDispatcher = new EventDispatcher();
globalThis.simulationTime = new SimulationTime();
globalThis.eventDrawer = new EventDrawer();


/**
 *
 */
 function resetSimulation(){
	globalThis.simulation?.terminate();
	globalThis.events = [];
	globalThis.simulationTime.reset();
	globalThis.eventDispatcher.reset();

	document.querySelector("#visualizer .network").innerHTML = "";
	document.querySelector("#visualizer .blockchain").innerHTML = "";

	const playButton = document.getElementById("play");
	playButton.innerHTML = "Play";
	playButton.classList.add("paused");

	globalThis.simulation = new Simulation();
}


const playButton = document.getElementById("play");

playButton.addEventListener("click", event => {
	const button = event.target;
	if(button.classList.contains("paused")){
		globalThis.simulationTime.resume();
		button.innerHTML = "Pause";
	}else{
		globalThis.simulationTime.pause();
		button.innerHTML = "Play";
	}
	button.classList.toggle("paused");
});

async function updateNetworkBoxSize(){
	const visualization = document.querySelector("#visualizer .network");
	globalThis.settings.networkBoxRatio =  visualization.clientWidth / visualization.clientHeight;
}
window.addEventListener("resize", updateNetworkBoxSize);
updateNetworkBoxSize();

generateInputs(allInputs, document.getElementById("controls"));
