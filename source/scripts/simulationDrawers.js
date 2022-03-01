
/**
 * @file
 */

export class EventDrawer{
	#nodes = new Map();
	#connection = new Map();
	#packets = new Map();
	#networkBox = document.querySelector("#visualizer .network");

	async draw(event){
		switch(event.type){
			case "node": {
				if(event.active){
					const node = document.createElement("div");
					node.classList.add("node");
					node.style.top = `${event.position.y * 100}%`;
					node.style.left = `${(event.position.x / globalThis.settings.networkBoxRatio) * 100}%`;

					this.#networkBox.appendChild(node);
					this.#nodes.set(event.address, node);
				}else{
					const node = this.#nodes.get(event.address);
					node.classList.add("inactive");
				}
				break;
			}
			case "connection": {
				if(event.active){
					const connection = document.createElement("div");
					connection.classList.add("connection");
					connection.style.top = `${event.position.y * 100}%`;
					connection.style.left = `${event.position.x * 100}%`;
					connection.style.setProperty("--length", `${event.length * 100}%`);
					connection.style.transform = `rotate(${event.slope}deg)`;

					this.#networkBox.appendChild(connection);
					this.#nodes.set(event.id, connection);
				}else{
					const connection = this.#nodes.get(event.address);
					connection.classList.add("inactive");
				}
				break;
			}
		}
	}
}
