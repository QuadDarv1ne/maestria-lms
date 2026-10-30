import customtkinter as ctk
import tkinter as tk
from tkinter import messagebox, scrolledtext
import json
import os
import math
import ast
import operator
import re

# --- Конфигурация файлов ---
SETTINGS_FILE = "settings_ctk.json"
HISTORY_FILE = "history_ctk.json"

# --- Безопасный парсер (тот же, что и в Flet) ---
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
    # Оборачиваем только ошибки разбора, иначе ZeroDivisionError
    # превращается в ValueError и не доходит до своего обработчика.
    try:
        node = ast.parse(expr, mode="eval").body
    except SyntaxError as e:
        raise ValueError(f"Ошибка разбора: {e.msg}") from e
    return _eval_node(node, use_degrees)

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

# --- Утилиты сохранения/загрузки ---
def load_settings():
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {"theme": "dark-blue", "appearance": "dark", "use_degrees": True}

def save_settings(theme, appearance, use_degrees):
    try:
        with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
            json.dump({"theme": theme, "appearance": appearance, "use_degrees": use_degrees}, f, ensure_ascii=False, indent=2)
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

# --- Разбор AST для отображения ---
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


class CalculatorApp(ctk.CTk):
    def __init__(self):
        super().__init__()

        # Настройка окна
        self.title("Калькулятор (CustomTkinter)")
        self.geometry("480x760")
        self.minsize(400, 600)

        # Загрузка настроек
        self.settings = load_settings()
        theme = self.settings.get("theme", "dark-blue")
        appearance = self.settings.get("appearance", "dark")
        self.use_degrees = self.settings.get("use_degrees", True)

        # set_default_color_theme принимает только встроенные темы
        if theme not in ("blue", "dark-blue", "green"):
            theme = "dark-blue"

        ctk.set_appearance_mode(appearance)
        ctk.set_default_color_theme(theme)

        self.expression = ""
        self.history = load_history()
        self.max_history = 15

        # Переменные состояний для переключателей (CTkSwitch не знает аргумента checked)
        self.light_theme_var = tk.BooleanVar(value=appearance == "light")
        self.use_degrees_var = tk.BooleanVar(value=self.use_degrees)

        # --- Элементы UI ---
        self._create_widgets()
        self._bind_keys()

    def _create_widgets(self):
        # Верхняя панель: настройки
        top_frame = ctk.CTkFrame(self, fg_color="transparent")
        top_frame.pack(fill="x", padx=16, pady=8)

        self.theme_switch = ctk.CTkSwitch(
            top_frame, text="Светлая тема", command=self.toggle_theme,
            variable=self.light_theme_var, onvalue=True, offvalue=False
        )
        self.theme_switch.pack(side="left", padx=8)

        self.degrees_switch = ctk.CTkSwitch(
            top_frame, text="Градусы", command=self.toggle_degrees,
            variable=self.use_degrees_var, onvalue=True, offvalue=False
        )
        self.degrees_switch.pack(side="right", padx=8)

        # Поле ввода
        self.display = ctk.CTkEntry(
            self, placeholder_text="0", font=("Consolas", 28), justify="right",
            height=64, border_width=2, corner_radius=12
        )
        self.display.pack(fill="x", padx=16, pady=(0, 8))

        # Статус
        self.status_label = ctk.CTkLabel(
            self, text="Готов к работе", font=("Segoe UI", 12), text_color="gray"
        )
        self.status_label.pack(padx=16)

        # Сетка кнопок
        btn_frame = ctk.CTkFrame(self, fg_color="transparent")
        btn_frame.pack(fill="both", expand=True, padx=12, pady=4)

        buttons = [
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

        for text, r, c in buttons:
            btn = ctk.CTkButton(
                btn_frame, text=text, font=("Segoe UI", 16),
                command=lambda t=text: self.on_button_click(t),
                height=56, width=56 if text != "0" else 116, corner_radius=12
            )
            if text == "0":
                btn.grid(row=r, column=c, columnspan=2, padx=2, pady=2, sticky="ew")
            else:
                btn.grid(row=r, column=c, padx=2, pady=2)

        # Научные кнопки (можно добавить переключатель, пока просто ниже)
        sci_frame = ctk.CTkFrame(btn_frame, fg_color="transparent")
        sci_frame.grid(row=6, column=0, columnspan=7, sticky="ew", pady=12)
        for text, r, c in sci_buttons:
            btn = ctk.CTkButton(
                sci_frame, text=text, font=("Segoe UI", 14),
                fg_color="#FFA500", text_color="black",
                command=lambda t=text: self.on_button_click(t),
                height=48, width=48, corner_radius=10
            )
            btn.grid(row=r % 2, column=c % 7, padx=2, pady=2)

        # История
        hist_frame = ctk.CTkScrollableFrame(self, label_text="История вычислений")
        hist_frame.pack(fill="both", expand=True, padx=16, pady=8)

        self.history_listbox = tk.Listbox(
            hist_frame, bg=self.cget("bg"), fg="#ccc", font=("Consolas", 13),
            borderwidth=0, highlightthickness=0, selectbackground="#444"
        )
        self.history_listbox.pack(fill="both", expand=True)
        self.history_listbox.bind("<Double-Button-1>", self.on_history_double_click)

        # Кнопки действий
        ctrl_frame = ctk.CTkFrame(self, fg_color="transparent")
        ctrl_frame.pack(fill="x", padx=16, pady=4)

        ctk.CTkButton(ctrl_frame, text="Очистить историю", command=self.clear_history,
                      fg_color="red", text_color="white", width=120, height=36, corner_radius=8).pack(side="left")
        ctk.CTkButton(ctrl_frame, text="Разбор AST", command=self.show_parse_info,
                      width=120, height=36, corner_radius=8).pack(side="right")

        self.rebuild_history_ui()

    def _bind_keys(self):
        self.bind("<Return>", lambda e: self.on_button_click("="))
        self.bind("<BackSpace>", lambda e: self.on_button_click("←"))
        self.bind("<Escape>", lambda e: self.on_button_click("C"))

    # --- Логика ---
    def on_button_click(self, char: str):
        if char == "C":
            self.expression = ""
            self.update_display()
            self.set_status("Очистка")
        elif char == "←":
            self.expression = self.expression[:-1]
            self.update_display()
            self.set_status("Удаление символа")
        elif char == "%":
            if self.expression:
                try:
                    val = float(self.expression.replace(",", "."))
                    self.expression = str(val / 100)
                    self.update_display()
                except ValueError:
                    pass
        elif char == "()":
            pos = len(self.expression)
            self.expression += "()"
            self.update_display()
            self.display.icursor(pos + 1)
        elif char == "(":
            pos = len(self.expression)
            self.expression += "("
            self.update_display()
            self.display.icursor(pos + 1)
        elif char == ")":
            self.expression += ")"
            self.update_display()
        elif char == "x²":
            self.expression += "**2"
            self.update_display()
        elif char == "^":
            self.expression += "**"
            self.update_display()
        elif char == "√":
            self.expression += "sqrt("
            self.update_display()
        elif char in ("sin", "cos", "tan", "ln", "log10", "exp", "abs"):
            self.expression += f"{char}("
            self.update_display()
        elif char == "1/x":
            self.expression += "**(-1)"
            self.update_display()
        elif char == "π":
            self.expression += str(math.pi)
            self.update_display()
        elif char == "=":
            self.calculate()
        else:
            self.expression += char
            self.update_display()

    def calculate(self):
        expr = self.expression.strip()
        if not expr:
            return

        # Простая валидация
        ok, msg = self.validate_and_style()
        if not ok:
            messagebox.showerror("Ошибка", msg)
            self.set_status(msg)
            return

        try:
            result = safe_eval_expr(expr, self.use_degrees)
            self.expression = str(result)
            self.update_display()
            self.add_to_history(expr, str(result))
            self.set_status("Результат вычислен")
        except ZeroDivisionError:
            messagebox.showerror("Ошибка", "Деление на ноль")
            self.set_status("Ошибка: деление на ноль")
        except Exception as e:
            messagebox.showerror("Ошибка вычисления", str(e))
            self.set_status("Ошибка вычисления")

    def validate_and_style(self):
        ok = True
        msg = "Готов к работе"

        if self.expression.count("(") != self.expression.count(")"):
            ok = False
            msg = "Незакрытые скобки"

        # Разрешённые символы: цифры, операторы, буквы для функций, скобки, точка, пробел, π
        allowed_pattern = r"^[0-9+\-*/().^%πa-z\s]*$"
        if not re.match(allowed_pattern, self.expression, re.IGNORECASE):
            ok = False
            msg = "Недопустимые символы"

        color = "#66BB6A" if ok else "#EF5350"  # зелёный / красный
        self.display.configure(border_color=color)
        self.status_label.configure(text_color=color if ok else "#EF5350")
        self.status_label.configure(text=msg)
        return ok, msg

    def update_display(self):
        self.display.delete(0, "end")
        self.display.insert(0, self.expression)

    def add_to_history(self, expr, res):
        entry = f"{expr} = {res}"
        self.history.append(entry)
        if len(self.history) > self.max_history:
            self.history.pop(0)
        save_history(self.history)
        self.rebuild_history_ui()

    def rebuild_history_ui(self):
        self.history_listbox.delete(0, "end")
        for item in reversed(self.history):
            self.history_listbox.insert("end", item)

    def on_history_double_click(self, event):
        selection = self.history_listbox.curselection()
        if selection:
            item = self.history_listbox.get(selection[0])
            # Берём часть до "="
            expr = item.split(" = ", 1)[0]
            self.expression = expr
            self.update_display()
            self.set_status("Выражение из истории вставлено")

    def clear_history(self):
        self.history = []
        save_history(self.history)
        self.rebuild_history_ui()
        self.set_status("История очищена")

    def show_parse_info(self):
        if not self.expression:
            messagebox.showwarning("Внимание", "Нет выражения для разбора")
            return
        info = get_parse_info(self.expression)
        dialog = ctk.CTkToplevel(self)
        dialog.title("Разбор выражения (AST)")
        dialog.geometry("500x400")

        text_area = scrolledtext.ScrolledText(
            dialog, font=("Consolas", 12), bg="#1e1e1e", fg="#00ff00",
            borderwidth=0, highlightthickness=0
        )
        text_area.pack(fill="both", expand=True, padx=12, pady=12)
        text_area.insert("1.0", info)
        text_area.configure(state="disabled")

        close_btn = ctk.CTkButton(
            dialog, text="Закрыть", command=dialog.destroy,
            width=120, height=36, corner_radius=8
        )
        close_btn.pack(pady=8)

    def toggle_theme(self):
        new_mode = "light" if self.light_theme_var.get() else "dark"
        ctk.set_appearance_mode(new_mode)
        self.settings["appearance"] = new_mode
        save_settings(self.settings.get("theme", "dark-blue"), new_mode, self.use_degrees)
        self.set_status(f"Тема: {new_mode}")

    def toggle_degrees(self):
        self.use_degrees = bool(self.use_degrees_var.get())
        mode_name = "градусы" if self.use_degrees else "радианы"
        save_settings(self.settings.get("theme", "dark-blue"), self.settings.get("appearance", "dark"), self.use_degrees)
        self.set_status(f"Тригонометрия: {mode_name}")

    def set_status(self, msg):
        self.status_label.configure(text=msg)


if __name__ == "__main__":
    app = CalculatorApp()
    app.mainloop()

'''
~ python -m pip install customtkinter

Программист: Дуплей Максим Игоревич
Дата: 30.10.2026
Версия: 1.0
Описание: Калькулятор написанный с помощью библиотеки customtkinter
'''
