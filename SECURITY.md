# Security

Do not open a public issue for a vulnerability, a leaked key, or a bug that lets someone read profiles without consent.

Open a private report in [Security Advisories](https://github.com/pablojhdcoder/IntroMesh/security/advisories/new) with:

- which component is affected
- what someone could do with the bug
- the minimum steps to reproduce it, without real data from other people

If you pasted `MODEL_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, or another key in a commit, issue, or log, say so in that report and rotate the key. Do not include the key in the message.

Covered versions are those on `main`. This repository does not publish the app to npm (`private: true` in `package.json`).
