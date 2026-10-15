"""Read credentials from a private pipe, authenticate to QQ only, never send mail."""
import json, smtplib, ssl, sys
client = None
result = {"stage": "connect", "ok": False}
try:
    data = json.load(sys.stdin)
    email, secret = data["email"], data["password"]
    method = data.get("method", "PLAIN")
    if method not in ("PLAIN", "LOGIN"):
        raise ValueError("Unsupported method")
    context = ssl.create_default_context()
    context.minimum_version = ssl.TLSVersion.TLSv1_2
    client = smtplib.SMTP_SSL("smtp.qq.com", 465, timeout=6, context=context)
    client.ehlo()
    result = {"stage": "auth", "ok": False, "tls": client.sock.version(), "method": method}
    if method not in client.esmtp_features.get("auth", "").upper().split():
        result["code"] = "METHOD_NOT_ADVERTISED"
    else:
        if method == "LOGIN":
            client.user, client.password = email, secret
            status, _ = client.auth("LOGIN", client.auth_login, initial_response_ok=False)
        else:
            status, _ = client.auth("PLAIN", lambda challenge=None: "\0" + email + "\0" + secret)
        result.update(ok=status == 235, code=status)
except smtplib.SMTPAuthenticationError as error:
    result.update(code=error.smtp_code)
except ssl.SSLCertVerificationError:
    result.update(code="CERTIFICATE_ERROR")
except (TimeoutError, OSError):
    result.update(code="NETWORK_ERROR")
except Exception:
    result.update(code="CHECK_FAILED")
finally:
    if client is not None:
        client.close()
    print(json.dumps(result))
