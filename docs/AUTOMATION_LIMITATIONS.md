# Automation Limitations

- VaultKey does NOT automate arbitrary websites.
- The default `manual` adapter never performs a remote change.
- Automatic mode is only available for integrations that declare `supportsAutomatic: true` via an official, documented provider API.
- When automation is OFF, no job may execute; queued jobs must recheck the persisted setting.
- Opening a provider page does NOT mean the password changed.
- MFA, CAPTCHA, rate limits, and provider security restrictions are never bypassed.
- Passwords are only replaced after explicit user confirmation of the provider-side change.