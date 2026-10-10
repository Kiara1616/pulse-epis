"""Provision researched UPT periods through the local, authenticated admin API."""
import http.cookiejar
import json
from pathlib import Path
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:3100/api/v1"
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))


def request(path, data=None):
    req = urllib.request.Request(BASE + path, data=json.dumps(data).encode() if data is not None else None,
                                 headers={"Content-Type": "application/json"})
    with opener.open(req, timeout=30) as response:
        return json.load(response)


if __name__ == "__main__":
    if request("/auth/config")["provider"] != "local":
        raise SystemExit("Este script solo prepara el entorno local de prueba.")
    request("/auth/local/login", {"email": "admin@local.pulse-epis.test", "password": "pulse-local-demo"})
    existing = {p["code"]: p for p in request("/padron/periods")}
    for period in json.loads((Path(__file__).resolve().parents[1] / "backend/data/academic-periods-upt.json").read_text()):
        payload = {key: period[key] for key in ("code", "starts_on", "ends_on")}
        if period["code"] in existing:
            if any(existing[period["code"]][key] != payload[key] for key in payload):
                raise SystemExit(f"Revisar fechas existentes de {period['code']}; no se sobrescribieron.")
            print(period["code"], "ya registrado")
        else:
            request("/padron/periods", payload)
            print(period["code"], "registrado")
