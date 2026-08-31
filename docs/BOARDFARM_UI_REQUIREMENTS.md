# Boardfarm-UI — Requirements & Context Index

These documents contain everything needed to build the Boardfarm-UI frontend. They are written for sessions with NO code access — all context is self-contained.

## Documents

### [01_BOARDFARM_FRAMEWORK.md](01_BOARDFARM_FRAMEWORK.md)
Deep understanding of the Boardfarm test framework:
- What boardfarm is, core concepts (boards, beds, inventory, environments)
- Complete JSON examples (inventory ams.json, environment configs)
- How test runs work (reserve → flash → provision → test → release)
- Test structure with env_req markers, fixtures, real code examples
- Test categories (2000+ tests across 12 domains)
- Code generation pipeline architecture
- Team dynamics (shared beds, private drafts, git publishing)

### [02_CURRENT_FRONTEND_UI.md](02_CURRENT_FRONTEND_UI.md)
Exact state of the current frontend implementation:
- Tech stack, architecture, seam pattern
- Complete theme/design tokens (every color, font, spacing, animation)
- Navigation structure (4 sections, 9 entries)
- Screen-by-screen description of every page (Dashboard, Codegen, JiraTicketPicker, Planner, Analyzer, Pipelines, Runs, Run Detail, Available Tests, Drafts, Configuration)
- Client seams with mock/http details
- Routing map
- Architectural rules

### [03_USER_REQUIREMENTS_AND_VISION.md](03_USER_REQUIREMENTS_AND_VISION.md)
What to build — the exact user requirements:
- The vision (single platform for all boardfarm operations)
- 12 explicit requirements (R1-R12) with details
- 6 user corrections from review (C1-C6) — things to NOT do
- 8 discovered enhancements (E1-E8)
- Reference screenshot analysis (what to take, what to ignore)
- Backend integration status (built, mocked, pending)
- "What NOT to do" rules

## How to Use These

1. Read all three documents in order
2. The user will also share screenshots of the current UI and reference prototypes
3. Plan the UI changes thoroughly before writing any code
4. Get explicit approval before starting implementation
5. Always backup before making changes: `cp -r frontend frontend_vN_backup`
