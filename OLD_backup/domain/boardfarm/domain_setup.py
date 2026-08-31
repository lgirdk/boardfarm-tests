from pathlib import Path

from boardfarm_api.ai_engine.codegen import CodegenDomainSetup

codegen_setup = CodegenDomainSetup(name="boardfarm")

from .codegen_pre_search_hooks import force_inject_hook

_DIR = Path(__file__).parent

# Static knowledge (injected into reasoning and codegen prompts)
codegen_setup.set_domain_knowledge(
    (_DIR / "knowledge" / "reasoning_prompt_knowledge.md").read_text(encoding="utf-8")
)
codegen_setup.set_framework_rules(
    (_DIR / "knowledge" / "base_framework_rule.md").read_text(encoding="utf-8")
)

# Dynamic rules — category-specific rules selected per test by the LLM selector
codegen_setup.register_dynamic_rules(_DIR / "codegen_rule_skills")

# Pre/post-search hooks
codegen_setup.register_hook_instance(force_inject_hook)
