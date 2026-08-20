import pytest

from lp_processor.store import Store


def test_processor_cannot_set_verified() -> None:
    store = Store(client=object())  # type: ignore[arg-type]
    with pytest.raises(ValueError, match="never mark"):
        store.set_status("00000000-0000-0000-0000-000000000000", "00000000-0000-0000-0000-000000000000", "VERIFIED")
