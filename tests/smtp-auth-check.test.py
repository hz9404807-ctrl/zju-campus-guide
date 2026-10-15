"""Offline LOGIN transcript tests; never connect or use real credentials."""
import contextlib, io, json, pathlib, runpy, smtplib, unittest
from unittest.mock import patch

SCRIPT = pathlib.Path(__file__).parents[1] / "supabase/tools/smtp-auth-check.py"

class LoginTranscriptTest(unittest.TestCase):
    def run_transcript(self, replies, password="fixture-only"):
        client = smtplib.SMTP()
        client.esmtp_features = {"auth": "PLAIN LOGIN"}
        client.sock = type("Socket", (), {"version": lambda self: "TLSv1.3"})()
        commands = []
        def command(*args):
            commands.append(args)
            return replies.pop(0)
        client.docmd = command
        client.ehlo = lambda: (250, b"ok")
        client.close = lambda: None
        output = io.StringIO()
        with patch("smtplib.SMTP_SSL", return_value=client), patch("sys.stdin", io.StringIO(json.dumps({"email":"fixture@qq.com", "password":password, "method":"LOGIN"}))), contextlib.redirect_stdout(output):
            runpy.run_path(str(SCRIPT), run_name="__main__")
        raw = output.getvalue()
        self.assertNotIn(password, raw)
        self.assertNotIn("fixture@qq.com", raw)
        return json.loads(raw), commands

    def test_login_challenge_sequence(self):
        result, commands = self.run_transcript([(334,b"VXNlcm5hbWU6"),(334,b"UGFzc3dvcmQ6"),(235,b"ok")])
        self.assertTrue(result["ok"])
        self.assertEqual(commands, [("AUTH","LOGIN"),("Zml4dHVyZUBxcS5jb20=",),("Zml4dHVyZS1vbmx5",)])

    def test_rejection_preserves_smtp_code(self):
        result, _ = self.run_transcript([(535,b"rejected")])
        self.assertEqual(result["code"],535)

    def test_malformed_challenge_is_not_generic(self):
        result, _ = self.run_transcript([(334,b"a")])
        self.assertEqual(result["code"],"AUTH_CHALLENGE_ERROR")

    def test_non_ascii_secret_is_not_generic(self):
        result, _ = self.run_transcript([(334,b"VXNlcm5hbWU6"),(334,b"UGFzc3dvcmQ6")], "fixture-\u4e2d")
        self.assertEqual(result["code"],"INPUT_ENCODING_ERROR")

if __name__ == "__main__":
    unittest.main()
