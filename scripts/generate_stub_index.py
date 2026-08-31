"""Generate a searchable index from boardfarm stub files.

Parses all .pyi files in the stubs directory and extracts:
- Use case functions (with hints, signatures, imports)
- Device template classes (properties, methods)
- Device API classes (like DMCLIAPI)
- Dataclasses (fields, types)

Output: stubs_index.json — a structured, searchable knowledge base
that can be used by LLMs or MCP tools to find the right use case
for a test step without grepping/reading raw files.

Usage:
    python generate_stub_index.py [stubs_dir] [output_file]
    python generate_stub_index.py                          # defaults: stubs/ → stubs_index.json
"""

import ast
import json
import re
import sys
import textwrap
from pathlib import Path


def _get_module_path(file_path: Path, stubs_root: Path) -> str:
    """Convert a file path to a Python module path.

    stubs/boardfarm/boardfarm3/use_cases/networking.pyi
    → boardfarm3.use_cases.networking
    """
    rel = file_path.relative_to(stubs_root)
    # Skip the first directory (repo name: boardfarm, boardfarm-docsis, etc.)
    parts = list(rel.parts[1:])
    # Remove .pyi/.py extension
    if parts:
        parts[-1] = parts[-1].replace(".pyi", "").replace(".py", "")
    # Skip __init__
    if parts and parts[-1] == "__init__":
        parts = parts[:-1]
    return ".".join(parts)


def _extract_signature(node: ast.FunctionDef) -> str:
    """Extract a clean function signature string from an AST node.

    Handles all Python argument types: positional-only, regular, *args,
    keyword-only, **kwargs — with annotations and defaults.
    """
    params = []
    args = node.args

    def _format_arg(arg: ast.arg, default: ast.expr | None = None) -> str:
        annotation = ast.unparse(arg.annotation) if arg.annotation else ""
        result = f"{arg.arg}: {annotation}" if annotation else arg.arg
        if default is not None:
            result += f" = {ast.unparse(default)}"
        return result

    # --- Positional-only + regular args (defaults are right-aligned) ---
    all_positional = list(args.posonlyargs) + list(args.args)
    defaults_copy = list(args.defaults)
    posonly_count = len(args.posonlyargs)

    positional_params: list[str] = []
    for arg in reversed(all_positional):
        if arg.arg == "self":
            continue
        default = defaults_copy.pop() if defaults_copy else None
        positional_params.insert(0, _format_arg(arg, default))

    # Insert "/" separator after positional-only args
    if posonly_count:
        posonly_non_self = sum(1 for a in args.posonlyargs if a.arg != "self")
        positional_params.insert(posonly_non_self, "/")

    params.extend(positional_params)

    # --- *args (vararg) ---
    if args.vararg:
        params.append(f"*{_format_arg(args.vararg)}")
    elif args.kwonlyargs:
        # If there are keyword-only args but no *args, add bare *
        params.append("*")

    # --- Keyword-only args ---
    for i, arg in enumerate(args.kwonlyargs):
        default = (
            args.kw_defaults[i]
            if i < len(args.kw_defaults) and args.kw_defaults[i] is not None
            else None
        )
        params.append(_format_arg(arg, default))

    # --- **kwargs ---
    if args.kwarg:
        params.append(f"**{_format_arg(args.kwarg)}")

    returns = ""
    if node.returns:
        returns = f" -> {ast.unparse(node.returns)}"

    return f"({', '.join(params)}){returns}"


