/**
 * @file
 * This is the main script file.
 */

const data = {
	algorithm: "bitcoin",
	attackers: 50,
	time: 1
}

const algorithmsInput = document.getElementById("algorithms");
const attackerInput = document.getElementById("attackers");
const timeInput = document.getElementById("time");

algorithmsInput.addEventListener("change", e => {
	data.algorithm = e.target.value;
	console.log(data);
});

attackerInput.addEventListener("input", e => {
	data.attackers = e.target.value;
	console.log(data);
});

timeInput.addEventListener("input", e => {
	data.time = e.target.value;
	console.log(data);
});


