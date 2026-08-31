class CodegenException(Exception):
    """Exception from the codegen."""


class CallbackException(Exception):
    """Rised when a callback donot follow the intended protocol."""


class IncludeEntryConfigChainError(Exception):
    """Exception haappens when the Include entry is wrongly build."""


class ProtocolException(Exception):
    """Raised when protocol verification fails and validations don't match."""

class RuleNameCollision(Exception):
    """Raise when the rule names provided collides with another."""