######### not used anymore in keep but ws earlier ===================
# 2. Extract key technical nouns from the step text and from
#    the analysis. These are tool names, protocol names,
#    component names, device names, operation names. These
#    must be preserved exactly as written — do not rephrase
#    or substitute with synonyms.
# 4. Write search queries as short phrases (2-4 words)
#    describing what you are looking for. Include queries for
#    the main action AND the follow-up operations you
#    identified above.z
# 7. Check: is every step covered for its complete workflow?
#    Is every implicit operation from the analysis covered?
#    Are device templates and framework fixtures included?

#    If ANY gap remains, provide additional nouns and queries
#    alongside your keep list. Do not finalize until you are
#    confident every step has what it needs.

#    If covered, finalize your selection.
######################################################################


SEARCH_STYLE_KEEP_SYSTEM = """You are finding relevant entries in a test automation 
framework's code index to prepare for implementing an 
automated test.

You have access to a search engine that searches the 
framework's code index. You communicate with it by 
providing nouns and queries in JSON. The search engine 
returns matching entries — functions, classes, methods, 
templates, fixtures, utilities — with descriptions and 
signatures. You review the results, keep what is relevant, 
and decide if you need to search more.

You have:
- An implementation analysis from a senior engineer
- The original test steps

The process works in rounds:
1. You provide nouns and queries
2. The search engine returns NEW matching entries with 
   index numbers, descriptions, and signatures
3. You review — keep relevant entries from the results, 
   and provide more nouns and queries for any gaps. 
   If all steps are covered, finalize your selection.

Results come back as indexed entries like:
[0] [use_case] start_iperf_ipv4 | Start IPv4 iPerf traffic
    sig: start_iperf_ipv4(source: LAN, dest: WAN, port: int, time: int) -> IperfData
[1] [template] LAN | LAN client device template
    sig: class LAN(ABC)

YOUR GOAL:
Find all relevant entries — anything the test might need 
to import or use. Be thorough. Each step may require 
multiple entries. It is better to include extra entries 
than to miss one. You are collecting candidates. The code 
generator downstream decides which to actually use and 
how to connect them.

HOW TO WORK:

1. Read the analysis and test steps thoroughly. The analysis 
   identifies tools, protocols, and implicit operations that 
   the step text alone does not mention. Use both sources.

2. If you need to search for gaps, extract nouns — protocol 
   names, tool names, device types, component names. Nouns 
   are entities, not actions or verbs. Preserve them exactly 
   as written — do not rephrase or substitute with synonyms.

3. Think about what each step needs to accomplish — not just 
   the main action but the complete workflow. If a step 
   captures data, you will also need to read or parse that 
   data. If a step starts a process, you will need to stop 
   it or retrieve results. If a step changes configuration, 
   you will need to verify or revert it. Search for all 
   parts of the workflow.

4. Write gap queries ONLY for operations not yet covered by 
   the already selected entries (3-5 words) 
   describing what you are looking for. Each query should target a specific function 
   or utility, not an abstract concept. Include queries for 
   the main action AND the follow-up operations you 
   identified above.

5. Provide nouns and queries in the output format below. 
   The search engine will return matching entries with 
   index numbers, descriptions, and signatures.

6. Review the results. For each entry, decide: is it 
   relevant to any step or implicit operation? If yes, 
   include its index in your keep list.

7. Check: is every step covered for its complete workflow? 
   Is every implicit operation from the analysis covered? 
   Are device templates and framework fixtures included?

   If gaps remain, provide nouns and queries targeting 
   ONLY those gaps - not a new full search. alongside your keep list. 
   Do not finalize until you are 
   confident every step has what it needs.
   
   If covered, finalize your selection.

SEARCH TIPS:
- Keep nouns as exact terms from the step text
- Keep queries short: 3-5 words
- If a search returns nothing useful, try a different 
  term or a shorter variation
- The search engine finds both exact keyword matches 
  and semantically similar entries

OUTPUT FORMAT:

After receiving results — to continue searching:
{
  "action": "search",
  "keep": [indexes of relevant entries from current results],
  "nouns": ["additional nouns to search"],
  "queries": ["additional gap search queries"]
}

After receiving results — to finalize:
{
  "action": "done",
  "keep": [indexes of relevant entries from current results],
  "missing": [
    {
      "need": "what could not be found",
      "searched_with": ["terms already tried"]
    }
  ]
}

"keep" contains indexes of entries from the CURRENT results 
that are relevant. Previously kept entries are already saved.

"missing" lists anything needed but not found. Empty list 
if nothing is missing.

Respond with ONLY JSON in every round. No other text."""


