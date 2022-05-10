export default {
	aspectRatio: {
		type: "number",
		label: "Aspect ratio",
		step: "0.001",
		setTo: () => {
			const maxSpace = document.querySelector("#visualizer .network-container");
			return maxSpace.clientWidth / maxSpace.clientHeight;
		},
		description: "The width-to-height ration of the box that the simulation is being run in. Where 10 is making the length 10 times bigger than the height and 0.1 is making the hight 10 times bigger than the length of the box.",
	},
	seed: {
		type: "number",
		min: 1,
		max: 10000,
		step: 1,
		setTo: () => Math.floor(Math.random() * 10000),
		description: `If you run the simulation multiple times with the same seed, then all runs will be identical. If you use different seeds, then the position of the nodes, as well as which nodes get to publish which blocks, and so on, are all different between runs.`,
	},
	network: {
		type: "box",
		description: "Settings related to the simulated network",
		children: {
			algorithms: {
				type: "select",
				label: "Verification",
				options: [
					"Balanced",
					"Bloated",
					"Sparse",
					"Naive",
				],
				default: "Balanced",
				description: "Which blockchain protocol should be used in the simulation",
			},
			nodes: {
				type: "range",
				min: 5,
				max: 30,
				default: 10,
				description: "How many nodes the simulation maximum can consist of",
				label: "Max nodes",
			},
			delay: {
				type: "range",
				min: 500,
				max: 4000,
				default: 1000,
				unit: "ms",
				description: "How slow should the network be. In other words; how many milliseconds should it take for a packet to move across the entire network visualization vertically.",
			},
		},
	},
	nodes: {
		type: "box",
		description: "Settings related to the simulated nodes",
		children: {
			delay: {
				type: "range",
				min: 500,
				max: 4000,
				default: 1000,
				unit: "ms",
				description: "How slowly new nodes are added to the network. In other words; how many milliseconds should it take for a new node to be added to the entire network visualization.",
			},
			startNodes: {
				type: "range",
				min: 1,
				max: 30,
				default: 5,
				description: "How many nodes are added to the network in the start of the simulation. In other words; how many nodes the simulation start with having visualizatied.",
				label: "Start nodes",
			},
			nodesToAdd: {
				type: "range",
				min: 1,
				max: 10,
				default: 5,
				description: "How many nodes are added to the network everytime the network adds new nodes. In other words; how many nodes the simulation adds",
				label: "Nodes added",
			},
		},
	},
	block: {
		type: "box",
		description: "Settings related to the simuluated blocks",
		children: {
			delay: {
				type: "range",
				min: 500,
				max: 5000,
				default: 3000,
				unit: "ms",
				description: "How often a new block should be discovered on the network (in milliseconds)",
			},
		},
	},
	nerdInfo: {
		type: "checkbox",
		label: "Show info for nerds",
		default: false,
		description: "Show debug information regarding the simulation process. Please note that it uses significantly more resources",
	},
};
