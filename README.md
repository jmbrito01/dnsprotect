# DNSProtect

DNSProtect is a local DNS Server built for security and privacy.

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
- DNSSEC
  - Change Mode: Force all queries to ask for DNSSEC
  - Block Mode: Set to block all queries that dont ask for DNSSEC or all responses that dont ask answer with DNSSEC
- FUTURE: Handshake.org DNS Name Resolution
- FUTURE: Accept DoH and DoT requests
- FUTURE: DNS-over-QUIC 
- FUTURE: DNS-over-DTLS
- FUTURE: DNSCrypt and Anonymized DNSCrypt
- FUTURE DNS-over-blockchain (https://ens.domains/)
- FUTURE: DNS over Tor

**Performance**
- Query Cache (Use Redis to cache DNS query results respecting TTLs for fast dns resolutions)
- Multi-threading for receiving requests
- Multiple forward servers (Forward Load Balancing)
  - Random Balance Strategy
  - Round Robin Strategy
  - FUTURE: Sticky Sessions

**Development**
- DNS Overrides (Override DNS resolutions for you selected IPs)
- FUTURE: Monitoring (Prometheus)
- FUTURE NAT64
