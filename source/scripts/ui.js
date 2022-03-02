/**
 * @file
 * This file is the main handler for all UI elements in the app. Most of the direct changes to DOM elements should happen in this file.
 * All of the underlying simulation functionality of the app is imported into this file from other files.
 */

import { Simulation, SimulationTime, EventDispatcher } from "./simulationHandlers.js";
import { EventDrawer } from "./simulationDrawers.js";

/**.
 * This is a JSON representation of all the different inputs that the simulation requires.
 * These are build and added to the app on load with `generateInputs()`, and can be changed live if need be.
 *
 * When a value is changed, it is saved to `globalThis.settings`. Here is an example of what it looks like:
 *
 *	globalThis.settings: {
 * 		network: {
 * 			algorithms: "Bitcoin",
 * 			nodes: 25,
 * 			...
 * 		},
 * 		seed: 3554,
 * 		...
 *	}
 *
 */
globalThis.settings = {};
const allInputs = {
	network: {
		type: "box",
		description: "Settings related to the simulated network",
		children: {
			algorithms: {
				type: "select",
				label: "Verification",
				options: [
					"Bitcoin",
					"PrebenCoin",
				],
				default: "Bitcoin",
				description: "Which blockchain protocol should be used in the simulation.",
			},
			nodes: {
				type: "range",
				min: 5,
				max: 100,
				default: 20,
				description: "How many nodes should the simulation consist of.",
			},
			speed: {
				type: "range",
				min: 500,
				max: 5000,
				default: 1000,
				unit: "ms",
				description: "How slow should the network be. In other words; how many milliseconds should it take for a packet to move across the entire network visualization vertically.",
			},
		},
	},
	seed: {
		type: "range",
		min: 1,
		max: 10000,
		step: 1,
		default: Math.random() * 10000,
		description: `If you run the simulation multiple times with the same seed, then all runs will be identical. If you use different seeds, then the position of the nodes, as well as which nodes get to publish which blocks, and so on, are all different between runs.`,
	},
	attackers: {
		type: "range",
		min: 0,
		max: 100,
		unit: "%",
		default: 50,
		description: "The percentage of nodes trying to misuse the network. Read more about it in the text section.",
	},
	time: {
		type: "range",
		min: 0.5,
		max: 2,
		step: 0.1,
		unit: "x",
		default: 1,
		description: "Use this to speed up or slow down the simulation to make it easier to follow along. This does not actually change anything in the simulation, it only changes the playback rate.",
	},
};

/**
 * Generates all input elements for the simulation, based on the variable `allInputs` defined above.
 *
 * @param {object} inputData - Description of the input elements to generate.
 * @param {object} parent - The element to put the input elements inside of.
 */
