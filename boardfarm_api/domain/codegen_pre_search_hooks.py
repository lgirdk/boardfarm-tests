"""Pre-search hooks: inject entries based on input analysis and matched skills."""

from boardfarm_api.ai_engine.codegen import ForceIncludeEntryHooksRegistry, IncludeEntry

force_inject_hook = ForceIncludeEntryHooksRegistry("pre-search-hooks")


@force_inject_hook.register
def add_all_fixtures(
    analysis: str, input_text: str, *, matched_skills: list[str] | None = None
) -> list[IncludeEntry]:
    """Always inject all fixtures — every test needs device access."""
    return [IncludeEntry.by_category("fixtures")]


@force_inject_hook.register
def skill_driven_includes(
    analysis: str, input_text: str, *, matched_skills: list[str] | None = None
) -> list[IncludeEntry]:
    """Inject category-specific entries that search may miss.

    Only force-includes what's genuinely CORE to the category and at risk
    of search not finding it. Search handles the rest.

    Criteria for inclusion:
    - Function appears in 80%+ of tests in the category (co-occurrence data)
    - OR function is in a non-obvious category (lib_utils, other) that
      search won't prioritize for the test's intent
    """
    breakpoint()
    if not matched_skills:
        return []

    results: list[IncludeEntry] = []

    if "tr069" in matched_skills:
        # GPV+SPV: co-occur in 350/1290 TR-069 tests, but most TR-069 tests
        # use at least one. Search usually finds these, but they're THE core.
        results.append(
            IncludeEntry.by_api_names(
                "get_parameter_values",
                "set_parameter_values",
            ).in_category("use_cases")
        )

    if "voice" in matched_skills:
        # Core call operations — every voice test uses these
        results.append(
            IncludeEntry.by_api_names(
                "call_a_phone",
                "answer_a_call",
                "disconnect_the_call",
                "is_call_connected",
            ).in_category("use_cases")
        )
        # Voice-specific tcpdump (different from networking tcpdump)
        results.append(
            IncludeEntry.by_api_names("tcpdump").in_category("use_cases")
        )
        # SIP trace parsing is in lib_utils — search may miss it because
        # the analysis talks about "SIP verification" not "lib_utils"
        results.append(
            IncludeEntry.by_api_names(
                "parse_sip_trace",
                "is_sip_sequence_matching",
                "is_rtp_trace_found",
                "is_rtp_trace_not_found",
            ).in_category("lib_utils")
        )

    if "snmp" in matched_skills:
        # Tightly coupled — SNMP tests use these as a unit
        results.append(
            IncludeEntry.by_api_names(
                "snmp_walk",
                "snmp_get",
                "snmp_set",
                "get_mib_oid",
            ).in_category("use_cases")
        )

    if "sw_update" in matched_skills:
        # Build preparation — every SW update test needs these regardless
        # of trigger path (SNMP vs TR-069). Search finds the trigger functions.
        results.append(
            IncludeEntry.by_api_names(
                "ensure_current_build_is_on_server",
                "ensure_update_build_is_on_server",
            ).in_category("use_cases")
        )

    if "wifi" in matched_skills:
        # The connection chain — analysis says "connect to WiFi" but
        # won't mention get_ssid/get_passphrase explicitly
        results.append(
            IncludeEntry.by_api_names(
                "get_ssid",
                "get_passphrase",
                "connect_wifi_client",
                "is_wifi_connected",
            ).in_category("use_cases")
        )

    if "ssam" in matched_skills:
        results.append(
            IncludeEntry.by_api_names(
                "enable_via_tr_069",
                "disable_via_tr_069",
                "check_ssam_params_via_tr_069",
                "is_blocked_by_ssam",
            ).in_category("use_cases")
        )

    if "telemetry" in matched_skills:
        # Enable/disable + URL getter — the core trio.
        # Status/log functions are specific and search finds them.
        results.append(
            IncludeEntry.by_api_names(
                "enable_telemetry_via_tr069",
                "disable_telemetry_via_tr069",
                "get_dcm_config_file_url",
            ).in_category("use_cases")
        )

    if "reverse_ssh" in matched_skills:
        # This is the entire reverse SSH API — small and self-contained
        results.append(
            IncludeEntry.by_api_names(
                "reverse_ssh_enabled_via_tr069",
                "get_reverse_ssh_status",
                "is_rssh_to_cpe_from_jumpserver_successful",
            ).in_category("use_cases")
        )

    # ---- Cross-cutting: keyword-driven, not skill-driven ----
    text = (analysis + " " + input_text).lower()

    # Packet capture pair (361 co-occurrences in corpus)
    if any(kw in text for kw in ("tcpdump", "packet capture", "pcap")):
        results.append(
            IncludeEntry.by_api_names(
                "tcpdump_on_device",
                "copy_pcap_to_artifacts",
            ).in_category("use_cases")
        )

    # Tshark parsing — only when tshark explicitly mentioned
    if "tshark" in text:
        results.append(
            IncludeEntry.by_api_names("parse_pcap_via_tshark").in_category("use_cases")
        )

    # Post-reboot verification chain (317 co-occurrences in corpus)
    if any(kw in text for kw in ("reboot", "factory reset", "power cycle", "restart", "comes back online", "board comes online")):
        results.append(
            IncludeEntry.by_api_names(
                "wait_for_board_boot_start",
                "is_board_online_after_reset",
                "verify_erouter_ip_address",
            ).in_category("use_cases")
        )

    if "factory reset" in text or "factory_reset" in text:
        results.append(
            IncludeEntry.by_api_names("factory_reset").in_category("use_cases")
        )

    if "power cycle" in text or "power_cycle" in text:
        results.append(
            IncludeEntry.by_api_names("power_cycle").in_category("use_cases")
        )

    return results
