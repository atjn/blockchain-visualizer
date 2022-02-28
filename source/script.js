/**
 * @file
 * This is the main script file.
 */

globalThis.data = {};

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
		},
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

generateInputs(allInputs, document.getElementById("controls"));

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
				range.dataset.unit = data.unit;

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

			let objectScope = globalThis.data;
			for (const scope of scopes) {
				objectScope[scope] ??= {};
				objectScope = objectScope[scope];
			}

			objectScope[e.target.name] = e.target.value;

			if (e.target.nextElementSibling?.tagName === "OUTPUT") {
				e.target.nextElementSibling.value = e.target.value + e.target.dataset.unit;
			}
		});
	}
}
