import flet as ft
import inspect

print("RoundedRectangleBorder:", inspect.getsource(ft.RoundedRectangleBorder)[:400])
print("\nPadding:", [f for f in __import__("re").findall(r"^\s{4}(\w+):", inspect.getsource(ft.Padding), __import__("re").M)])
print("\nSize:", [f for f in __import__("re").findall(r"^\s{4}(\w+):", inspect.getsource(ft.Size), __import__("re").M)])

for icon in ["DELETE_OUTLINE", "DELETE", "DOWNLOAD", "CODE", "DARK_MODE", "LIGHT_MODE",
             "FUNCTIONS", "SCIENCE", "CALCULATOR", "BACKSPACE", "ARROW_BACK",
             "HISTORY", "CLEAR_ALL", "FILE_DOWNLOAD", "ACCOUNT_TREE", "STRAIGHTEN"]:
    print(f"Icons.{icon}:", hasattr(ft.Icons, icon))

print("\nText params:", [p for p in inspect.signature(ft.Text).parameters if p in ("value", "size", "color", "weight", "expand", "overflow", "max_lines", "text_align", "no_wrap", "selectable")])
print("TextOverflow:", hasattr(ft, "TextOverflow"))
if hasattr(ft, "TextOverflow"):
    print("values:", [v for v in dir(ft.TextOverflow) if not v.startswith("_")])

print("\nColumn params:", [p for p in inspect.signature(ft.Column).parameters if p in ("controls", "spacing", "expand", "scroll", "tight", "alignment", "horizontal_alignment")])
print("Row params:", [p for p in inspect.signature(ft.Row).parameters if p in ("controls", "spacing", "expand", "tight", "alignment", "vertical_alignment", "wrap", "run_spacing")])

print("\nIconButton icon_size:", "icon_size" in inspect.signature(ft.IconButton).parameters)
print("IconButton style:", "style" in inspect.signature(ft.IconButton).parameters)
print("IconButton padding:", "padding" in inspect.signature(ft.IconButton).parameters)
print("IconButton alignment:", "alignment" in inspect.signature(ft.IconButton).parameters)
