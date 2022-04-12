export default {
	aspectRatio: {
		type: "number",
		label: "Aspect ratio",
		step: "0.001",
		setTo: () => {
			const maxSpace = document.querySelector("#visualizer .network-container");
			return maxSpace.clientWidth / maxSpace.clientHeight;
		},
		description: "Show debug information regarding the simulation process",
	},
	seed: {
		type: "number",
		min: 1,
		max: 10000,
		step: 1,
		setTo: () => Math.floor(Math.random() * 10000),
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
					"Test",
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
			delay: {
				type: "range",
				min: 500,
				max: 5000,
				default: 1000,
				unit: "ms",
				description: "How slow should the network be. In other words; how many milliseconds should it take for a packet to move across the entire network visualization vertically.",
			},
		},
	},
	nodes: {
		type: "box",
		description: "Settings related to the simulated network",
		children: {
			delay: {
				type: "range",
				min: 500,
				max: 5000,
				default: 1000,
				unit: "ms",
				description: "How slow new nodes are added to the network. In other words; how many milliseconds should it take for a new node to be added to the entire network visualization.",
			},
			startNodes: {
				type: "range",
				min: 1,
				max: 100,
				default: 5,
				description: "How many nodes are added to the network in the start of the simulation. In other words; how many nodes the simulation start with having visualizatied.",
			},
			nodesToAdd: {
				type: "range",
				min: 1,
				max: 10,
				default: 5,
				description: "How many nodes are added to the network everytime the network adds new nodes. In other words; how many nodes the simulation adds",
			},
		},
	},
	block: {
		type: "box",
		description: "Settings related to the simulated network",
		children: {
			delay: {
				type: "range",
				min: 500,
				max: 5000,
				default: 1000,
				unit: "ms",
				description: "How slow new the block should send packets to the network. In other words; how many milliseconds should it take for a new packet to be send to the other blocks in the network visualization.",
			},
		},
	},
	nerdInfo: {
		type: "checkbox",
		label: "Show info for nerds",
		default: false,
		description: "Show debug information regarding the simulation process",
	},
};
