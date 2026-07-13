locals {
  app_fqdn = "${var.app_subdomain}.${var.apex_domain}"
}

resource "cloudflare_dns_record" "apex_pages" {
  for_each = toset(var.pages_ipv4_addresses)

  zone_id = var.zone_id
  name    = var.apex_domain
  type    = "A"
  content = each.value
  proxied = var.proxied
  ttl     = var.ttl
  comment = "GitHub Pages docs site (#300)"
}

resource "cloudflare_dns_record" "apex_pages_ipv6" {
  for_each = toset(var.pages_ipv6_addresses)

  zone_id = var.zone_id
  name    = var.apex_domain
  type    = "AAAA"
  content = each.value
  proxied = var.proxied
  ttl     = var.ttl
  comment = "GitHub Pages docs site IPv6 (#300)"
}

resource "cloudflare_dns_record" "app_railway" {
  zone_id = var.zone_id
  name    = local.app_fqdn
  type    = "CNAME"
  content = var.railway_cname_target
  proxied = var.proxied
  ttl     = var.ttl
  comment = "Rustume Cloud API on Railway (#300)"
}
