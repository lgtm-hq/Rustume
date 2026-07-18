# Cloudflare DNS module

DNS records for `rustume.com`: apex → GitHub Pages, `app` → Railway custom domain.

## Usage

```hcl
module "dns" {
  source = "../modules/cloudflare-dns"

  zone_id              = var.cloudflare_zone_id
  railway_cname_target = "responsible-celebration-production-8280.up.railway.app"
}
```

## Custom hostnames

`custom_hostname_placeholder` output documents the hook for
[#336](https://github.com/lgtm-hq/Rustume/issues/336). Add `cloudflare_custom_hostname`
resources in a follow-up when tenant domains are codified.