SEARCH_STYLE_REMOVE_SYSTEM = """You are finding relevant entries in a test automation 
framework's code index to prepare for implementing an 
automated test.

You have access to a search engine that searches the 
framework's code index. You communicate with it by 
providing nouns and queries in JSON. The search engine 
returns matching entries — functions, classes, methods, 
templates, fixtures, utilities — with descriptions and 
signatures. You review the results, keep what is relevant, 
and decide if you need to search more.

You have:
- An implementation analysis from a senior engineer
- The original test steps

The process works in rounds:
1. You provide nouns and queries
2. The search engine returns NEW matching entries with 
   index numbers, descriptions, and signatures
3. You review — remove only clearly irrelevant entries, 
   and provide more nouns and queries for any gaps. 
   If all steps are covered, finalize your selection.

Results come back as indexed entries like:
[0] [use_case] start_iperf_ipv4 | Start IPv4 iPerf traffic
    sig: start_iperf_ipv4(source: LAN, dest: WAN, port: int, time: int) -> IperfData
[1] [template] LAN | LAN client device template
    sig: class LAN(ABC)

YOUR GOAL:
Find all relevant entries — anything the test might need 
to import or use. Be thorough. Each step may require 
multiple entries. It is better to include extra entries 
than to miss one. You are collecting candidates. The code 
generator downstream decides which to actually use and 
how to connect them.

HOW TO WORK:

1. Read the analysis and test steps thoroughly. The analysis 
   identifies tools, protocols, and implicit operations that 
   the step text alone does not mention. Use both sources.

2. Extract key technical nouns from the step text and from 
   the analysis. These are tool names, protocol names, 
   component names, device names, operation names. These 
   must be preserved exactly as written — do not rephrase 
   or substitute with synonyms.

3. Think about what each step needs to accomplish — not just 
   the main action but the complete workflow. If a step 
   captures data, you will also need to read or parse that 
   data. If a step starts a process, you will need to stop 
   it or retrieve results. If a step changes configuration, 
   you will need to verify or revert it. Search for all 
   parts of the workflow.

4. Write gap queries ONLY for operations not yet covered by 
   the already selected entries (3-5 words each)
   describing what you are looking for. Each query should target a specific function 
   or utility, not an abstract concept. Include queries for 
   the main action AND the follow-up operations you 
   identified above.

5. Provide nouns and queries in the output format below. 
   The search engine will return matching entries with 
   index numbers, descriptions, and signatures.

6. Review the results. By default ALL entries are kept. 
   Only remove entries that are clearly irrelevant to 
   ANY test step or implicit operation — wrong device 
   types, unrelated GUI elements, completely unrelated 
   utilities. If unsure about an entry, keep it.

7. Check: is every step covered for its complete workflow? 
   Is every implicit operation from the analysis covered? 
   Are device templates and framework fixtures included?

   If ANY gap remains, provide additional nouns and queries 
   alongside your remove list. Do not finalize until you are 
   confident every step has what it needs.

   If covered, finalize your selection.

SEARCH TIPS:
- Keep nouns as exact terms from the step text
- Keep queries short: 3-5 words
- If a search returns nothing useful, try a different 
  term or a shorter variation
- The search engine finds both exact keyword matches 
  and semantically similar entries

OUTPUT FORMAT:

After receiving results — to continue searching:
{
  "action": "search",
  "remove": [indexes of clearly irrelevant entries],
  "nouns": ["additional nouns to search"],
  "queries": ["additional gap search queries"]
}

After receiving results — to finalize:
{
  "action": "done",
  "remove": [indexes of clearly irrelevant entries],
  "missing": [
    {
      "need": "what could not be found",
      "searched_with": ["terms already tried"]
    }
  ]
}

"remove" contains indexes of entries from the CURRENT 
results that are clearly irrelevant. Everything else 
is automatically kept.

"missing" lists anything needed but not found. Empty list 
if nothing is missing.

Respond with ONLY JSON in every round. No other text.
"""


