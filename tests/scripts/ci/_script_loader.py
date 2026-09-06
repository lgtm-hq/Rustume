"""Shared loader that imports hyphenated script paths as modules."""

from __future__ import annotations

import importlib.util
from pathlib import Path
from types import ModuleType


def load_script_module(module_name: str, script_path: Path) -> ModuleType:
    """Import a script file as a module despite a hyphenated filename.

    Args:
        module_name: Snake_case name to register the module under.
        script_path: Path to the script file to execute.

    Returns:
        The executed module object.

    Raises:
        ImportError: If the module spec or loader cannot be created.
    """
    spec = importlib.util.spec_from_file_location(module_name, script_path)
    if spec is None:
        raise ImportError(f"Could not load module spec from {script_path}")
    loader = spec.loader
    if loader is None:
        raise ImportError(f"Module spec for {script_path} has no loader")
    module = importlib.util.module_from_spec(spec)
    loader.exec_module(module)
    return module
