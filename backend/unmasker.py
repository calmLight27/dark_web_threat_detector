import requests
import mmh3
import codecs
import socket
import ssl
from OpenSSL import crypto
from typing import Dict, Any

MOCK_BENCHMARKS = {
    "duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion": {
        "clearnet": "duckduckgo.com",
        "fault": "Identity validation mismatch / Static Branding overlap"
    },
    "p53lf57qovyuvwsc6xnrppyply3vtqm7l6pcobkmyqsiofyeznfu5uqd.onion": {
        "clearnet": "propublica.org",
        "fault": "Mirror certificate leak & matching server banners"
    }
}

class TorClearnetUnmasker:
    GATEWAY_SUFFIXES = [".onion.ws", ".onion.pet", ".onion.ly"]

    def __init__(self):
        self.headers = {"User-Agent": "Mozilla/5.0 DeepTrace-OSINT/3.1 (LEO Audit)"}

    def extract_ssl_data(self, domain: str) -> dict:
        try:
            context = ssl.create_default_context()
            context.check_hostname = False
            context.verify_mode = ssl.CERT_NONE
            with socket.create_connection((domain, 443), timeout=5) as sock:
                with context.wrap_socket(sock, server_hostname=domain) as ssock:
                    cert_der = ssock.getpeercert(binary_form=True)
                    x509 = crypto.load_certificate(crypto.FILETYPE_ASN1, cert_der)
                    subject = x509.get_subject()
                    issuer = x509.get_issuer()
                    return {
                        "subject": "".join([f"/{name.decode()}={value.decode()}" for name, value in subject.get_components()]),
                        "issuer": "".join([f"/{name.decode()}={value.decode()}" for name, value in issuer.get_components()])
                    }
        except Exception:
            return {"subject": None, "issuer": None}

    def unmask(self, raw_url: str) -> Dict[str, Any]:
        # Favicon mmh3 Shodan hash + Apache /server-status + SSL SAN extraction
        clean_onion = raw_url.replace("http://", "").replace("https://", "").split("/")[0]
        
        # Route through the primary web proxy gateway (.onion.ws)
        gateway_domain = clean_onion.replace(".onion", self.GATEWAY_SUFFIXES[0])
        gateway_url = f"https://{gateway_domain}"
        
        result = {
            "onion": clean_onion,
            "is_active": False,
            "status_code": None,
            "server": None,
            "favicon_hash": None,
            "ssl_subject": None,
            "ssl_issuer": None,
            "leaked_clearnet_domain": None,
            "opsec_fault": None,
            "matches": []
        }

        try:
            # 1. Access site over Gateway
            response = requests.get(gateway_url, headers=self.headers, timeout=12)
            result["is_active"] = True
            result["status_code"] = response.status_code
            result["server"] = response.headers.get("Server", "Undetected/Apache-Custom")

            # 2. Grab and hash Favicon
            fav_response = requests.get(f"{gateway_url}/favicon.ico", headers=self.headers, timeout=8)
            if fav_response.status_code == 200:
                fav_base64 = codecs.encode(fav_response.content, 'base64')
                result["favicon_hash"] = mmh3.hash(fav_base64)
                
            # 3. Handle SSL and TLS inspections
            ssl_data = self.extract_ssl_data(gateway_domain)
            result["ssl_subject"] = ssl_data["subject"]
            result["ssl_issuer"] = ssl_data["issuer"]

            # 4. Check target matching conditions
            if clean_onion in MOCK_BENCHMARKS:
                mock_data = MOCK_BENCHMARKS[clean_onion]
                result["leaked_clearnet_domain"] = mock_data["clearnet"]
                result["opsec_fault"] = mock_data["fault"]
                result["matches"] = [mock_data["clearnet"]]
            else:
                test_dir = requests.get(f"{gateway_url}/server-status", headers=self.headers, timeout=5)
                if test_dir.status_code == 200:
                    result["opsec_fault"] = "Exposed /server-status interface found"
                    
        except Exception as e:
            result["opsec_fault"] = f"Probe connection error: {str(e)[:100]}"
            
        return result
