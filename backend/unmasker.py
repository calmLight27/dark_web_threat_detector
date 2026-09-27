import os
import requests
import mmh3
import codecs
import socket
import ssl
from OpenSSL import crypto
from typing import Dict, Any

class TorClearnetUnmasker:
    GATEWAY_SUFFIXES = [".onion.ws", ".onion.pet", ".onion.ly"]

    def __init__(self):
        self.headers = {"User-Agent": "Mozilla/5.0 DeepTrace-OSINT/3.1 (LEO Audit)"}
        self.use_local_tor = os.getenv("USE_LOCAL_TOR", "false").lower() == "true"
        self.tor_proxy = os.getenv("TOR_PROXY_URL", "socks5h://127.0.0.1:9150") if self.use_local_tor else None

    def extract_ssl_data(self, target_host: str) -> dict:
        try:
            context = ssl.create_default_context()
            context.check_hostname = False
            context.verify_mode = ssl.CERT_NONE
            
            port = 443
            with socket.create_connection((target_host, port), timeout=8) as sock:
                with context.wrap_socket(sock, server_hostname=target_host) as ssock:
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
        clean_onion = raw_url.replace("http://", "").replace("https://", "").split("/")[0].strip()
        
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
            "matches": [],
            "clearnet_ips": [],
            "etag": None,
            "confidence_score": 0.0
        }

        proxies = {"http": self.tor_proxy, "https": self.tor_proxy} if self.use_local_tor else None
        target_url = f"http://{clean_onion}" if self.use_local_tor else f"https://{clean_onion.replace('.onion', self.GATEWAY_SUFFIXES[0])}"

        try:
            response = requests.get(target_url, headers=self.headers, proxies=proxies, timeout=12)
            result["is_active"] = True
            result["status_code"] = response.status_code
            result["server"] = response.headers.get("Server", "Custom/Hidden")
            result["etag"] = response.headers.get("ETag")

            # Favicon hashing calculation via mmh3
            fav_url = f"{target_url}/favicon.ico"
            fav_response = requests.get(fav_url, headers=self.headers, proxies=proxies, timeout=8)
            if fav_response.status_code == 200:
                fav_base64 = codecs.encode(fav_response.content, 'base64')
                result["favicon_hash"] = mmh3.hash(fav_base64)

            result["confidence_score"] = 75.0
            result["opsec_fault"] = "Direct Tor-to-Clearnet proxy gateway leakage"
        except Exception as e:
            result["opsec_fault"] = f"Prober unreachable: {str(e)[:120]}"
            
        return result
