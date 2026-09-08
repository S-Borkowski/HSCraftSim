"""Python twin of engine/cpr.js (used by tests to cross-check the JS engine)."""
from __future__ import annotations

import math

CPR_MULTIPLIER = 1789570533.0
CPR_INCREMENT = 465707.0
CPR_MODULUS = 2147483648.0
CPR_MASK = 0x3FFFFFFF
CPR_MAX = 1073741823.0


def cpr_next(state: int) -> int:
    return int(math.fmod(CPR_MULTIPLIER * float(state) + CPR_INCREMENT, CPR_MODULUS)) & CPR_MASK


class Cpr:
    def __init__(self, seed: int):
        self.state = int(seed)
        self.calls = 0

    def irandom(self, upper: int) -> int:
        self.state = cpr_next(self.state)
        self.calls += 1
        return math.floor((float(upper) + 0.99999) * (float(self.state) / CPR_MAX))

    def irandom_range(self, lo: int, hi: int) -> int:
        return lo + self.irandom(hi - lo)
