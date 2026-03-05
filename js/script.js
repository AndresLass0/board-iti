let i = 0;

function actualizar(){
    i++;
    document.getElementById("counter").textContent = i;
}

setInterval(actualizar, 1000);