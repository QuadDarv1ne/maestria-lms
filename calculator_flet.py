import flet as ft
import json
import os
import math
import ast
import operator
import re

SETTINGS_FILE = "settings_flet.json"
HISTORY_FILE = "history_flet.json"

# --- Безопасный парсер ---
ALLOWED_OPERATORS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Pow: operator.pow,
    ast.USub: operator.neg,
    ast.UAdd: operator.pos,
}

ALLOWED_FUNCTIONS = {
    "sin": math.sin,
    "cos": math.cos,
    "tan": math.tan,
    "sqrt": math.sqrt,
    "log10": math.log10,
    "ln": math.log,
    "exp": math.exp,
    "abs": abs,
}

def safe_eval_expr(expr: str, use_degrees: bool):
    try:
        node = ast.parse(expr, mode="eval").body
        return _eval_node(node, use_degrees)
    except Exception as e:
        raise ValueError(f"Ошибка разбора: {e}")

def _eval_node(node, use_degrees: bool):
    if isinstance(node, ast.Constant):
        if isinstance(node.value, (int, float)):
            return node.value
        raise ValueError("Только числа разрешены")
    if isinstance(node, ast.BinOp):
        left = _eval_node(node.left, use_degrees)
        right = _eval_node(node.right, use_degrees)
        op_type = type(node.op)
        if op_type not in ALLOWED_OPERATORS:
            raise ValueError("Операция запрещена")
        return ALLOWED_OPERATORS[op_type](left, right)
    if isinstance(node, ast.UnaryOp):
        operand = _eval_node(node.operand, use_degrees)
        op_type = type(node.op)
        if op_type not in ALLOWED_OPERATORS:
            raise ValueError("Унарная операция запрещена")
        return ALLOWED_OPERATORS[op_type](operand)
    if isinstance(node, ast.Call):
        func_name = node.func.id if isinstance(node.func, ast.Name) else None
        if func_name not in ALLOWED_FUNCTIONS:
            raise ValueError(f"Функция '{func_name}' не разрешена")
        if len(node.args) != 1:
            raise ValueError("Разрешены только функции с одним аргументом")
        arg = _eval_node(node.args[0], use_degrees)

        if use_degrees and func_name in ("sin", "cos", "tan"):
            arg = math.radians(arg)

        return ALLOWED_FUNCTIONS[func_name](arg)
    raise ValueError("Недопустимая конструкция")

# --- Утилиты ---
def load_settings():
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {"theme": "dark", "scientific_mode": False, "use_degrees": True}

def save_settings(theme, scientific_mode, use_degrees):
    try:
        with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
            json.dump({"theme": theme, "scientific_mode": scientific_mode, "use_degrees": use_degrees}, f, ensure_ascii=False, indent=2)
    except Exception:
        pass

def load_history():
    if os.path.exists(HISTORY_FILE):
        try:
            with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []
    return []

