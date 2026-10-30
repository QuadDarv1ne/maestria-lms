import flet as ft
import inspect

print("Icons.ARROW_FORWARD:", ft.Icons.ARROW_FORWARD)
print("icons module:", type(ft.icons))

ts_sig = inspect.signature(ft.TextSelection)
print("TextSelection sig:", ts_sig)

s = ft.SnackBar(content=ft.Text("x"), bgcolor=ft.Colors.RED_400)
print("snack.open:", s.open)

print("Switch params:", [p for p in inspect.signature(ft.Switch).parameters if p in ("label", "on_change", "value", "thumb_color")])

print("Page.window:", hasattr(ft.Page, "window"))
print("Window class:", hasattr(ft, "Window"))
if hasattr(ft, "Window"):
    print("Window params:", list(inspect.signature(ft.Window).parameters.keys())[:20])

gv_params = list(inspect.signature(ft.GridView).parameters.keys())
print("\nGridView params:", [p for p in gv_params if p in ("controls", "runs_count", "max_extent", "spacing", "run_spacing", "child_aspect_ratio", "padding", "expand", "horizontal", "build_controls_on_demand")])

tf_params = list(inspect.signature(ft.TextField).parameters.keys())
print("\nTextField relevant:", [p for p in tf_params if p in ("size", "text_size", "border_color", "border_radius", "content_padding", "text_align", "expand", "value", "selection", "on_change", "bgcolor", "read_only", "multiline", "height")])

lv_params = list(inspect.signature(ft.ListView).parameters.keys())
print("\nListView relevant:", [p for p in lv_params if p in ("expand", "spacing", "divider_thickness", "padding", "auto_scroll", "controls")])

c_params = list(inspect.signature(ft.Container).parameters.keys())
print("\nContainer relevant:", [p for p in c_params if p in ("content", "padding", "expand", "bgcolor", "border_radius", "border")])

ad_params = list(inspect.signature(ft.AlertDialog).parameters.keys())
print("\nAlertDialog relevant:", [p for p in ad_params if p in ("title", "content", "actions", "open", "modal", "bgcolor")])

b_params = list(inspect.signature(ft.Button).parameters.keys())
print("\nButton relevant:", [p for p in b_params if p in ("content", "on_click", "size", "icon", "style", "color", "bgcolor")])

print("\nTextButton:", hasattr(ft, "TextButton"))
if hasattr(ft, "TextButton"):
    tb_params = list(inspect.signature(ft.TextButton).parameters.keys())
    print("TextButton relevant:", [p for p in tb_params if p in ("content", "on_click", "size")])

print("\nFilledButton:", hasattr(ft, "FilledButton"))
print("IconButton relevant:", [p for p in list(inspect.signature(ft.IconButton).parameters.keys()) if p in ("icon", "content", "label", "on_click", "data", "bgcolor", "color", "border_radius", "tooltip", "width", "height", "style")])
