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

**Privacy**
- Force DoH(Force DNS-over-HTTPS in all DNS queries)
- Force DoT (Force DNS-over-TLS in all DNS queries)
- Domain Black List (used for adblock and no tracking)
- Domain Whitelist (allow only selected domains to be reached and block all else)

**Performance**
- Query Cache (Use Redis to cache DNS query results respecting TTLs for fast dns resolutions)

**Development**
- DNS Overrides (Override DNS resolutions for you selected IPs)

To be implemented in the future:
- NEXT: Monitoring
- NEXT: DNSSEC
- 

