#!/usr/bin/env python3
"""Apply mechanical i18n string replacements across apps/web/src."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "apps/web/src"

# Exact string -> (replacement, needs_translate_import, needs_use_i18n)
# Components use t(); stores/libs use translate()
REPLACEMENTS: dict[str, tuple[str, str]] = {
    # common
    '"Add"': ('t("common.actions.add")', "component"),
    '"Cancel"': ('t("common.actions.cancel")', "component"),
    '"Confirm"': ('t("common.actions.confirm")', "component"),
    '"Delete"': ('t("common.actions.delete")', "component"),
    '"Dismiss"': ('t("common.actions.dismiss")', "component"),
    '"Duplicate"': ('t("common.actions.duplicate")', "component"),
    '"Export"': ('t("common.actions.export")', "component"),
    '"Import"': ('t("common.actions.import")', "component"),
    '"Refresh"': ('t("common.actions.refresh")', "component"),
    '"Remove"': ('t("common.actions.remove")', "component"),
    '"Rename"': ('t("common.actions.rename")', "component"),
    '"Retry"': ('t("common.actions.retry")', "component"),
    '"Save"': ('t("common.actions.save")', "component"),
    '"Sign in to sync"': ('t("common.actions.signIn")', "component"),
    '"Sign out"': ('t("common.actions.signOut")', "component"),
    '"Coming soon"': ('t("common.status.comingSoon")', "component"),
    '"Importing..."': ('t("common.status.importing")', "component"),
    '"Loading..."': ('t("common.status.loading")', "component"),
    '"Offline"': ('t("common.status.offline")', "component"),
    '"Saved"': ('t("common.status.saved")', "component"),
    '"Saving..."': ('t("common.status.saving")', "component"),
    '"Unsaved"': ('t("common.status.unsaved")', "component"),
    '"Visible"': ('t("common.status.visible")', "component"),
    '"Account"': ('t("common.labels.account")', "component"),
    '"No items yet"': ('t("common.labels.noItemsYet")', "component"),
    '"Untitled"': ('t("common.labels.untitled")', "component"),
    '"Are you sure you want to delete this resume?"': (
        't("common.confirm.deleteResume")',
        "component",
    ),
    # store translate() replacements
    '"Resume deleted"': ('translate("home.toasts.deleted")', "translate"),
    '"Failed to delete resume"': ('translate("home.toasts.deleteFailed")', "translate"),
    '"Resume duplicated"': ('translate("home.toasts.duplicated")', "translate"),
    '"Failed to duplicate resume"': ('translate("home.toasts.duplicateFailed")', "translate"),
    '"Resume renamed"': ('translate("home.toasts.renamed")', "translate"),
    '"Failed to rename resume"': ('translate("home.toasts.renameFailed")', "translate"),
    '"Signed out"': ('translate("account.toasts.signedOut")', "translate"),
    '"Failed to sign out. Please try again."': (
        'translate("account.toasts.signOutFailed")',
        "translate",
    ),
    '"Resume export downloaded"': ('translate("account.export.jsonSuccess")', "translate"),
    '"Failed to export resumes"': ('translate("account.export.jsonFailed")', "translate"),
    '"PDF export downloaded"': ('translate("account.export.pdfSuccess")', "translate"),
    '"Failed to export PDFs"': ('translate("account.export.pdfFailed")', "translate"),
    '"Account deleted"': ('translate("account.toasts.accountDeleted")', "translate"),
    '"Failed to delete account. Please try again."': (
        'translate("account.toasts.deleteFailed")',
        "translate",
    ),
    '"You\'re signed in to Rustume Cloud."': ('translate("auth.signedIn")', "translate"),
    '"Sign-in was interrupted. Please try again."': (
        'translate("auth.errors.invalidState")',
        "translate",
    ),
    '"We couldn\'t sign you in. Please try again."': (
        'translate("auth.errors.authenticationFailed")',
        "translate",
    ),
    '"Something went wrong on our end. Please try again later."': (
        'translate("auth.errors.serverError")',
        "translate",
    ),
    '"Sign-in failed. Please try again."': ('translate("auth.errors.generic")', "translate"),
    '"New resume created"': ('translate("editor.toasts.newResume")', "translate"),
    '"Failed to create new resume — redirecting to home"': (
        'translate("editor.toasts.createFailed")',
        "translate",
    ),
    '"Failed to load resume — your data has not been modified"': (
        'translate("editor.toasts.loadFailed")',
        "translate",
    ),
    '"You have unsaved changes. Leave anyway?"': (
        'translate("editor.navigationGuard.message")',
        "translate",
    ),
    '"Resume ID data was corrupted — it has been reset"': (
        'translate("storage.toasts.idCorrupted")',
        "translate",
    ),
    '"Resume saved but metadata could not be updated — storage may be full"': (
        'translate("storage.toasts.metaFailed")',
        "translate",
    ),
    '"Resume list data was corrupted — it has been reset"': (
        'translate("storage.toasts.listCorrupted")',
        "translate",
    ),
    '"Local storage is full — could not save resume"': (
        'translate("storage.toasts.full")',
        "translate",
    ),
    '"Local storage is full — resume saved but list not updated"': (
        'translate("storage.toasts.listNotUpdated")',
        "translate",
    ),
    '"Failed to load resume list"': ('translate("storage.toasts.listLoadFailed")', "translate"),
    '"Could not load saved theme preference"': (
        'translate("theme.toasts.loadFailed")',
        "translate",
    ),
    '"Could not save theme preference"': ('translate("theme.toasts.saveFailed")', "translate"),
    '"Resume was updated elsewhere. Reload to see latest changes."': (
        'translate("storage.toasts.conflict")',
        "translate",
    ),
    '"Preview paused briefly — too many rapid updates"': (
        'translate("preview.toasts.throttled")',
        "translate",
    ),
    '"PDF export paused briefly — too many rapid requests"': (
        'translate("preview.toasts.pdfThrottled")',
        "translate",
    ),
    '"Saving paused briefly — too many rapid changes"': (
        'translate("storage.toasts.saveThrottled")',
        "translate",
    ),
    '"Preview rendering failed"': ('translate("preview.renderFailed")', "translate"),
    '"Resume imported successfully"': ('translate("import.toasts.success")', "translate"),
    '"Failed to import file"': ('translate("import.toasts.failed")', "translate"),
    '"PDF exported successfully"': ('translate("export.toasts.pdfSuccess")', "translate"),
    '"Failed to export PDF"': ('translate("export.toasts.pdfFailed")', "translate"),
    '"JSON exported successfully"': ('translate("export.toasts.jsonSuccess")', "translate"),
    '"Failed to export JSON"': ('translate("export.toasts.jsonFailed")', "translate"),
    '"Profile photo uploaded"': ('translate("builder.imageUpload.uploaded")', "translate"),
    '"Profile photo removed"': ('translate("builder.imageUpload.removed")', "translate"),
    '"Failed to process image"': ('translate("builder.imageUpload.processFailed")', "translate"),
    '"No local resumes could be imported"': (
        'translate("cloudImport.toasts.noneImported")',
        "translate",
    ),
    '"Failed to import resumes"': ('translate("cloudImport.toasts.failed")', "translate"),
}


def flatten(obj: dict, prefix: str = "") -> dict[str, str]:
    out: dict[str, str] = {}
    for key, value in obj.items():
        path = f"{prefix}.{key}" if prefix else key
        if isinstance(value, dict):
            out.update(flatten(value, path))
        else:
            out[path] = value
    return out


def build_catalog_replacements() -> dict[str, tuple[str, str]]:
    catalog_path = ROOT / "i18n/locales/en-US.json"
    catalog = json.loads(catalog_path.read_text())
    flat = flatten(catalog)
    extra: dict[str, tuple[str, str]] = {}
    for key, value in flat.items():
        if not isinstance(value, str) or "{{" in value:
            continue
        quoted = json.dumps(value)
        if quoted not in REPLACEMENTS and quoted not in extra:
            extra[quoted] = (f't("{key}")', "component")
    return {**extra, **REPLACEMENTS}


def ensure_import(content: str, kind: str, rel_depth: int) -> str:
    if kind == "translate":
        imp = 'import { translate } from "../i18n/translate";'
        if 'from "../i18n/translate"' in content or "from '../i18n/translate'" in content:
            return content
        # depth adjust for stores vs lib
        if "/stores/" in str(rel_depth):
            imp = 'import { translate } from "../i18n/translate";'
        elif "/lib/" in str(rel_depth):
            imp = 'import { translate } from "../i18n/translate";'
        elif "/api/" in str(rel_depth):
            imp = 'import { translate } from "../i18n/translate";'
        elif "/hooks/" in str(rel_depth):
            imp = 'import { translate } from "../i18n/translate";'
        return imp + "\n" + content

    if kind == "component":
        if "useI18n" in content:
            return content
        # compute relative path to i18n
        return content  # handled per-file manually for import path

    return content


def migrate_file(path: Path, replacements: dict[str, tuple[str, str]]) -> bool:
    original = path.read_text()
    content = original
    changed = False
    needs_component = False
    needs_translate = False

    for old, (new, kind) in sorted(replacements.items(), key=lambda x: -len(x[0])):
        if old in content:
            content = content.replace(old, new)
            changed = True
            if kind == "component":
                needs_component = True
            elif kind == "translate":
                needs_translate = True

    if not changed:
        return False

    if needs_translate and 'from "../i18n/translate"' not in content:
        # pick import depth
        rel = path.relative_to(ROOT)
        parts = len(rel.parts) - 1
        prefix = "/".join([".."] * parts)
        imp = f'import {{ translate }} from "{prefix}/i18n/translate";\n'
        content = imp + content

    if needs_component and "useI18n" not in content:
        rel = path.relative_to(ROOT)
        parts = len(rel.parts) - 1
        prefix = "/".join([".."] * parts)
        imp = f'import {{ useI18n }} from "{prefix}/i18n";\n'
        if f'from "{prefix}/i18n"' not in content:
            content = imp + content
        # inject const { t } = useI18n(); into first function component
        if "const { t } = useI18n()" not in content:
            content = re.sub(
                r"(export (?:default )?function \w+\([^)]*\) \{)\n",
                r"\1\n  const { t } = useI18n();\n",
                content,
                count=1,
            )
            content = re.sub(
                r"(export function \w+\([^)]*\) \{)\n",
                r"\1\n  const { t } = useI18n();\n",
                content,
                count=1,
            )

    if content != original:
        path.write_text(content)
        return True
    return False


def main() -> None:
    replacements = build_catalog_replacements()
    skip = {"i18n", "test", "wasm", "vite-env.d.ts"}
    count = 0
    for path in ROOT.rglob("*"):
        if path.suffix not in {".ts", ".tsx"}:
            continue
        if any(part in skip for part in path.parts):
            continue
        if migrate_file(path, replacements):
            count += 1
            print(f"migrated: {path.relative_to(ROOT)}")
    print(f"done: {count} files")


if __name__ == "__main__":
    main()