def _extract_hints(docstring: str) -> list[str]:
    """Extract hint phrases from a docstring.

    Looks for:
        .. hint:: This Use Case implements statements from the test suite such as:
            - Some hint phrase
            - Another hint phrase
    """
    hints = []
    if not docstring:
        return hints
    # TODO need to work on hint extraction properly

    in_hint_block = False
    for line in docstring.split("\n"):
        stripped = line.strip()
        # if "hint:: This Use Case implements statements" in stripped:
        if "hint::" in stripped:
            in_hint_block = True
            continue
        if in_hint_block:
            if stripped.startswith("- "):
                hints.append(stripped[2:].strip())
            elif stripped.startswith(":") or (
                stripped
                and not stripped.startswith("-")
                and not stripped.startswith("*")
            ):
                # Hit a parameter line or non-list content — end of hint block
                in_hint_block = False
            elif not stripped:
                # Empty line might be within the hint block, continue
                continue
    return hints


def _get_decorator_names(decorator_list: list) -> list[str]:
    """Extract decorator names from AST decorator list."""
    names = []
    for d in decorator_list:
        if isinstance(d, ast.Name):
            names.append(d.id)
        elif isinstance(d, ast.Attribute):
            names.append(ast.unparse(d))
        elif isinstance(d, ast.Call):
            # e.g. @moved_function(...) — extract the function name
            if isinstance(d.func, ast.Name):
                names.append(d.func.id)
            elif isinstance(d.func, ast.Attribute):
                names.append(ast.unparse(d.func))
            else:
                names.append(ast.unparse(d.func))
        else:
            names.append(ast.unparse(d))
    return names


# Decorators that are meaningful for test writers
_RELEVANT_DECORATORS = {
    "contextmanager",
    "staticmethod",
    "classmethod",
    "abstractmethod",
    "cached_property",
    "property",
    "lru_cache",
    "moved_function",
    "fixture",
}


def _get_relevant_tags(decorator_names: list[str]) -> list[str]:
    """Return tags for decorators that matter to test writers."""
    tags = []
    for name in decorator_names:
        # Match exact or partial (e.g. "functools.lru_cache" → "lru_cache")
        base = name.split(".")[-1]
        if base in _RELEVANT_DECORATORS:
            tags.append(base)
    return tags


def _get_fixture_scope(decorator_list: list) -> str | None:
    """Extract pytest fixture scope from decorator if present.

    Returns the scope string ('function', 'session', etc.) or None.
    """
    for d in decorator_list:
        if isinstance(d, ast.Call):
            func_name = ast.unparse(d.func) if hasattr(d, "func") else ""
            if "fixture" in func_name:
                for kw in d.keywords:
                    if kw.arg == "scope" and isinstance(kw.value, ast.Constant):
                        return kw.value.value
                # No scope kwarg — default is 'function'
                return "function"
    return None


def _extract_fields_from_class(node: ast.ClassDef) -> dict[str, str]:
    """Extract field annotations from a dataclass or simple class."""
    fields = {}
    for item in node.body:
        if isinstance(item, ast.AnnAssign) and isinstance(item.target, ast.Name):
            type_str = ast.unparse(item.annotation) if item.annotation else "Any"
            fields[item.target.id] = type_str
    return fields


def _extract_properties(node: ast.ClassDef) -> list[dict]:
    """Extract @property and @cached_property from a class."""
    properties = []
    for item in node.body:
        if isinstance(item, ast.FunctionDef):
            dec_names = _get_decorator_names(item.decorator_list)
            tags = _get_relevant_tags(dec_names)
            is_property = any(t in ("property", "cached_property") for t in tags)
            # Also treat single-arg abstractmethod as property (template pattern)
            if (
                not is_property
                and "abstractmethod" in tags
                and len(item.args.args) == 1
            ):
                is_property = True
            if is_property and item.args.args and len(item.args.args) == 1:
                # Skip private properties
                if item.name.startswith("_"):
                    continue
                ret = ast.unparse(item.returns) if item.returns else ""
                doc = ast.get_docstring(item) or ""
                entry = {
                    "name": item.name,
                    "return_type": ret,
                    "docstring": doc,
                }
                if "cached_property" in tags:
                    entry["cached"] = True
                properties.append(entry)
    return properties