function generateInputs(inputData, parent){
	for (const [name, data] of Object.entries(inputData)) {

		// Create a label for the control
		const label = document.createElement("label");
		label.innerHTML = `${data.label || name[0].toUpperCase() + name.slice(1)}:`;
		label.for = name;
		parent.appendChild(label);

		// Then create the control along with any other necessary DOM elements for that control
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

				// This makes the input handler run on this control, which saves the inital default value to `globalThis.settings`.
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

				// This makes the input handler run on this control, which saves the inital default value to `globalThis.settings`.
				range.dispatchEvent(new InputEvent("input"));

				break;
			}
		}
	}

	/**
	 * This functon should be called on every control element being added to the UI.
	 *
	 * When the user updates a setting with one of the controls,
	 * this function makes sure the change is ported to the `globalThis.settings` object.
	 *
	 * If the control value is shown in an `<output>` field in the DOM, then that is also updated by this function.
	 *
	 * @param {object} element - Control element to listen to.
	 */
	function appendDataReader(element){
		element.addEventListener("input", e => {

			/**
			 * All of this is just to figure out if the control is inside one or more boxes.
			 *
			 * This is important because if, for example, the control "speed" was inside a box called "connection",
			 * which was in turn inside a box called "network", then the value should be saved as:
			 *
			 * `globalThis.settings.network.connection.speed`.
			 *
			 * And not just as:
			 *
			 * `globalThis.settings.speed`.
			 *
			 * ..which could make it collide with other controls that also have that name, but are used for something other than network connections.
			 *
			 */

			const scopes = [];
			let domScope = e.target;

			// Move up the tree of the control's DOM parents and save the name of each control box.
			// Stop when encountering a parent that is not a control box.
			while (domScope.parentElement.classList.contains("controlBox")) {
				domScope = domScope.parentElement;

				scopes.push(domScope.id);
			}

			// We have saved the box names going from the inside-out, but we want to create the settings element from the outside-in, so we reverse the order.
			scopes.reverse();

			// Now we iterate through each box name, and make sure an object is saved inside the `globalThis.settings` object with that name.
			let settingsScope = globalThis.settings;
			for (const scope of scopes) {
				settingsScope[scope] ??= {};
				settingsScope = settingsScope[scope];
			}

			/**
			 * At this point, we are left with the desired settings object structure. In the case of the above example, the object looks like:
			 *
			 * 	globalThis.settings: {
			 * 		network: {
			 * 			connection: {
			 * 				...
			 *			}.
						...
			 * 		}.
			 * 		...
			 * 	}.
			 *
			 * All the "..." just represent that there could maybe already be information in these objects that we don't know about / don't care about.
			 *
			 * The `settingsScope` now points to `globalThis.settings.network.connection`, so now we are ready to actually add the control value to the object.
			 */


			/**
			 * Here comes the important part of the function.
			 */

			// Update to the new value in `globalThis.settings`.
			settingsScope[e.target.name] = e.target.value;

			// If an `<output>` field is associated with this control in the UI, update that field as well.
			if (e.target.nextElementSibling?.tagName === "OUTPUT") {
				e.target.nextElementSibling.value = e.target.value + e.target.dataset.unit;
			}

			// When settings have changed, we should reset the simulation and prepare for a new run.
			resetSimulation();
		});
	}
}

/**
 * When called, resets the entire simulation as if the app had just been opened.
 * This is mostly useful when the user has changed some settings and the simulation should run again from the start.
 */
function resetSimulation(){
	globalThis.simulation?.terminate();
	globalThis.events = [];
	globalThis.simulationTime.reset();
	globalThis.eventDispatcher.reset();

	// Remove all the DOM elements that represent the nodes, connections, and so on.
	document.querySelector("#visualizer .network").innerHTML = "";
	document.querySelector("#visualizer .blockchain").innerHTML = "";

	// Reset the play button
	const playButton = document.getElementById("play");
	playButton.innerHTML = "Play";
	playButton.classList.add("paused");

	// Open a new underlying simulation
	globalThis.simulation = new Simulation();
}

/**
 * This eventlistener handles when the user clicks on the play button.
 * It can both pause and resume the simulation.
 */
const playButton = document.getElementById("play");
playButton.addEventListener("click", event => {
	const button = event.target;

	if(button.classList.contains("paused")){
		// Button was paused, resume playback
		globalThis.simulationTime.resume();
		button.innerHTML = "Pause";
		button.classList.remove("paused");
	}else{
		// Button was playing, pause playback
		globalThis.simulationTime.pause();
		button.innerHTML = "Play";
		button.classList.add("paused");
	}
});

/**
 * When the visualization runs, it needs to know the dimensions of the box that the visualization runs in.
 * Whenever the browser window changes size in any way, this function runs and saves the new network box ratio to `globalThis.settings`.
 *
 * In this visualization, it is assumed that the height of the network box is always 1,
 * so all that the simulation needs to know is the ratio between the height of the box and the width.
 *
 */
async function updateNetworkBoxSize(){
	const visualization = document.querySelector("#visualizer .network");
	globalThis.settings.networkBoxRatio = visualization.clientWidth / visualization.clientHeight;
}
window.addEventListener("resize", updateNetworkBoxSize);
updateNetworkBoxSize();

/**
 * Set up the necessary classes to run the simulation. You can read more about each class in their respective files.
 */
globalThis.eventDispatcher = new EventDispatcher();
globalThis.simulationTime = new SimulationTime();
globalThis.eventDrawer = new EventDrawer();

/**
 * Running `generateInputs` here is what gets the whole app going. It doesn't just generate the controls,
 * but as a side product also generates the initial `globalThis.settings`, which in turn starts the simulation.
 */
generateInputs(allInputs, document.getElementById("controls"));
