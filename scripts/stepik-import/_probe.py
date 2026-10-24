"""Одноразовая разведка структуры Stepik API (stdlib, без зависимостей)."""
import json
import urllib.parse
import urllib.request

BASE = "https://stepik.org/api"
UA = "maestria-stepik-import/1.0"


def req(path, params=None):
    url = f"{BASE}/{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params)
    r = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": UA})
    with urllib.request.urlopen(r, timeout=30) as resp:
        return json.load(resp)


def keys(obj):
    return sorted(obj.keys()) if isinstance(obj, dict) else type(obj).__name__


course = req("courses/207061")["courses"][0]
print("COURSE keys:", keys(course))
print("title:", course.get("title"))
print("sections:", course.get("sections"))
print("chapters:", bool(course.get("chapters")), "collaborators:", course.get("collaborators"))

sec = req("sections/" + str(course["sections"][0]))["sections"][0]
print("\nSECTION keys:", keys(sec))
print("units:", sec.get("units"))

unit = req("units/" + str(sec["units"][0]))["units"][0]
print("\nUNIT keys:", keys(unit))

lesson = req("lessons/" + str(unit["lesson"]), {"embed": "steps"})["lessons"][0]
print("\nLESSON keys:", keys(lesson))
print("step_type:", lesson.get("step_type"), "steps:", lesson.get("steps"))

step = req("steps/" + str(lesson["steps"][0]))["steps"][0]
print("\nSTEP keys:", keys(step))
print("BLOCK keys:", keys(step["block"]))
print("block.name:", step["block"].get("name"), "position:", step.get("position"))
print("actions:", keys(step.get("actions", {})))
print("options:", keys(step.get("options", {})))
print("meta:", keys(step.get("meta", {})))
print("video:", json.dumps(step["block"].get("video"), ensure_ascii=False)[:400])
print("text head:", (step["block"].get("text") or "")[:400])
print("solution head:", (step["block"].get("solution") or "")[:200])