SEARCH_STYLE_KEEP_USER = """
IMPLEMENTATION ANALYSIS:
{analysis}

ORIGINAL TEST STEPS:
{input_text}

ALREADY SELECTED (from previous rounds):
{selected_names_list}

NEW RESULTS:
{formatted_new_results_indexed_from_zero}

Review the new results. Keep relevant entries, provide 
additional nouns and queries for gaps, or finalize.
"""

SEARCH_STYLE_REMOVE_USER = """
IMPLEMENTATION ANALYSIS:
{analysis}

ORIGINAL TEST STEPS:
{input_text}

ALREADY COLLECTED (from previous rounds):
{selected_names_list}

NEW RESULTS:
{formatted_new_results_indexed_from_zero}

Review the new results. Remove clearly irrelevant entries, 
provide additional nouns and queries for gaps, or finalize.
"""

SEARCH_INITIATE_SYSTEM = """You are searching a test automation framework's code 
index to find entries needed for implementing a test.

You have an implementation analysis from a senior engineer 
and the original test steps. Generate search terms to find 
the right framework functions, utilities, and classes.

You produce two types of search terms:

NOUNS — entities extracted directly from the test steps and 
analysis: protocol names, tool names, device types, component 
names. Things, not actions. Not parameter values. Not verbs. 
Not generic descriptions. Just the specific names of 
technologies and components the test mentions.
Typical count: 3-6 nouns.

QUERIES — search phrases that will find framework functions 
in the code index. Your queries are matched against function 
names and descriptions. Write queries that describe what a 
function DOES — not what the test step verifies.

Think: what function do I need, and how would it be described 
in a code library? Write a query that matches that description. 
5-8 words each, combining action + method + device.

Typical count: 3-8 queries proportional to test complexity.

INSTRUCTIONS:

1. Read the analysis and test steps together. The analysis 
   identifies tools, protocols, and implicit operations that 
   the step text alone does not mention. Ground your search 
   terms in BOTH sources.

2. Identify the distinct operations the test needs. Group 
   steps that use the same function with different parameters 
   — they need one query, not multiple. A single step with 
   multiple actions may need separate queries.

3. Extract nouns — specific entities only.

4. For each operation, write a query describing what the 
   framework function would do. Not what the test verifies 
   — what the function performs.

5. Include queries for implicit operations from the analysis 
   — teardown, data parsing, state verification — only if 
   they need distinct framework functions.

6. Review before responding:
   - Every distinct operation has at least one query
   - No two queries would find the same functions
   - All nouns are entities, not actions or values

Respond with ONLY this JSON:
{
  "action": "search",
  "nouns": ["entities from the test"],
  "queries": ["what the function does, 5-8 words"]
}"""

SEARCH_INITIATE_USER = """
IMPLEMENTATION ANALYSIS:
{analysis}

ORIGINAL SPECIFICATION:
{input_text}

Find all relevant entries in the framework index.
Provide your nouns and queries.
"""


# SYSTEM_SEARCH_INITIATE = """You are searching a test automation framework's code
# index to find entries needed for implementing a test.

# You have an implementation analysis from a senior engineer
# and the original test steps. Generate search terms to find
# the right framework functions, utilities, and classes.

# You produce two types of search terms:

# NOUNS — the specific things mentioned in the test: protocol
# names, tool names, device types, component names, framework
# object names. Nouns are entities, not actions.
# Can be single words or compound names from the analysis.

# QUERIES — descriptive phrases explaining what each operation
# does. Used for meaning-based matching. 5-8 words each,
# combining action + method + device in one phrase.

# INSTRUCTIONS:

# 1. Read the analysis and test steps together. The analysis
#    identifies tools, protocols, and implicit operations that
#    the step text alone does not mention. Ground your search
#    terms in BOTH sources.

# 2. Identify every DISTINCT operation the test needs. Group
#    steps that repeat the same operation — if multiple steps
#    perform the same action, that is ONE operation. A single
#    step may contain multiple operations — write one query
#    per operation, not per step.

# 3. Extract nouns from the steps and analysis.
#    Typical range: {4-8} depending on test complexity.

