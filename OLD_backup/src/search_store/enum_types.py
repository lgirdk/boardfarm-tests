from enum import StrEnum


class MemberType(StrEnum):
    is_property = "property"
    is_method = "method"


# class CodeCategory(StrEnum):
#     usecase : str =  "use_cases"
#     template:str =  "templates"
#     fixture:str = "fixtures"
#     templates:str = "templates"
#     dataclasses