def _extract_methods(node: ast.ClassDef) -> list[dict]:
    """Extract non-property methods from a class."""
    methods = []
    for item in node.body:
        if isinstance(item, ast.FunctionDef):
            dec_names = _get_decorator_names(item.decorator_list)
            tags = _get_relevant_tags(dec_names)

            # Skip properties and dunder methods
            is_property = any(t in ("property", "cached_property") for t in tags)
            if is_property or item.name.startswith("_"):
                continue

            doc = ast.get_docstring(item) or ""
            sig = _extract_signature(item)
            hints = _extract_hints(doc)

            method_entry = {
                "name": item.name,
                "signature": sig,
                "docstring": doc,
            }
            if hints:
                method_entry["hints"] = hints
            # Add relevant tags (contextmanager, staticmethod, classmethod, etc.)
            method_tags = [
                t
                for t in tags
                if t not in ("property", "cached_property", "abstractmethod")
            ]
            if method_tags:
                method_entry["tags"] = method_tags
            methods.append(method_entry)
    return methods


def _is_use_case_module(file_path: Path) -> bool:
    """Check if a file is in a use_cases directory."""
    return "use_cases" in file_path.parts


def _is_template_module(file_path: Path) -> bool:
    """Check if a file is in a templates directory."""
    return "templates" in file_path.parts


def _is_lib_module(file_path: Path) -> bool:
    """Check if a file is in a lib directory."""
    return "lib" in file_path.parts


def _is_dataclass(node: ast.ClassDef):
    """checks if the node is a dataclass."""
    return "dataclass" in [node.decorator_list]


def parse_stub_file(file_path: Path, stubs_root: Path) -> dict:
    """Parse a single stub file and extract structured information."""
    try:
        source = file_path.read_text(encoding="utf-8")
        tree = ast.parse(source)
    except SyntaxError, UnicodeDecodeError:
        return {}

    module_path = _get_module_path(file_path, stubs_root)
    if not module_path:
        return {}

    result = {"module": module_path, "file": str(file_path.relative_to(stubs_root))}

    functions = []
    classes = []

    # TODO handle module level typealias.

    for node in ast.iter_child_nodes(tree):
        if isinstance(node, ast.FunctionDef):
            # Skip private functions — tests should never call these
            if node.name.startswith("_"):
                continue

            doc = ast.get_docstring(node) or ""
            sig = _extract_signature(node)
            hints = _extract_hints(doc)
            dec_names = _get_decorator_names(node.decorator_list)
            if "overload" in dec_names:
                continue  # skip, keep only the real implementation
            tags = _get_relevant_tags(dec_names)

            fixture_scope = _get_fixture_scope(node.decorator_list)

            entry = {
                "type": "function",
                "name": node.name,
                "signature": f"{node.name}{sig}",
                "import": f"from {module_path} import {node.name}",
                "docstring": doc,
            }
            if hints:
                entry["hints"] = hints
            if tags:
                entry["tags"] = tags
            if fixture_scope:
                entry["fixture_scope"] = fixture_scope

            functions.append(entry)

        elif isinstance(node, ast.ClassDef):
            # Skip private classes — tests should never use these
            if node.name.startswith("_"):
                continue
            doc = ast.get_docstring(node) or ""
            bases = [ast.unparse(b) for b in node.bases]
            fields = _extract_fields_from_class(node)
            properties = _extract_properties(node)
            methods = _extract_methods(node)
            _is_dataclass = "dataclass" in _get_decorator_names(node.decorator_list)

            entry = {
                "type": "class",
                "name": node.name,
                "import": f"from {module_path} import {node.name}",
                "docstring": doc,
            }
            if bases:
                entry["bases"] = bases
            if fields:
                entry["fields"] = fields
            if properties:
                entry["properties"] = properties
            if methods:
                entry["methods"] = methods
            if _is_dataclass:
                entry["dataclass"] = True

            classes.append(entry)

    if functions:
        result["functions"] = functions
    if classes:
        result["classes"] = classes

    return result if (functions or classes) else {}


