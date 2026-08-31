# """This module create code using nay framwork as the ap abstractinos lyer nd ando uses the stub registry and the serach engine o serch
# ll tehe related code apis that are present in that framework thiss module dont deal with any implemented code

# The idea is basecally it is provided will a struchtured parsed frmework abreacted and categorised api documenttinos
# so that it can work on teh sam without even thinking or knowing baout the implemetatinos .. thi modeule do write usint test for the
# implementatinos . it uses a framword concs(gain these are structured and registerd vi the stubregistry) to seach and use wrie code
# using the smr .. this modeue hse resong on teh tak provided and should get a domain context formt eh framwork and a framework rules
# which define how the code should be write the stylingand other improtant aspec . tse will be direcctly injected tot eh promtps
# hence be carefull writing those """


# so wht this codegen does


# the whole idea is like  this write whatever asked using the framwork provided and lso pyr pytho for now .
# now  so how this entire project oporatethe search_store is just a registry and utiliies and seach thigs  `but the agent the codegen
# workss like this  ::-- the core ida is whn we implemnt using ny framework boardfarm or djngo or dydanti ,, they actualy have what
# pi layer we dnt cre wht else they have insie implemente d we just want the functinos or the pi layer name to understand what it does `
# so to put it in putr context it bsiclaly saying thatthe stub_index is kind of a framework aware structured documentatinos that
# we index and then search it nd provide the llm in teh context .. now the catedories are framework thing .. so if i use pydantic i will categorixe all the validatinos rlted things in one specific way
# call as validations , similary we do it for usecse .. now note and think oreectly me if wrong the categories are actuly how logically we write the documentatinos wrt ????? its a questinos
# we never wrt thing in relatino to the repo name or smtng so teh categoriztinos that the frame work provide is basically it ..
# now this thime i am creating the entire structure from the stub index which si basically a structure coddumentatinos .. i can lso get the at from a pure doc file and then structure it and can pass it to this machine coge as well and the registry it will inderstnd correct ???
# so in this context our codegen or the registry is perfectly lligned wrt  ???  revisit nd verifybthis
# if this is done then the categoies and how to use those categories because the prompts are also framework aware prompts the rule asn sometime s the system prompts we cn actully write how to understnd dnuse those things in the ode its a knowledge
# aprt from this we cn lso allow the code aget to invode intermitent hooks that the cutome code for the frame work can tap into and run to perform some actoion
# nowte these thing are done because i belive the framewrk can use these are reduce the searching the context creatinos better ...(here lso do you thsi the context assemly should be done by the frmework atgeted hooks or things .. think and tell me deeply )
# thos hence the system use prompts the varianbl we will be give it should have thos variables may be per model nad the systm canbe customizwwd bsed on the framwork ? this is a querinos i am also asking

# DEEPLY THINK LL THESE THIGS . I NEED YOU TO UNDERSTAND AND THEN EVALUATE WHAT EVER I SAIED IS IT ALLIGNNING TO WHAT WE HAVE BUILD ?? GO THORH TH ECODE AND THE DISCUSSINOS ..
# OR THERE ARE DEVIATINOS . WENNED TO CHECK THE  INTENT IDENTIFY AND DO THINKBASED ON THAT AND MAY BE BRANSTORM AND ASK OURSELF THE QIESITNOS RE LATED TO THESE POINTS AND THE POINT I MISSED .
# HOW THINK AND TEL ME


# for this ypi re not getting one point if i wnat to make thigs work across models then wrt now if you go a check the prompts you can clearly se w are actually using the nmes luke usecase and some domain intnded directinos in teh system prompt it self and the user prompt itself except the only logic keep and remove .  so i was thinking  the code gen which onboarding a framworks creates completly separateprmt for it  abd then startstunig theose .. the internal parameter injected to it vi the serach proms remain the same for all the frameworks the format parameter wrt  ? its just the workings and som theing that shine  int eh system and bringing that idea of things . like pytst or create robots framework or jsut write some things using this python .. youy getting it  ???   or i am not making sence

#  what i ws thisnking is like som frmtoek prompts /boardfarm/pytestpromt/  similry osme other promtps adn inside that we have may be for differencet differecent modl

#  or this si too much think and tell me ... dont get biased ..


# PromptKey = tuple[PromptVariant, PromptStage, str]   # (variant, stage, task)

# class PromptRegistry:
#     def __init__(self):
#         self._prompts: dict[PromptKey, PromptPair] = {}

#     def register(self, variant: PromptVariant, stage: PromptStage,
#                  task: str, pair: PromptPair) -> None:
#         validate_placeholders(stage, pair)            # against STAGE_VARIABLES
#         self._prompts[(variant, stage, task)] = pair

#     def resolve(self, variant: PromptVariant, stage: PromptStage,
#                 task: str) -> PromptPair:
#         # exact → base-task fallback
#         for key in ((variant, stage, task), (variant, stage, "base")):
#             if key in self._prompts:
#                 return self._prompts[key]
#         raise PromptNotFound(variant, stage, task)

from .data_models import (
    CodegenDomainSetup,
    CodegenPromptPair,
    DynamicRule,
    DynamicRulesRegistry,
    ForceIncludeEntryHooksRegistry,
    IncludeEntry,
    PostSearchEntryHooksRegistry,
    PromptRegistry,
)
from .enums import CodegenOutputType, CodegenPromptStage, CodegenPromptVariant
from .protocols import ForceIncludeEntryHook, PostSearchEnricherHook

__all__ = [
    # Protocols
    "ForceIncludeEntryHook",
    "PostSearchEnricherHook",
    # Data Models
    "CodegenPromptPair",
    "CodegenDomainSetup",
    "DynamicRule",
    "DynamicRulesRegistry",
    "PromptRegistry",
    "IncludeEntry",
    "ForceIncludeEntryHooksRegistry",
    "PostSearchEntryHooksRegistry",
    # Enums
    "CodegenPromptStage",
    "CodegenPromptVariant",
    "CodegenOutputType",
]
