# DNSProtect

DNSProtect is a DNS Server built for security and privacy.

## Getting Started

Create a config file in your first run running
```bash
dnsprotect setup -o myconfig.json
```
The default configuration should work fine, if you need to customize something, feel free. After all questions, you should see a myconfig.json in the directory you ran the command.

Start the DNS server:
```bash
dnsprotect start -c myconfig.json
```

Now that you have everything running, you can simply set your DNS Server from your PC to `localhost` and everything should start working.


## Features
- Force DoH(DNS-over-HTTPS)
- Force DoT (DNS-over-TLS)
- Blacklist (used for adblock and no tracking)
  - Block Domains
- Whitelist
- Query Cache (respecting TTLs)
- DNS Overrides

To be implemented in the future:
- NEXT: Monitoring
- NEXT: DNSSEC
- 

