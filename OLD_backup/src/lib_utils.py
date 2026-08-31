from __future__ import annotations
import re

def split_frontmatter(skill_content: str) -> tuple[str, str]:
    """Split a SKILL.md file's content into its YAML frontmatter and body.

    Expects content of the form:
        ---
        <yaml frontmatter>
        ---
        <markdown body>

    This does NOT parse the YAML — it only extracts the raw frontmatter
    string. Pass the header through yaml.safe_load() separately to get
    a dict.

    Args:
        skill_content: Full raw text of a SKILL.md file.

    Returns:
        A (header, body) tuple:
          - header: raw YAML text between the --- delimiters (unparsed)
          - body: everything after the closing --- delimiter, stripped

    Raises:
        ValueError: If skill_content has no valid --- frontmatter block.
    """
    match = re.match(r"^---\s*\n(.*?)\n---\s*\n(.*)$", skill_content, re.DOTALL)
    if not match:
        raise ValueError("No valid YAML frontmatter found (expected '---' delimiters)")

    header, body = match.group(1), match.group(2)
    return header, body.strip()