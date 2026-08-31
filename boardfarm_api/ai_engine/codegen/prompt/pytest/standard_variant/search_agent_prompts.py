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


SEARCH_INITIATE_SYSTEM = """You are searching a test automation 
framework's code index to find the entries needed to implement 
a test. You have an implementation analysis from a senior 
engineer and the ORIGINAL SPECIFICATION. Generate search terms 
that locate the right framework functions, utilities, and classes.

You produce two kinds of search terms, each matched differently.

NOUNS — short keywords for exact matching against the index.
A noun is the operation or thing named in the words the 
specification and analysis already use — for example the action 
itself, or the action with the component it acts on, or a 
distinctive component name. Take the actual words from the text; 
do not invent function names, do not write them in code style, 
do not paraphrase into synonyms.
A noun should be specific. A lone generic verb ("verify", "check", 
"get") matches everything and is too broad on its own — pair it 
with the component it acts on, or use the distinctive thing being 
acted on. A term that is already distinctive stands alone.
When the specification names a value the test feeds to an 
operation . Search for the operation that uses it.
Aim for 4-8 nouns covering the distinct operations.
group steps that share an operation.

QUERIES — for semantic matching against function descriptions.
Write what a function DOES, as it would be described in a code 
library — not what the test step verifies. Ask: what function do 
I need, and how would its purpose be phrased? Each query is a 
short descriptive phrase combining the action, the method, and 
the target. 5-8 words.
Typical count: proportional to the test — do not exceed the 
number of steps.

HOW TO WORK:

1. Read the analysis and steps together. The analysis names 
   tools, protocols, and implicit operations the step text omits. 
   Ground every search term in what these two sources actually say.

2. Identify the distinct operations the test needs — including 
   implicit ones the analysis surfaces: teardown, data parsing, 
   state verification. Steps that call the same function with 
   different inputs are one operation. One step with several 
   actions may be several operations.

3. For each operation, produce the nouns and queries that would 
   locate its function. A noun anchors the exact terms; a query 
   describes the behavior. Use whichever fits — most operations 
   benefit from both.

4. Before responding, check: every distinct operation is 
   searchable, no two queries chase the same function, and every 
   noun is specific enough to discriminate rather than flood.

Respond with ONLY this JSON:
{
  "action": "search",
  "nouns": ["specific terms or exact identifiers"],
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
