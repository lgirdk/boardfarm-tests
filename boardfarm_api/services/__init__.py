"""Business logic layer — the verbs of the application.

Services orchestrate ai_engine/, integrations/, and db/ to fulfill
user actions. Each service is a module (file), not a class — plain
functions that take a db session and return results.

Dependency rule: services/ may import from ai_engine/, integrations/,
db/, and core/. Never from api/ (services don't know about HTTP).

Modules:
    auth        login(), create_user(), verify_token()
    # Future:
    # codegen    generate_test() — delegates to ai_engine
    # test_catalog  list_tests(), search(), get_health()
    # runs       create_run(), dispatch(), poll_status()
    # artifacts  save_draft(), publish(), update_content()
    # environments  create_env(), validate(), list()
    # schedules  create_schedule(), next_fire(), trigger()
    # jira       connect(), disconnect(), search_tickets()
    # analyzer   analyze_log() — delegates to ai_engine
"""
