import requests
import hashlib
import time
import random
import json
import os
from datetime import datetime

# CONFIGURACIÓN
KEY = "2bf880b03e44e4a92bf6a3e295becacc0da296b4"
SECRET = "6d83dc55236ca0329376e61c55e83436abd1672d"
CONTEST_ID = 676037
HORA_INICIO_STR = "2026-03-09 22:18:00" 
PATH_EVENTOS = "./recursos/eventos.json"
PATH_BOARD = "./recursos/board.json"

def get_codeforces_data():
    method = "contest.status"
    params = {
        "contestId": CONTEST_ID,
        "from": 1,
        "count": 100,
        "apiKey": KEY,
        "time": int(time.time())
    }
    sorted_params = "&".join(f"{k}={params[k]}" for k in sorted(params))
    rand = str(random.randint(100000, 999999))
    hash_string = f"{rand}/{method}?{sorted_params}#{SECRET}"
    api_sig = rand + hashlib.sha512(hash_string.encode()).hexdigest()
    params["apiSig"] = api_sig
    
    url = f"https://codeforces.com/api/{method}"
    try:
        return requests.get(url, params=params).json()
    except:
        return None

def main():
    # Crear carpeta recursos si no existe
    if not os.path.exists("./recursos"):
        os.makedirs("./recursos")

    while True:
        # 1. Calcular tiempo del concurso
        inicio_dt = datetime.strptime(HORA_INICIO_STR, "%Y-%m-%d %H:%M:%S")
        ahora_dt = datetime.now()
        
        tiempo_concurso = int((ahora_dt - inicio_dt).total_seconds())

        if tiempo_concurso < 0:
            print(f"Faltan {abs(tiempo_concurso)} segundos para iniciar...")
            with open(PATH_BOARD, "w") as f:
                json.dump({"status": "COUNTDOWN", "seconds_left": abs(tiempo_concurso)}, f)
            time.sleep(1)
            continue

        # 2. Obtener Submissions
        data = get_codeforces_data()
        if not data or data.get("status") != "OK":
            time.sleep(2)
            continue

        # 3. Procesar Eventos
        try:
            with open(PATH_EVENTOS, "r") as f: eventos = json.load(f)
        except: eventos = []
        
        ids_existentes = {e["id"] for e in eventos}
        nuevos_eventos = False
        
        for sub in data["result"]:
            if sub["id"] not in ids_existentes:
                evento = {
                    "id": sub["id"],
                    "time": sub["relativeTimeSeconds"],
                    "team": sub["author"]["members"][0]["handle"],
                    "problem": sub["problem"]["index"],
                    "result": sub.get("verdict", "TESTING")
                }
                eventos.append(evento)
                nuevos_eventos = True
        
        if nuevos_eventos:
            eventos.sort(key=lambda x: x["time"])
            with open(PATH_EVENTOS, "w") as f: json.dump(eventos, f, indent=4)

        # 4. Construir Board
        board = {}
        for e in eventos:
            if e["time"] > tiempo_concurso: continue
            
            t, team, prob, res = e["time"], e["team"], e["problem"], e["result"]
            if team not in board:
                board[team] = {"team": team, "solved": 0, "penalty": 0, "problems": {}}
            
            if prob not in board[team]["problems"]:
                board[team]["problems"][prob] = {"wa": 0, "solved": False, "time": None}
            
            p = board[team]["problems"][prob]
            if not p["solved"]:
                if res in ["OK", "ACCEPTED"]:
                    p["solved"] = True
                    p["time"] = t
                    board[team]["solved"] += 1
                    # AQUI SE QUITO LA PENALIZACION POR WA. Solo suma el tiempo de envio.
                    board[team]["penalty"] += t 
                elif res not in ["TESTING", "PENDING"]:
                    p["wa"] += 1

        board_list = sorted(board.values(), key=lambda x: (-x["solved"], x["penalty"]))
        
        with open(PATH_BOARD, "w") as f:
            json.dump({"status": "LIVE", "elapsed": tiempo_concurso, "data": board_list}, f, indent=4)

        print(f"Board actualizado. Tiempo: {tiempo_concurso}s")
        time.sleep(1)

if __name__ == "__main__":
    main()