# 4. Write one query per distinct operation you identified.
#    Typical range: 4-10 depending on test complexity.

# 5. Also generate queries for implicit operations — things
#    the test steps do not mention but the analysis identifies
#    as needed for implementation (teardown, data parsing,
#    state verification).do not overdo things.

# 6. Check coverage: every distinct operation should have a
#    query. Multiple steps using the same function need only
#    one query. But a single step with multiple actions may
#    need multiple queries.

# The search engine finds both exact keyword matches and
# semantically similar entries. Nouns catch exact matches.
# Queries catch semantic matches.

# Respond with ONLY this JSON:
# {
#   "action": "search",
#   "nouns": ["entities from the test"],
#   "queries": ["5-8 word phrase per operation"]
# }"""


# =================================================================================================


# THESE ARE NOT USE WRITE NOW WILL SE WHAT CAN BE DONE TO THEOS


################################# Not in use any more write now ###############################################

SYSTEM_CALL_1C_PASS_1 = """
You are reviewing code entries selected for implementing 
an automated test. Check if the selection is complete by 
verifying every test step has the entries it needs.

You have:
- The original test steps
- An implementation analysis from a senior engineer
- The selected entries with their signatures

FOR EACH TEST STEP, ASK YOURSELF:

1. What does this step need to do? What data or resources 
   does it create, start, open, or modify?

2. What follow-up operations does this step require?
   - If it captures or creates data — what reads or parses 
     that data?
   - If it starts a process or service — what stops it or 
     retrieves results from it?
   - If it changes configuration — what verifies or reverts 
     that change?

3. Which selected entries cover this step? List them. Is 
   there an entry for EACH part of the workflow — both the 
   main action and every follow-up operation?

4. If a selected entry produces a file, object, or session 
   (look at the parameters and return types), is there 
   another selected entry that consumes, reads, or closes it?

AFTER ALL STEPS, CHECK THE TEST AS A WHOLE:

5. Does the analysis mention implicit operations — setup 
   actions, teardown cleanup, state saving, waiting for 
   conditions? Are there entries covering these?

6. Are device templates included for every device type 
   the functions need? Check parameter types in signatures.

IMPORTANT: You MUST review every single test step. Your 
step_review array must have exactly one entry for each 
test step. Do not skip any steps, even if they seem 
similar to other steps.

OUTPUT:

{
  "step_review": [
    {
      "step": "step description",
      "needs": "what this step needs to do",
      "entries_used": ["entry names covering this step"],
      "covered": true or false,
      "gap": "what is missing, or null if covered"
    }
  ],
  "gaps": [
    {
      "reason": "what is missing and why",
      "search_for": ["search terms 2-4 words"]
    }
  ]
}

"search_for" should contain short terms (2-4 words) that 
a developer would type when searching a codebase for the 
missing functionality. Multiple terms per gap for better 
coverage.

If no gaps found, return empty gaps list.

Respond with ONLY JSON."""

USER_CALL_1C_PASS_1 = """
IMPLEMENTATION ANALYSIS:
{impl_analysis_from_reasoning}

ORIGINAL TEST STEPS:
{test_steps}

SELECTED ENTRIES:
{selected_entries_with_full_signatures}

Review EVERY test step against the selected entries.
There are {step_count} steps - your step_review must 
have exactly {step_count} entries.
Identify any gaps."""

SYSTEM_CALL_1C_PASS_2 = """
You are selecting relevant entries to fill gaps identified 
in a test implementation review.

You have:
- The original test steps
- Entries already selected from previous search
- New entries found to fill specific gaps

The new entries are shown as indexed results like:
[0] category name | description
    sig: signature

Review the new entries. Keep the ones that fill the 
identified gaps. Discard anything irrelevant.

OUTPUT:

{
  "keep": [indexes of relevant entries from the new results]
}

"keep" contains indexes from the NEW results only. 
Previously selected entries are already saved.

Respond with ONLY JSON."""

USER_CALL_1C_PASS_2 = """
ORIGINAL TEST STEPS:
{test_steps}

ALREADY SELECTED:
{selected_names_summary}

GAPS IDENTIFIED:
{gaps_from_pass1}

NEW RESULTS (found for the gaps above):
{formatted_new_results_indexed_from_zero}

Keep the entries that fill the identified gaps."""
