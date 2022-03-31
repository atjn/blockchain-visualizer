var a;

function showAndHide(){
	if (a == 1){
		document.getElementById("sidebar").style.display = "inline";
		return a = 0;
	}
	else {
		document.getElementById("sidebar").style.display = "none";
		return a = 1;
	}

}
