# Boardfarm Environment Config Generator

Generates `env_config.json` files for boardfarm test runs from model specs.

## How It Works

1. **Model spec** (`profiles/<model>/spec.json`) — defines what a device model CAN do (max env)
2. **User requirements** (template or LLM) — specifies what a test NEEDS (subset)
3. **Generator** — validates requirements ⊆ capabilities, prunes spec to needs, outputs `env_config.json`

## Quick Start

```bash
# 1. Generate a fillable template from the model spec
python generate_template.py --spec profiles/demo_device

# 2. Fill the template (edit the YAML)
# 3. Generate env_config from the filled template
python generate_env.py --template filled.yaml --spec profiles/demo_device

# Or: use LLM to fill from test steps
python generate_env.py --steps "Step 1: SNMP walk. Step 2: Verify dual mode" \
  --spec profiles/demo_device --llm anthropic
```

## Creating a Model Spec

Copy `profiles/demo_device/spec.json` and customize for your device.

The spec IS a valid `environment_def` with all features enabled to the max. Annotations:
- `"a|b|c"` — enum field, one of these values
- `"__user__"` — value provided at runtime (boot_file, image_uri, etc.)
- Array length = max supported (4 `lan_clients` = max 4)
- Key present = model supports it. Key absent = not supported.
- Fixed values are included as-is.

## Commands

| Command | Description |
|---------|-------------|
| `generate_template.py --spec <dir>` | Generate fillable YAML template |
| `generate_env.py --template <yaml> --spec <dir>` | Generate env_config from filled template |
| `generate_env.py --steps "..." --spec <dir> --llm anthropic` | Generate env_config via LLM |
| `generate_env.py --steps "..." --spec <dir> --show-prompt` | Show LLM prompt (debug) |
| Add `--env-req` to any generate_env command | Also output `@pytest.mark.env_req` dict |
| Add `--output file.json` | Write to file instead of stdout |

## File Structure

```
env_generator/
├── profiles/
│   └── demo_device/
│       └── spec.json          # Model spec (annotated max env)
├── generate_template.py       # Spec → fillable YAML template
├── generate_env.py            # Template/LLM → env_config.json
└── README.md
```
