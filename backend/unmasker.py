class TorClearnetUnmasker:
    GATEWAY_SUFFIXES = [".onion.ws", ".onion.pet", ".onion.ly"]

    def unmask(self, raw_url: str) -> Dict[str, Any]:
        # Favicon mmh3 Shodan hash + Apache /server-status + SSL SAN extraction
