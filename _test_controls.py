import flet as ft

# Simulate control creation from calculator_flet.py
display = ft.TextField(
    value="",
    text_size=24,
    text_align=ft.TextAlign.RIGHT,
    border_radius=8,
    expand=True,
    content_padding=12,
    border_color=ft.Colors.GREEN_600,
)
display.selection = ft.TextSelection(base_offset=3, extent_offset=3)
display.border_color = ft.Colors.RED_400

status_text = ft.Text("Готов к работе", size=12, color=ft.Colors.GREY_400, expand=True)

history_list = ft.ListView(expand=True, spacing=6, divider_thickness=0, padding=8)
history_list.controls.append(
    ft.Row(
        [
            ft.Text("2+2", size=13, weight=ft.FontWeight.BOLD, expand=True),
            ft.IconButton(
                icon=ft.Icons.ARROW_FORWARD,
                tooltip="Вставить в поле",
                on_click=lambda e: None,
            ),
        ],
        alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
    )
)

snack = ft.SnackBar(ft.Text("msg", color=ft.Colors.WHITE), bgcolor=ft.Colors.RED_400)

dlg = ft.AlertDialog(
    title=ft.Text("Разбор выражения (AST)", size=16, weight=ft.FontWeight.BOLD),
    content=ft.TextField(
        value="info",
        multiline=True,
        expand=True,
        read_only=True,
        height=300,
        border_radius=8,
        bgcolor=ft.Colors.SURFACE_CONTAINER_HIGHEST,
    ),
    actions=[ft.TextButton("Закрыть", on_click=lambda e: None)],
)

grid = ft.GridView(expand=True, runs_count=7, spacing=6, run_spacing=8, padding=8)
grid.controls.append(
    ft.Button(
        content="7",
        width=56,
        height=56,
        bgcolor=ft.Colors.SURFACE,
        color=ft.Colors.ON_SURFACE,
        tooltip="7",
        data="7",
        on_click=lambda e: None,
    )
)
grid.controls.append(
    ft.Button(
        content="sin",
        width=56,
        height=56,
        bgcolor="#FFA500",
        color=ft.Colors.BLACK,
        tooltip="sin",
        data="sin",
        on_click=lambda e: None,
    )
)

top_row = ft.Row(
    [
        ft.Switch(label="Тема: светлая", on_change=lambda e: None, value=False),
        ft.Container(expand=True),
        ft.Switch(label="Научный режим", on_change=lambda e: None, value=False, thumb_color="#FFA500"),
        ft.Switch(label="Градусы", on_change=lambda e: None, value=True),
    ],
    alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
)

history_panel = ft.Column(
    [
        ft.Text("История вычислений", size=14, weight=ft.FontWeight.BOLD),
        history_list,
    ],
    expand=True,
)

ctrl_row = ft.Row(
    [
        ft.FilledButton("Очистить историю", on_click=lambda e: None),
        ft.FilledButton("Экспорт истории", on_click=lambda e: None, bgcolor=ft.Colors.BLUE_600),
        ft.FilledButton("Разбор выражения", on_click=lambda e: None, bgcolor=ft.Colors.PURPLE_600),
    ],
    alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
)

root = ft.Column(
    [
        top_row,
        ft.Container(ft.Row([display], expand=True), padding=8),
        status_text,
        grid,
        history_panel,
        ctrl_row,
    ],
    expand=True,
    spacing=4,
)

print("All controls created OK")
print("root type:", type(root).__name__)
print("grid controls:", len(grid.controls))
print("Window fields:", [f for f in ("width", "height", "resizable") if hasattr(ft.Window, f)])