def save_history(history):
    try:
        with open(HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump(history, f, ensure_ascii=False, indent=2)
    except Exception:
        pass

def get_parse_info(expr: str) -> str:
    try:
        node = ast.parse(expr, mode="eval").body
        return _node_to_text(node, level=0)
    except Exception as e:
        return f"Не удалось разобрать выражение: {e}"

def _node_to_text(node, level: int) -> str:
    indent = "  " * level
    if isinstance(node, ast.Constant):
        return f"{indent}🔢 Число: {node.value}"
    if isinstance(node, ast.BinOp):
        op_map = {
            ast.Add: "+", ast.Sub: "-", ast.Mult: "*", ast.Div: "/", ast.Pow: "**"
        }
        op = op_map.get(type(node.op), "?")
        left = _node_to_text(node.left, level + 1)
        right = _node_to_text(node.right, level + 1)
        return f"{indent}➕ Операция: {op}\n{left}\n{right}"
    if isinstance(node, ast.UnaryOp):
        op_map = {ast.USub: "-", ast.UAdd: "+"}
        op = op_map.get(type(node.op), "?")
        operand = _node_to_text(node.operand, level + 1)
        return f"{indent}➖ Унарная: {op}\n{operand}"
    if isinstance(node, ast.Call):
        func = node.func.id if isinstance(node.func, ast.Name) else "?"
        arg = _node_to_text(node.args[0], level + 1)
        return f"{indent}🧮 Функция: {func}\n{arg}"
    return f"{indent}❓ Неизвестный узел: {type(node)}"


def main(page: ft.Page):
    page.title = "Калькулятор (Flet v1.0)"
    page.window.width = 460
    page.window.height = 800
    page.window.resizable = False

    settings = load_settings()
    theme_mode = settings.get("theme", "dark")
    scientific_mode = settings.get("scientific_mode", False)
    use_degrees = settings.get("use_degrees", True)
    page.theme_mode = ft.ThemeMode.DARK if theme_mode == "dark" else ft.ThemeMode.LIGHT

    expression = ""
    history = load_history()
    max_history = 15

    # --- Виджеты ---
    def make_display_border(color):
        return ft.OutlineInputBorder(side=ft.BorderSide(color=color), border_radius=8)

    display = ft.TextField(
        value="",
        text_size=24,
        text_align=ft.TextAlign.RIGHT,
        border=make_display_border(ft.Colors.GREEN_600),
        expand=True,
        content_padding=12,
        on_change=lambda e: on_display_changed(e),
    )

    status_text = ft.Text("Готов к работе", size=12, color=ft.Colors.GREY_400, expand=True)

    history_list = ft.ListView(
        expand=True,
        spacing=6,
        divider_thickness=0,
        padding=8,
    )

    def rebuild_history_ui():
        history_list.controls.clear()
        for item in reversed(history):
            parts = item.split(" = ", 1)
            expr = parts[0] if len(parts) > 0 else ""
            row = ft.Row(
                [
                    ft.Text(expr, size=13, weight=ft.FontWeight.BOLD, expand=True),
                    ft.IconButton(
                        icon=ft.Icons.ARROW_FORWARD,
                        tooltip="Вставить в поле",
                        on_click=lambda _, e_expr=expr: insert_expression(e_expr)
                    ),
                ],
                alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
            )
            history_list.controls.append(row)
        page.update()

    def insert_expression(expr: str):
        nonlocal expression
        expression = expr
        update_display()
        set_status("Выражение из истории вставлено")

    def update_display():
        display.value = expression
        page.update()

    def add_to_history(expr, res):
        nonlocal history
        entry = f"{expr} = {res}"
        history.append(entry)
        if len(history) > max_history:
            history.pop(0)
        rebuild_history_ui()
        save_history(history)
        page.update()

    def show_error(msg):
        snack = ft.SnackBar(ft.Text(msg, color=ft.Colors.WHITE), bgcolor=ft.Colors.RED_400)
        page.show_dialog(snack)
        page.update()

    def set_status(msg):
        status_text.value = msg
        page.update()

    def on_display_changed(e):
        nonlocal expression
        expression = e.control.value
        validate_and_style()
        set_status("Редактирование вручную")

    def validate_and_style():
        ok = True
        msg = "Готов к работе"

        if expression.count("(") != expression.count(")"):
            ok = False
            msg = "Незакрытые скобки"

        allowed_pattern = r"^[0-9+\-*/().^%πa-z\s]*$"
        if not re.match(allowed_pattern, expression, re.IGNORECASE):
            ok = False
            msg = "Недопустимые символы"

        color = ft.Colors.GREEN_600 if ok else ft.Colors.RED_400
        display.border = make_display_border(color)
        status_text.color = ft.Colors.GREEN_600 if ok else ft.Colors.RED_400
        page.update()
        return ok, msg

    def on_button_click(e):
        char = e.control.data
        process_char(char)

    def process_char(char):
        nonlocal expression, scientific_mode, use_degrees

        if char == "C":
            expression = ""
        elif char == "←":
            expression = expression[:-1]
        elif char == "%":
            if expression:
                try:
                    val = float(expression.replace(",", "."))
                    expression = str(val / 100)
                except ValueError:
                    pass
        elif char == "()":
            pos = len(expression)
            expression += "()"
            display.selection = ft.TextSelection(base_offset=pos + 1, extent_offset=pos + 1)
        elif char == "(":
            pos = len(expression)
            expression += "("
            display.selection = ft.TextSelection(base_offset=pos + 1, extent_offset=pos + 1)
        elif char == ")":
            expression += ")"
        elif char == "x²":
            expression += "**2"
        elif char == "^":
            expression += "**"
        elif char == "√":
            expression += "sqrt("
        elif char in ("sin", "cos", "tan", "ln", "log10", "exp", "abs"):
            expression += f"{char}("
        elif char == "1/x":
            expression += "**(-1)"
        elif char == "π":
            expression += str(math.pi)
        elif char == "=":
            try:
                ok, msg = validate_and_style()
                if not ok:
                    show_error(msg)
                    set_status(msg)
                    return
                result = safe_eval_expr(expression, use_degrees)
                add_to_history(expression, str(result))
                expression = str(result)
                set_status("Результат вычислен")
            except ZeroDivisionError:
                show_error("Деление на ноль")
                set_status("Ошибка: деление на ноль")
            except Exception as e:
                show_error(str(e))
                set_status("Ошибка вычисления")
        else:
            expression += char

        set_status(f"Вставлен: {char}")
        update_display()


    def handle_key(e: ft.KeyboardEvent):
        nonlocal expression
        if e.key == "Enter":
            process_char("=")
        elif e.key == "Escape":
            expression = ""
            update_display()
            set_status("Очистка (Esc)")
        elif e.key == "Backspace":
            expression = expression[:-1]
            update_display()
            set_status("Удаление символа (Backspace)")

    page.on_keyboard_event = handle_key

    def toggle_theme(e):
        nonlocal theme_mode
        theme_mode = "light" if theme_mode == "dark" else "dark"
        page.theme_mode = ft.ThemeMode.LIGHT if theme_mode == "light" else ft.ThemeMode.DARK
        save_settings(theme_mode, scientific_mode, use_degrees)
        set_status(f"Тема: {theme_mode}")
        page.update()

    def toggle_degrees(e):
        nonlocal use_degrees
        use_degrees = not use_degrees
        save_settings(theme_mode, scientific_mode, use_degrees)
        mode_name = "градусы" if use_degrees else "радианы"
        set_status(f"Тригонометрия: {mode_name}")
        page.update()

    def clear_history(e):
        nonlocal history
        history = []
        rebuild_history_ui()
        save_history(history)
        set_status("История очищена")
        page.update()

    def export_history(e):
        text_content = "\n".join(history)
        filename = "history_export.txt"
        try:
            with open(filename, "w", encoding="utf-8") as f:
                f.write(text_content)
            snack = ft.SnackBar(
                ft.Text(f"История сохранена в {filename}", color=ft.Colors.WHITE),
                bgcolor=ft.Colors.GREEN_600
            )
            page.show_dialog(snack)
        except Exception as err:
            show_error(f"Не удалось сохранить: {err}")
        page.update()

    def show_parse_info(e):
        if not expression:
            show_error("Нет выражения для разбора")
            return
        info = get_parse_info(expression)
        dlg = ft.AlertDialog(
            title=ft.Text("Разбор выражения (AST)", size=16, weight=ft.FontWeight.BOLD),
            content=ft.TextField(
                value=info,
                multiline=True,
                expand=True,
                read_only=True,
                height=300,
                border=ft.OutlineInputBorder(border_radius=8),
                bgcolor=ft.Colors.SURFACE_CONTAINER_HIGHEST,
            ),
            actions=[ft.TextButton("Закрыть", on_click=lambda _: page.pop_dialog())]
        )
        page.show_dialog(dlg)
        page.update()

    # --- Панель кнопок ---
    basic_buttons = [
        ("7", 0, 0), ("8", 0, 1), ("9", 0, 2), ("/", 0, 3), ("C", 0, 4), ("←", 0, 5), ("()", 0, 6),
        ("4", 1, 0), ("5", 1, 1), ("6", 1, 2), ("*", 1, 3), ("%", 1, 4), ("π", 1, 5), ("^", 1, 6),
        ("1", 2, 0), ("2", 2, 1), ("3", 2, 2), ("-", 2, 3), ("=", 2, 4), ("+", 2, 5), ("x²", 2, 6),
        ("0", 3, 0), (".", 3, 1)
    ]

    sci_buttons = [
        ("√", 4, 0), ("sin", 4, 1), ("cos", 4, 2), ("tan", 4, 3),
        ("ln", 4, 4), ("log10", 4, 5), ("exp", 4, 6),
        ("abs", 5, 0), ("1/x", 5, 1), ("(", 5, 2), (")", 5, 3)
    ]

    grid = ft.GridView(
        expand=True,
        runs_count=7,
        spacing=6,
        run_spacing=8,
        padding=8,
    )

    for text, r, c in basic_buttons:
        btn = ft.Button(
            content=text,
            width=56,
            height=56,
            bgcolor=ft.Colors.SURFACE,
            color=ft.Colors.ON_SURFACE,
            tooltip=text,
            data=text,
            on_click=on_button_click,
        )
        grid.controls.append(btn)

    # Скрываем научные кнопки по умолчанию, показываем при включении режима
    sci_btn_controls = {}
    for text, r, c in sci_buttons:
        btn = ft.Button(
            content=text,
            width=56,
            height=56,
            bgcolor="#FFA500",
            color=ft.Colors.BLACK,
            tooltip=text,
            data=text,
            on_click=on_button_click,
        )
        sci_btn_controls[text] = btn
        grid.controls.append(btn)  # добавляем, но будем скрывать/показывать

    def update_scientific_buttons():
        for text, btn in sci_btn_controls.items():
            btn.visible = scientific_mode
        page.update()

    # Переопределяем toggle_scientific, чтобы обновлять видимость кнопок
    def toggle_scientific(e):
        nonlocal scientific_mode
        scientific_mode = not scientific_mode
        save_settings(theme_mode, scientific_mode, use_degrees)
        mode_name = "включён" if scientific_mode else "выключен"
        set_status(f"Научный режим: {mode_name}")
        update_scientific_buttons()

    # Сразу скрываем научные кнопки, если режим выключен
    update_scientific_buttons()

    # --- Верхняя панель управления ---
    top_row = ft.Row(
        [
            ft.Switch(
                label="Тема: светлая",
                on_change=toggle_theme,
                value=(theme_mode == "light"),
            ),
            ft.Container(expand=True),  # отступ
            ft.Switch(
                label="Научный режим",
                on_change=toggle_scientific,
                value=scientific_mode,
                thumb_color="#FFA500",
            ),
            ft.Switch(
                label="Градусы",
                on_change=toggle_degrees,
                value=use_degrees,
            ),
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
            ft.FilledButton("Очистить историю", on_click=clear_history),
            ft.FilledButton("Экспорт истории", on_click=export_history, bgcolor=ft.Colors.BLUE_600),
            ft.FilledButton("Разбор выражения", on_click=show_parse_info, bgcolor=ft.Colors.PURPLE_600),
        ],
        alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
    )

    # Сборка страницы
    page.add(
        ft.Column(
            [
                top_row,
                ft.Container(
                    ft.Row([display], expand=True),
                    padding=8,
                ),
                status_text,
                grid,
                history_panel,
                ctrl_row,
            ],
            expand=True,
            spacing=4,
        )
    )

    # Первоначальная отрисовка истории
    rebuild_history_ui()
    validate_and_style()

if __name__ == "__main__":
    ft.run(main)

'''
~ python -m pip install flet
Программист: Дуплей Максим Игоревич
Дата: 30.10.2026
Версия: 1.0
Описание: Калькулятор написанный с помощью фреймворка Flet
'''