def build_index(stubs_root: Path) -> dict:
    """Build the complete stub index."""
    index = {
        "_meta": {
            "description": "Boardfarm3 stub index — searchable knowledge base for test writing",
            "stubs_root": str(stubs_root),
            "usage": "Search 'hints' to find use cases matching test step phrases. "
            "Use 'import' and 'signature' for correct code generation.",
        },
        "use_cases": [],
        "fixtures": [],
        "templates": [],
        "device_apis": [],
        "dataclasses": [],
        "exceptions": [],
        "lib_utils": [],
        "other": [],
    }

    stub_files = sorted(stubs_root.rglob("*.pyi")) + sorted(stubs_root.rglob("*.py"))
    # Deduplicate (some files might match both patterns)
    seen = set()
    unique_files = []
    for f in stub_files:
        if f not in seen:
            seen.add(f)
            unique_files.append(f)

    for file_path in unique_files:
        parsed = parse_stub_file(file_path, stubs_root)
        if not parsed:
            continue

        # TODO this logi is hardcoded . can be optimized
        is_use_case = _is_use_case_module(file_path)
        is_template = _is_template_module(file_path)
        is_lib = _is_lib_module(file_path)
        is_device = "devices" in file_path.parts
        is_exception_file = "exception" in str(file_path)
        ## =========================================================

        # Categorize functions
        for func in parsed.get("functions", []):
            func["module"] = parsed["module"]
            func["file"] = parsed["file"]
            if func.get("fixture_scope"):
                index["fixtures"].append(func)
            elif is_use_case:
                index["use_cases"].append(func)
            elif is_device:
                continue  # Skip concrete device implementations
            elif is_lib:
                index["lib_utils"].append(func)
            else:
                index["other"].append(func)

        # Categorize classes
        for cls in parsed.get("classes", []):
            cls["module"] = parsed["module"]
            cls["file"] = parsed["file"]

            # Skip concrete device implementations — tests use templates, not devices
            if is_device:
                continue

            # Determine category
            has_abstract = any(
                "ABC" in b or "Abstract" in b for b in cls.get("bases", [])
            )
            is_exception = (
                any("Exception" in b or "Error" in b for b in cls.get("bases", []))
                or is_exception_file
            )

            if is_exception:
                index["exceptions"].append(cls)
            elif cls.get("dataclass"):
                index["dataclasses"].append(cls)
            elif is_template or has_abstract:
                index["templates"].append(cls)
            elif is_lib and cls.get("methods"):
                index["device_apis"].append(cls)
            elif is_use_case:
                index["use_cases"].append(cls)
            else:
                index["other"].append(cls)

    # Build summary stats
    index["_meta"]["stats"] = {
        cat: len(index[cat])
        for cat in [
            "use_cases",
            "fixtures",
            "templates",
            "device_apis",
            "dataclasses",
            "exceptions",
            "lib_utils",
            "other",
        ]
    }
    index["_meta"]["stats"]["total_hints"] = sum(
        len(uc.get("hints", [])) for uc in index["use_cases"]
    )

    return index


def main():
    # raise Exception("PAths neeed to be changed")
    stubs_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("stubs")
    output_file = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("stubs_index.json")

    if not stubs_dir.exists():
        print(f"Error: stubs directory '{stubs_dir}' not found", file=sys.stderr)
        sys.exit(1)

    print(f"Parsing stubs from: {stubs_dir}")
    index = build_index(stubs_dir)

    stats = index["_meta"]["stats"]
    print(f"Extracted:")
    for cat, count in stats.items():
        print(f"  {cat:15s}: {count}")

    output_file.write_text(json.dumps(index, indent=2, default=str), encoding="utf-8")
    print(f"\nIndex written to: {output_file}")


if __name__ == "__main__":
    main()
