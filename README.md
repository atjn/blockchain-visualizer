# Blockchain Visualizer
This project sets out to help people understand discovery- and publishing algorithms in peer-to-peer networks, by creating an interactive visualization of how nodes in these networks communicate with each other. You can read more about how the interface works by going to [the website](https://blockchain-visualizer.netlify.app/).

This project is very well documented, so if you want to learn about somewhat complex website setups, this might be a good codebase to read through.

## State of the project
The project mainly exists as part of a university exam, but we might continue development of it, especially if anyone wants to help us with it. The website is far from finished, and especially needs to be better at explaining what is going on to the user. Any contributions are welcome - check out [`CONTRIBUTING`](CONTRIBUTING.md) for more details.

## Technical overview
The code runs on two separate threads. One for the user interface (UI) and one for simulating the blockchain. This is done to allow the simulation to run as fast as possible without making the UI feel laggy. As the simulation runs, it sends a queue of commands to the UI thread, which tells it exactly how to draw the simulation. Note that all the information necessary to display the visualization has been calculated by the simulation, so the UI just needs to apply the commands directly, which is what allows it to run relatively smooth and not block user commands.

### User interface
Most of the UI code is defined in [`ui.js`](source/scripts/ui.js). The [`controls.js`](source/scripts/controls.js) file determines which controls are available to the user, and the first thing the UI does, is generate these controls in the HTML DOM. It also generates a `Timeline` class that represents the user controls for pausing/playing/skipping in the simulation.

All the code that is directly related to the simulation is defined in [`simulationHandlers.js`](source/scripts/simulationHandlers.js). Note that this is not the actual simulation which runs on a different thread, but instead the code that the UI uses to control the simulation, and to process the commands that is sent from the simulation.

When the UI wants to start a simulation, it creates a new `Simulation` class, which spawns a new thread where the actual simulation starts running. The simulation receives the current settings/controls that have been set by the user, and then starts generating events. If the user ever changes the settings, then the entire `Simulation` class is deleted (which also terminates the underlying thread), and then a new `Simulation` is initialized, which then uses the new settings.

Events are handled by the `EventDispatcher` and the `SimulationTime` classes. `SimulationTime` defines how far into the simulation the user has gone. This is much like playing a video, where you can play/pause and skip around in the timeline for the simulation. The `EventDispatcher` is constantly running, and when it sees that the `SimulationTime` has moved beyond the timestamp of an event, it tells the `EventDrawer` to draw the event in the visualization window.

If the user skips forward, then the `EventDispatcher` wil simply have a very long list of events that it needs to draw instantly. If the user skips backwards, then the entire visualization is deleted, and every event is redrawn up until the timestamp that the user skipped to.

### Simulation
The simulation code is defined in [`simulation.js`](source/scripts/simulation.js) and mainly consists of two things; a dictionary of nodes which have unique adresses and their own non-volatile storage (the `NodeData` class), and an event queue that tracks which nodes are sending what data, and when it should be arriving at a certain node (the `EventQueue` class).
The code that runs on the virtualized nodes are separate from the simulation, and are defined in the [`scripts/algorithms`](source/scripts/algorithms/) folder. The node algorithms use a well-defined API to communicate with the simulation. This allows us to write new algorithms fairly easily, and makes it easy to switch between different algorithms.

Each node algorithm defines a `process()` function, which is run every time a node receives a packet with data from another node. Nodes only run when they receive packets. While running, they have access to their own dedicated storage, where they can save their own version of the blockchain, addresses to other nodes that they communicate with, and any other data that they might want to save. When they're done processing the packet, they can also define a list of new packets that should be delivered to other nodes.

When a node defines packets that should be sent, the simulation calculates when the packet should arrive, based on the distance between the sending and receiving node. The packet is then saved as a `NodeEvent` in the `EventQueue`, which holds a list of all events that are yet to be processed, sorted by when they are supposed to happen. The simulation is constantly working through these events, and eventually gets to the new packet deliveries that the node defined. It then spins up the receiving nodes, lets them process the packet, and then accepts a new list of packets to put into the `EventQueue`.

It is important to note that if an event is set to execute 10 seconds later, the simulation doesn't actually wait 10 seconds to run it. The simulation runs it immediately, but then adds 10 seconds to the timestamps of all the next packet deliveries. This allows the simulation to run much faster than realtime, which in turn allows the user to easily skip forward in the simulation on the UI thread.

The `EventQueue` can also hold `FunctionEvent`s, which define when certain functions from the simulation should run. An example is the `newBlock` function, which is responsible for periodically sending a `NewBlockSignal` packet to a random node, telling it that it has found a new block that it should start broadcasting to the rest of the network.

## Building the app
The code in the [`source`](source/) folder can be build to a final app that will show up in the [`public`](public/) folder. The built code is mostly the same, but has been minified to save resources when it is sent to the user. The serviceworker will also be activated, and tailor-made for that exact version of the app.

You can build the app by first making sure that you have [Node](https://nodejs.org/en/) with [npm](https://www.npmjs.com/package/npm) installed, then navigating to the root of this project in your terminal, and running:

```
npm run build
```

## Testing
This codebase has many different ways to test itself. All of the tests can be run by first making sure that you have [Node](https://nodejs.org/en/) with [npm](https://www.npmjs.com/package/npm) installed, then navigating to the root of this project in your terminal, and running:

```
npm run test
```

You can only merge code into the `main` branch if it passes all tests.

### Linting
The first test that is run, is static linting. This tests that the code you have written looks nice and is asy for other developers to read. Sometimes it also catches serious errors in the code. It can be run with:

```
npm run lint
```

This runs three separate linting engines: `npm run lint:js`, `npm run lint:css`, `npm run lint:html`. The JS linter is especially interesting because it asks you to document all the code you write.

The linters will sometimes fix things automatically. If you don't like that, you can run `npm run lint:nofix` instead. The `nofix` options is also what is used for `npm run test` so if you get any errors when running the test, then try to to run `npm run lint`, and all your problems might just go away.

### Unit tests
The next test is unit tests, which are coded tests that reside in the [`test`](test/) folder. These tests are designed to check that individual functions in the [`scripts`](source/scripts/) folder actually do what they say they do. For example that the `BlockChain.add()` function actually adds the given block to the blockchain.

This is very useful for regression testing, which is a fancy word for saying that when someone implements changes to the code, they can quickly run these unit tests to make sure that none of the existing functions have changed behaviour in a way that means they don't work like they should.

For theses tests to be most useful, they should cover most functions in the codebase, and be well written to detect even slight changes in the way the functions work. That is unfortunately not the case right no.

The unit tests can be run on their own with:

```
npm run test:unit
```

You can also run a specific testing file with `node test/<NAME-OF-TEST-FILE>.js`.

### End-to-end tests
End-to-end tests are not yet implemented in this code base, but the idea is to test the program from the user's perspective. This will be done by actually opening the website in a browser and testing that each button does what it it supposed to do when you click on it.

### CodeQL tests
When you create a pull request for your code, it will also be scanned by a few CodeQL tools. These tools analyze your code to see if they can find any vulnerabilities in it, or any code that is completely unusable. They work much in the same way that the linting tools do, but are more focused on what the code does, and less on how it is written.
